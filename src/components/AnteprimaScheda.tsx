"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeFootprint } from "@/lib/footprint";
import { prefetchGeocode } from "@/lib/geo";
import { Semaforo } from "@/components/Semaforo";
import { PLAN_MAP, type Plan } from "@/lib/piani";
import { tutteLeAziendePubbliche } from "@/lib/azienda-pubblica";

type Prod = {
  id: string;
  nome: string;
  categoria: string | null;
  stabilimento_citta: string;
};
type Ingr = { nome: string; origine: string };
type Voce = { p: Prod; ingr: Ingr[] };

/** Un prodotto come appare nel passaporto pubblico / embed (semaforo + CO₂). */
function PassaportoPreview({ azienda, voce }: { azienda: string; voce: Voce }) {
  const { p, ingr } = voce;
  const fp = computeFootprint(
    p.stabilimento_citta,
    ingr.map((i) => ({ name: i.nome, origin: i.origine })),
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e3eed7] bg-white shadow-sm">
      <div className="flex items-center justify-between bg-green-800 px-4 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-lime-300">
          Passaporto della filiera
        </span>
        <span className="font-display text-sm text-white">ECO-VISA</span>
      </div>
      <div className="p-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-lime-600">
          {p.categoria || "Prodotto"}
        </div>
        <h4 className="font-display text-xl leading-tight text-green-800">{p.nome}</h4>
        {azienda && (
          <p className="text-xs text-green-900/60">
            {azienda} · stabilimento {p.stabilimento_citta}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-leaf/50 p-3">
          <Semaforo level={fp.level} score={fp.score} />
          <div className="text-right">
            <div className="font-display text-2xl text-green-800">
              {fp.totalCo2Kg.toLocaleString("it-IT")} kg
            </div>
            <div className="text-[11px] text-green-900/60">
              CO₂ trasporto · {fp.totalKm.toLocaleString("it-IT")} km
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legenda({ plan }: { plan: Plan }) {
  const info = PLAN_MAP[plan];
  const voci: { ic: string; t: string; d: string }[] = [
    {
      ic: "🚦",
      t: "Semaforo + CO₂",
      d: "Per ogni prodotto, l'impronta delle materie prime diventa un semaforo verde/giallo/rosso e i kg di CO₂. Compili gli ingredienti e l'origine, il calcolo è automatico.",
    },
    {
      ic: "🧾",
      t: "Passaporto pubblico",
      d: "È questa cornice che i clienti vedono: sulla vetrina ECO-VISA e incorporata (embed) sul tuo sito.",
    },
    {
      ic: "📦",
      t: "Quanti prodotti",
      d: `Col piano ${info.label} puoi pubblicarne fino a ${info.maxProducts}.`,
    },
    {
      ic: "🔗",
      t: "Codice da incollare",
      d: "Ogni prodotto genera un codice embed: lo copi e lo incolli sul tuo sito, e mostra il semaforo sempre aggiornato.",
    },
  ];
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wide text-green-700">
        Legenda — come si compone la scheda
      </div>
      <ul className="mt-3 space-y-2">
        {voci.map((v) => (
          <li key={v.t} className="flex gap-3 rounded-xl border border-[#e3eed7] p-3">
            <span className="text-xl">{v.ic}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-green-800">{v.t}</div>
              <div className="text-xs text-green-900/65">{v.d}</div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-xl bg-leaf/40 p-3 text-xs text-green-900/70">
        💡 Più materie prime locali usi, migliore è il semaforo. Salva un prodotto e
        premi <strong>Aggiorna</strong> per vederlo qui come lo vedono i clienti.
      </p>
    </div>
  );
}

/**
 * Anteprima della scheda pubblica ECO-VISA: mostra i prodotti dell'azienda come
 * passaporti ecologici (semaforo + CO₂) esattamente come appaiono in vetrina e
 * nell'embed, più una legenda-guida.
 */
export function AnteprimaScheda({
  ownerId,
  plan,
  refreshKey = 0,
}: {
  ownerId: string;
  plan: Plan;
  /** cambia quando salvi un prodotto/servizio → ricarica l'anteprima */
  refreshKey?: number;
}) {
  const [azienda, setAzienda] = useState<string>("");
  const [voci, setVoci] = useState<Voce[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setVer] = useState(0);
  const [paginaUrl, setPaginaUrl] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);

  const copia = async () => {
    if (!paginaUrl) return;
    try {
      await navigator.clipboard.writeText(paginaUrl);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 1800);
    } catch {
      /* clipboard non disponibile: l'utente può selezionare e copiare a mano */
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data: az } = await supabase
      .from("aziende")
      .select("id, nome")
      .eq("owner", ownerId)
      .maybeSingle();
    const a = az as { id: string; nome: string } | null;
    setAzienda(a?.nome ?? "");
    if (!a) {
      setVoci([]);
      setPaginaUrl(null);
      setLoading(false);
      return;
    }
    // URL pubblico condivisibile: lo slug è identico a quello della pagina
    // statica /azienda/[slug] (risolto dalla stessa funzione, per id).
    try {
      const elenco = await tutteLeAziendePubbliche();
      const mine = elenco.find((x) => x.id === a.id);
      setPaginaUrl(mine ? `https://ecovisa.it/azienda/${mine.slug}/` : null);
    } catch {
      setPaginaUrl(null);
    }
    const { data: pr } = await supabase
      .from("prodotti")
      .select("id, nome, categoria, stabilimento_citta")
      .eq("azienda_id", a.id)
      .order("created_at");
    const prods = (pr as Prod[]) ?? [];
    const built: Voce[] = [];
    const names = new Set<string>();
    for (const p of prods) {
      const { data: ing } = await supabase
        .from("ingredienti")
        .select("nome, origine")
        .eq("prodotto_id", p.id);
      const ingr = (ing as Ingr[]) ?? [];
      built.push({ p, ingr });
      if (p.stabilimento_citta) names.add(p.stabilimento_citta);
      ingr.forEach((i) => i.origine && names.add(i.origine));
    }
    setVoci(built);
    setLoading(false);
    // risolvi le località su OpenStreetMap poi ricalcola i semafori
    for (const n of names) await prefetchGeocode(n);
    setVer((v) => v + 1);
  }, [ownerId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <section className="card mt-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl text-green-800">
          👁 Anteprima della tua scheda pubblica
        </h2>
        <button onClick={load} className="btn-ghost text-sm" disabled={loading}>
          {loading ? "Carico…" : "↻ Aggiorna"}
        </button>
      </div>
      <p className="mt-1 text-sm text-green-900/70">
        È <strong>esattamente</strong> il passaporto della filiera che i clienti vedono in
        vetrina e sul tuo sito (embed). Salva un prodotto, poi premi «Aggiorna».
      </p>

      {paginaUrl && (
        <div className="mt-4 rounded-2xl border border-[#cfe6b0] bg-leaf/50 p-4">
          <div className="text-sm font-bold text-green-800">🔗 La tua pagina pubblica</div>
          <p className="mt-0.5 text-xs text-green-900/70">
            Condividila su social, sito, email e carta intestata: è il tuo mini-sito
            su ECO-VISA, con tutti i tuoi prodotti e l&apos;impronta di trasporto.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={paginaUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-[#d6e6c4] bg-white px-3 py-1.5 text-sm text-green-900"
            />
            <button type="button" onClick={copia} className="btn-lime text-sm">
              {copiato ? "✓ Copiato" : "Copia link"}
            </button>
            <a
              href={paginaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-sm"
            >
              Apri ↗
            </a>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-green-900/60">Carico l&apos;anteprima…</p>
      ) : voci.length === 0 ? (
        <p className="mt-4 rounded-xl bg-leaf/40 p-4 text-sm text-green-900/70">
          Aggiungi un prodotto con le sue materie prime: qui vedrai il suo passaporto
          della filiera come appare ai clienti.
        </p>
      ) : (
        <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_minmax(280px,360px)]">
          <Legenda plan={plan} />
          <div className="space-y-3">
            {voci.map((v) => (
              <PassaportoPreview key={v.p.id} azienda={azienda} voce={v} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
