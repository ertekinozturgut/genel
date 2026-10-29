"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dokümanlar" },
  { href: "/chat", label: "Sohbet" },
  { href: "/graph", label: "Bilgi Grafı" },
  { href: "/explorer", label: "İndeks Gezgini" },
  { href: "/settings", label: "Ayarlar" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="5" cy="6" r="2.5" fill="#7c9cff" />
            <circle cx="19" cy="7" r="2.5" fill="#5eead4" />
            <circle cx="12" cy="18" r="2.5" fill="#f59e0b" />
            <path d="M5 6L19 7M5 6l7 12M19 7l-7 11" stroke="#8b91a3" strokeWidth="1.3" />
          </svg>
          GraphRAG Studio
        </Link>
        <nav className="flex gap-1 overflow-x-auto text-sm">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" || path.startsWith("/documents") : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 transition ${active ? "bg-panel-2 text-ink" : "text-mute hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
