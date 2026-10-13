import { CarScreen } from "@/features/car/CarScreen";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CarScreen id={id} />;
}
