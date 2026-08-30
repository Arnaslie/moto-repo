// Bike spec catalog for the seat-height fit check (ADR 0006) — plain data, no
// React/Next/Prisma imports, same as the gear catalog.
//
// Deliberately NOT a database table. Nothing holds a foreign key to a bike yet
// (rider reports are deferred), so this stays a const: editing a seat height is
// a one-line diff instead of a migration and a reseed. When reports land they
// can carry the slug as a plain string, the way GearItem ids already work.
//
// !! THE NUMBERS BELOW ARE UNVERIFIED. !!
// Seat heights were drafted from memory, not read off manufacturer spec sheets.
// They are close, and "close" is precisely the failure this feature exists to
// fix — a rider deciding on a purchase deserves the real figure. Every entry
// needs a pass against the manufacturer's published spec before this ships.
// `sagMm` and `seatWidth` are worse than unverified: nobody publishes them at
// all. See ADR 0006 for why they're estimates by construction.

export type BikeCategory =
  | "cruiser"
  | "sport"
  | "naked"
  | "standard"
  | "adv"
  | "dualsport";

// Rider sag — how much the suspension gives up once someone sits on it, so the
// seat at a stop is lower than the unladen figure on the spec sheet. Not
// published by any manufacturer. These are per-category defaults in the usual
// 30%-of-travel range; long-travel bikes sink furthest.
export const SAG_DEFAULTS_MM: Record<BikeCategory, number> = {
  cruiser: 25,
  sport: 30,
  naked: 30,
  standard: 30,
  adv: 40,
  dualsport: 45,
};

// Width of the seat where it meets the tank — the part your thighs straddle at
// a stop. A wide nose splays the legs outward so they travel diagonally rather
// than straight down, which costs reach the seat height never mentions. Also
// unpublished; hand-classified per bike.
export type SeatWidth = "narrow" | "medium" | "wide";

// Reach cost of the splay, in millimetres, applied on top of the sagged seat
// height. Rough, empirical, and the first thing real rider reports should
// replace — the whole point of the crowdsourced path is that these stop
// mattering once a bike has testimony behind it.
export const SPLAY_PENALTY_MM: Record<SeatWidth, number> = {
  narrow: 0,
  medium: 15,
  wide: 35,
};

export type BikeSpec = {
  // Stable slug. Referenced by future rider reports, so don't renumber.
  id: string;
  // Representative year for these specs, not the full production run.
  year: number;
  make: string;
  model: string;
  category: BikeCategory;
  // Published, unladen. The number the spec sheet gives you.
  seatHeightMm: number;
  seatWidth: SeatWidth;
  // Overrides SAG_DEFAULTS_MM where the real figure is actually known.
  sagMm?: number;
};

