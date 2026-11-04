const TRUSTED_GROUP_ORDER_ORIGINS = new Set([
  "https://erewhon-alpha.vercel.app",
  "https://jensons2ndlunch.store",
  "https://www.jensons2ndlunch.store",
]);
const HANDOFF_TTL_MS = 2 * 60 * 1000;
const STORAGE_KEY = "pendingCartHandoff";
const EREWHON_API = "https://ordersapi.enfmkt.com/v1";
const PRIMARY_CART_TYPE_ID = "67c190abcf94f13b74707c27";
const ORDER_TAB_PATTERNS = [
  "https://erewhon-alpha.vercel.app/o/*",
  "https://jensons2ndlunch.store/o/*",
  "https://www.jensons2ndlunch.store/o/*",
];

async function connectAlreadyOpenOrderTabs() {
  const tabs = await chrome.tabs.query({ url: ORDER_TAB_PATTERNS });
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined) return;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["presence.js"],
        });
      } catch {
        // A tab may close or navigate between the query and injection.
      }
    }),
  );
}

function isCartId(value) {
  return typeof value === "string" && /^[a-f0-9]{24}$/.test(value);
}

function senderUrl(sender) {
  try {
    return new URL(sender.url || "");
  } catch {
    return null;
  }
}

function apiErrorMessage(payload) {
  if (payload?.error === undefined || payload.error === 0) return null;
  if (typeof payload.error === "object" && payload.error?.message) {
    return payload.error.message;
  }
  return payload?.message || "Erewhon rejected the cart update";
}

