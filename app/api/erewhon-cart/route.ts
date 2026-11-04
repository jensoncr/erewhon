import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type {
  ItemConfiguration,
  ModifierGroup,
  ModifierSize,
  ProductOptions,
} from "@/lib/erewhon";

const EREWHON_API = "https://ordersapi.enfmkt.com/v1";
const PRIMARY_CART_TYPE_ID = "67c190abcf94f13b74707c27";

const STORE_IDS: Record<string, string> = {
  GROVE: "636a427456fb922c0cbeadd0",
  BH: "61c1d17c3e90950a6f208514",
  CBS: "61c1d5623e90950a6f20851d",
  CC: "649b0ed8138687eddcf96b7d",
  GD: "681ba4298279d3f311efc577",
  MB: "672551f730f233ef2f9b0ccd",
  PAS: "64beaf82c6b1fb92e4c51b87",
  SM: "638893331689c01ed824ce07",
  SL: "638899561689c01ed824ce08",
  SC: "6388a1d51689c01ed824ce09",
  VEN: "6388a2a91689c01ed824ce0a",
  WH: "681bad628279d3f311efce7b",
};

type ApiEnvelope = {
  error?: number | { message?: string };
  message?: string;
};

type RawModifier = {
  _id?: string;
  name?: string;
  label?: string;
  price?: number | string;
  maximum?: number | string;
  status?: string;
  [key: string]: unknown;
};

type RawModifierSet = {
  _id?: string;
  name?: string;
  label?: string;
  type?: string;
  minimum?: number | string;
  maximum?: number | string;
  required?: boolean | string;
  status?: string;
  modifiers?: RawModifier[];
  [key: string]: unknown;
};

type RawModifierContainer = {
  modifier_sets?: RawModifierSet[];
};

type RawModifierSize = RawModifier & {
  modifier_groups?: RawModifierContainer | unknown[];
};

type RawProduct = {
  _id?: string;
  internal_product_id?: string;
  name?: string;
  in_stock?: boolean;
  is_available?: string;
  modifier_groups?: RawModifierContainer | unknown[];
  modifier_size?: RawModifierSize[];
};

type ProductResponse = ApiEnvelope & {
  product?: RawProduct;
};

type AddResponse = ApiEnvelope & {
  cart_id?: string | { _id?: string };
};

type CartModifier = {
  _id?: string;
  quantity?: number;
};

type CartModifierGroup = {
  _id?: string;
  modifiers?: CartModifier[];
};

type CartProduct = {
  available?: boolean;
  quantity?: number;
  modifier_size_id?: string;
  selected_modifiers?: CartModifierGroup[];
  product?: {
    internal_product_id?: string;
    name?: string;
    in_stock?: boolean;
  };
};

type CartResponse = ApiEnvelope & {
  cart?: {
    store_id?: string;
    all_product_available?: boolean;
    departments?: Array<{ products?: CartProduct[] }>;
  };
};

type ResolvedSelection = {
  groupId: string;
  optionId: string;
  quantity: number;
};

type ResolvedProduct = {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  modifierSizeId?: string;
  modifierSets?: RawModifierSet[];
  selections: ResolvedSelection[];
  configurationDescription: string;
};

class TransferError extends Error {
  status: number;
  /** Erewhon's own numeric error code, when the failure came from their API. */
  code?: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "TransferError";
    this.status = status;
  }
}

// Erewhon answers getproduct with this code both for products that don't
// exist and for ones that are off today's menu or out of stock. Either way
// the item is not orderable right now, which is a 409 for callers, not a
// transfer fault.
const EREWHON_PRODUCT_UNAVAILABLE = 4;

// Erewhon product ids are numeric but not fixed-width: single items are 8-10
// digits while multipacks and bundles concatenate two ids into 19-20. The
// guard exists to keep anything non-numeric out of the form-encoded body, so
// the ceiling just needs headroom over the longest real id.
const PRODUCT_ID = /^\d{6,24}$/;

