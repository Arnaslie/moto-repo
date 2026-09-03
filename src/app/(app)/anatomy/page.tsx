import { BikeSkeleton } from "@/components/anatomy/BikeSkeleton";
import { RAKE_DEG, TRAIL, WHEELBASE, SEAT_H } from "@/lib/anatomy";

export const metadata = {
  title: "Anatomy · moto-repo",
  description: "Every part of a naked bike, named and pointed at.",
};

// Fourth gear. See ADR 0008.
//
// Nothing here is dynamic — no session, no query, no client JS — but the route
// still renders on demand, because the shared layout reads the session cookie
// for the header. Worth knowing before anyone tries to prerender this.

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

      {/* The figure is the one thing on the page that wants more than the
          feed column: it breaks out to the viewport and centres on it, while
          the prose above and below stays in the column where it reads. */}
      <div className="relative left-1/2 w-[min(100vw-2rem,1400px)] -translate-x-1/2 overflow-x-auto">
        {/* Below about a tablet the figure would shrink past the point where its
            labels can be read, so it keeps a floor and pans instead. */}
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
