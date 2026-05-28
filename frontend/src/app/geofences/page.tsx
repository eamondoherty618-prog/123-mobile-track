"use client";

import { MapPinned } from "lucide-react";

import { SectionCard } from "@/components/ui/SectionCard";

export default function GeofencesPage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-forest">Geofences</p>
        <h1 className="mt-1 text-3xl font-bold text-brand-ink">Geofences</h1>
        <p className="mt-2 text-sm text-slate-500">
          Add arrival, departure, and after-hours zones around the places that matter most.
        </p>
      </div>

      <SectionCard className="p-10 text-center">
        <MapPinned size={28} className="mx-auto mb-4 text-slate-300" />
        <p className="text-base font-semibold text-brand-ink">Coming soon</p>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
          Zone-based arrival, departure, and after-hours alerts are in development.
          Live GPS tracking and trip history are available now.
        </p>
      </SectionCard>
    </div>
  );
}
