"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { label: string; lat: number; lng: number };

// Champ adresse avec autocomplétion via Nominatim (OpenStreetMap, gratuit).
// À chaque frappe (avec debounce), on propose des adresses réelles pour éviter les erreurs de saisie.
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
  excludePt?: [number, number]; // optionnel : biais vers une zone (non bloquant)
}) {
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounce : on attend 350ms après la dernière frappe avant d'interroger Nominatim.
  useEffect(() => {
    if (value.length < 3) {
      setSugs([]);
      return;
    }
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const url =
          "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=5&q=" +
          encodeURIComponent(value);
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setSugs(
            data.map((d: { display_name: string; lat: string; lon: string }) => ({
              label: d.display_name,
              lat: parseFloat(d.lat),
              lng: parseFloat(d.lon),
            }))
          );
          setOpen(true);
        }
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
                  onChange(s.label);
                  setOpen(false);
                }}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
