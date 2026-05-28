"use client";

import { Wrench } from "lucide-react";

import { SectionCard } from "@/components/ui/SectionCard";

export default function MaintenancePage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-forest">Maintenance</p>
        <h1 className="mt-1 text-3xl font-bold text-brand-ink">Maintenance</h1>
        <p className="mt-2 text-sm text-slate-500">
          Track scheduled service work, due mileage, inspection windows, and maintenance reminders.
        </p>
      </div>

      <SectionCard className="p-10 text-center">
        <Wrench size={28} className="mx-auto mb-4 text-slate-300" />
        <p className="text-base font-semibold text-brand-ink">Coming soon</p>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
          Oil change, tire, brake, and inspection reminders are in development.
          Set these up once your vehicles and GPS tracking are running.
        </p>
      </SectionCard>
    </div>
  );
}