function apiErrorMessage(payload: ApiEnvelope): string | null {
  if (payload.error === undefined || payload.error === 0) return null;
  if (typeof payload.error === "object" && payload.error.message) {
    return payload.error.message;
  }
  return payload.message || "Erewhon rejected the cart update";
}

async function postForm<T extends ApiEnvelope>(
  path: string,
  fields: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${EREWHON_API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new TransferError(`Erewhon returned ${response.status}`);
  }

  const payload = (await response.json()) as T;
  const apiError = apiErrorMessage(payload);
  if (apiError) {
    const error = new TransferError(apiError);
    if (typeof payload.error === "number") error.code = payload.error;
    throw error;
  }
  return payload;
}

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Math.floor(finiteNumber(value, fallback));
  return parsed >= 0 ? parsed : fallback;
}

function modifierSets(
  container: RawModifierContainer | unknown[] | undefined,
): RawModifierSet[] {
  if (!container || Array.isArray(container)) return [];
  return Array.isArray(container.modifier_sets)
    ? container.modifier_sets
    : [];
}

function normalizeGroups(rawGroups: RawModifierSet[]): ModifierGroup[] {
  return rawGroups.flatMap((group) => {
    if (
      group.status === "inactive" ||
      !group._id ||
      !/^[a-f0-9]{24}$/.test(group._id)
    ) {
      return [];
    }
    const choices = (group.modifiers || []).flatMap((choice) => {
      const label = choice.label || choice.name;
      if (
        choice.status === "inactive" ||
        !choice._id ||
        !/^[a-f0-9]{24}$/.test(choice._id) ||
        !label
      ) {
        return [];
      }
      return [
        {
          id: choice._id,
          label,
          price: finiteNumber(choice.price),
          maximum: Math.max(1, positiveInteger(choice.maximum, 1)),
        },
      ];
    });
    if (choices.length === 0) return [];

    const type = group.type === "checkbox" ? "checkbox" : "radio";
    const minimum = positiveInteger(group.minimum, 0);
    const maximum = Math.max(
      minimum,
      positiveInteger(group.maximum, type === "radio" ? 1 : choices.length),
    );
    return [
      {
        id: group._id,
        label: group.label || group.name || "Choose options",
        type,
        minimum,
        maximum,
        choices,
      },
    ];
  });
}

function normalizeModifierSizes(product: RawProduct): ModifierSize[] {
  if (!Array.isArray(product.modifier_size)) return [];
  return product.modifier_size.flatMap((size) => {
    const label = size.label || size.name;
    if (
      size.status === "inactive" ||
      !size._id ||
      !/^[a-f0-9]{24}$/.test(size._id) ||
      !label
    ) {
      return [];
    }
    return [
      {
        id: size._id,
        label,
        price: finiteNumber(size.price),
        groups: normalizeGroups(modifierSets(size.modifier_groups)),
      },
    ];
  });
}

async function getRawProduct(
  productId: string,
  storeId: string,
): Promise<RawProduct> {
  let payload: ProductResponse;
  try {
    payload = await postForm<ProductResponse>("getproduct", {
      internal_product_id: productId,
      cart_type_id: PRIMARY_CART_TYPE_ID,
      store_id: storeId,
    });
  } catch (error) {
    if (
      error instanceof TransferError &&
      error.code === EREWHON_PRODUCT_UNAVAILABLE
    ) {
      error.status = 409;
    }
    throw error;
  }
  const product = payload.product;
  if (!product?._id || !/^[a-f0-9]{24}$/.test(product._id)) {
    throw new TransferError(`Erewhon could not find product ${productId}`, 409);
  }
  if (product.in_stock === false || product.is_available === "false") {
    throw new TransferError(
      `${product.name || productId} is no longer available`,
      409,
    );
  }
  return product;
}

