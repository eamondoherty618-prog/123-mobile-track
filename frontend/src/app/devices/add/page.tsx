"use client";

import { CheckCircle, Loader2, Wifi } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { getStoredToken } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";

type Step = "instructions" | "waiting" | "name" | "done" | "error";

function AddDevicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hwFromUrl = searchParams.get("hw") ?? "";
  const { state, updateVehicle, addVehicle, forceSyncToServer } = useWorkspace();

  const unassignedVehicles = state.vehicles.filter((v) => !v.deviceAssignment || v.deviceAssignment === "Not assigned");

  const [step, setStep] = useState<Step>(hwFromUrl ? "name" : "instructions");
  const [hardwareId, setHardwareId] = useState(hwFromUrl);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [newVehicleName, setNewVehicleName] = useState("");
  const [claimedVehicleName, setClaimedVehicleName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived: what name will show on the done screen
  function resolvedName() {
    if (selectedVehicleId && selectedVehicleId !== "__new__") {
      return unassignedVehicles.find((v) => v.id === selectedVehicleId)?.name ?? newVehicleName;
    }
    return newVehicleName.trim();
  }

  const claimReady = (() => {
    if (!hardwareId) return false;
    if (unassignedVehicles.length > 0) {
      if (!selectedVehicleId) return false;
      if (selectedVehicleId === "__new__") return newVehicleName.trim().length > 0;
      return true;
    }
    return newVehicleName.trim().length > 0;
  })();

  function startPolling(hw: string) {
    setHardwareId(hw);
    setStep("waiting");
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/fleet/provision/poll?hw=${hw}`);
        const data = await res.json();
        if (data.claimed) {
          clearInterval(pollRef.current!);
          setDeviceId(data.device_id);
          setStep("done");
        }
      } catch {
        // ignore transient errors
      }
    }, 3000);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function claimDevice() {
    if (!claimReady) return;
    setClaiming(true);
    setError("");
    try {
      const token = getStoredToken();
      const usingExisting = selectedVehicleId && selectedVehicleId !== "__new__";
      const body = usingExisting
        ? { hardware_id: hardwareId, vehicle_id: selectedVehicleId }
        : { hardware_id: hardwareId, device_name: newVehicleName.trim() };

      const res = await fetch("/api/fleet/provision/claim", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? "Claim failed"); return; }

      const name = resolvedName();
      if (usingExisting) {
        updateVehicle(selectedVehicleId, { deviceAssignment: data.device_id });
      } else {
        addVehicle({
          name,
          vehicleNumber: "",
          plate: "",
          make: "",
          model: "",
          year: new Date().getFullYear(),
          type: "Truck",
          notes: "",
          installDate: new Date().toISOString().slice(0, 10),
          enabledFeatures: [],
          deviceAssignment: data.device_id,
        });
      }
      // Sync immediately so the new vehicle survives a page refresh
      setTimeout(() => forceSyncToServer(), 300);

      setClaimedVehicleName(name);
      setDeviceId(data.device_id);
      setStep("done");
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-forest">Devices</p>
        <h1 className="mt-1 text-3xl font-bold text-brand-ink">Add New Device</h1>
        <p className="mt-2 text-sm text-slate-500">
          Set up a new LilyGo tracker and link it to your account.
        </p>
      </div>

      {step === "instructions" && (
        <SectionCard className="max-w-xl p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="rounded-md bg-brand-mint p-3 text-brand-forest shrink-0">
              <Wifi size={22} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-brand-ink">Connect to tracker WiFi</h2>
              <p className="mt-1 text-sm text-slate-500">
                Power on your new tracker. Within 30 seconds it will broadcast a WiFi network
                starting with <span className="font-mono font-semibold text-brand-ink">123Track-</span>.
                Connect your phone to that network — a setup page will appear automatically.
              </p>
            </div>
          </div>

          <ol className="space-y-3 text-sm text-slate-600">
            {[
              "Power on the tracker (connect USB-C or hardwire to 12V).",
              "On your phone, go to WiFi settings and join the network named 123Track-XXXX.",
              "A setup page opens automatically. Tap &#8220;Link to my account&#8221;.",
              "You&#39;ll be brought back here to assign the tracker to a vehicle.",
            ].map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span dangerouslySetInnerHTML={{ __html: s }} />
              </li>
            ))}
          </ol>

          <p className="text-xs text-slate-400">
            Already have the hardware ID? Enter it below to skip the WiFi step.
          </p>
          <div className="flex gap-2">
            <input
              className="h-10 flex-1 rounded-md border border-brand-line px-3 text-sm font-mono"
              placeholder="Hardware ID (e.g. 884112088304)"
              value={hardwareId}
              onChange={(e) => setHardwareId(e.target.value)}
            />
            <Button
              variant="primary"
              disabled={!hardwareId.trim()}
              onClick={() => setStep("name")}
            >
              Continue
            </Button>
          </div>
        </SectionCard>
      )}

      {step === "waiting" && (
        <SectionCard className="max-w-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-brand-navy" />
            <p className="text-sm font-semibold text-brand-ink">
              Waiting for tracker to come online…
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Hardware ID: <span className="font-mono font-semibold">{hardwareId}</span>
          </p>
          <p className="text-xs text-slate-400">
            Checking every 3 seconds. This usually takes under a minute.
          </p>
          <Button variant="secondary" onClick={() => { clearInterval(pollRef.current!); setStep("instructions"); }}>
            Cancel
          </Button>
        </SectionCard>
      )}

      {step === "name" && (
        <SectionCard className="max-w-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-brand-ink">Assign this tracker</h2>
          <p className="text-sm text-slate-500">
            Hardware ID: <span className="font-mono font-semibold">{hardwareId}</span>
          </p>

          {unassignedVehicles.length > 0 ? (
            <>
              <p className="text-sm text-slate-500">
                Assign to an existing vehicle, or create a new one.
              </p>
              <select
                className="h-10 w-full rounded-md border border-brand-line bg-white px-3 text-sm"
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                autoFocus
              >
                <option value="">— Choose a vehicle —</option>
                {unassignedVehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
                <option value="__new__">+ Create new vehicle…</option>
              </select>
              {selectedVehicleId === "__new__" && (
                <input
                  className="h-10 w-full rounded-md border border-brand-line px-3 text-sm"
                  placeholder="e.g. Van 3, Truck 07, Jane's Sedan"
                  value={newVehicleName}
                  onChange={(e) => setNewVehicleName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && claimDevice()}
                  autoFocus
                />
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Give it a name that matches the vehicle it will be installed in.
              </p>
              <input
                className="h-10 w-full rounded-md border border-brand-line px-3 text-sm"
                placeholder="e.g. Van 3, Truck 07, Jane's Sedan"
                value={newVehicleName}
                onChange={(e) => setNewVehicleName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && claimDevice()}
                autoFocus
              />
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={!claimReady || claiming}
              onClick={claimDevice}
            >
              {claiming ? <Loader2 size={16} className="animate-spin" /> : "Claim device"}
            </Button>
            <Button variant="secondary" onClick={() => setStep("instructions")}>
              Back
            </Button>
          </div>
        </SectionCard>
      )}

      {step === "done" && (
        <SectionCard className="max-w-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle size={22} className="text-brand-forest" />
            <h2 className="text-base font-semibold text-brand-ink">Tracker linked!</h2>
          </div>
          <p className="text-sm text-slate-500">
            Tracker <span className="font-mono font-semibold">{deviceId}</span> is now assigned
            to <span className="font-semibold text-brand-ink">{claimedVehicleName}</span>.
            It will appear on the map once it gets a GPS fix outdoors.
          </p>
          <p className="text-sm text-slate-500">
            The tracker will automatically reboot into tracking mode. You can close the tracker
            WiFi network on your phone now.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => router.push("/devices")}>
              Go to Devices
            </Button>
            <Button variant="secondary" onClick={() => {
              setStep("instructions");
              setHardwareId("");
              setNewVehicleName("");
              setSelectedVehicleId("");
              setDeviceId("");
            }}>
              Add another
            </Button>
          </div>
        </SectionCard>
      )}

      {step === "error" && (
        <SectionCard className="max-w-xl p-6 space-y-4">
          <p className="text-sm text-red-500">{error}</p>
          <Button variant="secondary" onClick={() => setStep("instructions")}>Try again</Button>
        </SectionCard>
      )}
    </div>
  );
}

export default function AddDevicePageWrapper() {
  return (
    <Suspense>
      <AddDevicePage />
    </Suspense>
  );
}
