"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Emergency } from "@/lib/supabase";

import "leaflet/dist/leaflet.css";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

const emptySubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

const severityColors: Record<number, string> = {
  5: "#dc2626",
  4: "#f97316",
  3: "#eab308",
  2: "#3b82f6",
  1: "#6b7280",
};

function createIcon(severity: number, highlighted: boolean) {
  const color = severityColors[severity] ?? "#6b7280";
  const size = highlighted ? 42 : 28;
  const h = highlighted ? 60 : 40;
  const cx = size / 2;
  const cy = size / 2;
  const r = highlighted ? 9 : 6;
  const ring = highlighted
    ? `<circle cx="${cx}" cy="${cy}" r="${cx - 2}" fill="none" stroke="white" stroke-width="3" opacity="0.9"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 ${size} ${h}">
    <path d="M${cx} 0C${cx * 0.45} 0 0 ${cx * 0.45} 0 ${cx}c0 ${cx * 0.75} ${cx} ${h - cx} ${cx} ${h - cx}s${cx}-${h - cx * 1.75} ${cx}-${h - cx}C${size} ${cx * 0.45} ${size - cx * 0.45} 0 ${cx} 0z" fill="${color}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="white"/>
    ${ring}
  </svg>`;
  return L.divIcon({
    html: svg,
    className: highlighted ? "selected-marker" : "",
    iconSize: [size, h],
    iconAnchor: [cx, h],
    popupAnchor: [0, -h],
  });
}

function FitBounds({ emergencies }: { emergencies: Emergency[] }) {
  const map = useMap();

  useEffect(() => {
    const points = emergencies
      .filter((e) => e.lat != null && e.lng != null)
      .map((e) => [e.lat!, e.lng!] as [number, number]);
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [emergencies, map]);

  return null;
}

function FlyToSelected({ emergencies, selectedId }: { emergencies: Emergency[]; selectedId: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedId) return;
    const e = emergencies.find((em) => em.id === selectedId);
    if (e?.lat != null && e?.lng != null) {
      map.flyTo([e.lat, e.lng], Math.max(map.getZoom(), 13), { duration: 0.8 });
    }
  }, [selectedId, emergencies, map]);

  return null;
}

export default function MapView({
  emergencies,
  onSelect,
  selectedId,
}: {
  emergencies: Emergency[];
  onSelect: (e: Emergency) => void;
  selectedId: string | null;
}) {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-900 text-gray-500">
        Loading map...
      </div>
    );
  }

  return (
    <MapContainer
      center={[39.8283, -98.5795]}
      zoom={4}
      className="h-full w-full"
      style={{ background: "#0f172a" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <FitBounds emergencies={emergencies} />
      <FlyToSelected emergencies={emergencies} selectedId={selectedId} />
      {emergencies
        .filter((e) => e.lat != null && e.lng != null)
        .map((e) => {
          const isSelected = e.id === selectedId;
          return (
            <Marker
              key={e.id}
              position={[e.lat!, e.lng!]}
              icon={createIcon(e.severity ?? 1, isSelected)}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{ click: () => onSelect(e) }}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{e.incident_type ?? "Unknown"}</strong>
                  <br />
                  Severity: {e.severity ?? "N/A"}
                </div>
              </Popup>
            </Marker>
          );
        })}
    </MapContainer>
  );
}
