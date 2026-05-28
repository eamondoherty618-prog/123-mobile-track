"use client";

import { CarFront } from "lucide-react";
import { useState } from "react";

import { AddVehicleModal } from "@/components/forms/AddVehicleModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/SectionCard";
import { useWorkspace } from "@/lib/workspace";

export default function VehiclesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { state } = useWorkspace();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-forest">Vehicles</p>
        <h1 className="mt-1 text-3xl font-bold text-brand-ink">Vehicles</h1>
        <p className="mt-2 text-sm text-slate-500">
          Add vehicles, keep records organized, and link each one to a tracker when it is ready.
        </p>
      </div>

      {state.vehicles.length === 0 ? (
        <EmptyState
          title="No vehicles yet"
          description="Add the first vehicle to start building your live fleet registry."
          actionLabel="Add First Vehicle"
          onAction={() => setModalOpen(true)}
          icon={<CarFront size={22} />}
        />
      ) : (
        <SectionCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-brand-line px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-brand-ink">Vehicle list</h2>
              <p className="text-sm text-slate-500">
                {state.vehicles.length} vehicle{state.vehicles.length !== 1 ? "s" : ""} in this account
              </p>
            </div>
            <Button onClick={() => setModalOpen(true)}>Add Vehicle</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-cloud text-slate-500">
                <tr>
                  {["Vehicle", "Plate", "Type", "Region", "Tracker", "Status", "Last seen"].map((header) => (
                    <th key={header} className="px-5 py-3 font-semibold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-t border-brand-line">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-brand-ink">{vehicle.name}</p>
                      <p className="text-xs text-slate-500">
                        {vehicle.make} {vehicle.model} {vehicle.year}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-brand-text">{vehicle.plate}</td>
                    <td className="px-5 py-4 text-brand-text">{vehicle.type}</td>
                    <td className="px-5 py-4 text-brand-text">{vehicle.region}</td>
                    <td className="px-5 py-4 text-brand-text">{vehicle.deviceAssignment}</td>
                    <td className="px-5 py-4">
                      <Badge tone={vehicle.deviceStatus}>{vehicle.deviceStatus}</Badge>
                    </td>
                    <td className="px-5 py-4 text-brand-text">{vehicle.lastSeen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <AddVehicleModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
