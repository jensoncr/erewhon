import { mutation, query } from "./_generated/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

const orderStatusValidator = v.union(
  v.literal("open"),
  v.literal("locked"),
  v.literal("placed"),
);

const publicOrderValidator = v.object({
  _id: v.id("orders"),
  _creationTime: v.number(),
  name: v.string(),
  storeKey: v.string(),
  code: v.string(),
  organizerName: v.string(),
  deadline: v.optional(v.number()),
  status: orderStatusValidator,
});

const itemConfigurationValidator = v.object({
  modifierSize: v.optional(
    v.object({
      id: v.string(),
      label: v.string(),
      price: v.number(),
    }),
  ),
  selections: v.array(
    v.object({
      groupId: v.string(),
      groupLabel: v.string(),
      optionId: v.string(),
      optionLabel: v.string(),
      price: v.number(),
      quantity: v.number(),
    }),
  ),
});

type ItemConfiguration = {
  modifierSize?: { id: string; label: string; price: number };
  selections: Array<{
    groupId: string;
    groupLabel: string;
    optionId: string;
    optionLabel: string;
    price: number;
    quantity: number;
  }>;
};

function toPublicOrder(order: Doc<"orders">) {
  return {
    _id: order._id,
    _creationTime: order._creationTime,
    name: order.name,
    storeKey: order.storeKey,
    code: order.code,
    organizerName: order.organizerName,
    deadline: order.deadline,
    status: order.status,
  };
}

const MAX_ORDERS_PER_HOUR = 100;
const MAX_ITEMS_PER_ORDER = 300;
const MAX_TEXT_LENGTH = 500;
const MIN_TOKEN_LENGTH = 16;
const MAX_TOKEN_LENGTH = 128;

function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = "";
  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return code;
}

function assertToken(token: string): void {
  if (token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH) {
    throw new Error("Invalid token");
  }
}

function assertTextLengths(...values: string[]): void {
  if (values.some((value) => value.length > MAX_TEXT_LENGTH)) {
    throw new Error("Text is too long");
  }
}

function sanitizeQty(qty: number): number {
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    throw new Error("Quantity must be between 1 and 99");
  }
  return qty;
}

function sanitizeConfiguration(
  configuration: ItemConfiguration | undefined,
): ItemConfiguration | undefined {
  if (!configuration) return undefined;
  if (configuration.selections.length > 60) {
    throw new Error("Too many product options");
  }

  const cleanPrice = (price: number) => {
    if (!Number.isFinite(price) || price < 0 || price > 1_000) {
      throw new Error("Invalid option price");
    }
    return price;
  };
  const cleanId = (id: string) => {
    if (!/^[a-f0-9]{24}$/.test(id)) throw new Error("Invalid product option");
    return id;
  };
  const cleanLabel = (label: string) => label.trim().slice(0, 160);

  const seen = new Set<string>();
  const selections = configuration.selections.map((selection) => {
    const groupId = cleanId(selection.groupId);
    const optionId = cleanId(selection.optionId);
    const key = `${groupId}:${optionId}`;
    if (seen.has(key)) throw new Error("Duplicate product option");
    seen.add(key);
    if (
      !Number.isInteger(selection.quantity) ||
      selection.quantity < 1 ||
      selection.quantity > 99
    ) {
      throw new Error("Invalid option quantity");
    }
    return {
      groupId,
      groupLabel: cleanLabel(selection.groupLabel),
      optionId,
      optionLabel: cleanLabel(selection.optionLabel),
      price: cleanPrice(selection.price),
      quantity: selection.quantity,
    };
  });

  const modifierSize = configuration.modifierSize
    ? {
        id: cleanId(configuration.modifierSize.id),
        label: cleanLabel(configuration.modifierSize.label),
        price: cleanPrice(configuration.modifierSize.price),
      }
    : undefined;

  if (!modifierSize && selections.length === 0) return undefined;
  return { modifierSize, selections };
}

function configurationKey(configuration: ItemConfiguration | undefined) {
  if (!configuration) return undefined;
  const selections = [...configuration.selections]
    .sort((a, b) =>
      `${a.groupId}:${a.optionId}`.localeCompare(`${b.groupId}:${b.optionId}`),
    )
    .map(
      (selection) =>
        `${selection.groupId}:${selection.optionId}:${selection.quantity}`,
    )
    .join(",");
  return `${configuration.modifierSize?.id ?? ""}|${selections}`;
}

function assertOpen(order: Doc<"orders">) {
  if (order.status !== "open") {
    throw new Error("This order is locked");
  }
  if (order.deadline !== undefined && Date.now() > order.deadline) {
    throw new Error("The deadline for this order has passed");
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    storeKey: v.string(),
    organizerName: v.string(),
    token: v.string(),
    deadline: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const organizerName = args.organizerName.trim();
    if (!name || !organizerName) throw new Error("Name is required");
    assertToken(args.token);
    assertTextLengths(name, organizerName, args.storeKey);
    const recentOrders = await ctx.db
      .query("orders")
      .withIndex("by_creation_time", (q) =>
        q.gt("_creationTime", Date.now() - 60 * 60 * 1000),
      )
      .take(MAX_ORDERS_PER_HOUR);
    if (recentOrders.length >= MAX_ORDERS_PER_HOUR) {
      throw new Error("Too many new orders right now. Try again later");
    }
    const code = makeCode();
    await ctx.db.insert("orders", {
      name,
      storeKey: args.storeKey,
      code,
      organizerName,
      organizerToken: args.token,
      deadline: args.deadline,
      status: "open",
    });
    return code;
  },
});

