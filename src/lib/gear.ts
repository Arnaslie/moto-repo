// Cosmetic gear catalog — plain data, no React/Next/Prisma imports so it can be
// consumed by the seed script, API, web UI, and a future mobile app alike.

export const SLOTS = [
  { key: "background", label: "Background" },
  { key: "jacket", label: "Jacket" },
  { key: "helmet", label: "Helmet" },
  { key: "visor", label: "Visor" },
] as const;

export type SlotKey = (typeof SLOTS)[number]["key"];

// Draw order for the avatar, back to front. "body" is the base skin layer that
// is always drawn (from the user's avatarSkin), not an equippable slot.
export const RENDER_ORDER: ReadonlyArray<SlotKey | "body"> = [
  "background",
  "body",
  "jacket",
  "helmet",
  "visor",
];

export type Rarity = "common" | "rare" | "legendary";

export type GearItemDef = {
  id: string;
  slot: SlotKey;
  name: string;
  brand?: string;
  rarity: Rarity;
  // Key into the SVG shape registry (see components/Avatar.tsx).
  asset: string;
  color?: string;
  starter: boolean;
};

// The free set granted to every new account on signup.
export const STARTER_CATALOG: GearItemDef[] = [
  // Backgrounds
  { id: "bg-sunset", slot: "background", name: "Sunset Ride", rarity: "common", asset: "bg-gradient", color: "#f97316", starter: true },
  { id: "bg-dusk", slot: "background", name: "Cool Dusk", rarity: "common", asset: "bg-gradient", color: "#0ea5e9", starter: true },
  { id: "bg-garage", slot: "background", name: "The Garage", rarity: "common", asset: "bg-solid", color: "#374151", starter: true },

  // Jackets
  { id: "jacket-leather-black", slot: "jacket", name: "Leather Jacket", brand: "moto-repo", rarity: "common", asset: "jacket", color: "#1f2937", starter: true },
  { id: "jacket-textile-red", slot: "jacket", name: "Textile Jacket", brand: "moto-repo", rarity: "common", asset: "jacket", color: "#dc2626", starter: true },
  { id: "jacket-hivis", slot: "jacket", name: "Hi-Vis Jacket", brand: "moto-repo", rarity: "rare", asset: "jacket", color: "#facc15", starter: true },

  // Helmets
  { id: "helmet-full-orange", slot: "helmet", name: "Full-Face — Orange", brand: "moto-repo", rarity: "common", asset: "helmet-full", color: "#f97316", starter: true },
  { id: "helmet-full-black", slot: "helmet", name: "Full-Face — Stealth", brand: "moto-repo", rarity: "common", asset: "helmet-full", color: "#111827", starter: true },
  { id: "helmet-open-white", slot: "helmet", name: "Open-Face — Classic", brand: "moto-repo", rarity: "common", asset: "helmet-open", color: "#f3f4f6", starter: true },

  // Visors
  { id: "visor-clear", slot: "visor", name: "Clear Visor", rarity: "common", asset: "visor", color: "#bae6fd", starter: true },
  { id: "visor-tinted", slot: "visor", name: "Tinted Visor", rarity: "common", asset: "visor", color: "#1e293b", starter: true },
  { id: "visor-gold", slot: "visor", name: "Iridium Gold Visor", rarity: "legendary", asset: "visor", color: "#d4af37", starter: true },
];

export const RARITY_LABELS: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  legendary: "Legendary",
};
