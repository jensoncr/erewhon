# Erewhon Group Cart

My team kept ordering Erewhon through Uber Eats. Every order paid for the Uber Eats markup and fees, and I wanted us to get more for our money. So I cut out Uber Eats and built this to go straight to Erewhon.

One person creates an order and shares the link. Everyone adds what they want from Erewhon's live catalog. When the order is locked, the organizer moves it all into one cart on `erewhon.com` and checks out there.

This is a personal project. It isn't affiliated with or endorsed by Erewhon.

It isn't hosted anywhere anymore, so run it locally. You'll need your own Convex project.

## Local development

Install dependencies and start the app:

```bash
bun install
bun dev
```

The application expects `NEXT_PUBLIC_CONVEX_URL` in `.env.local`. Convex schema and functions live in [`convex/`](./convex).

## Cart transfer

Only the organizer who checks out needs the Chrome extension. Its source is in [`extensions/erewhon-cart-bridge/`](./extensions/erewhon-cart-bridge), and the downloadable package served by the app is [`public/erewhon-cart-bridge.zip`](./public/erewhon-cart-bridge.zip).

The organizer locks the shared order, selects **Transfer all to Erewhon**, reviews the resulting Erewhon cart, and completes checkout directly with Erewhon.

## License

[MIT](./LICENSE)