async function postForm(path, fields, authToken, allowEmpty = false) {
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    "device-type": "web",
    "app-version": "5.0.0",
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(`${EREWHON_API}/${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(fields),
  });
  if (!response.ok) throw new Error(`Erewhon returned ${response.status}`);

  const payload = await response.json();
  const apiError = apiErrorMessage(payload);
  if (apiError && !allowEmpty) throw new Error(apiError);
  return payload;
}

function flattenCartProducts(payload) {
  return (payload?.cart?.departments || []).flatMap(
    (department) => department.products || [],
  );
}

function selectedModifierQuantity(modifier) {
  return Number(modifier?.quantity) || Number(modifier?.count) || 0;
}

function configurationSignature(entry) {
  const selected = (entry?.selected_modifiers || [])
    .flatMap((group) =>
      (group?.modifiers || []).flatMap((modifier) => {
        if (!isCartId(group?._id) || !isCartId(modifier?._id)) return [];
        return [
          `${group._id}:${modifier._id}:${selectedModifierQuantity(modifier)}`,
        ];
      }),
    )
    .sort()
    .join(",");
  return `${isCartId(entry?.modifier_size_id) ? entry.modifier_size_id : ""}|${selected}`;
}

function cartLineKey(entry) {
  return `${entry?.product?.internal_product_id || ""}:${configurationSignature(entry)}`;
}

function cartQuantities(payload) {
  const quantities = new Map();
  for (const entry of flattenCartProducts(payload)) {
    const key = cartLineKey(entry);
    quantities.set(key, (quantities.get(key) || 0) + (Number(entry.quantity) || 0));
  }
  return quantities;
}

function responseCartId(payload, fallback) {
  const candidate =
    typeof payload?.cart_id === "string"
      ? payload.cart_id
      : payload?.cart_id?._id;
  return isCartId(candidate) ? candidate : fallback;
}

function modifierSets(item) {
  if (!item.selectedModifiers.length) return undefined;
  return item.selectedModifiers.map((group) => {
    const modifiers = group.modifiers.map((modifier) => {
      const quantity = selectedModifierQuantity(modifier);
      return {
        ...modifier,
        quantity,
        count: quantity,
        is_selected: true,
      };
    });
    return {
      ...group,
      quantity: modifiers.reduce(
        (total, modifier) => total + modifier.quantity,
        0,
      ),
      total_items_count: modifiers.reduce(
        (total, modifier) => total + modifier.quantity,
        0,
      ),
      is_added: true,
      is_updated: true,
      modifiers,
    };
  });
}

async function addToCart(item, quantity, cartId, authToken) {
  const selected = modifierSets(item);
  const payload = await postForm(
    `addtocart/${item.id}`,
    {
      ...(cartId ? { cart_id: cartId } : {}),
      cart_type_id: PRIMARY_CART_TYPE_ID,
      ...(quantity === undefined
        ? {}
        : { product_quantity: String(quantity) }),
      ...(item.modifierSizeId
        ? { modifier_size_id: item.modifierSizeId }
        : {}),
      ...(selected ? { modifier_sets: JSON.stringify(selected) } : {}),
      screen_name: "group-order-transfer",
      screen_url: "https://erewhon.com/cart",
      is_mobile: "false",
    },
    authToken,
  );
  const nextCartId = responseCartId(payload, cartId);
  if (!nextCartId) throw new Error("Erewhon did not return a usable cart");
  return nextCartId;
}

async function setDefaultStore(cartId, storeId, authToken) {
  await postForm(
    "default_stores",
    {
      cart_id: cartId,
      cart_type_id: PRIMARY_CART_TYPE_ID,
      store_id: storeId,
    },
    authToken,
  );
}

async function mergeIntoAccountCart(sourceCartId, targetCartId, authToken) {
  const source = await postForm("usercart", {
    cart_id: sourceCartId,
    cart_type_id: PRIMARY_CART_TYPE_ID,
  });
  const sourceItems = flattenCartProducts(source).map((entry) => ({
    id: entry.product?._id,
    internalId: entry.product?.internal_product_id,
    name: entry.product?.name || "product",
    quantity: Number(entry.quantity),
    modifierSizeId: isCartId(entry.modifier_size_id)
      ? entry.modifier_size_id
      : undefined,
    selectedModifiers: Array.isArray(entry.selected_modifiers)
      ? entry.selected_modifiers
      : [],
    key: cartLineKey(entry),
  }));
  if (
    !isCartId(source.cart?.store_id) ||
    sourceItems.length === 0 ||
    sourceItems.some(
      (item) =>
        !isCartId(item.id) ||
        !/^\d{6,16}$/.test(item.internalId || "") ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99 ||
        item.selectedModifiers.some(
          (group) =>
            !isCartId(group?._id) ||
            !Array.isArray(group.modifiers) ||
            group.modifiers.length === 0 ||
            group.modifiers.some(
              (modifier) =>
                !isCartId(modifier?._id) ||
                !Number.isInteger(selectedModifierQuantity(modifier)) ||
                selectedModifierQuantity(modifier) < 1 ||
                selectedModifierQuantity(modifier) > 99,
            ),
        ),
    )
  ) {
    throw new Error("The verified group cart is incomplete");
  }

  const target = targetCartId
    ? await postForm(
        "usercart",
        {
          cart_id: targetCartId,
          cart_type_id: PRIMARY_CART_TYPE_ID,
        },
        authToken,
        true,
      )
    : null;
  const before = cartQuantities(target);
  let currentCartId = targetCartId;
  let storeIsSet = false;

  if (currentCartId) {
    await setDefaultStore(currentCartId, source.cart.store_id, authToken);
    storeIsSet = true;
  }

  for (const item of sourceItems) {
    currentCartId = await addToCart(
      item,
      item.quantity,
      currentCartId,
      authToken,
    );
    if (!storeIsSet) {
      await setDefaultStore(currentCartId, source.cart.store_id, authToken);
      storeIsSet = true;
    }
  }

  let merged = await postForm(
    "usercart",
    {
      cart_id: currentCartId,
      cart_type_id: PRIMARY_CART_TYPE_ID,
    },
    authToken,
  );
  let after = cartQuantities(merged);

  // addtocart normally adds the requested quantity. If a cart already held
  // the same product and Erewhon treated the request as a replacement, use the
  // site's own one-at-a-time increment behavior to restore the exact sum.
  for (const item of sourceItems) {
    const expected = (before.get(item.key) || 0) + item.quantity;
    const missing = expected - (after.get(item.key) || 0);
    if (missing < 0 || missing > 99) {
      throw new Error(`Erewhon returned an unexpected quantity for ${item.name}`);
    }
    for (let index = 0; index < missing; index += 1) {
      currentCartId = await addToCart(
        item,
        undefined,
        currentCartId,
        authToken,
      );
    }
  }

  merged = await postForm(
    "usercart",
    {
      cart_id: currentCartId,
      cart_type_id: PRIMARY_CART_TYPE_ID,
    },
    authToken,
  );
  after = cartQuantities(merged);
  const incorrect = sourceItems.filter((item) => {
    const expected = (before.get(item.key) || 0) + item.quantity;
    return after.get(item.key) !== expected;
  });
  if (incorrect.length > 0) {
    throw new Error(
      `Erewhon did not merge: ${incorrect.map((item) => item.name).join(", ")}`,
    );
  }

  const count = [...after.values()].reduce(
    (total, quantity) => total + quantity,
    0,
  );
  return { cartId: currentCartId, count };
}

async function handleMessage(message, sender) {
  const url = senderUrl(sender);
  if (!url) return { ok: false };

  if (message?.type === "authorize-handoff") {
    if (
      !TRUSTED_GROUP_ORDER_ORIGINS.has(url.origin) ||
      !url.pathname.startsWith("/o/") ||
      !isCartId(message.cartId) ||
      !Number.isInteger(message.count) ||
      message.count < 1 ||
      message.count > 999
    ) {
      return { ok: false };
    }

    await chrome.storage.session.set({
      [STORAGE_KEY]: {
        cartId: message.cartId,
        count: message.count,
        expiresAt: Date.now() + HANDOFF_TTL_MS,
      },
    });
    return { ok: true };
  }

  if (message?.type === "consume-handoff") {
    if (
      url.origin !== "https://erewhon.com" ||
      url.pathname !== "/cart" ||
      !isCartId(message.cartId)
    ) {
      return { ok: false };
    }

    const stored = await chrome.storage.session.get(STORAGE_KEY);
    const handoff = stored[STORAGE_KEY];
    if (
      !handoff ||
      handoff.cartId !== message.cartId ||
      !Number.isInteger(handoff.count) ||
      handoff.expiresAt < Date.now()
    ) {
      if (handoff?.expiresAt < Date.now()) {
        await chrome.storage.session.remove(STORAGE_KEY);
      }
      return { ok: false };
    }

    const hasAccountToken =
      typeof message.authToken === "string" &&
      message.authToken.length >= 10 &&
      message.authToken.length <= 8_192;
    const targetCartId = isCartId(message.targetCartId)
      ? message.targetCartId
      : undefined;
    if (hasAccountToken) {
      const merged = await mergeIntoAccountCart(
        message.cartId,
        targetCartId,
        message.authToken,
      );
      await chrome.storage.session.remove(STORAGE_KEY);
      return { ok: true, ...merged };
    }

    await chrome.storage.session.remove(STORAGE_KEY);
    return { ok: true, cartId: message.cartId, count: handoff.count };
  }

  return { ok: false };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) =>
      sendResponse({
        ok: false,
        error:
          error instanceof Error
            ? error.message.slice(0, 160)
            : "Erewhon rejected the cart update",
      }),
    );
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  void connectAlreadyOpenOrderTabs().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  void connectAlreadyOpenOrderTabs().catch(() => {});
});

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: "https://jensons2ndlunch.store/" });
});
