import Link from "next/link";
import { EcoVisaLogo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-[#e3eed7] bg-leaf">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <EcoVisaLogo />
          <p className="mt-3 max-w-sm text-sm text-green-900/80">
            ECO-VISA misura quanto le materie prime di un prodotto sono
            sostenibili, calcolando i chilometri e la CO₂ del trasporto dal
            luogo di origine allo stabilimento di produzione.
          </p>
        </div>
        <div>
          <h4 className="label mb-2">Servizi</h4>
          <ul className="space-y-1 text-sm">
            <li><Link href="/prodotti" className="hover:text-lime-500">Schede prodotto</Link></li>
            <li><Link href="/calcola" className="hover:text-lime-500">Calcola impronta</Link></li>
            <li><Link href="/biofido" className="hover:text-lime-500">BioFido</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="label mb-2">Progetto</h4>
          <ul className="space-y-1 text-sm text-green-900/80">
            <li>Impronta ecologica</li>
            <li>Spesa km0</li>
            <li>Filiera corta</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#dceac9] py-4 text-center text-xs text-green-900/60">
        © {new Date().getFullYear()} ECO-VISA — concept basato sul progetto Pangea Etico.
      </div>
    </footer>
  );
}
