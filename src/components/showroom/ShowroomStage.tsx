"use client";

import dynamic from "next/dynamic";

// Load the three.js canvas only in the browser, and only for this route — keeps
// the ~600kb 3D bundle out of SSR and off every other page.
const ShowroomCanvas = dynamic(() => import("./ShowroomCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-white/40">
      Warming up the showroom…
    </div>
  ),
});

export function ShowroomStage({ seed }: { seed: string }) {
  return (
    <div className="relative h-[70vh] w-full overflow-hidden bg-[#0b0b0f]">
      <ShowroomCanvas seed={seed} />
      <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs text-white/30">
        Drag to orbit · scroll to zoom
      </p>
    </div>
  );
}
