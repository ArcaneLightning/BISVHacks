"use client";

import { useEffect, useRef, useState } from "react";

export default function EmergencyMiniMap({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    (async () => {
      try {
        const L = await import("leaflet");

        if (cancelled || !containerRef.current) return;

        map = L.map(containerRef.current, {
          center: [lat, lng],
          zoom: 15,
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false,
          boxZoom: false,
          keyboard: false,
        });

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        ).addTo(map);

        const pin = L.divIcon({
          html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
            <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="#dc2626"/>
            <circle cx="14" cy="14" r="6" fill="white"/>
          </svg>`,
          className: "",
          iconSize: [28, 40],
          iconAnchor: [14, 40],
        });

        L.marker([lat, lng], { icon: pin }).addTo(map);

        setTimeout(() => map?.invalidateSize(), 100);
      } catch (e) {
        console.error("Failed to load map:", e);
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng]);

  if (error) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-lg bg-gray-900 text-xs text-gray-500">
        Could not load map &middot;{" "}
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 text-blue-400 underline"
        >
          Open in Google Maps
        </a>
      </div>
    );
  }

  return (
    <div
      className="relative h-48 w-full overflow-hidden rounded-lg"
      style={{ background: "#111827" }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
