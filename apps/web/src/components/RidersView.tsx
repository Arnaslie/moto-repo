"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RiderMap } from "./RiderMap";
import type { RiderLocation } from "@moto/core/locations";

const POLL_MS = 5000;
const HANDLE_KEY = "moto:rider";

type LatLng = { lat: number; lng: number };

export function RidersView() {
  const [rider, setRider] = useState("");
  const [sharing, setSharing] = useState(false);
  const [me, setMe] = useState<LatLng | null>(null);
  const [locations, setLocations] = useState<RiderLocation[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const meRef = useRef<LatLng | null>(null);

  // Restore the rider handle from a previous visit. This runs post-mount (not
  // during render) on purpose: localStorage isn't available during SSR, and
  // populating after hydration avoids a server/client markup mismatch.
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
    };
  }, []);

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
    // Tell the server we've gone invisible (best effort).
    if (last) {
      await postLocation(last.lat, last.lng, null, false).catch(() => {});
    }
  }

  const others = locations.filter((l) => l.rider !== rider.trim());

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
      <div className="h-[60vh] w-full">
        <RiderMap locations={others} me={me} />
      </div>
    </div>
  );
}
