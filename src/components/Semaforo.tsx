import type { Giudizio, TierIng, EcoLevel } from "@/lib/footprint";
import { categoriaDiTier } from "@/lib/footprint";

/* Semaforo grande: giudizio proporzionale (6 livelli) con widget speciali. */
type Meta = { label: string; color: string; lampada: EcoLevel; desc: string };

const META: Record<Giudizio, Meta> = {
  verde_plus: {
    label: "Super Green",
    color: "#2e9e0e",
    lampada: "verde",
    desc: "Tutte le materie prime sono a filiera corta. Eccellente!",
  },
  verde: {
    label: "Sostenibile",
    color: "var(--traffic-green)",
    lampada: "verde",
    desc: "La maggior parte delle materie prime è a filiera corta.",
  },
  verde_chiaro: {
    label: "Buono",
    color: "#7cb342",
    lampada: "verde",
    desc: "Metà delle materie prime è vicina, le altre a media distanza.",
  },
  giallo: {
    label: "Migliorabile",
    color: "var(--traffic-yellow)",
    lampada: "giallo",
    desc: "Diverse materie prime arrivano da lontano.",
  },
  rosso: {
    label: "Alto impatto",
    color: "var(--traffic-red)",
    lampada: "rosso",
    desc: "Molte materie prime percorrono lunghe distanze.",
  },
  rosso_intenso: {
    label: "Filiera lunga",
    color: "#b71c1c",
    lampada: "rosso",
    desc: "Tutte le materie prime arrivano da molto lontano.",
  },
};

export function Semaforo({
  level,
  score,
  size = "md",
}: {
  level: Giudizio;
  score?: number;
  size?: "sm" | "md";
}) {
  const order: EcoLevel[] = ["rosso", "giallo", "verde"];
  const lamp = size === "sm" ? 18 : 30;
  const m = META[level];
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex flex-col items-center gap-2 rounded-2xl bg-[#222] p-2"
        aria-label={`Semaforo ecologico: ${m.label}`}
      >
        {order.map((l) => {
          const on = l === m.lampada;
          return (
            <span
              key={l}
              className={on ? "pulse-soft" : ""}
              style={{
                width: lamp,
                height: lamp,
                borderRadius: "9999px",
                background: on ? m.color : "#3a3a3a",
                boxShadow: on ? `0 0 14px ${m.color}` : "none",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          );
        })}
      </div>

      {size === "md" && (
        <div>
          <div className="flex items-center gap-2">
            <div className="font-display text-xl" style={{ color: m.color }}>
              {m.label}
            </div>
            {level === "verde_plus" && (
              <span className="rounded-full bg-[#2e9e0e] px-2 py-0.5 text-[11px] font-bold text-white">
                🌱 SUPER GREEN · km0
              </span>
            )}
          </div>
          {typeof score === "number" && (
            <div className="text-sm font-semibold text-green-900/70">
              Punteggio ECO-VISA: {score}/100
            </div>
          )}
          <p className="mt-0.5 max-w-xs text-xs text-green-900/70">{m.desc}</p>

          {level === "rosso_intenso" && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-traffic-red/40 bg-[#fff1f0] p-2">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-traffic-red text-sm font-bold text-white">
                !
              </span>
              <p className="text-xs text-green-900/80">
                Questo prodotto sicuramente è buonissimo, ma perché non proviamo a
                renderlo ancora migliore usando materie prime locali?
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Mini-semaforo orizzontale di una singola materia prima (premia ogni
   ingrediente in base alla distanza). I 4 verdi usano sfumature diverse. */
const COLORE_TIER: Record<TierIng, string> = {
  km0: "#2e9e0e",
  verde_intenso: "#4caf2a",
  verde_chiaro: "#7cb342",
  verde_pallido: "#aed581",
  giallo: "var(--traffic-yellow)",
  rosso: "var(--traffic-red)",
};

export function SemaforoIngrediente({ tier }: { tier: TierIng }) {
  const cat = categoriaDiTier(tier);
  const ordine: EcoLevel[] = ["verde", "giallo", "rosso"];
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#222] px-1 py-0.5">
        {ordine.map((c) => {
          const on = c === cat;
          const colore = c === "verde" ? COLORE_TIER[tier] : `var(--traffic-${c === "giallo" ? "yellow" : "red"})`;
          return (
            <span
              key={c}
              style={{
                width: 9,
                height: 9,
                borderRadius: "9999px",
                background: on ? colore : "#3a3a3a",
                boxShadow: on ? `0 0 6px ${colore}` : "none",
              }}
            />
          );
        })}
      </span>
      {tier === "km0" && (
        <span className="text-[9px] font-bold text-[#2e9e0e]">km0</span>
      )}
    </span>
  );
}
