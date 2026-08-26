"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/reserver", label: "Réserver" },
  { href: "/chauffeur", label: "Chauffeur" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" onClick={() => setOpen(false)}>
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500 text-black">K</span>
          <span>VTC</span>
        </Link>

        {/* Desktop */}
        <div className="hidden sm:flex items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                "rounded-lg px-3 py-1.5 transition " +
                (isActive(l.href)
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "text-neutral-300 hover:bg-neutral-800 hover:text-white")
              }
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/reserver"
            className="ml-2 rounded-lg bg-emerald-500 px-4 py-1.5 font-semibold text-black hover:bg-emerald-400"
          >
            Réserver
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          className="sm:hidden rounded-lg border border-neutral-700 px-3 py-1.5 text-neutral-300"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          ☰
        </button>
      </nav>

      {open && (
        <div className="sm:hidden border-t border-neutral-800 bg-neutral-950 px-4 py-2 space-y-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={
                "block rounded-lg px-3 py-2 text-sm " +
                (isActive(l.href)
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "text-neutral-300 hover:bg-neutral-800")
              }
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/reserver"
            onClick={() => setOpen(false)}
            className="block rounded-lg bg-emerald-500 px-3 py-2 text-center font-semibold text-black"
          >
            Réserver une course
          </Link>
        </div>
      )}
    </header>
  );
}
