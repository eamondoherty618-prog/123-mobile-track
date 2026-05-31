"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, ChevronRight, MapPin, RadioTower, User } from "lucide-react";

import { useWorkspace, serviceAreaOptions } from "@/lib/workspace";
import { useAuth } from "@/lib/auth";

const STEPS = [
  { id: "welcome",  label: "Welcome",      icon: CheckCircle2 },
  { id: "company",  label: "Your company", icon: Building2 },
  { id: "area",     label: "Service area", icon: MapPin },
  { id: "vehicle",  label: "First vehicle", icon: RadioTower },
  { id: "done",     label: "All set!",     icon: CheckCircle2 },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { completeSetup, addVehicle, state } = useWorkspace();

  const [step, setStep] = useState(0);

  // Company step
  const [companyName, setCompanyName] = useState(state.companyName !== "My Fleet" ? state.companyName : "");
  const [adminName, setAdminName] = useState(user?.name ?? state.adminName);
  const [adminEmail, setAdminEmail] = useState(user?.email ?? state.adminEmail);
  const [timezone, setTimezone] = useState(state.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Area step
  const [serviceAreaId, setServiceAreaId] = useState(state.serviceAreaId);

  // Vehicle step
  const [vehicleName, setVehicleName] = useState("");
  const [vehicleType, setVehicleType] = useState("Van");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [skipVehicle, setSkipVehicle] = useState(false);

  function handleCompany(e: FormEvent) {
    e.preventDefault();
    setStep(2);
  }

  function handleArea(e: FormEvent) {
    e.preventDefault();
    setStep(3);
  }

  function handleVehicle(e: FormEvent) {
    e.preventDefault();
    completeSetup({ companyName, serviceAreaId, timezone, adminName, adminEmail });
    if (!skipVehicle && vehicleName.trim()) {
      addVehicle({
        name: vehicleName.trim(),
        vehicleNumber: "001",
        plate: vehiclePlate.trim(),
        make: "",
        model: "",
        year: new Date().getFullYear(),
        type: vehicleType,
        notes: "",
        installDate: "",
        enabledFeatures: ["GPS Tracking", "Live Location", "Motion Wake"],
      });
    }
    setStep(4);
  }

  function finish() {
    router.replace("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 to-brand-cloud px-4 py-10">
      {/* Logo */}
      <div className="mb-8 flex justify-center">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 overflow-hidden rounded-full">
            <img src="/123-mobile-track-logo.png" alt="" className="h-full w-full object-contain scale-[1.5]" />
          </div>
          <span className="text-lg font-bold text-brand-ink">123 Mobile Track</span>
        </div>
      </div>

      {/* Step indicator */}
      <div className="mx-auto mb-8 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full transition-colors ${
              i < step ? "bg-brand-forest" : i === step ? "bg-brand-navy" : "bg-slate-200"
            }`} />
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-slate-200" />}
          </div>
        ))}
      </div>

      <div className="mx-auto w-full max-w-md">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="rounded-xl border border-brand-line bg-white p-8 shadow-panel text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-mint">
              <CheckCircle2 size={32} className="text-brand-forest" />
            </div>
            <h1 className="text-2xl font-bold text-brand-ink">Welcome to 123 Mobile Track</h1>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Let&apos;s get your fleet set up in just a few steps. It takes less than 2 minutes.
            </p>
            <button
              onClick={() => setStep(1)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand-navy py-3 text-sm font-semibold text-white transition hover:bg-brand-forest"
            >
              Get started <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 1: Company */}
        {step === 1 && (
          <form onSubmit={handleCompany} className="rounded-xl border border-brand-line bg-white p-8 shadow-panel">
            <div className="mb-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-mint">
                <Building2 size={20} className="text-brand-forest" />
              </div>
              <h2 className="text-xl font-bold text-brand-ink">Your company</h2>
              <p className="mt-1 text-sm text-slate-500">Tell us a bit about your business.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-ink">Company name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Plumbing Co."
                  required
                  className="h-11 w-full rounded-md border border-brand-line bg-brand-cloud px-4 text-sm outline-none transition focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-ink">Your name</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  className="h-11 w-full rounded-md border border-brand-line bg-brand-cloud px-4 text-sm outline-none transition focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-ink">Email</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="jane@company.com"
                  required
                  className="h-11 w-full rounded-md border border-brand-line bg-brand-cloud px-4 text-sm outline-none transition focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                />
              </div>
            </div>
            <button type="submit" className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand-navy py-3 text-sm font-semibold text-white transition hover:bg-brand-forest">
              Continue <ChevronRight size={16} />
            </button>
          </form>
        )}

        {/* Step 2: Service area */}
        {step === 2 && (
          <form onSubmit={handleArea} className="rounded-xl border border-brand-line bg-white p-8 shadow-panel">
            <div className="mb-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-mint">
                <MapPin size={20} className="text-brand-forest" />
              </div>
              <h2 className="text-xl font-bold text-brand-ink">Service area</h2>
              <p className="mt-1 text-sm text-slate-500">Where does your fleet operate?</p>
            </div>
            <div className="grid gap-2">
              {serviceAreaOptions.filter(o => o.id).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setServiceAreaId(opt.id)}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition ${
                    serviceAreaId === opt.id
                      ? "border-brand-navy bg-brand-navy text-white"
                      : "border-brand-line bg-brand-cloud text-brand-ink hover:border-brand-navy"
                  }`}
                >
                  {opt.label}
                  {serviceAreaId === opt.id && <CheckCircle2 size={16} />}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={!serviceAreaId}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand-navy py-3 text-sm font-semibold text-white transition hover:bg-brand-forest disabled:opacity-50"
            >
              Continue <ChevronRight size={16} />
            </button>
            <button type="button" onClick={() => setStep(3)} className="mt-3 w-full text-center text-sm text-slate-400 hover:text-slate-600">
              Skip for now
            </button>
          </form>
        )}

        {/* Step 3: First vehicle */}
        {step === 3 && (
          <form onSubmit={handleVehicle} className="rounded-xl border border-brand-line bg-white p-8 shadow-panel">
            <div className="mb-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-mint">
                <RadioTower size={20} className="text-brand-forest" />
              </div>
              <h2 className="text-xl font-bold text-brand-ink">Add your first vehicle</h2>
              <p className="mt-1 text-sm text-slate-500">You can add more vehicles later from the dashboard.</p>
            </div>
            {!skipVehicle ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-brand-ink">Vehicle name</label>
                  <input
                    type="text"
                    value={vehicleName}
                    onChange={(e) => setVehicleName(e.target.value)}
                    placeholder="Van 1, Truck A, etc."
                    className="h-11 w-full rounded-md border border-brand-line bg-brand-cloud px-4 text-sm outline-none transition focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-brand-ink">Type</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="h-11 w-full rounded-md border border-brand-line bg-brand-cloud px-4 text-sm outline-none transition focus:border-brand-navy"
                  >
                    {["Van", "Truck", "Car", "Box Truck", "Trailer", "Motorcycle"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-brand-ink">License plate <span className="text-slate-400">(optional)</span></label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="ABC-1234"
                    className="h-11 w-full rounded-md border border-brand-line bg-brand-cloud px-4 text-sm outline-none transition focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                  />
                </div>
              </div>
            ) : null}
            <button type="submit" className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand-navy py-3 text-sm font-semibold text-white transition hover:bg-brand-forest">
              {skipVehicle ? "Finish setup" : "Add vehicle & finish"} <ChevronRight size={16} />
            </button>
            {!skipVehicle && (
              <button type="button" onClick={() => { setSkipVehicle(true); }} className="mt-3 w-full text-center text-sm text-slate-400 hover:text-slate-600">
                Skip — I&apos;ll add vehicles later
              </button>
            )}
          </form>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="rounded-xl border border-brand-line bg-white p-8 shadow-panel text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-brand-ink">You&apos;re all set!</h1>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Your fleet is ready. Head to the dashboard to see live tracking, trips, and alerts.
            </p>
            <button
              onClick={finish}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand-forest py-3 text-sm font-semibold text-white transition hover:bg-brand-navy"
            >
              Go to dashboard <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {step > 0 && step < 4 && (
        <button onClick={() => setStep((s) => s - 1)} className="mx-auto mt-6 text-sm text-slate-400 hover:text-slate-600">
          ← Back
        </button>
      )}
    </div>
  );
}
