(async () => {
  const PRIMARY_CART_TYPE_ID = "67c190abcf94f13b74707c27";
  const params = new URLSearchParams(window.location.hash.slice(1));
  const cartId = params.get("group-cart");
  if (!cartId) return;

  params.delete("group-cart");
  params.delete("count");

  const remainingHash = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}${remainingHash ? `#${remainingHash}` : ""}`,
  );

  if (!/^[a-f0-9]{24}$/.test(cartId)) return;

  function showHandoffError() {
    const render = () => {
      if (!document.body || document.getElementById("j2l-handoff-error")) return;
      const alert = document.createElement("div");
      alert.id = "j2l-handoff-error";
      alert.setAttribute("role", "alert");
      alert.textContent =
        "J2L couldn't move this order into your Erewhon cart. Return to the order page and try again.";
      Object.assign(alert.style, {
        position: "fixed",
        inset: "16px 16px auto",
        zIndex: "2147483647",
        maxWidth: "640px",
        margin: "0 auto",
        padding: "14px 18px",
        borderRadius: "12px",
        background: "#17251b",
        color: "#fff",
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.24)",
        font: "600 14px/1.4 -apple-system, BlinkMacSystemFont, sans-serif",
      });
      document.body.appendChild(alert);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", render, { once: true });
    } else {
      render();
    }
  }

  try {
    const targetCartId = window.localStorage.getItem("CId");
    const authToken = window.localStorage.getItem("URT");
    const authorization = await chrome.runtime.sendMessage({
      type: "consume-handoff",
      cartId,
      ...(targetCartId ? { targetCartId } : {}),
      ...(authToken ? { authToken } : {}),
    });
    if (!authorization?.ok) {
      showHandoffError();
      return;
    }
    const nextCartId = authorization.cartId || cartId;

    // Erewhon's current cart page derives cart_type_id from this metadata
    // before requesting CId. Preserve other cart types and supply primary when
    // a guest browser has not fetched the list yet.
    let cartTypes = [];
    try {
      const savedCartTypes = JSON.parse(
        window.localStorage.getItem("ctypes") || "[]",
      );
      if (Array.isArray(savedCartTypes)) cartTypes = savedCartTypes;
    } catch {
      // Replace malformed site metadata with the known primary cart type.
    }
    if (!cartTypes.some((type) => type?.type === "primary")) {
      cartTypes.push({ _id: PRIMARY_CART_TYPE_ID, type: "primary" });
    }
    window.localStorage.setItem("ctypes", JSON.stringify(cartTypes));
    window.localStorage.removeItem("sc_types");
    window.localStorage.setItem("CId", nextCartId);
    if (Number.isInteger(authorization.count)) {
      window.localStorage.setItem("cartCount", String(authorization.count));
    }

    window.location.replace("https://erewhon.com/cart");
  } catch {
    // Leave the user's current cart untouched if authorization is unavailable.
    showHandoffError();
  }
})();
