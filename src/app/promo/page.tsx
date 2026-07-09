"use client";

import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// durata di ogni scena (ms) — bilanciata in base al testo (totale ~47s)
const DUR = [6000, 9500, 7000, 8500, 9000, 7000];
const TOTAL = DUR.reduce((a, b) => a + b, 0);

export default function PromoPage() {
  const [i, setI] = useState(0);
  const [ended, setEnded] = useState(false);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (ended) return;
    const t = setTimeout(() => {
      setI((prev) => {
        if (prev >= DUR.length - 1) {
          setEnded(true);
          return prev;
        }
        return prev + 1;
      });
    }, DUR[i]);
    return () => clearTimeout(t);
  }, [i, ended, runId]);

  function replay() {
    setI(0);
    setEnded(false);
    setRunId((r) => r + 1);
  }

  const on = (n: number) => (i === n ? "on" : "");

  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        width: "100%",
        overflow: "hidden",
        background:
          "radial-gradient(120% 120% at 30% 18%, #2a6a14 0%, #143005 62%, #0b2103 100%)",
        fontFamily: "var(--font-barlow), system-ui, sans-serif",
        color: "#eaffd6",
      }}
    >
      {/* trama a puntini stile presentazione */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(234,255,214,.10) 1.5px, transparent 1.6px)",
          backgroundSize: "26px 26px",
          pointerEvents: "none",
        }}
      />

      <style>{`
        .scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
          text-align:center;padding:6vh 6vw;opacity:0;transform:scale(.96) translateY(14px);
          transition:opacity .9s ease,transform .9s ease;pointer-events:none}
        .scene.on{opacity:1;transform:none}
        .disp{font-family:var(--font-anton),Impact,sans-serif;font-style:italic;text-transform:uppercase;line-height:.92;letter-spacing:.5px}
        .whitecard{background:#fff;border-radius:18px;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.3)}
        .pin{animation:drop .6s ease both}
        @keyframes drop{from{opacity:0;transform:translateY(-18px)}to{opacity:1;transform:none}}
        @keyframes barfill{from{width:0}to{width:100%}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
      `}</style>

      {/* 1 — apertura */}
      <div className={`scene ${on(0)}`}>
        <svg width="88" height="88" viewBox="0 0 64 64" aria-hidden="true" style={{ marginBottom: 16 }}>
          <circle cx="32" cy="32" r="28" fill="#8cc63f" />
          <g fill="none" stroke="#143306" strokeWidth="1.6" opacity="0.6">
            <ellipse cx="32" cy="32" rx="12" ry="28" /><ellipse cx="32" cy="32" rx="24" ry="28" />
            <line x1="4" y1="32" x2="60" y2="32" />
          </g>
        </svg>
        <div className="disp" style={{ fontSize: "clamp(40px,9vw,104px)", color: "#fff" }}>
          ECO<span style={{ color: "#8cc63f" }}>-VISA</span>
        </div>
        <p style={{ marginTop: 18, fontSize: "clamp(18px,2.6vw,30px)", maxWidth: 720, color: "#dcf2b8" }}>
          Quanti chilometri ha percorso ciò che hai acquistato?
        </p>
      </div>

      {/* 2 — conto ecologico / semaforo */}
      <div className={`scene ${on(1)}`}>
        <span style={{ fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", fontSize: "clamp(12px,1.8vw,17px)", color: "#8cc63f" }}>
          Il conto dei chilometri
        </span>
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: "5vw", flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14, borderRadius: 22, background: "#0e2604" }}>
            {["#e2231a", "#f6c416", "#45a82f"].map((c, idx) => (
              <span key={c} style={{ width: 46, height: 46, borderRadius: "50%", background: c, boxShadow: idx === 2 ? `0 0 26px ${c}` : "none", opacity: idx === 2 ? 1 : 0.35 }} />
            ))}
          </div>
          <p style={{ textAlign: "left", maxWidth: 540, fontSize: "clamp(18px,2.5vw,28px)", color: "#eaffd6" }}>
            Vedi l&apos;<strong>impatto e l&apos;origine</strong> di ogni ingrediente. Più bassa è la <strong>CO₂</strong>, più alto è il punteggio — con <strong>sconti e premi</strong>.
          </p>
        </div>
      </div>

      {/* 3 — passaporto della filiera */}
      <div className={`scene ${on(2)}`}>
        <div className="disp" style={{ fontSize: "clamp(30px,6vw,72px)", color: "#fff" }}>
          Il passaporto<br />della filiera
        </div>
        <p style={{ marginTop: 16, fontSize: "clamp(17px,2.5vw,28px)", maxWidth: 720, color: "#dcf2b8" }}>
          Ogni prodotto ottiene la sua scheda con il semaforo, da mostrare sul proprio sito.
        </p>
      </div>

      {/* 4 — spesa km0 (grafica originale dalla presentazione) */}
      <div className={`scene ${on(3)}`}>
        <div style={{ display: "flex", alignItems: "center", gap: "4vw", flexWrap: "wrap", justifyContent: "center" }}>
          <div className="whitecard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/promo/km0-cerchi.jpg`} alt="Raggi km0" style={{ height: "min(36vh,260px)", width: "auto", display: "block" }} />
          </div>
          <div style={{ textAlign: "left", maxWidth: 460 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/promo/spesa-km0.jpg`} alt="Spesa km0" style={{ height: 84, width: "auto", borderRadius: "50%", marginBottom: 12 }} />
            <p style={{ fontSize: "clamp(18px,2.5vw,28px)", color: "#eaffd6" }}>
              Il portale suggerisce <strong>alternative simili</strong> a minor impatto, magari da un produttore più <strong>vicino</strong> a te.
            </p>
          </div>
        </div>
      </div>

      {/* 5 — BioFido */}
      <div className={`scene ${on(4)}`}>
        <div style={{ display: "flex", alignItems: "center", gap: "4vw", flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ borderRadius: 18, overflow: "hidden", border: "4px solid #8cc63f", boxShadow: "0 12px 34px rgba(0,0,0,.4)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/brand/biofido.jpg`} alt="BioFido — il segugio del biologico" style={{ height: "min(40vh,300px)", width: "auto", display: "block" }} />
          </div>
          <div style={{ textAlign: "left", maxWidth: 440 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/promo/biofido-logo.png`} alt="BioFido" style={{ height: 60, width: "auto", marginBottom: 12 }} />
            <p style={{ fontSize: "clamp(17px,2.4vw,27px)", color: "#eaffd6" }}>
              Un <strong>segugio</strong> che trova nella tua zona produttori, negozi e ristoranti <strong>bio</strong>: un hub diffuso di realtà locali.
            </p>
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${BASE}/promo/biofido-icon.png`} alt="App BioFido" style={{ height: 56, width: 56, borderRadius: 14 }} />
              <span style={{ fontWeight: 700, color: "#8cc63f", fontSize: "clamp(15px,2vw,20px)" }}>
                Scarica l&apos;app gratuita
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6 — mission + CTA */}
      <div className={`scene ${on(5)}`}>
        <span style={{ fontSize: "clamp(13px,1.8vw,18px)", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#8cc63f" }}>
          La nostra missione
        </span>
        <div className="disp" style={{ marginTop: 10, fontSize: "clamp(26px,5vw,60px)", color: "#fff", maxWidth: 900 }}>
          Rendere visibili i chilometri<br />e premiare la filiera corta
        </div>
        <p style={{ marginTop: 22, fontSize: "clamp(20px,3vw,34px)", fontWeight: 700, color: "#8cc63f" }}>ecovisa.it</p>
      </div>

      {/* barra avanzamento */}
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 5, width: "100%", background: "rgba(255,255,255,.12)" }}>
        {!ended && <div key={runId} style={{ height: "100%", background: "#8cc63f", animation: "barfill linear forwards", animationDuration: `${TOTAL}ms` }} />}
      </div>

      {ended && (
        <button onClick={replay} style={{ position: "absolute", bottom: 18, right: 18, padding: "10px 18px", borderRadius: 999, border: "none", background: "#8cc63f", color: "#143306", fontWeight: 700, cursor: "pointer" }}>
          ↻ Rivedi
        </button>
      )}
    </div>
  );
}
