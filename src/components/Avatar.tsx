"use client";

import { useId } from "react";
import { RENDER_ORDER, type SlotKey } from "@/lib/gear";

export type EquippedItem = {
  slot: SlotKey;
  asset: string;
  color: string | null;
};

type ShapeProps = { color: string; gradientId: string };

// ---- Shape registry: each gear `asset` maps to an SVG drawing ----------------

function Background({ asset, color, gradientId }: ShapeProps & { asset: string }) {
  if (asset === "bg-gradient") {
    return (
      <>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="200" height="200" fill={`url(#${gradientId})`} />
      </>
    );
  }
  return <rect x="0" y="0" width="200" height="200" fill={color} />;
}

function Body({ skin }: { skin: string }) {
  return (
    <>
      {/* torso silhouette (mostly covered by the jacket) */}
      <path d="M36 200 C36 158 66 146 100 146 C134 146 164 158 164 200 Z" fill={skin} />
      {/* neck */}
      <rect x="86" y="116" width="28" height="26" rx="10" fill={skin} />
      {/* head */}
      <circle cx="100" cy="88" r="40" fill={skin} />
      {/* hair (shown when no helmet) */}
      <path d="M60 84 A40 40 0 0 1 140 84 C140 70 124 58 100 58 C76 58 60 70 60 84 Z" fill="#3b2f2a" />
    </>
  );
}

function DefaultShirt() {
  // Neutral tee shown when no jacket is equipped.
  return <path d="M40 200 C40 162 70 150 100 150 C130 150 160 162 160 200 Z" fill="#9ca3af" />;
}

function Jacket({ color }: { color: string }) {
  return (
    <>
      <path d="M38 200 C38 160 68 148 100 148 C132 148 162 160 162 200 Z" fill={color} />
      {/* collar */}
      <path d="M78 150 L100 168 L122 150 L116 146 L100 158 L84 146 Z" fill="#00000033" />
      {/* zipper */}
      <rect x="98.5" y="160" width="3" height="40" fill="#00000040" />
    </>
  );
}

function HelmetFull({ color }: { color: string }) {
  return (
    <>
      {/* shell + chin bar */}
      <path
        d="M100 40 C142 40 150 78 150 100 C150 132 132 150 100 150 C68 150 50 132 50 100 C50 78 58 40 100 40 Z"
        fill={color}
        stroke="#00000022"
        strokeWidth="2"
      />
      {/* visor window (reads as a closed dark visor when none equipped) */}
      <rect x="66" y="72" width="68" height="36" rx="17" fill="#1e293b" />
      {/* highlight */}
      <path d="M72 58 C88 48 112 48 128 58" stroke="#ffffff55" strokeWidth="4" fill="none" strokeLinecap="round" />
    </>
  );
}

function HelmetOpen({ color }: { color: string }) {
  return (
    <>
      {/* dome covering the top of the head, face left open */}
      <path d="M54 98 A46 46 0 0 1 146 98 L146 96 A46 46 0 0 0 54 96 Z" fill={color} />
      <path d="M55 96 A45 45 0 0 1 145 96 L145 108 L55 108 Z" fill={color} stroke="#00000022" strokeWidth="2" />
      {/* front brim */}
      <rect x="52" y="106" width="96" height="8" rx="4" fill="#00000033" />
      <path d="M70 62 C86 52 114 52 130 62" stroke="#ffffff55" strokeWidth="4" fill="none" strokeLinecap="round" />
    </>
  );
}

function Visor({ color }: { color: string }) {
  return (
    <>
      <rect x="66" y="72" width="68" height="36" rx="17" fill={color} fillOpacity="0.72" />
      {/* glossy sweep */}
      <path d="M72 82 C90 74 112 74 128 80" stroke="#ffffff88" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  );
}

// ---- Avatar composition ------------------------------------------------------

export function Avatar({
  skin,
  equipped,
  size = 160,
  className,
}: {
  skin: string;
  equipped: EquippedItem[];
  size?: number;
  className?: string;
}) {
  const gradientId = useId();
  const bySlot = new Map<SlotKey, EquippedItem>();
  for (const item of equipped) bySlot.set(item.slot, item);

  const hasHelmet = bySlot.has("helmet");

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Rider avatar"
    >
      {RENDER_ORDER.map((layer) => {
        if (layer === "body") return <Body key="body" skin={skin} />;

        const item = bySlot.get(layer);

        if (layer === "background") {
          if (!item) return <rect key="bg" x="0" y="0" width="200" height="200" fill="#1f2937" />;
          return (
            <Background
              key="bg"
              asset={item.asset}
              color={item.color ?? "#374151"}
              gradientId={gradientId}
            />
          );
        }

        if (layer === "jacket") {
          if (!item) return <DefaultShirt key="jacket" />;
          return <Jacket key="jacket" color={item.color ?? "#1f2937"} />;
        }

        if (layer === "helmet") {
          if (!item) return null;
          return item.asset === "helmet-open" ? (
            <HelmetOpen key="helmet" color={item.color ?? "#f3f4f6"} />
          ) : (
            <HelmetFull key="helmet" color={item.color ?? "#f97316"} />
          );
        }

        if (layer === "visor") {
          // A visor only makes sense with a helmet on.
          if (!item || !hasHelmet) return null;
          return <Visor key="visor" color={item.color ?? "#bae6fd"} />;
        }

        return null;
      })}
    </svg>
  );
}
