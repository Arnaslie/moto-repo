"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RiderMap } from "./RiderMap";
import { StretchComposer } from "./StretchComposer";
import { StretchTrends } from "./StretchTrends";
import type { RiderLocation } from "@moto/core/locations";
import {
  MAX_PATH_POINTS,
  MIN_PATH_POINTS,
  MIN_RENDER_ZOOM,
  STRETCH_KINDS,
  type Bounds,
  type LatLng,
  type Stretch,
  type TrendingTag,
} from "@moto/core/stretches";

const POLL_MS = 5000;
const REFETCH_DEBOUNCE_MS = 400;
const HANDLE_KEY = "moto:rider";

export function RidersView({ viewerHandle }: { viewerHandle: string | null }) {
  const [rider, setRider] = useState("");
  const [sharing, setSharing] = useState(false);
  const [me, setMe] = useState<LatLng | null>(null);
  const [locations, setLocations] = useState<RiderLocation[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const [stretches, setStretches] = useState<Stretch[]>([]);
  const [trends, setTrends] = useState<TrendingTag[]>([]);
  const [zoom, setZoom] = useState(2);
  const [drawing, setDrawing] = useState(false);
  const [draftPath, setDraftPath] = useState<LatLng[]>([]);
  const [composing, setComposing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const meRef = useRef<LatLng | null>(null);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(HANDLE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of persisted handle
    if (saved) setRider(saved);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/locations");
        const data = await res.json();
        if (active) setLocations(data.locations ?? []);
      } catch {
        /* transient network error — next tick retries */
      }
    }
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    };
  }, []);

  const loadChalk = useCallback(async (bounds: Bounds) => {
    const query = new URLSearchParams({
      minLat: String(bounds.minLat),
      maxLat: String(bounds.maxLat),
      minLng: String(bounds.minLng),
      maxLng: String(bounds.maxLng),
    }).toString();

    try {
      const [stretchRes, trendRes] = await Promise.all([
        fetch(`/api/stretches?${query}`),
        fetch(`/api/stretches/trends?${query}`),
      ]);
      const [stretchData, trendData] = await Promise.all([
        stretchRes.json(),
        trendRes.json(),
      ]);
      setStretches(stretchData.stretches ?? []);
      setTrends(trendData.tags ?? []);
    } catch {
      /* transient network error — the next pan retries */
    }
  }, []);

  const onViewportChange = useCallback(
    (bounds: Bounds, nextZoom: number) => {
      setZoom(nextZoom);
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      if (nextZoom < MIN_RENDER_ZOOM) {
        setStretches([]);
        setTrends([]);
        return;
      }
      refetchTimer.current = setTimeout(() => loadChalk(bounds), REFETCH_DEBOUNCE_MS);
    },
    [loadChalk],
  );

  const cancelDraw = useCallback(() => {
    setDrawing(false);
    setComposing(false);
    setDraftPath([]);
  }, []);

  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDraw();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawing, cancelDraw]);

  const postLocation = useCallback(
    async (lat: number, lng: number, accuracy: number | null, share: boolean) => {
      await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rider: rider.trim(), lat, lng, accuracy, sharing: share }),
      });
    },
    [rider],
  );

  function startSharing() {
    if (!rider.trim()) {
      setStatus("Enter a handle first.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setStatus("Geolocation isn't supported in this browser.");
      return;
    }
    localStorage.setItem(HANDLE_KEY, rider.trim());
    setStatus("Locating you…");
    setSharing(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const p = { lat: latitude, lng: longitude };
        setMe(p);
        meRef.current = p;
        setStatus(null);
        postLocation(latitude, longitude, accuracy, true).catch(() => {});
      },
      (err) => {
        setStatus(err.message || "Couldn't get your location.");
        setSharing(false);
        if (watchIdRef.current != null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  }

  async function stopSharing() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
    setStatus(null);
    const last = meRef.current;
    setMe(null);
    if (last) {
      await postLocation(last.lat, last.lng, null, false).catch(() => {});
    }
  }

  async function vote(id: string, value: number) {
    const res = await fetch(`/api/stretches/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setStretches((current) =>
      current.map((s) =>
        s.id === id
          ? {
              ...s,
              score: data.score,
              myVote: data.myVote,
              lastConfirmedAt: data.lastConfirmedAt ?? s.createdAt,
            }
          : s,
      ),
    );
  }

  async function removeStretch(id: string) {
    const res = await fetch(`/api/stretches/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setStretches((current) => current.filter((s) => s.id !== id));
    setSelectedId(null);
  }

  const others = locations.filter((l) => l.rider !== rider.trim());
  const selected = stretches.find((s) => s.id === selectedId) ?? null;
  const canFinish = draftPath.length >= MIN_PATH_POINTS;
  const tooZoomedOut = zoom < MIN_RENDER_ZOOM;

  return (
    <div>
      <div className="border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={rider}
            onChange={(e) => setRider(e.target.value)}
            disabled={sharing}
            placeholder="Your handle"
            maxLength={40}
            className="min-w-0 flex-1 rounded-full border border-black/15 bg-transparent px-4 py-2 text-sm outline-none focus:border-orange-500 disabled:opacity-50 dark:border-white/20"
          />
          <button
            type="button"
            onClick={sharing ? stopSharing : startSharing}
            className={`rounded-full px-5 py-2 text-sm font-semibold text-white transition-colors ${
              sharing
                ? "bg-rose-500 hover:bg-rose-600"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {sharing ? "Stop sharing" : "Share my location"}
          </button>
        </div>
        <p className="mt-2 text-sm text-black/50 dark:text-white/50">
          {status ??
            `${others.length} rider${others.length === 1 ? "" : "s"} sharing right now` +
              (sharing ? " · you're live 🟢" : "")}
        </p>
      </div>

      <div className="flex min-h-[76px] flex-wrap items-center gap-2 border-b border-black/10 px-4 py-3 dark:border-white/10">
        {drawing ? (
          <>
            <button
              type="button"
              onClick={() => {
                setDrawing(false);
                setComposing(true);
              }}
              disabled={!canFinish}
              className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-40"
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => setDraftPath((p) => p.slice(0, -1))}
              disabled={draftPath.length === 0}
              className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold transition-colors hover:border-black/30 disabled:opacity-40 dark:border-white/20 dark:hover:border-white/40"
            >
              Undo point
            </button>
            <button
              type="button"
              onClick={cancelDraw}
              className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold transition-colors hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
            >
              Cancel
            </button>
            <p className="w-full text-sm text-black/50 dark:text-white/50">
              Click along the road — {draftPath.length}/{MAX_PATH_POINTS} points.
              Escape cancels.
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setDraftPath([]);
                setDrawing(true);
              }}
              disabled={!viewerHandle || tooZoomedOut || composing}
              className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-40"
            >
              Chalk a stretch
            </button>
            <p className="w-full text-sm text-black/50 dark:text-white/50">
              {!viewerHandle
                ? "Sign in to chalk a stretch."
                : tooZoomedOut
                  ? "Zoom in to see and add road notes."
                  : `${stretches.length} stretch${stretches.length === 1 ? "" : "es"} chalked here`}
            </p>
          </>
        )}
      </div>

      <div className="h-[60vh] w-full">
        <RiderMap
          locations={others}
          me={me}
          stretches={stretches}
          draftPath={draftPath}
          drawing={drawing}
          selectedId={selectedId}
          onMapClick={(point) =>
            setDraftPath((current) =>
              current.length >= MAX_PATH_POINTS ? current : [...current, point],
            )
          }
          onViewportChange={onViewportChange}
          onSelectStretch={setSelectedId}
        />
      </div>

      {composing && (
        <StretchComposer
          path={draftPath}
          onCancel={cancelDraw}
          onCreated={(stretch) => {
            setStretches((current) => [stretch, ...current]);
            cancelDraw();
            setSelectedId(stretch.id);
          }}
        />
      )}

      {selected && !composing && (
        <div className="border-t border-black/10 px-4 py-3 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{selected.label}</span>
            <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs font-semibold text-black/60 dark:border-white/20 dark:text-white/60">
              {STRETCH_KINDS[selected.kind].name}
            </span>
            <span className="text-xs text-black/50 dark:text-white/50">
              @{selected.author}
            </span>
            <span className="ml-auto text-sm tabular-nums">{selected.score}</span>
            <button
              type="button"
              onClick={() => vote(selected.id, selected.myVote === 1 ? 0 : 1)}
              disabled={!viewerHandle}
              aria-pressed={selected.myVote === 1}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-40 ${
                selected.myVote === 1
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-black/15 dark:border-white/20"
              }`}
            >
              Still true
            </button>
            <button
              type="button"
              onClick={() => vote(selected.id, selected.myVote === -1 ? 0 : -1)}
              disabled={!viewerHandle}
              aria-pressed={selected.myVote === -1}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-40 ${
                selected.myVote === -1
                  ? "border-rose-500 text-rose-600 dark:text-rose-400"
                  : "border-black/15 dark:border-white/20"
              }`}
            >
              Not any more
            </button>
            {viewerHandle === selected.author && (
              <button
                type="button"
                onClick={() => removeStretch(selected.id)}
                className="rounded-full border border-black/15 px-3 py-1 text-xs font-semibold transition-colors hover:border-rose-500 dark:border-white/20"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Close"
              className="rounded-full border border-black/15 px-3 py-1 text-xs font-semibold dark:border-white/20"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <StretchTrends tags={trends} />
    </div>
  );
}
