import { divIcon, DivIcon } from "leaflet";

// ─── SVG vehicle silhouettes (44×22 viewBox, side-profile, facing right) ──────

function carSvg(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 22" width="44" height="22">
    <circle cx="11" cy="18" r="4.5" fill="#111827"/>
    <circle cx="33" cy="18" r="4.5" fill="#111827"/>
    <circle cx="11" cy="18" r="2" fill="#374151"/>
    <circle cx="33" cy="18" r="2" fill="#374151"/>
    <path d="M6 15 L10 7 L16 4 L28 4 L34 7 L38 15 L38 17 L6 17 Z"
      fill="${fill}" stroke="rgba(0,0,0,0.45)" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M16 5 L28 5 L32 13 L12 13 Z" fill="rgba(186,230,253,0.45)"/>
    <rect x="6" y="15.5" width="32" height="1.5" fill="rgba(0,0,0,0.1)"/>
  </svg>`;
}

function pickupSvg(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 22" width="44" height="22">
    <circle cx="11" cy="18" r="4.5" fill="#111827"/>
    <circle cx="11" cy="18" r="2" fill="#374151"/>
    <circle cx="33" cy="18" r="4.5" fill="#111827"/>
    <circle cx="33" cy="18" r="2" fill="#374151"/>
    <!-- cab: sloped hood on left, tall cab, open bed on right -->
    <path d="M4 14 L4 13 L7 9 L17 8 L19 4 L27 4 L27 14 Z"
      fill="${fill}" stroke="rgba(0,0,0,0.45)" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M17 8 L19 4.5 L26.5 4.5 L26.5 8 Z" fill="rgba(186,230,253,0.55)"/>
    <path d="M27 8 L41 8 L41 14 L27 14 Z"
      fill="${fill}" stroke="rgba(0,0,0,0.3)" stroke-width="0.8" stroke-linejoin="round"/>
    <rect x="28" y="9" width="12" height="5" fill="rgba(0,0,0,0.22)"/>
    <rect x="27.5" y="8" width="13.5" height="1" fill="rgba(0,0,0,0.15)"/>
    <rect x="40.5" y="8" width="1" height="6" fill="rgba(0,0,0,0.25)"/>
    <rect x="3" y="11" width="2" height="2.5" rx="0.5" fill="rgba(255,255,220,0.9)"/>
  </svg>`;
}

function vanSvg(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 22" width="44" height="22">
    <circle cx="11" cy="18" r="4.5" fill="#111827"/>
    <circle cx="33" cy="18" r="4.5" fill="#111827"/>
    <circle cx="11" cy="18" r="2" fill="#374151"/>
    <circle cx="33" cy="18" r="2" fill="#374151"/>
    <rect x="4" y="5" width="36" height="12" rx="2.5"
      fill="${fill}" stroke="rgba(0,0,0,0.45)" stroke-width="1.2"/>
    <rect x="5.5" y="6.5" width="9" height="8" rx="1" fill="rgba(186,230,253,0.45)"/>
    <rect x="16" y="6.5" width="7" height="8" rx="1" fill="rgba(186,230,253,0.25)"/>
    <rect x="25" y="6.5" width="13" height="8" rx="1" fill="rgba(186,230,253,0.2)"/>
  </svg>`;
}

function boxTruckSvg(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 22" width="44" height="22">
    <circle cx="11" cy="18" r="4.5" fill="#111827"/>
    <circle cx="29" cy="18" r="4.5" fill="#111827"/>
    <circle cx="37" cy="18" r="4.5" fill="#111827"/>
    <circle cx="11" cy="18" r="2" fill="#374151"/>
    <circle cx="29" cy="18" r="2" fill="#374151"/>
    <circle cx="37" cy="18" r="2" fill="#374151"/>
    <path d="M5 15 L7 7 L17 7 L17 15 Z"
      fill="${fill}" stroke="rgba(0,0,0,0.45)" stroke-width="1.2" stroke-linejoin="round"/>
    <rect x="8" y="8" width="8" height="6" rx="1" fill="rgba(186,230,253,0.45)"/>
    <rect x="17" y="4" width="22" height="11" rx="1.5"
      fill="${fill}" stroke="rgba(0,0,0,0.4)" stroke-width="1"/>
    <line x1="24" y1="4" x2="24" y2="15" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>
    <line x1="31" y1="4" x2="31" y2="15" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>
  </svg>`;
}

