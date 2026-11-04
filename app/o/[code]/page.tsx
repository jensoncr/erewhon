import { OrderRoom } from "@/components/OrderRoom";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <OrderRoom code={code} />;
}
