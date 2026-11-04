# Jenson's Second Lunch

This small Chrome extension lets the group-order page hand a verified anonymous
cart to `erewhon.com`. It requests local extension storage plus site access to
the production group-order routes and Erewhon's cart page.

To merge a group cart into your Erewhon cart, it reads your Erewhon session token
(`URT`) from `localStorage` on erewhon.com and sends it as a Bearer token to
Erewhon's orders API at `ordersapi.enfmkt.com`. The token is not sent to this app
or anywhere else.

Each handoff is authorized by the extension from a trusted production order
page, expires after two minutes, and can be consumed only once. Untrusted cart
links leave the user's current Erewhon cart untouched.

Trusted order pages are limited to the project's stable Vercel aliases and the
`jensons2ndlunch.store` apex and `www` domains.

Version 0.3 reconnects already-open order tabs when the unpacked extension is
installed, reloaded, or started with Chrome. The order page also preserves and
resumes an in-progress handoff if Chrome needs one automatic page reload.

Version 0.3.1 adds the J2L icon and makes the toolbar button open the group-order
home page.

Version 0.3.2 supplies Erewhon&apos;s current primary-cart type metadata before the
verified cart ID is loaded.

Version 0.4 merges the verified group cart into the owner&apos;s authenticated
Erewhon cart locally inside Chrome, so Erewhon cannot replace the handoff with
an empty account cart. Erewhon credentials go only to Erewhon's orders API.

Version 0.5 preserves each product&apos;s exact variant and modifier selections
while merging, including both sides on Chicken Combo Plates. Configurations are
verified independently so differently customized copies stay separate.
