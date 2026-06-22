import Link from "next/link";
import { EcoVisaLogo } from "./Logo";
import { UserMenu } from "./UserMenu";

const nav = [
  { href: "/prodotti", label: "Prodotti" },
  { href: "/calcola", label: "Calcola impronta" },
  { href: "/biofido", label: "BioFido" },
  { href: "/servizi-extra", label: "Servizi extra" },
  { href: "/abbonamenti", label: "Abbonamenti" },
  { href: "/#come-funziona", label: "Come funziona" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#e3eed7] bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="ECO-VISA home">
          <EcoVisaLogo />
        </Link>
        <div className="flex items-center gap-4">
          <nav className="hidden items-center gap-5 lg:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-sm font-semibold text-green-800 hover:text-lime-500"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