export const get = query({
  args: { code: v.string(), token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      order: publicOrderValidator,
      items: v.array(
        v.object({
          _id: v.id("items"),
          _creationTime: v.number(),
          orderId: v.id("orders"),
          addedBy: v.string(),
          productId: v.string(),
          productName: v.string(),
          brand: v.string(),
          category: v.string(),
          size: v.string(),
          price: v.number(),
          image: v.string(),
          qty: v.number(),
          note: v.optional(v.string()),
          configurationKey: v.optional(v.string()),
          configuration: v.optional(itemConfigurationValidator),
          surprise: v.optional(v.boolean()),
          mine: v.boolean(),
        }),
      ),
      isOrganizer: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (!order) return null;
    const items = await ctx.db
      .query("items")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    // Strip organizerToken so clients can't read it and impersonate the organizer.
    const publicOrder = toPublicOrder(order);
    const isOrganizer = order.organizerToken === args.token;
    return {
      order: publicOrder,
      items: items.map(({ token, ...item }) => {
        const mine = token === args.token;
        // Surprise items stay a mystery to everyone but the organizer — the
        // masking must happen here so the product never reaches other clients.
        if (item.surprise && !isOrganizer) {
          return {
            ...item,
            // Unique per item so locked-order views don't merge mysteries.
            productId: `mystery-${item._id}`,
            productName: "Mystery item",
            brand: "",
            category: "Mystery",
            size: "",
            image: "",
            mine,
          };
        }
        return { ...item, mine };
      }),
      isOrganizer,
    };
  },
});

export const listForOrganizer = query({
  args: {
    token: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(publicOrderValidator),
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("orders")
      .withIndex("by_organizer_token", (q) =>
        q.eq("organizerToken", args.token),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...results,
      // Never expose the organizer credential in query results.
      page: results.page.map(toPublicOrder),
    };
  },
});

export const setStatus = mutation({
  args: {
    orderId: v.id("orders"),
    token: v.string(),
    status: orderStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.organizerToken !== args.token) {
      throw new Error("Only the organizer can change the order status");
    }
    await ctx.db.patch(args.orderId, { status: args.status });
    if (
      args.status === "open" &&
      order.deadline !== undefined &&
      Date.now() > order.deadline
    ) {
      // Reopening past the deadline clears it, otherwise adds stay rejected.
      await ctx.db.patch(args.orderId, { deadline: undefined });
    }
  },
});

export const deleteOrder = mutation({
  args: {
    orderId: v.id("orders"),
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.organizerToken !== args.token) {
      throw new Error("Only the organizer can delete this order");
    }

    const items = await ctx.db
      .query("items")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .take(1_001);
    if (items.length > 1_000) {
      throw new Error("This order is too large to delete in one step");
    }
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(order._id);
    return null;
  },
});

export const addItem = mutation({
  args: {
    orderId: v.id("orders"),
    token: v.string(),
    addedBy: v.string(),
    productId: v.string(),
    productName: v.string(),
    brand: v.string(),
    category: v.string(),
    size: v.string(),
    price: v.number(),
    image: v.string(),
    qty: v.number(),
    configuration: v.optional(itemConfigurationValidator),
    surprise: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    assertOpen(order);
    assertToken(args.token);
    assertTextLengths(
      args.addedBy,
      args.productId,
      args.productName,
      args.brand,
      args.category,
      args.size,
      args.image,
    );
    const qty = sanitizeQty(args.qty);
    if (!Number.isFinite(args.price) || args.price < 0) {
      throw new Error("Invalid price");
    }
    const configuration = sanitizeConfiguration(args.configuration);
    const configKey = configurationKey(configuration);
    const existing = await ctx.db
      .query("items")
      .withIndex("by_order_token_product_and_configuration", (q) =>
        q
          .eq("orderId", args.orderId)
          .eq("token", args.token)
          .eq("productId", args.productId)
          .eq("configurationKey", configKey),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        qty: Math.min(existing.qty + qty, 99),
      });
      return;
    }
    const orderItems = await ctx.db
      .query("items")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .take(MAX_ITEMS_PER_ORDER);
    if (orderItems.length >= MAX_ITEMS_PER_ORDER) {
      throw new Error("This order is full");
    }
    await ctx.db.insert("items", {
      orderId: args.orderId,
      token: args.token,
      addedBy: args.addedBy.trim() || "Someone",
      productId: args.productId,
      productName: args.productName,
      brand: args.brand,
      category: args.category,
      size: args.size,
      price: args.price,
      image: args.image,
      qty,
      configurationKey: configKey,
      configuration,
      surprise: args.surprise,
    });
  },
});

async function getEditableItem(
  ctx: MutationCtx,
  itemId: Id<"items">,
  token: string,
) {
  const item = await ctx.db.get(itemId);
  if (!item) throw new Error("Item not found");
  const order = await ctx.db.get(item.orderId);
  if (!order) throw new Error("Order not found");
  const isOrganizer = order.organizerToken === token;
  if (item.token !== token && !isOrganizer) {
    throw new Error("You can only edit your own items");
  }
  // The organizer may fix items even after lock; everyone else only while open.
  if (!isOrganizer) assertOpen(order);
  return item;
}

export const updateItem = mutation({
  args: {
    itemId: v.id("items"),
    token: v.string(),
    qty: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await getEditableItem(ctx, args.itemId, args.token);
    const patch: { qty?: number; note?: string } = {};
    if (args.qty !== undefined) patch.qty = sanitizeQty(args.qty);
    if (args.note !== undefined) patch.note = args.note.slice(0, 200);
    await ctx.db.patch(item._id, patch);
  },
});

export const removeItem = mutation({
  args: { itemId: v.id("items"), token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await getEditableItem(ctx, args.itemId, args.token);
    await ctx.db.delete(item._id);
  },
});
