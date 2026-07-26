import Link from "next/link";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/reserver", label: "Réserver" },
  { href: "/chauffeur", label: "Chauffeur" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500 text-black">K</span>
          <span>VTC</span>
        </Link>
        <div className="flex items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
