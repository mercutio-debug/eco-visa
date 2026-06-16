"use client";

import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// durata di ogni scena (ms) — totale 20 secondi
const DUR = [4000, 4200, 3400, 4400, 4000];

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

  const active = (n: number) => (i === n ? "on" : "");

  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        width: "100%",
        overflow: "hidden",
        background: "radial-gradient(120% 120% at 30% 20%, #1f5210 0%, #123005 60%, #0b2103 100%)",
        fontFamily: "var(--font-barlow), system-ui, sans-serif",
        color: "#eaffd6",
      }}
    >
      <style>{`
        .scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
          text-align:center;padding:6vh 6vw;opacity:0;transform:scale(.96) translateY(14px);
          transition:opacity .7s ease,transform .7s ease;pointer-events:none}
        .scene.on{opacity:1;transform:none}
        .disp{font-family:var(--font-anton),Impact,sans-serif;font-style:italic;text-transform:uppercase;line-height:.95;letter-spacing:.5px}
        .dot{width:14px;height:14px;border-radius:50%;background:#8cc63f;display:inline-block;margin:0 4px;animation:pulse 1.4s infinite}
        @keyframes pulse{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}
        .pin{animation:drop .6s ease both}
        @keyframes drop{from{opacity:0;transform:translateY(-18px)}to{opacity:1;transform:none}}
        @keyframes barfill{from{width:0}to{width:100%}}
      `}</style>

      {/* SCENA 1 — apertura */}
      <div className={`scene ${active(0)}`}>
        <svg width="90" height="90" viewBox="0 0 64 64" aria-hidden="true" style={{ marginBottom: 18 }}>
          <circle cx="32" cy="32" r="28" fill="#8cc63f" />
          <g fill="none" stroke="#143306" strokeWidth="1.6" opacity="0.6">
            <ellipse cx="32" cy="32" rx="12" ry="28" /><ellipse cx="32" cy="32" rx="24" ry="28" />
            <line x1="4" y1="32" x2="60" y2="32" />
          </g>
        </svg>
        <div className="disp" style={{ fontSize: "clamp(40px,9vw,104px)", color: "#fff" }}>
          ECO<span style={{ color: "#8cc63f" }}>-VISA</span>
        </div>
        <p style={{ marginTop: 20, fontSize: "clamp(18px,2.6vw,30px)", maxWidth: 720, color: "#dcf2b8" }}>
          Quanto è sostenibile ciò che mettiamo in tavola?
        </p>
      </div>

      {/* SCENA 2 — cosa fa ECO-VISA */}
      <div className={`scene ${active(1)}`}>
        <div style={{ display: "flex", alignItems: "center", gap: "5vw", flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14, borderRadius: 22, background: "#0e2604" }}>
            {["#e2231a", "#f6c416", "#45a82f"].map((c, idx) => (
              <span key={c} style={{
                width: 48, height: 48, borderRadius: "50%", background: c,
                boxShadow: idx === 2 ? `0 0 26px ${c}` : "none", opacity: idx === 2 ? 1 : 0.35,
              }} />
            ))}
          </div>
          <div style={{ textAlign: "left", maxWidth: 560 }}>
            <div className="disp" style={{ fontSize: "clamp(30px,5.5vw,64px)", color: "#8cc63f" }}>
              Misura<br />l&apos;impronta
            </div>
            <p style={{ marginTop: 14, fontSize: "clamp(17px,2.4vw,26px)", color: "#eaffd6" }}>
              ECO-VISA calcola i chilometri e la CO₂ del trasporto di ogni materia prima e assegna un semaforo verde, giallo o rosso.
            </p>
          </div>
        </div>
      </div>

      {/* SCENA 3 — passaporto ecologico */}
      <div className={`scene ${active(2)}`}>
        <div className="disp" style={{ fontSize: "clamp(30px,6vw,72px)", color: "#fff" }}>
          Il passaporto<br />ecologico
        </div>
        <p style={{ marginTop: 18, fontSize: "clamp(17px,2.5vw,28px)", maxWidth: 720, color: "#dcf2b8" }}>
          Ogni prodotto ottiene la sua scheda con il semaforo, da mostrare sul proprio sito — sempre aggiornata.
        </p>
      </div>

      {/* SCENA 4 — BioFido */}
      <div className={`scene ${active(3)}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${BASE}/brand/biofido-solologo.png`} alt="BioFido" style={{ height: "min(26vh,200px)", width: "auto", marginBottom: 16 }} />
        <div className="disp" style={{ fontSize: "clamp(28px,5.5vw,64px)", color: "#8cc63f" }}>
          BioFido
        </div>
        <p style={{ marginTop: 12, fontSize: "clamp(17px,2.5vw,27px)", maxWidth: 720, color: "#eaffd6" }}>
          Il segugio del biologico: trova i produttori e i negozi bio a chilometro zero intorno a te.
        </p>
        <div style={{ marginTop: 16 }}>
          {[0, 1, 2, 3, 4].map((n) => (
            <span key={n} className="pin" style={{ animationDelay: `${n * 0.12}s`,
              display: "inline-block", width: 16, height: 16, margin: "0 6px", borderRadius: "50% 50% 50% 0",
              transform: "rotate(-45deg)", background: "#327413", border: "2px solid #8cc63f" }} />
          ))}
        </div>
      </div>

      {/* SCENA 5 — mission + CTA */}
      <div className={`scene ${active(4)}`}>
        <span style={{ fontSize: "clamp(13px,1.8vw,18px)", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#8cc63f" }}>
          La nostra missione
        </span>
        <div className="disp" style={{ marginTop: 10, fontSize: "clamp(26px,5vw,60px)", color: "#fff", maxWidth: 900 }}>
          Rendere visibile la sostenibilità<br />e premiare la filiera corta
        </div>
        <p style={{ marginTop: 22, fontSize: "clamp(20px,3vw,34px)", fontWeight: 700, color: "#8cc63f" }}>
          ecovisa.it
        </p>
      </div>

      {/* barra di avanzamento */}
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 5, width: "100%", background: "rgba(255,255,255,.12)" }}>
        {!ended && (
          <div key={runId} style={{ height: "100%", background: "#8cc63f", animation: "barfill 20s linear forwards" }} />
        )}
      </div>

      {/* controllo replay (non disturba la registrazione) */}
      {ended && (
        <button
          onClick={replay}
          style={{
            position: "absolute", bottom: 18, right: 18, padding: "10px 18px", borderRadius: 999,
            border: "none", background: "#8cc63f", color: "#143306", fontWeight: 700, cursor: "pointer",
          }}
        >
          ↻ Rivedi
        </button>
      )}
    </div>
  );
}
