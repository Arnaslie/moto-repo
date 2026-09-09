"use client";

import { useEffect, useRef, useState } from "react";
import type * as LeafletNS from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RiderLocation } from "@moto/core/locations";
import {
  FADE_FLOOR,
  MIN_RENDER_ZOOM,
  freshness,
  type Bounds,
  type LatLng,
  type Stretch,
} from "@moto/core/stretches";

const TOOLTIP_ZOOM = 12;
const CASING_WEIGHT = 9;
const CORE_WEIGHT = 5;

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

function boundsOfMap(map: LeafletNS.Map): Bounds {
  const b = map.getBounds();
  return {
    minLat: b.getSouth(),
    maxLat: b.getNorth(),
    minLng: Math.max(-180, b.getWest()),
    maxLng: Math.min(180, b.getEast()),
  };
}

export function RiderMap({
  locations,
  me,
  stretches = [],
  draftPath = [],
  drawing = false,
  selectedId = null,
  onMapClick,
  onViewportChange,
  onSelectStretch,
}: {
  locations: RiderLocation[];
  me: LatLng | null;
  stretches?: Stretch[];
  draftPath?: LatLng[];
  drawing?: boolean;
  selectedId?: string | null;
  onMapClick?: (point: LatLng) => void;
  onViewportChange?: (bounds: Bounds, zoom: number) => void;
  onSelectStretch?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const layerRef = useRef<LeafletNS.LayerGroup | null>(null);
  const chalkRef = useRef<LeafletNS.LayerGroup | null>(null);
  const draftRef = useRef<LeafletNS.LayerGroup | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(2);

  const handlers = useRef({ onMapClick, onViewportChange, onSelectStretch, drawing });
  useEffect(() => {
    handlers.current = { onMapClick, onViewportChange, onSelectStretch, drawing };
  });

  const hasFitted = useRef(false);
  const hadMe = useRef(false);

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

      const report = () => {
        setZoom(map.getZoom());
        handlers.current.onViewportChange?.(boundsOfMap(map), map.getZoom());
      };
      map.on("moveend", report);
      map.on("click", (e: LeafletNS.LeafletMouseEvent) => {
        if (!handlers.current.drawing) return;
        handlers.current.onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      leafletRef.current = L;
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      chalkRef.current = L.layerGroup().addTo(map);
      draftRef.current = L.layerGroup().addTo(map);
      setReady(true);
      report();
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (drawing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    const container = map.getContainer();
    container.style.cursor = drawing ? "crosshair" : "";
  }, [ready, drawing]);

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

    const startedSharing = Boolean(me) && !hadMe.current;
    hadMe.current = Boolean(me);

    if (points.length > 0 && (!hasFitted.current || startedSharing)) {
      hasFitted.current = true;
      const target = startedSharing && me ? [[me.lat, me.lng] as [number, number]] : points;
      map.fitBounds(L.latLngBounds(target).pad(0.3), { maxZoom: 14 });
    }
  }, [ready, locations, me]);

  useEffect(() => {
    const L = leafletRef.current;
    const chalk = chalkRef.current;
    if (!ready || !L || !chalk) return;

    chalk.clearLayers();
    if (zoom < MIN_RENDER_ZOOM) return;

    const now = Date.now();
    for (const stretch of stretches) {
      const alive = freshness(stretch.kind, stretch.lastConfirmedAt, now);
      if (alive < FADE_FLOOR) continue;

      const line = stretch.path.map((p) => [p.lat, p.lng] as [number, number]);
      const selected = stretch.id === selectedId;

      L.polyline(line, {
        className: "chalk-casing",
        weight: CASING_WEIGHT,
        opacity: alive * 0.55,
        interactive: false,
      }).addTo(chalk);

      const core = L.polyline(line, {
        className: `chalk-core chalk-${stretch.kind}`,
        weight: selected ? CORE_WEIGHT + 2 : CORE_WEIGHT,
        opacity: alive,
      }).addTo(chalk);

      core.on("click", (e: LeafletNS.LeafletMouseEvent) => {
        if (handlers.current.drawing) return;
        L.DomEvent.stop(e);
        handlers.current.onSelectStretch?.(stretch.id);
      });

      if (zoom >= TOOLTIP_ZOOM) {
        core.bindTooltip(stretch.label, {
          permanent: true,
          direction: "center",
          className: "chalk-tip",
          opacity: 1,
        });
      }
    }
  }, [ready, stretches, zoom, selectedId]);

  useEffect(() => {
    const L = leafletRef.current;
    const draft = draftRef.current;
    if (!ready || !L || !draft) return;

    draft.clearLayers();
    if (draftPath.length === 0) return;

    const line = draftPath.map((p) => [p.lat, p.lng] as [number, number]);
    if (line.length > 1) {
      L.polyline(line, {
        className: "chalk-draft",
        weight: CORE_WEIGHT,
        dashArray: "6 6",
        interactive: false,
      }).addTo(draft);
    }
    for (const point of line) {
      L.circleMarker(point, {
        radius: 4,
        className: "chalk-draft-vertex",
        weight: 2,
        fillOpacity: 1,
        interactive: false,
      }).addTo(draft);
    }
  }, [ready, draftPath]);

  return <div ref={containerRef} className="h-full w-full" />;
}