function productOptions(product: RawProduct, productId: string): ProductOptions {
  const groups = normalizeGroups(modifierSets(product.modifier_groups));
  const modifierSizes = normalizeModifierSizes(product);
  return {
    productId,
    productName: product.name || productId,
    groups,
    modifierSizes,
    requiresSelection:
      modifierSizes.length > 0 || groups.some((group) => group.minimum > 0),
  };
}

function prepareConfiguration(
  product: RawProduct,
  productName: string,
  configuration: ItemConfiguration | undefined,
): Pick<
  ResolvedProduct,
  | "modifierSizeId"
  | "modifierSets"
  | "selections"
  | "configurationDescription"
> {
  const sizes = Array.isArray(product.modifier_size)
    ? product.modifier_size.filter(
        (size) => size._id && size.status !== "inactive",
      )
    : [];
  let selectedSize: RawModifierSize | undefined;
  let rawGroups: RawModifierSet[];

  if (sizes.length > 0) {
    if (!configuration?.modifierSize) {
      throw new TransferError(
        `${productName} needs a main choice before transfer. Reopen the order and choose its options.`,
        409,
      );
    }
    selectedSize = sizes.find(
      (size) => size._id === configuration.modifierSize?.id,
    );
    if (!selectedSize?._id) {
      throw new TransferError(
        `${productName}'s selected option is no longer available. Reopen the order and choose again.`,
        409,
      );
    }
    rawGroups = modifierSets(selectedSize.modifier_groups);
  } else {
    if (configuration?.modifierSize) {
      throw new TransferError(
        `${productName}'s options changed. Reopen the order and choose again.`,
        409,
      );
    }
    rawGroups = modifierSets(product.modifier_groups);
  }

  const storedSelections = configuration?.selections || [];
  const selectionLookup = new Map(
    storedSelections.map((selection) => [
      `${selection.groupId}:${selection.optionId}`,
      selection.quantity,
    ]),
  );
  const usedSelections = new Set<string>();
  const resolvedSelections: ResolvedSelection[] = [];
  const description = selectedSize
    ? [selectedSize.label || selectedSize.name || "Selected option"]
    : [];

  const configuredGroups = rawGroups.map((group) => {
    const minimum = positiveInteger(group.minimum, 0);
    const maximum = Math.max(minimum, positiveInteger(group.maximum, 1));
    let total = 0;
    let selectedChoiceCount = 0;
    const modifiers = (group.modifiers || []).map((choice) => {
      const key = `${group._id}:${choice._id}`;
      const quantity = selectionLookup.get(key) || 0;
      if (quantity > 0) {
        const choiceMaximum = Math.max(
          1,
          positiveInteger(choice.maximum, maximum),
        );
        if (quantity > choiceMaximum) {
          throw new TransferError(
            `${productName}'s ${group.label || group.name || "option"} quantity is no longer available.`,
            409,
          );
        }
        total += quantity;
        selectedChoiceCount += 1;
        usedSelections.add(key);
        resolvedSelections.push({
          groupId: group._id || "",
          optionId: choice._id || "",
          quantity,
        });
        description.push(
          `${choice.label || choice.name || "Selected option"}${quantity > 1 ? ` ×${quantity}` : ""}`,
        );
      }
      return { ...choice, is_selected: quantity > 0, count: quantity };
    });

    if (
      total < minimum ||
      total > maximum ||
      (group.type === "radio" && selectedChoiceCount > 1)
    ) {
      throw new TransferError(
        `${productName} needs ${group.label || group.name || "another option"} before transfer. Reopen the order and choose again.`,
        409,
      );
    }

    return {
      ...group,
      modifiers,
      total_items_count: total,
      ...(total > 0 ? { is_added: true, is_updated: true } : {}),
    };
  });

  if (usedSelections.size !== storedSelections.length) {
    throw new TransferError(
      `${productName}'s options changed. Reopen the order and choose again.`,
      409,
    );
  }

  return {
    modifierSizeId: selectedSize?._id,
    modifierSets: configuredGroups.length > 0 ? configuredGroups : undefined,
    selections: resolvedSelections,
    configurationDescription: description.join(", "),
  };
}