function motorcycleSvg(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 22" width="44" height="22">
    <circle cx="9" cy="15" r="6" fill="none" stroke="${fill}" stroke-width="2.5"/>
    <circle cx="9" cy="15" r="2.5" fill="${fill}"/>
    <circle cx="35" cy="15" r="6" fill="none" stroke="${fill}" stroke-width="2.5"/>
    <circle cx="35" cy="15" r="2.5" fill="${fill}"/>
    <path d="M9 15 L22 9 L35 15" stroke="${fill}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M18 9 L26 9" stroke="${fill}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <rect x="19" y="11" width="6" height="5" rx="1.5" fill="${fill}"/>
  </svg>`;
}

function trailerSvg(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 22" width="44" height="22">
    <circle cx="13" cy="18" r="4.5" fill="#111827"/>
    <circle cx="33" cy="18" r="4.5" fill="#111827"/>
    <circle cx="13" cy="18" r="2" fill="#374151"/>
    <circle cx="33" cy="18" r="2" fill="#374151"/>
    <rect x="6" y="8" width="34" height="9" rx="1.5"
      fill="${fill}" stroke="rgba(0,0,0,0.4)" stroke-width="1.2"/>
    <circle cx="5" cy="12.5" r="1.5" fill="rgba(0,0,0,0.3)"/>
    <line x1="2" y1="12.5" x2="5" y2="12.5" stroke="rgba(0,0,0,0.4)" stroke-width="1.5"/>
  </svg>`;
}

function getVehicleSvg(vehicleType: string, fill: string): string {
  const t = vehicleType.toLowerCase();
  if (t.includes("motorcycle") || t.includes("bike")) return motorcycleSvg(fill);
  if (t.includes("box") || t.includes("cargo")) return boxTruckSvg(fill);
  if (t.includes("trailer")) return trailerSvg(fill);
  if (t.includes("pickup") || t.includes("truck")) return pickupSvg(fill);
  if (t.includes("van") || t.includes("service") || t.includes("tow") || t.includes("suv")) return vanSvg(fill);
  return carSvg(fill);
}

// ─── Status dot color ─────────────────────────────────────────────────────────

function statusDotColor(isMoving: boolean, isOnline: boolean): string {
  if (isMoving) return "#22c55e";
  if (isOnline) return "#3b82f6";
  return "#94a3b8";
}

// ─── Public factory ───────────────────────────────────────────────────────────

export function createVehicleMapIcon(opts: {
  vehicleType: string;
  vehicleColor?: string;
  photo?: string;
  isMoving?: boolean;
  isOnline?: boolean;
  selected?: boolean;
  maintDue?: boolean;
}): DivIcon {
  const {
    vehicleType,
    vehicleColor,
    photo,
    isMoving = false,
    isOnline = false,
    selected = false,
    maintDue = false,
  } = opts;

  const dotColor = statusDotColor(isMoving, isOnline);
  // Fill: vehicle's own color if set; otherwise use status color
  const fillColor = vehicleColor || (isMoving ? "#22c55e" : isOnline ? "#173754" : "#64748b");

  const dot = `<div style="position:absolute;top:-1px;right:-1px;width:11px;height:11px;border-radius:50%;background:${dotColor};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.25)"></div>`;
  const maintBadge = maintDue
    ? `<div style="position:absolute;top:-1px;left:-1px;width:11px;height:11px;border-radius:50%;background:#f97316;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:7px;line-height:1">⚙</div>`
    : "";

  if (photo) {
    const borderColor = selected ? "#15803d" : dotColor;
    const sz = 44;
    const outer = sz + 10;
    return divIcon({
      className: "",
      html: `<div style="position:relative;width:${outer}px;height:${outer}px">
        <div style="position:absolute;top:4px;left:4px;width:${sz}px;height:${sz}px;border-radius:50%;overflow:hidden;border:3px solid ${borderColor};box-shadow:0 2px 10px rgba(0,0,0,0.35)">
          <img src="${photo}" style="width:100%;height:100%;object-fit:cover"/>
        </div>
        ${dot}${maintBadge}
      </div>`,
      iconSize: [outer, outer],
      iconAnchor: [outer / 2, outer / 2],
    });
  }

  const svg = getVehicleSvg(vehicleType, fillColor);
  // SVG is 44x22; add 10px padding around for dots + drop-shadow bleed
  const cW = 54, cH = 32;
  const selStyle = selected ? "outline:2.5px solid #15803d;outline-offset:2px;border-radius:4px;" : "";

  return divIcon({
    className: "",
    html: `<div style="position:relative;width:${cW}px;height:${cH}px">
      <div style="position:absolute;top:5px;left:5px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));${selStyle}">${svg}</div>
      ${dot}${maintBadge}
    </div>`,
    iconSize: [cW, cH],
    iconAnchor: [cW / 2, cH / 2],
  });
}
