"use client";

import { useEffect, useRef, useState } from "react";

export type Suggestion = { label: string; short: string; lat: number; lng: number };

// Champ adresse avec autocomplétion via Photon (https://photon.komoot.io, basé sur OpenStreetMap).
// Gratuit, sans clé, moins de throttle que Nominatim. On conserve lat/lng en mémoire et on
// renvoie un label court (rue + ville) lisible dans le champ.
export default function AddressInput({
  label,
  value,
  onChange,
  required,
  excludePt,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  excludePt?: [number, number];
}) {
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Déduplique les requêtes identiques (cache simple en mémoire).
  const cache = useRef<Map<string, Suggestion[]>>(new Map());

  useEffect(() => {
    if (value.length < 3) {
      setSugs([]);
      return;
    }
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const cached = cache.current.get(value);
        if (cached) {
          setSugs(cached);
          setOpen(true);
          setBusy(false);
          return;
        }
        // Priorité IDF+Oise (zone d'activité du VTC) via le paramètre bbox léger.
        const url =
          "https://photon.komoot.io/api/?lang=fr&limit=5&q=" +
          encodeURIComponent(value);
        const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
        const data = await res.json();
        const arr = Array.isArray(data?.features) ? data.features : [];
        const out: Suggestion[] = arr.map((f: any) => {
          const p = f.properties || {};
          const parts = [p.name, p.street, p.housenumber, p.city || p.town || p.village, p.postcode].filter(Boolean);
          const short = [p.housenumber ? `${p.housenumber} ${p.street || p.name}` : (p.street || p.name), p.city || p.town || p.village].filter(Boolean).join(", ");
          return {
            label: p.name ? parts.join(", ") : (p.label || short),
            short: short || p.name || value,
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
          };
        });
        cache.current.set(value, out);
        setSugs(out);
        setOpen(true);
      } catch {
        setSugs([]);
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [value]);

  // Ferme la liste si on clique ailleurs.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="input"
        placeholder={label}
        value={value}
        required={required}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => sugs.length && setOpen(true)}
      />
      {busy && <span className="absolute right-3 top-3 text-xs text-neutral-500">…</span>}
      {open && sugs.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 text-sm shadow-lg">
          {sugs.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-neutral-800"
                onClick={() => {
                  onChange(s.short);
                  setOpen(false);
                }}
              >
                {s.short}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
