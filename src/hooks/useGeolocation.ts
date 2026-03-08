"use client";

import { useCallback, useState } from "react";

type Coords = { lat: number; lng: number };

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getPosition = useCallback((): Promise<Coords> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const msg = "Geolocation is not supported";
        setError(msg);
        return reject(new Error(msg));
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(c);
          resolve(c);
        },
        (err) => {
          setError(err.message);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }, []);

  return { coords, error, getPosition };
}
