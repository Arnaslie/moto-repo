"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, type EquippedItem } from "./Avatar";
import { SLOTS, RARITY_LABELS, type SlotKey, type Rarity } from "@/lib/gear";

export type OwnedItem = {
  id: string;
  slot: SlotKey;
  name: string;
  brand: string | null;
  rarity: Rarity;
  asset: string;
  color: string | null;
};

const SKIN_TONES = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5a3410"];

export function AvatarCustomizer({
  owned,
  initialEquipped,
  initialSkin,
}: {
  owned: OwnedItem[];
  initialEquipped: Partial<Record<SlotKey, string>>;
  initialSkin: string;
}) {
  const router = useRouter();
  const [equipped, setEquipped] = useState(initialEquipped);
  const [skin, setSkin] = useState(initialSkin);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(owned.map((o) => [o.id, o]));
  const preview: EquippedItem[] = [];
  for (const [slot, id] of Object.entries(equipped)) {
    const item = id ? byId.get(id) : undefined;
    if (item) preview.push({ slot: slot as SlotKey, asset: item.asset, color: item.color });
  }

  async function save(payload: Record<string, unknown>, apply: () => void, revert: () => void) {
    apply();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't save.");
      }
      router.refresh();
    } catch (err) {
      revert();
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  function selectItem(slot: SlotKey, id: string | null) {
    const prev = equipped;
    save(
      id ? { gearItemId: id } : { clearSlot: slot },
      () => setEquipped({ ...prev, [slot]: id ?? undefined }),
      () => setEquipped(prev),
    );
  }

  function selectSkin(tone: string) {
    const prev = skin;
    save({ skin: tone }, () => setSkin(tone), () => setSkin(prev));
  }

  return (
    <div className="border-b border-black/10 px-4 py-4 dark:border-white/10">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="shrink-0 self-center">
          <div className="overflow-hidden rounded-2xl ring-1 ring-black/10 dark:ring-white/10">
            <Avatar skin={skin} equipped={preview} size={160} />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              Skin
            </p>
            <div className="flex gap-2">
              {SKIN_TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => selectSkin(tone)}
                  disabled={busy}
                  aria-label={`Skin tone ${tone}`}
                  className={`h-7 w-7 rounded-full ring-2 transition ${
                    skin === tone ? "ring-orange-500" : "ring-transparent"
                  }`}
                  style={{ backgroundColor: tone }}
                />
              ))}
            </div>
          </div>

          {SLOTS.map((slot) => {
            const items = owned.filter((o) => o.slot === slot.key);
            const current = equipped[slot.key];
            return (
              <div key={slot.key}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
                  {slot.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={!current} disabled={busy} onClick={() => selectItem(slot.key, null)}>
                    None
                  </Chip>
                  {items.map((item) => (
                    <Chip
                      key={item.id}
                      active={current === item.id}
                      disabled={busy}
                      onClick={() => selectItem(slot.key, item.id)}
                      swatch={item.color ?? undefined}
                      title={`${item.name}${item.rarity !== "common" ? ` · ${RARITY_LABELS[item.rarity]}` : ""}`}
                    >
                      {item.name}
                    </Chip>
                  ))}
                </div>
              </div>
            );
          })}

          {error && <p className="text-sm text-rose-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function Chip({
  children,
  active,
  disabled,
  onClick,
  swatch,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  swatch?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
        active
          ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400"
          : "border-black/15 hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
      } disabled:opacity-50`}
    >
      {swatch && (
        <span
          className="h-3 w-3 rounded-full ring-1 ring-black/20"
          style={{ backgroundColor: swatch }}
        />
      )}
      {children}
    </button>
  );
}
