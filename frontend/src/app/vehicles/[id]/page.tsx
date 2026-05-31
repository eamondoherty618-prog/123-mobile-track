import { VehicleDetailClient } from "./VehicleDetailClient";

// Pre-renders one shell page; actual vehicle ID resolved client-side
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function VehicleDetailPage() {
  return <VehicleDetailClient />;
}