async function resolveProduct(
  productId: string,
  qty: number,
  storeId: string,
  configuration: ItemConfiguration | undefined,
): Promise<ResolvedProduct> {
  const product = await getRawProduct(productId, storeId);
  const productName = product.name || productId;
  const configured = prepareConfiguration(
    product,
    productName,
    configuration,
  );

  return {
    id: product._id || "",
    productId,
    productName,
    qty,
    ...configured,
  };
}

async function addProduct(
  product: ResolvedProduct,
  cartId?: string,
): Promise<string> {
  const payload = await postForm<AddResponse>(`addtocart/${product.id}`, {
    ...(cartId ? { cart_id: cartId } : {}),
    cart_type_id: PRIMARY_CART_TYPE_ID,
    product_quantity: String(product.qty),
    ...(product.modifierSizeId
      ? { modifier_size_id: product.modifierSizeId }
      : {}),
    ...(product.modifierSets
      ? { modifier_sets: JSON.stringify(product.modifierSets) }
      : {}),
    screen_name: "group-order-transfer",
    screen_url: "https://erewhon.com/cart",
    is_mobile: "false",
  });

  const responseCartId =
    typeof payload.cart_id === "string"
      ? payload.cart_id
      : payload.cart_id?._id;
  const nextCartId = responseCartId || cartId;
  if (!nextCartId || !/^[a-f0-9]{24}$/.test(nextCartId)) {
    throw new TransferError("Erewhon did not return a usable cart");
  }
  return nextCartId;
}

function flattenCartProducts(cart: CartResponse): CartProduct[] {
  return (cart.cart?.departments || []).flatMap(
    (department) => department.products || [],
  );
}

function configurationSignature(
  modifierSizeId: string | undefined,
  selections: ResolvedSelection[],
): string {
  const selected = [...selections]
    .sort((a, b) =>
      `${a.groupId}:${a.optionId}`.localeCompare(`${b.groupId}:${b.optionId}`),
    )
    .map(
      (selection) =>
        `${selection.groupId}:${selection.optionId}:${selection.quantity}`,
    )
    .join(",");
  return `${modifierSizeId || ""}|${selected}`;
}

function cartConfigurationSignature(entry: CartProduct): string {
  const selections = (entry.selected_modifiers || []).flatMap((group) =>
    (group.modifiers || []).flatMap((modifier) => {
      if (!group._id || !modifier._id) return [];
      return [
        {
          groupId: group._id,
          optionId: modifier._id,
          quantity: Number(modifier.quantity) || 0,
        },
      ];
    }),
  );
  return configurationSignature(entry.modifier_size_id, selections);
}

async function verifyCart(
  cartId: string,
  storeId: string,
  requested: ResolvedProduct[],
): Promise<void> {
  const payload = await postForm<CartResponse>("usercart", {
    cart_id: cartId,
    cart_type_id: PRIMARY_CART_TYPE_ID,
  });

  if (payload.cart?.store_id !== storeId) {
    throw new TransferError("Erewhon did not keep the selected store");
  }

  const remaining = flattenCartProducts(payload);
  const missing: ResolvedProduct[] = [];
  const unavailable: ResolvedProduct[] = [];
  for (const item of requested) {
    const expectedSignature = configurationSignature(
      item.modifierSizeId,
      item.selections,
    );
    const index = remaining.findIndex(
      (entry) =>
        entry.product?.internal_product_id === item.productId &&
        Number(entry.quantity) === item.qty &&
        cartConfigurationSignature(entry) === expectedSignature,
    );
    if (index === -1) {
      missing.push(item);
      continue;
    }
    const [entry] = remaining.splice(index, 1);
    if (entry.available === false || entry.product?.in_stock === false) {
      unavailable.push(item);
    }
  }

  if (missing.length > 0) {
    throw new TransferError(
      `Erewhon did not preserve: ${missing
        .map((item) =>
          [item.productName, item.configurationDescription]
            .filter(Boolean)
            .join(" — "),
        )
        .join(", ")}`,
    );
  }
  if (payload.cart?.all_product_available === false || unavailable.length > 0) {
    throw new TransferError(
      `No longer available: ${unavailable.map((item) => item.productName).join(", ") || "one or more products"}`,
      409,
    );
  }
}