export const BIKE_CATALOG: BikeSpec[] = [
  // --- Low cruisers — where a short rider usually gets sent first -----------
  { id: "indian-scout", year: 2023, make: "Indian", model: "Scout", category: "cruiser", seatHeightMm: 643, seatWidth: "medium" },
  { id: "honda-shadow-phantom", year: 2023, make: "Honda", model: "Shadow Phantom 750", category: "cruiser", seatHeightMm: 656, seatWidth: "medium" },
  { id: "kawasaki-vulcan-900", year: 2023, make: "Kawasaki", model: "Vulcan 900 Classic", category: "cruiser", seatHeightMm: 675, seatWidth: "medium" },
  { id: "yamaha-bolt", year: 2023, make: "Yamaha", model: "Bolt R-Spec", category: "cruiser", seatHeightMm: 690, seatWidth: "medium" },
  { id: "honda-rebel-300", year: 2024, make: "Honda", model: "Rebel 300", category: "cruiser", seatHeightMm: 690, seatWidth: "narrow" },
  { id: "honda-rebel-500", year: 2024, make: "Honda", model: "Rebel 500", category: "cruiser", seatHeightMm: 690, seatWidth: "narrow" },
  { id: "kawasaki-vulcan-s", year: 2023, make: "Kawasaki", model: "Vulcan S", category: "cruiser", seatHeightMm: 705, seatWidth: "medium" },
  { id: "harley-iron-883", year: 2022, make: "Harley-Davidson", model: "Iron 883", category: "cruiser", seatHeightMm: 760, seatWidth: "medium" },
  { id: "royal-enfield-meteor-350", year: 2024, make: "Royal Enfield", model: "Meteor 350", category: "cruiser", seatHeightMm: 765, seatWidth: "medium" },

  // --- Naked, sport and standard -------------------------------------------
  { id: "yamaha-mt-03", year: 2024, make: "Yamaha", model: "MT-03", category: "naked", seatHeightMm: 780, seatWidth: "narrow" },
  { id: "yamaha-yzf-r3", year: 2024, make: "Yamaha", model: "YZF-R3", category: "sport", seatHeightMm: 780, seatWidth: "narrow" },
  { id: "kawasaki-ninja-400", year: 2023, make: "Kawasaki", model: "Ninja 400", category: "sport", seatHeightMm: 785, seatWidth: "narrow" },
  { id: "kawasaki-z400", year: 2023, make: "Kawasaki", model: "Z400", category: "naked", seatHeightMm: 785, seatWidth: "narrow" },
  { id: "bmw-g310r", year: 2024, make: "BMW", model: "G 310 R", category: "naked", seatHeightMm: 785, seatWidth: "narrow" },
  { id: "honda-cb500f", year: 2024, make: "Honda", model: "CB500F", category: "naked", seatHeightMm: 785, seatWidth: "medium" },
  { id: "honda-cbr500r", year: 2024, make: "Honda", model: "CBR500R", category: "sport", seatHeightMm: 785, seatWidth: "medium" },
  { id: "suzuki-sv650", year: 2024, make: "Suzuki", model: "SV650", category: "naked", seatHeightMm: 785, seatWidth: "medium" },
  { id: "triumph-bonneville-t100", year: 2024, make: "Triumph", model: "Bonneville T100", category: "standard", seatHeightMm: 790, seatWidth: "medium" },
  { id: "kawasaki-z650", year: 2024, make: "Kawasaki", model: "Z650", category: "naked", seatHeightMm: 790, seatWidth: "medium" },
  { id: "kawasaki-ninja-650", year: 2024, make: "Kawasaki", model: "Ninja 650", category: "sport", seatHeightMm: 790, seatWidth: "medium" },
  { id: "yamaha-mt-07", year: 2024, make: "Yamaha", model: "MT-07", category: "naked", seatHeightMm: 805, seatWidth: "medium" },
  { id: "triumph-trident-660", year: 2024, make: "Triumph", model: "Trident 660", category: "naked", seatHeightMm: 805, seatWidth: "medium" },
  { id: "ducati-monster", year: 2024, make: "Ducati", model: "Monster", category: "naked", seatHeightMm: 820, seatWidth: "medium" },
  { id: "ktm-390-duke", year: 2024, make: "KTM", model: "390 Duke", category: "naked", seatHeightMm: 830, seatWidth: "narrow" },

  // --- Adventure — where the published number lies hardest ------------------
  { id: "royal-enfield-himalayan", year: 2023, make: "Royal Enfield", model: "Himalayan 411", category: "adv", seatHeightMm: 800, seatWidth: "wide" },
  { id: "honda-cb500x", year: 2024, make: "Honda", model: "CB500X", category: "adv", seatHeightMm: 830, seatWidth: "wide" },
  { id: "bmw-g310gs", year: 2024, make: "BMW", model: "G 310 GS", category: "adv", seatHeightMm: 835, seatWidth: "medium" },
  { id: "honda-africa-twin", year: 2024, make: "Honda", model: "CRF1100L Africa Twin", category: "adv", seatHeightMm: 850, seatWidth: "wide" },
  { id: "bmw-r1250gs", year: 2023, make: "BMW", model: "R 1250 GS", category: "adv", seatHeightMm: 850, seatWidth: "wide" },
  { id: "yamaha-tenere-700", year: 2024, make: "Yamaha", model: "Ténéré 700", category: "adv", seatHeightMm: 875, seatWidth: "wide" },

  // --- Dual sport — tall on paper, narrow in practice; the reverse case -----
  { id: "honda-crf300l", year: 2024, make: "Honda", model: "CRF300L", category: "dualsport", seatHeightMm: 880, seatWidth: "narrow" },
  { id: "suzuki-drz400s", year: 2024, make: "Suzuki", model: "DR-Z400S", category: "dualsport", seatHeightMm: 935, seatWidth: "narrow" },
];

export function bikeById(id: string): BikeSpec | undefined {
  return BIKE_CATALOG.find((b) => b.id === id);
}

export function bikeLabel(b: BikeSpec): string {
  return `${b.make} ${b.model}`;
}
