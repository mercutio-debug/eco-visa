import type { Metadata } from "next";
import { Anton, Barlow } from "next/font/google";
import "./globals.css";
import { SiteChrome } from "@/components/SiteChrome";
import { CartDrawer } from "@/components/CartDrawer";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const barlow = Barlow({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});

const TITLE = "ECO-VISA — l'impronta di trasporto delle materie prime";
const DESCRIPTION =
  "ECO-VISA misura l'impronta di trasporto dei prodotti calcolando i chilometri e la CO₂ del trasporto delle materie prime, dal luogo di origine allo stabilimento di produzione.";

// Il mirror su GitHub Pages (build con GITHUB_PAGES=true) è un DOPPIONE di
// ecovisa.it: lo marchiamo noindex così Google indicizza solo il dominio vero.
const isGitHubPages = process.env.GITHUB_PAGES === "true";

export const metadata: Metadata = {
  metadataBase: new URL("https://ecovisa.it"),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "ECO-VISA",
  keywords: [
    "impronta di trasporto",
    "CO2 trasporto materie prime",
    "filiera corta",
    "chilometro zero",
    "prodotti bio",
    "filiera corta aziende agricole",
  ],
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "ECO-VISA",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/demo/onboarding/img/campagna.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/demo/onboarding/img/campagna.jpg"],
  },
  robots: isGitHubPages
    ? { index: false, follow: true }
    : { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://ecovisa.it/#org",
      name: "ECO-VISA",
      url: "https://ecovisa.it",
      description: DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": "https://ecovisa.it/#site",
      url: "https://ecovisa.it",
      name: "ECO-VISA",
      inLanguage: "it-IT",
      publisher: { "@id": "https://ecovisa.it/#org" },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${anton.variable} ${barlow.variable}`}>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SiteChrome>{children}</SiteChrome>
        <CartDrawer portale="ECO-VISA" />
      </body>
    </html>
  );
}
