(() => {
  const INSTALL_KEY = "__jensonsSecondLunchPresenceV050";
  const TRUSTED_ORIGINS = new Set([
    "http://localhost:3000",
  ]);

  function announce() {
    window.postMessage(
      {
        source: "erewhon-cart-bridge",
        type: "ready",
        version: "0.5.0",
      },
      window.location.origin,
    );
  }

  if (globalThis[INSTALL_KEY]) {
    globalThis[INSTALL_KEY].announce();
    return;
  }
  globalThis[INSTALL_KEY] = { announce };

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }
    if (!TRUSTED_ORIGINS.has(event.origin) || !location.pathname.startsWith("/o/")) {
      return;
    }
    if (
      event.data?.source === "erewhon-group-order" &&
      event.data?.type === "bridge-ping"
    ) {
      announce();
    }
    if (
      event.data?.source === "erewhon-group-order" &&
      event.data?.type === "authorize-handoff" &&
      typeof event.data.requestId === "string"
    ) {
      try {
        const handoff = new URL(event.data.handoffUrl);
        const params = new URLSearchParams(handoff.hash.slice(1));
        const cartId = params.get("group-cart");
        const count = Number(params.get("count"));
        if (
          handoff.origin !== "https://erewhon.com" ||
          handoff.pathname !== "/cart" ||
          !cartId ||
          !/^[a-f0-9]{24}$/.test(cartId) ||
          !Number.isInteger(count) ||
          count < 1 ||
          count > 999
        ) {
          throw new Error("Invalid cart handoff");
        }

        const response = await chrome.runtime.sendMessage({
          type: "authorize-handoff",
          cartId,
          count,
        });
        if (!response?.ok) throw new Error("Authorization failed");

        window.postMessage(
          {
            source: "erewhon-cart-bridge",
            type: "handoff-authorized",
            requestId: event.data.requestId,
          },
          window.location.origin,
        );
      } catch {
        window.postMessage(
          {
            source: "erewhon-cart-bridge",
            type: "handoff-error",
            requestId: event.data.requestId,
          },
          window.location.origin,
        );
      }
    }
  });

  announce();
})();
