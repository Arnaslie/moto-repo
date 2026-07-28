"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  COMMON_MAKES,
  MAKE_MAX,
  MODEL_MAX,
  NICKNAME_MAX,
  MIN_YEAR,
  maxYear,
  type Motorcycle,
} from "@/lib/motorcycles";

export function Garage({
  bikes: initialBikes,
  canEdit,
}: {
  bikes: Motorcycle[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const makesListId = useId();
  const [bikes, setBikes] = useState<Motorcycle[]>(initialBikes);
  const [adding, setAdding] = useState(false);
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setYear("");
    setMake("");
    setModel("");
    setNickname("");
    setError(null);
  }

  async function addBike(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/motorcycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, make, model, nickname }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't add that bike.");
      setBikes((prev) => [...prev, data.motorcycle as Motorcycle]);
      resetForm();
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that bike.");
    } finally {
      setBusy(false);
    }
  }

  async function removeBike(id: string) {
    const prev = bikes;
    setBikes((b) => b.filter((x) => x.id !== id)); // optimistic
    try {
      const res = await fetch(`/api/motorcycles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setBikes(prev); // revert on failure
    }
  }

  return (
    <section className="border-b border-black/10 px-4 py-4 dark:border-white/10">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          <span aria-hidden>🏍️</span> Garage
          {bikes.length > 0 && (
            <span className="text-black/40 dark:text-white/40">({bikes.length})</span>
          )}
        </h3>
        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full border border-black/15 px-3 py-1 text-sm font-medium transition-colors hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
          >
            + Add bike
          </button>
        )}
      </div>

      {bikes.length === 0 && !adding && (
        <p className="text-sm text-black/40 dark:text-white/40">
          {canEdit ? "No bikes yet — add your first ride." : "No bikes in the garage yet."}
        </p>
      )}

      <ul className="space-y-2">
        {bikes.map((bike) => (
          <li
            key={bike.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-3 py-2.5 dark:border-white/10"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {bike.year} {bike.make} {bike.model}
              </p>
              {bike.nickname && (
                <p className="truncate text-sm text-black/50 dark:text-white/50">
                  “{bike.nickname}”
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={`/showroom/${bike.id}`}
                className="rounded-full px-3 py-1 text-sm font-medium text-orange-500 transition-colors hover:bg-orange-500/10"
              >
                Showroom
              </Link>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => removeBike(bike.id)}
                  aria-label={`Remove ${bike.year} ${bike.make} ${bike.model}`}
                  className="rounded-full px-2 py-1 text-sm text-black/40 transition-colors hover:bg-rose-500/10 hover:text-rose-500 dark:text-white/40"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {canEdit && adding && (
        <form onSubmit={addBike} className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Year"
              min={MIN_YEAR}
              max={maxYear()}
              required
              className="w-24 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-orange-500 dark:border-white/20"
            />
            <input
              type="text"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Make"
              list={makesListId}
              maxLength={MAKE_MAX}
              required
              className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-orange-500 dark:border-white/20"
            />
            <datalist id={makesListId}>
              {COMMON_MAKES.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model"
              maxLength={MODEL_MAX}
              required
              className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-orange-500 dark:border-white/20"
            />
          </div>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname (optional)"
            maxLength={NICKNAME_MAX}
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-orange-500 dark:border-white/20"
          />
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setAdding(false);
              }}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-orange-500 px-5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