function storedConfigurationKey(configuration: ItemConfiguration | undefined) {
  if (!configuration) return "";
  return configurationSignature(
    configuration.modifierSize?.id,
    configuration.selections.map((selection) => ({
      groupId: selection.groupId,
      optionId: selection.optionId,
      quantity: selection.quantity,
    })),
  );
}

function errorResponse(error: unknown) {
  if (error instanceof TransferError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("Erewhon cart transfer failed", error);
  return Response.json(
    { error: "The Erewhon cart transfer failed. Please try again." },
    { status: 502 },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId") || "";
    const storeKey = url.searchParams.get("storeKey") || "";
    if (!PRODUCT_ID.test(productId)) {
      throw new TransferError("Invalid product", 400);
    }
    const storeId = STORE_IDS[storeKey];
    if (!storeId) throw new TransferError("Unsupported Erewhon store", 400);
    const product = await getRawProduct(productId, storeId);
    return Response.json(productOptions(product, productId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: unknown; token?: unknown };
    if (typeof body.code !== "string" || typeof body.token !== "string") {
      throw new TransferError("Missing order credentials", 400);
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) throw new TransferError("Convex is not configured", 500);

    const convex = new ConvexHttpClient(convexUrl);
    const data = await convex.query(api.orders.get, {
      code: body.code,
      token: body.token,
    });

    if (!data) throw new TransferError("Order not found", 404);
    if (!data.isOrganizer) {
      throw new TransferError("Only the organizer can transfer this cart", 403);
    }
    if (data.order.status !== "locked") {
      throw new TransferError("Lock the order before transferring it", 409);
    }

    const storeId = STORE_IDS[data.order.storeKey];
    if (!storeId) throw new TransferError("Unsupported Erewhon store", 409);

    const grouped = new Map<
      string,
      { productId: string; qty: number; configuration?: ItemConfiguration }
    >();
    for (const item of data.items) {
      if (!PRODUCT_ID.test(item.productId)) {
        throw new TransferError(`Invalid product ID ${item.productId}`, 409);
      }
      const key = `${item.productId}:${item.configurationKey || storedConfigurationKey(item.configuration)}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.qty += item.qty;
      } else {
        grouped.set(key, {
          productId: item.productId,
          qty: item.qty,
          configuration: item.configuration,
        });
      }
    }

    if (grouped.size === 0) {
      throw new TransferError("The group cart is empty", 409);
    }
    if (grouped.size > 75) {
      throw new TransferError("This order has too many distinct items", 409);
    }
    for (const item of grouped.values()) {
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
        throw new TransferError(
          "A product quantity is outside Erewhon limits",
          409,
        );
      }
    }

    const resolved = await Promise.all(
      [...grouped.values()].map((item) =>
        resolveProduct(
          item.productId,
          item.qty,
          storeId,
          item.configuration,
        ),
      ),
    );

    let cartId = await addProduct(resolved[0]);
    await postForm<ApiEnvelope>("default_stores", {
      cart_id: cartId,
      cart_type_id: PRIMARY_CART_TYPE_ID,
      store_id: storeId,
    });

    for (const product of resolved.slice(1)) {
      cartId = await addProduct(product, cartId);
    }

    await verifyCart(cartId, storeId, resolved);

    const productCount = resolved.reduce((sum, product) => sum + product.qty, 0);
    const handoff = new URL("https://erewhon.com/cart");
    handoff.hash = new URLSearchParams({
      "group-cart": cartId,
      count: String(productCount),
    }).toString();

    return Response.json({
      handoffUrl: handoff.toString(),
      productCount,
      distinctProductCount: resolved.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
