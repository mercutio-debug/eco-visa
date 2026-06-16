"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { WelcomePopup } from "./WelcomePopup";

/**
 * Mostra header e footer del sito, tranne sulle pagine /embed (le strisce
 * incorporabili da altri siti, che devono essere pulite e autonome).
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // pagine "nude" (senza header/footer): embed incorporabile e promo da registrare
  if (pathname?.startsWith("/embed") || pathname?.startsWith("/promo")) {
    return <main className="min-h-full">{children}</main>;
  }
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WelcomePopup />
    </>
  );
}
