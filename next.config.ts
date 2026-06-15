import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Esporta il sito come file statici (cartella out/) per hosting condiviso (Hostinger).
  output: "export",
  // L'ottimizzazione immagini di Next richiede un server: disattivata per l'export statico.
  images: { unoptimized: true },
  // URL con slash finale -> Hostinger serve le cartelle con index.html senza errori 404.
  trailingSlash: true,
};

export default nextConfig;
