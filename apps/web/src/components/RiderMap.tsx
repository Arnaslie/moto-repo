"use client";

import { useEffect, useRef, useState } from "react";
import type * as LeafletNS from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RiderLocation } from "@moto/core/locations";

type LatLng = { lat: number; lng: number };

const PIN_COLORS = [
  "#f97316", // orange
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#10b981", // emerald
  "#8b5cf6", // violet
];

function colorFor(rider: string): string {
  let hash = 0;
  for (let i = 0; i < rider.length; i++) {
    hash = (hash + rider.charCodeAt(i)) % PIN_COLORS.length;
  }
  return PIN_COLORS[hash];
}

function pinIcon(L: typeof LeafletNS, label: string, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:28px;height:28px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);background:${color};
      border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:white;font:600 12px system-ui;">
        ${label}
      </span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 26],
  });
}

export function RiderMap({
  locations,
  me,
}: {
  locations: RiderLocation[];
  me: LatLng | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const layerRef = useRef<LeafletNS.LayerGroup | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      leafletRef.current = L;
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();
    const points: LeafletNS.LatLngExpression[] = [];

    for (const loc of locations) {
      const initial = loc.rider.charAt(0).toUpperCase() || "?";
      L.marker([loc.lat, loc.lng], {
        icon: pinIcon(L, initial, colorFor(loc.rider)),
      })
        .bindPopup(`<strong>@${loc.rider}</strong>`)
        .addTo(layer);
      points.push([loc.lat, loc.lng]);
    }

    if (me) {
      L.circleMarker([me.lat, me.lng], {
        radius: 8,
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 1,
        weight: 3,
      })
        .bindPopup("You")
        .addTo(layer);
      points.push([me.lat, me.lng]);
    }

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points).pad(0.3), { maxZoom: 14 });
    }
  }, [ready, locations, me]);

  return <div ref={containerRef} className="h-full w-full" />;
}
