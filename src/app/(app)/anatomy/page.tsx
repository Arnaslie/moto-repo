import { BikeSkeleton } from "@/components/anatomy/BikeSkeleton";
import { RAKE_DEG, TRAIL, WHEELBASE, SEAT_H } from "@/lib/anatomy";

export const metadata = {
  title: "Anatomy · moto-repo",
  description: "Every part of a naked bike, named and pointed at.",
};

const SPECS = [
  { k: "Wheelbase", v: `${WHEELBASE} mm` },
  { k: "Rake", v: `${RAKE_DEG}°` },
  { k: "Trail", v: `${TRAIL} mm` },
  { k: "Seat", v: `${SEAT_H} mm` },
];

export default function AnatomyPage() {
  return (
    <div className="px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Anatomy</h1>
        <p className="mt-1 max-w-prose text-sm text-[var(--anat-note)]">
          A naked bike with the bodywork it never had — so the frame, the engine and the
          drive are all where you can point at them. Drawn to Yamaha MT-07 geometry.
        </p>
      </header>

            <div className="relative left-1/2 w-[min(100vw-2rem,1400px)] -translate-x-1/2 overflow-x-auto">
                <div className="min-w-[1100px]">
          <BikeSkeleton />
        </div>
      </div>

      <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--drive-hair)] pt-4">
        {SPECS.map(({ k, v }) => (
          <div key={k}>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--anat-note)]">
              {k}
            </dt>
            <dd className="font-mono text-sm tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 max-w-prose text-xs text-[var(--anat-note)]">
        The hard points are computed, not drawn by eye: tyre diameters come off the
        sidewall markings, the fork line off the published rake and trail, and the chain
        runs on the tangents between a 16-tooth and a 43-tooth sprocket.
      </p>
    </div>
  );
}
