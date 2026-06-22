"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { computeFootprint } from "@/lib/footprint";
import { prefetchGeocode, geocodeIndirizzo, lookupCap } from "@/lib/geo";

// mappa per posizionare il segnaposto a mano (solo client: usa Leaflet)
const MappaPicker = dynamic(() => import("@/components/MappaPicker"), { ssr: false });
import { useGeoResolve } from "@/lib/useGeoResolve";
import { Semaforo } from "@/components/Semaforo";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { PianiAbbonamento } from "@/components/Abbonamenti";
import { ComuneAutocomplete } from "@/components/ComuneAutocomplete";
import { IndirizzoAutocomplete } from "@/components/IndirizzoAutocomplete";
import { ImportoInput } from "@/components/ImportoInput";
import { DatiFatturazioneForm, type PrefillFatturazione } from "@/components/DatiFatturazioneForm";
import { SezioneBio } from "@/components/SezioneBio";
import { SchedaServizi } from "@/components/SchedaServizi";
import { ServiziExtra } from "@/components/ServiziExtra";
import { GoldPromoBanner } from "@/components/GoldPromoBanner";
import { CalcolatoreImpronta } from "@/components/CalcolatoreImpronta";
import { CatalogoCard } from "@/components/CatalogoCard";
import { AnteprimaScheda } from "@/components/AnteprimaScheda";
import { StatisticheCard } from "@/components/StatisticheCard";
import { caricaImmagineCatalogo } from "@/lib/catalogo";
import { lookupPiva } from "@/lib/fatturazione";
import { getMyPlan } from "@/lib/plan";
import { syncBioFido } from "@/lib/biofido-scheda";
import { formatPrezzo } from "@/lib/prezzo";
import { billingEnabled, startCheckout, openCustomerPortal } from "@/lib/billing";
import { startOnboarding, refreshConnectStatus } from "@/lib/connect";
import {
  listMyBookings,
  setBookingStatus,
  sendMessage,
  euroCents,
  STATO_LABEL,
  type Booking,
  type BookingStatus,
} from "@/lib/bookings";
import { ChatPrenotazione } from "@/components/ChatPrenotazione";
import { listContatti, setContattoGestito, type Contatto } from "@/lib/contatti";
import { NotificheToggle } from "@/components/NotificheToggle";
import { SmsNotificheToggle } from "@/components/SmsNotificheToggle";
import { PLAN_MAP, isDowngrade, perditeDowngrade, type Plan } from "@/lib/piani";

type Azienda = {
  id: string;
  nome: string;
  piva: string | null;
  codice_fiscale: string | null;
  citta_sede: string | null;
  indirizzo?: string | null;
  cap?: string | null;
  provincia?: string | null;
  lat?: number | null;
  lon?: number | null;
  sito_web: string | null;
  descrizione?: string | null;
  immagine?: string | null;
};

/** Lunghezza massima della descrizione azienda. */
const MAX_DESCRIZIONE = 500;
type Stabilimento = { id: string; nome: string | null; citta: string };
type Ingrediente = { id?: string; nome: string; origine: string };
type Prodotto = {
  id: string;
  nome: string;
  categoria: string | null;
  stabilimento_citta: string;
  immagine: string | null;
  prezzo?: string | null;
  prenotabile?: boolean | null;
  ingredienti: Ingrediente[];
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [azienda, setAzienda] = useState<Azienda | null>(null);
  const [stabilimenti, setStabilimenti] = useState<Stabilimento[]>([]);
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  // setGeoV forza il re-render (e il ricalcolo CO₂) quando OSM risolve le località salvate
  const [, setGeoV] = useState(0);
  // piano: attivo (da subscriptions, condiviso con BioFido) e scelto per la configurazione
  const [activePlan, setActivePlan] = useState<Plan>("free");
  const [pianoScelto, setPianoScelto] = useState<Plan>("free");
  const [periodo, setPeriodo] = useState<"monthly" | "annual">("annual");

  // ---- caricamento dati ----
  const loadAll = useCallback(async () => {
    setLoading(true);
    const { data: az } = await supabase.from("aziende").select("*").limit(1);
    const a = (az?.[0] as Azienda) ?? null;
    setAzienda(a);
    if (a) {
      const { data: st } = await supabase
        .from("stabilimenti")
        .select("*")
        .eq("azienda_id", a.id)
        .order("created_at");
      setStabilimenti((st as Stabilimento[]) ?? []);

      const { data: pr } = await supabase
        .from("prodotti")
        .select("*")
        .eq("azienda_id", a.id)
        .order("created_at");
      const prods = (pr as Omit<Prodotto, "ingredienti">[]) ?? [];
      const withIngr: Prodotto[] = [];
      for (const p of prods) {
        const { data: ing } = await supabase
          .from("ingredienti")
          .select("*")
          .eq("prodotto_id", p.id)
          .order("created_at");
        withIngr.push({ ...p, ingredienti: (ing as Ingrediente[]) ?? [] });
      }
      setProdotti(withIngr);

      // Risolve via OpenStreetMap le località dei prodotti salvati (stabilimento
      // + origini) e poi forza il ricalcolo della CO₂ in elenco.
      const names = new Set<string>();
      withIngr.forEach((p) => {
        if (p.stabilimento_citta) names.add(p.stabilimento_citta);
        p.ingredienti.forEach((i) => i.origine && names.add(i.origine));
      });
      (async () => {
        for (const n of names) await prefetchGeocode(n);
        setGeoV((v) => v + 1);
      })();
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/accedi");
      return;
    }
    loadAll();
  }, [authLoading, user, router, loadAll]);

  // piano attivo (condiviso con BioFido) + inizializzazione del piano scelto
  useEffect(() => {
    if (!user) return;
    getMyPlan().then((p) => {
      setActivePlan(p);
      const saved = window.localStorage.getItem("ecovisa_plan") as Plan | null;
      setPianoScelto(p !== "free" ? p : saved && saved in PLAN_MAP ? saved : "free");
    });
  }, [user]);

  function scegliPiano(p: Plan, per: "monthly" | "annual") {
    // Downgrade: avviso che i contenuti/funzioni non inclusi nel piano scelto
    // non saranno più visibili (i dati restano salvati, tornano col re-upgrade).
    if (isDowngrade(activePlan, p)) {
      const perse = perditeDowngrade(activePlan, p);
      const elenco = perse.length ? "\n\n• " + perse.join("\n• ") : "";
      const ok = window.confirm(
        `⚠️ ATTENZIONE — stai passando dal piano ${PLAN_MAP[activePlan].label} al piano ${PLAN_MAP[p].label}, meno ricco.\n\n` +
          `Con questo cambio NON saranno più visibili al pubblico:${elenco}\n\n` +
          `I dati non vengono cancellati: torneranno visibili se in futuro risali di piano.\n\n` +
          `Vuoi procedere con il downgrade?`,
      );
      if (!ok) return;
    }
    setPianoScelto(p);
    setPeriodo(per);
    window.localStorage.setItem("ecovisa_plan", p);
  }

  // Tiene la scheda BioFido allineata ai dati ECO-VISA (descrizione, prodotti
  // con prezzo/foto, piano): così un Gold ha una scheda ricca, non scarna.
  useEffect(() => {
    if (user && azienda) {
      // salva il piano sull'azienda: marker e scheda pubblica lo usano per i widget
      void supabase.from("aziende").update({ plan: activePlan }).eq("id", azienda.id).then(() => {});
      syncBioFido(user.id, activePlan);
    }
  }, [user, azienda, prodotti, activePlan]);

  // Salva il prodotto del calcolatore-semaforo tra "I tuoi prodotti" (poi
  // l'utente vi aggiunge foto e dettagli). Lo stabilimento è la città del
  // calcolatore; categoria/foto si completano dopo nella sezione prodotti.
  async function aggiungiProdottoDaSemaforo(data: {
    nome: string;
    stabilimento: string;
    ingredienti: { nome: string; origine: string }[];
  }): Promise<{ error?: string }> {
    if (!azienda) return { error: "Salva prima la scheda anagrafica qui sotto." };
    const { data: prod, error } = await supabase
      .from("prodotti")
      .insert({
        azienda_id: azienda.id,
        nome: data.nome,
        categoria: null,
        stabilimento_citta: data.stabilimento,
        immagine: null,
      })
      .select("id")
      .single();
    if (error || !prod) return { error: error?.message ?? "Errore nel salvataggio del prodotto." };
    if (data.ingredienti.length) {
      await supabase.from("ingredienti").insert(
        data.ingredienti.map((i) => ({ prodotto_id: prod.id, nome: i.nome, origine: i.origine })),
      );
    }
    await loadAll();
    return {};
  }

  if (authLoading || loading) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-green-900/70">Caricamento…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
            Area aziende
          </div>
          <h1 className="title-pangea text-3xl text-green-700 md:text-4xl">
            La tua dashboard
          </h1>
        </div>
        <button
          className="btn-ghost text-sm"
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/");
          }}
        >
          Esci
        </button>
      </div>

      {/* IL SEMAFORO È LA PRIMA COSA SU ECO-VISA: compila il prodotto e ottieni il giudizio */}
      <section className="card mt-6 border-2 border-lime-500 p-6">
        <h2 className="font-display text-2xl text-green-700 md:text-3xl">
          🚦 Il tuo semaforo di sostenibilità
        </h2>
        <p className="mt-1 text-sm text-green-900/75">
          Compila la scheda del tuo prodotto e ottieni subito il semaforo ecologico.{" "}
          <strong>
            Come utente Free puoi caricare e condividere sul tuo sito un solo prodotto
          </strong>{" "}
          — scegli un abbonamento qui sotto e potrai caricare più schede.
        </p>
        <div className="mt-5">
          <CalcolatoreImpronta
            nascondiPubblica
            vuoto
            aziendaNome={azienda?.nome ?? undefined}
            onAggiungiProdotto={aggiungiProdottoDaSemaforo}
          />
        </div>
        <p className="mt-4 rounded-xl bg-leaf/50 p-3 text-sm text-green-900/75">
          👉 Per <strong>salvare il prodotto e generare il codice</strong> da copiare
          e incollare sul tuo sito (che mostra questa cornice-semaforo, sempre
          aggiornata), aggiungilo nella sezione <strong>«I tuoi prodotti»</strong> qui
          sotto.
        </p>
      </section>

      <PianoSelector scelto={pianoScelto} attivo={activePlan} onScegli={scegliPiano} />

      <GoldPromoBanner portale="ECO-VISA" />

      <SchedaServizi piano={pianoScelto} attivo={activePlan} />

      <AnagraficaCard
        azienda={azienda}
        initialNome={(user?.user_metadata as { nome?: string })?.nome}
        ownerId={user?.id ?? ""}
        onSaved={loadAll}
      />

      {user && (
        <SezioneBio
          ownerId={user.id}
          aziendaNome={azienda?.nome ?? undefined}
          aziendaCitta={azienda?.citta_sede ?? undefined}
          aziendaLat={azienda?.lat ?? undefined}
          aziendaLon={azienda?.lon ?? undefined}
        />
      )}

      {azienda && (
        <>
          <StabilimentiCard
            aziendaId={azienda.id}
            stabilimenti={stabilimenti}
            onChange={loadAll}
          />
          <ProdottiCard
            aziendaId={azienda.id}
            stabilimenti={stabilimenti}
            prodotti={prodotti}
            plan={activePlan}
            onChange={loadAll}
          />
        </>
      )}

      {user && azienda && <AnteprimaScheda ownerId={user.id} plan={pianoScelto} />}
      {user && <StatisticheCard ownerId={user.id} plan={pianoScelto} />}

      {user && <PagamentiCard ownerId={user.id} plan={pianoScelto} />}

      <section className="card mt-6 p-6">
        <h2 className="font-display text-2xl text-green-800">Servizi extra</h2>
        <p className="mt-1 text-sm text-green-900/70">
          Potenzia la tua azienda. Guarda la demo di ciascun servizio.
        </p>
        <div className="mt-4">
          <ServiziExtra showPrices />
        </div>
      </section>

      {user && <MessaggiCard ownerId={user.id} />}

      {user && PLAN_MAP[pianoScelto].canSell && <PrenotazioniCard ownerId={user.id} />}

      {user && <CatalogoCard ownerId={user.id} gold={pianoScelto === "gold"} />}

      {user && (
        <PagamentoFinale
          ownerId={user.id}
          scelto={pianoScelto}
          attivo={activePlan}
          prefill={{
            ragione_sociale: azienda?.nome ?? undefined,
            partita_iva: azienda?.piva ?? undefined,
            codice_fiscale: azienda?.codice_fiscale ?? undefined,
            indirizzo: azienda?.indirizzo ?? undefined,
            cap: azienda?.cap ?? undefined,
            citta: azienda?.citta_sede ?? undefined,
            provincia: azienda?.provincia ?? undefined,
          }}
        />
      )}
    </div>
  );
}

/* ------------------- SCELTA PIANO (senza pagamento) ------------------- */
function PianoSelector({
  scelto,
  attivo,
  onScegli,
}: {
  scelto: Plan;
  attivo: Plan;
  onScegli: (p: Plan, per: "monthly" | "annual") => void;
}) {
  return (
    <section className="card mt-6 p-6">
      <h2 className="font-display text-2xl text-green-800">Scegli il tuo piano</h2>
      <p className="mt-1 text-sm text-green-900/70">
        Lo stesso abbonamento vale anche su BioFido. Scegli ora, compili la
        scheda e i prodotti, e paghi alla fine.
      </p>
      <div className="mt-6">
        <PianiAbbonamento currentPlan={attivo} selectedPlan={scelto} onSelect={onScegli} />
      </div>
    </section>
  );
}

/* ------------------- PAGAMENTO FINALE (dati fatturazione + checkout) ------------------- */
function PagamentoFinale({
  ownerId,
  scelto,
  attivo,
  prefill,
}: {
  ownerId: string;
  scelto: Plan;
  attivo: Plan;
  prefill?: PrefillFatturazione;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fatturazioneOk, setFatturazioneOk] = useState(false);

  const giaAttivo = attivo === scelto && attivo !== "free";

  async function paga(per: "monthly" | "annual") {
    setBusy(true);
    setMsg(null);
    try {
      await startCheckout(scelto, per);
    } catch (e) {
      setBusy(false);
      setMsg((e as Error).message);
    }
  }

  async function gestisci() {
    setBusy(true);
    setMsg(null);
    try {
      await openCustomerPortal();
    } catch (e) {
      setBusy(false);
      setMsg((e as Error).message);
    }
  }

  if (scelto === "free") {
    return (
      <section className="card mt-6 p-6 text-center">
        <h2 className="font-display text-2xl text-green-800">Tutto pronto, gratis</h2>
        <p className="mt-1 text-sm text-green-900/70">
          Con il piano Free la tua scheda e i tuoi prodotti sono già attivi.
          Niente da pagare.
        </p>
      </section>
    );
  }

  if (giaAttivo) {
    return (
      <section className="card mt-6 p-6 text-center">
        <h2 className="font-display text-2xl text-green-800">
          Piano {PLAN_MAP[scelto].label} attivo ✅
        </h2>
        <p className="mt-1 text-sm text-green-900/70">
          Il tuo abbonamento è attivo: vale sia su ECO-VISA sia su BioFido.
        </p>
        <button className="btn-ghost mt-4" onClick={gestisci} disabled={busy}>
          {busy ? "Apro…" : "Gestisci abbonamento (fatture, carta, disdetta)"}
        </button>
        <p className="mt-2 text-xs text-green-900/55">
          Per non rinnovare, disdici almeno 10 giorni prima della scadenza.
        </p>
        {msg && <p className="mt-2 text-sm font-semibold text-traffic-red">{msg}</p>}
      </section>
    );
  }

  const mensile = PLAN_MAP[scelto].monthlyPrice;
  const annuale = PLAN_MAP[scelto].annualPrice;
  const mensileSuAnno = mensile * 12;

  return (
    <section className="mt-6 space-y-4">
      <DatiFatturazioneForm ownerId={ownerId} onValid={setFatturazioneOk} prefill={prefill} />

      <div className="panel-dark rounded-2xl p-6 text-center">
        <h2 className="font-display text-2xl">Attiva il piano {PLAN_MAP[scelto].label}</h2>
        <p className="mt-1 text-[#eaf7d8]">
          Un solo abbonamento, valido su ECO-VISA e BioFido.
        </p>
        {billingEnabled ? (
          <>
            <div className="mt-4 flex flex-col items-center gap-2">
              {/* Annuale: opzione consigliata (principale) */}
              <button
                className="btn-lime w-full max-w-sm justify-center"
                onClick={() => paga("annual")}
                disabled={busy || !fatturazioneOk}
              >
                {busy ? "Apro il pagamento…" : `Vai al pagamento — ${annuale} € + IVA/anno`}
              </button>
              {/* Mensile: tonalità diversa, con equivalente annuale tra parentesi */}
              <button
                className="w-full max-w-sm justify-center rounded-full border border-white/40 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
                onClick={() => paga("monthly")}
                disabled={busy || !fatturazioneOk}
              >
                Oppure mensile — {mensile} € + IVA/mese{" "}
                <span className="font-normal text-[#eaf7d8]">({mensileSuAnno} € all&apos;anno)</span>
              </button>
              <p className="text-xs text-[#cfe3b4]">
                Con l&apos;annuale risparmi: {mensileSuAnno - annuale} € all&apos;anno.
              </p>
            </div>
            <p className="mx-auto mt-3 max-w-sm text-xs text-[#cfe3b4]">
              Rinnovo automatico: il mensile si rinnova ogni mese, l&apos;annuale ogni
              anno. Puoi disdire quando vuoi; <strong>per non rinnovare, annulla
              almeno 10 giorni prima della scadenza</strong>.
            </p>
            {!fatturazioneOk && (
              <p className="mt-3 text-sm text-badge-yellow">
                Salva prima i dati di fatturazione qui sopra.
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-[#eaf7d8]">Pagamenti non ancora attivi.</p>
        )}
        {msg && <p className="mt-3 text-sm font-semibold text-badge-yellow">{msg}</p>}
      </div>
    </section>
  );
}

/* ------------------- ANAGRAFICA AZIENDA ------------------- */
const BOZZA_ANAGRAFICA = "ecovisa_anagrafica_bozza";

function AnagraficaCard({
  azienda,
  initialNome,
  ownerId,
  onSaved,
}: {
  azienda: Azienda | null;
  initialNome?: string;
  ownerId: string;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(azienda?.nome ?? initialNome ?? "");
  const [piva, setPiva] = useState(azienda?.piva ?? "");
  const [cf, setCf] = useState(azienda?.codice_fiscale ?? "");
  const [cfUguale, setCfUguale] = useState(
    !!azienda?.codice_fiscale && azienda.codice_fiscale === azienda.piva,
  );
  const [citta, setCitta] = useState(azienda?.citta_sede ?? "");
  const [indirizzo, setIndirizzo] = useState(azienda?.indirizzo ?? "");
  const [cap, setCap] = useState(azienda?.cap ?? "");
  const [provincia, setProvincia] = useState(azienda?.provincia ?? "");
  const [coord, setCoord] = useState<{ lat: number; lon: number } | null>(
    azienda?.lat != null && azienda?.lon != null
      ? { lat: Number(azienda.lat), lon: Number(azienda.lon) }
      : null,
  );
  const [geoBusy, setGeoBusy] = useState(false);
  const [sito, setSito] = useState(azienda?.sito_web ?? "");
  const [descrizione, setDescrizione] = useState(azienda?.descrizione ?? "");
  const [immagine, setImmagine] = useState<string | null>(azienda?.immagine ?? null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Se l'azienda è già salvata uso i suoi dati; altrimenti ripristino la BOZZA
  // locale, così cambiando pagina o ricaricando NON si perde quanto digitato.
  useEffect(() => {
    if (azienda) {
      setNome(azienda.nome ?? initialNome ?? "");
      setPiva(azienda.piva ?? "");
      setCf(azienda.codice_fiscale ?? "");
      setCfUguale(!!azienda.codice_fiscale && azienda.codice_fiscale === azienda.piva);
      setCitta(azienda.citta_sede ?? "");
      setIndirizzo(azienda.indirizzo ?? "");
      setCap(azienda.cap ?? "");
      setProvincia(azienda.provincia ?? "");
      setCoord(
        azienda.lat != null && azienda.lon != null
          ? { lat: Number(azienda.lat), lon: Number(azienda.lon) }
          : null,
      );
      setSito(azienda.sito_web ?? "");
      setDescrizione(azienda.descrizione ?? "");
      setImmagine(azienda.immagine ?? null);
      return;
    }
    try {
      const b = JSON.parse(localStorage.getItem(BOZZA_ANAGRAFICA) || "null");
      if (b) {
        setNome(b.nome ?? initialNome ?? "");
        setPiva(b.piva ?? "");
        setCf(b.cf ?? "");
        setCfUguale(!!b.cfUguale);
        setCitta(b.citta ?? "");
        if (b.indirizzo) setIndirizzo(b.indirizzo);
        if (b.cap) setCap(b.cap);
        if (b.provincia) setProvincia(b.provincia);
        if (b.coord) setCoord(b.coord);
        setSito(b.sito ?? "");
        if (b.descrizione) setDescrizione(b.descrizione);
        if (b.immagine) setImmagine(b.immagine);
      }
    } catch {
      /* bozza assente o corrotta */
    }
  }, [azienda, initialNome]);

  // salva la bozza ad ogni modifica (finché l'azienda non è registrata sul server)
  useEffect(() => {
    if (azienda) return;
    try {
      localStorage.setItem(
        BOZZA_ANAGRAFICA,
        JSON.stringify({
          nome, piva, cf, cfUguale, citta, indirizzo, cap, provincia, coord, sito, descrizione, immagine,
        }),
      );
    } catch {
      /* localStorage non disponibile */
    }
  }, [azienda, nome, piva, cf, cfUguale, citta, indirizzo, cap, provincia, coord, sito, descrizione, immagine]);

  // Geocodifica l'indirizzo completo per posizionare il segnaposto con precisione.
  async function localizza() {
    if (!indirizzo.trim() || !citta.trim()) {
      setMsg("Inserisci almeno indirizzo e città per localizzare.");
      return;
    }
    setGeoBusy(true);
    setMsg(null);
    try {
      // completo il CAP se mancante (utile per la fattura e per la ricerca)
      if (!cap.trim()) {
        const pc = await lookupCap(citta, provincia || undefined);
        if (pc) setCap(pc);
      }
      const p = await geocodeIndirizzo(indirizzo, citta, provincia || undefined);
      if (p) {
        setCoord(p);
        setMsg("Posizione trovata ✓ — se il pin non è preciso, trascinalo sulla mappa.");
      } else {
        // fallback al centroide del comune, così la mappa compare comunque
        const c = await prefetchGeocode(citta);
        if (c) {
          setCoord({ lat: c.lat, lon: c.lon });
          setMsg("Indirizzo non riconosciuto: ho centrato sul comune, posiziona tu il pin sulla mappa.");
        } else {
          setMsg("Comune non riconosciuto: controlla città e provincia.");
        }
      }
    } finally {
      setGeoBusy(false);
    }
  }

  async function recuperaDaPiva() {
    if (piva.replace(/\D/g, "").length !== 11) return;
    setLookupBusy(true);
    setMsg(null);
    try {
      const d = await lookupPiva(piva);
      if (!d) {
        setMsg("Partita IVA non trovata: inserisci i dati a mano.");
      } else {
        if (d.ragione_sociale) setNome(d.ragione_sociale);
        if (d.citta) setCitta(d.citta);
        setMsg("Dati recuperati dal registro VIES ✓");
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLookupBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const payload: Record<string, unknown> = {
      nome,
      piva: piva || null,
      codice_fiscale: (cfUguale ? piva : cf) || null,
      citta_sede: citta || null,
      indirizzo: indirizzo || null,
      cap: cap || null,
      provincia: provincia || null,
      lat: coord?.lat ?? null,
      lon: coord?.lon ?? null,
      sito_web: sito || null,
      descrizione: descrizione.trim() || null,
      immagine: immagine || null,
    };
    const esegui = (p: Record<string, unknown>) =>
      azienda
        ? supabase.from("aziende").update(p).eq("id", azienda.id)
        : supabase.from("aziende").insert(p);

    let { error } = await esegui(payload);
    // Se una colonna non è ancora presente nel DB (immagine/descrizione/codice_fiscale/
    // indirizzo/cap/provincia/lat/lon), la rimuovo e riprovo: così l'anagrafica si salva comunque.
    for (const col of ["immagine", "descrizione", "codice_fiscale", "indirizzo", "cap", "provincia", "lat", "lon"]) {
      // \b per evitare falsi positivi su colonne brevi (es. "lat" dentro "violation")
      if (error && new RegExp(`\\b${col}\\b`, "i").test(error.message)) {
        delete payload[col];
        ({ error } = await esegui(payload));
      }
    }
    setSaving(false);
    if (error) setMsg("Errore: " + error.message);
    else {
      try {
        localStorage.removeItem(BOZZA_ANAGRAFICA);
      } catch {
        /* ignore */
      }
      setMsg("Salvato ✓");
      onSaved();
    }
  }

  return (
    <section className="card mt-8 p-6">
      <h2 className="font-display text-2xl text-green-800">Scheda anagrafica</h2>
      <p className="mt-1 text-sm text-green-900/70">
        I dati della tua azienda. La sede non incide sul calcolo CO₂ (conta lo
        stabilimento di produzione).
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="label">Nome azienda *</span>
          <input className="field mt-1" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Partita IVA</span>
          <div className="mt-1 flex gap-2">
            <input
              className="field flex-1"
              value={piva}
              inputMode="numeric"
              placeholder="11 cifre"
              onChange={(e) => setPiva(e.target.value)}
            />
            <button
              type="button"
              className="btn-ghost whitespace-nowrap text-sm"
              onClick={recuperaDaPiva}
              disabled={lookupBusy || piva.replace(/\D/g, "").length !== 11}
            >
              {lookupBusy ? "Cerco…" : "Recupera dati"}
            </button>
          </div>
        </label>
        <div className="block">
          <span className="label">Codice fiscale</span>
          <input
            className="field mt-1 disabled:opacity-60"
            value={cfUguale ? piva : cf}
            disabled={cfUguale}
            onChange={(e) => setCf(e.target.value)}
            placeholder="Codice fiscale dell'azienda"
          />
          <label className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-green-900/75">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--lime-500)]"
              checked={cfUguale}
              onChange={(e) => setCfUguale(e.target.checked)}
            />
            Codice fiscale uguale alla Partita IVA
          </label>
        </div>
        <label className="block">
          <span className="label">Città sede</span>
          <div className="mt-1">
            <ComuneAutocomplete
              value={citta}
              onSelect={async (c) => {
                setCitta(c.nome);
                // provincia subito dalla sigla del comune; CAP ricavato da Nominatim
                if (c.prov) setProvincia(c.prov);
                const pc = await lookupCap(c.nome, c.prov);
                if (pc) setCap(pc);
              }}
              placeholder="Inizia a scrivere la città…"
            />
          </div>
        </label>
        <label className="block">
          <span className="label">Sito web</span>
          <input className="field mt-1" value={sito} onChange={(e) => setSito(e.target.value)} />
        </label>

        {/* Indirizzo preciso: serve a posizionare il segnaposto sulla mappa
            (di BioFido e della ricerca) sul punto esatto, non sul centro del comune. */}
        <label className="block md:col-span-2">
          <span className="label">Indirizzo (via e numero civico)</span>
          <div className="mt-1 flex gap-2">
            <div className="flex-1">
              <IndirizzoAutocomplete
                value={indirizzo}
                onChange={setIndirizzo}
                onSelect={(s) => {
                  // riempio indirizzo, posizione e — se assenti — città/CAP/provincia
                  setIndirizzo(s.via ?? s.label);
                  setCoord({ lat: s.lat, lon: s.lon });
                  if (s.citta && !citta.trim()) setCitta(s.citta);
                  if (s.cap) setCap(s.cap);
                  if (s.provincia) setProvincia(s.provincia);
                  setMsg("Indirizzo trovato ✓ — se il pin non è preciso, trascinalo sulla mappa.");
                }}
                placeholder="Es. Regione Pontelungo Inferiore 17, Albenga"
              />
            </div>
            <button
              type="button"
              className="btn-ghost whitespace-nowrap text-sm"
              onClick={localizza}
              disabled={geoBusy || !indirizzo.trim() || !citta.trim()}
            >
              {geoBusy ? "Cerco…" : "📍 Localizza"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-green-900/55">
            Inizia a scrivere e scegli un suggerimento: posiziona il segnaposto da
            solo. In alternativa, premi «Localizza» o trascina il pin sulla mappa.
          </p>
        </label>
        <label className="block">
          <span className="label">CAP</span>
          <input
            className="field mt-1"
            value={cap}
            inputMode="numeric"
            maxLength={5}
            onChange={(e) => setCap(e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="5 cifre"
          />
        </label>
        <label className="block">
          <span className="label">Provincia</span>
          <input
            className="field mt-1"
            value={provincia}
            maxLength={2}
            onChange={(e) => setProvincia(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
            placeholder="Sigla, es. SV"
          />
        </label>

        {/* Mappa per la posizione esatta: compare dopo «Localizza» (o se già
            salvata). L'utente può trascinare il pin se l'indirizzo non basta. */}
        {coord && (
          <div className="block md:col-span-2">
            <span className="label">Posizione sulla mappa</span>
            <p className="mt-1 mb-2 text-[11px] text-green-900/55">
              Trascina il segnaposto (o tocca un punto) per correggere la posizione
              esatta dell&apos;azienda. Ricordati di premere «Aggiorna dati» per salvarla.
            </p>
            <MappaPicker
              lat={coord.lat}
              lon={coord.lon}
              onChange={(la, lo) => setCoord({ lat: la, lon: lo })}
            />
          </div>
        )}
        <label className="block md:col-span-2">
          <span className="label">Descrizione azienda</span>
          <textarea
            className="field mt-1"
            rows={3}
            maxLength={MAX_DESCRIZIONE}
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value.slice(0, MAX_DESCRIZIONE))}
            placeholder="Racconta la tua azienda: storia, valori, cosa produci… (max 500 caratteri)"
          />
          <div className="mt-1 text-right text-[11px] text-green-900/50">
            {descrizione.length}/{MAX_DESCRIZIONE}
          </div>
        </label>

        {/* Immagine dell'azienda (copertina): compare nella scheda pubblica e,
            per i Gold, in cima al widget sulla mappa di BioFido. */}
        <div className="block md:col-span-2">
          <span className="label">Immagine dell&apos;azienda (copertina)</span>
          <div className="mt-1 flex items-center gap-3">
            {immagine ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={immagine} alt="" className="h-20 w-32 rounded-lg object-cover" />
            ) : (
              <span className="flex h-20 w-32 items-center justify-center rounded-lg bg-leaf text-[10px] text-green-900/50">
                nessuna immagine
              </span>
            )}
            <div className="flex flex-col gap-1">
              <label className="btn-ghost cursor-pointer text-sm">
                {uploadingImg ? "Carico…" : immagine ? "Cambia immagine" : "Carica immagine"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setUploadingImg(true);
                    try {
                      setImmagine(await caricaImmagineCatalogo(azienda?.id ?? ownerId, f));
                    } catch (err) {
                      alert((err as Error).message);
                    } finally {
                      setUploadingImg(false);
                    }
                  }}
                />
              </label>
              {immagine && (
                <button
                  type="button"
                  className="text-xs font-bold text-traffic-red hover:underline"
                  onClick={() => setImmagine(null)}
                >
                  Rimuovi
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 text-[11px] text-green-900/50">
            Ridimensionata in automatico. Ricordati di premere «Aggiorna dati» per salvarla.
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-lime" onClick={save} disabled={saving || !nome}>
          {saving ? "Salvataggio…" : azienda ? "Aggiorna dati" : "Salva azienda"}
        </button>
        {msg && <span className="text-sm font-semibold text-green-700">{msg}</span>}
      </div>
    </section>
  );
}

/* ------------------- STABILIMENTI ------------------- */
function StabilimentiCard({
  aziendaId,
  stabilimenti,
  onChange,
}: {
  aziendaId: string;
  stabilimenti: Stabilimento[];
  onChange: () => void;
}) {
  const [nome, setNome] = useState("");
  const [citta, setCitta] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!citta.trim()) return;
    setSaving(true);
    await supabase
      .from("stabilimenti")
      .insert({ azienda_id: aziendaId, nome: nome || null, citta });
    setSaving(false);
    setNome("");
    setCitta("");
    onChange();
  }
  async function remove(id: string) {
    await supabase.from("stabilimenti").delete().eq("id", id);
    onChange();
  }

  return (
    <section className="card mt-6 p-6">
      <h2 className="font-display text-2xl text-green-800">Stabilimenti di produzione</h2>
      <p className="mt-1 text-sm text-green-900/70">
        La città dello stabilimento è il punto da cui si misura la distanza delle
        materie prime.
      </p>

      {stabilimenti.length > 0 && (
        <ul className="mt-4 space-y-2">
          {stabilimenti.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-[#e3eed7] bg-white px-4 py-2"
            >
              <span className="text-green-900">
                <strong>{s.citta}</strong>
                {s.nome ? ` — ${s.nome}` : ""}
              </span>
              <button
                className="text-xs font-bold text-traffic-red hover:underline"
                onClick={() => remove(s.id)}
              >
                Elimina
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="block">
          <span className="label">Città dello stabilimento *</span>
          <div className="mt-1">
            <PlaceAutocomplete value={citta} onChange={setCitta} placeholder="Es. Cuneo" />
          </div>
        </label>
        <label className="block">
          <span className="label">Nome (facoltativo)</span>
          <input
            className="field mt-1"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Es. Stabilimento principale"
          />
        </label>
        <button className="btn-lime" onClick={add} disabled={saving || !citta}>
          Aggiungi
        </button>
      </div>
    </section>
  );
}

/* ------------------- PRODOTTI ------------------- */
function ProdottiCard({
  aziendaId,
  stabilimenti,
  prodotti,
  plan,
  onChange,
}: {
  aziendaId: string;
  stabilimenti: Stabilimento[];
  prodotti: Prodotto[];
  plan: Plan;
  onChange: () => void;
}) {
  // Diritti per piano: foto e prezzo sono riservati al Gold; i servizi
  // prenotabili a chi può vendere (Silver e Gold); la categoria è per tutti.
  const info = PLAN_MAP[plan] ?? PLAN_MAP.free;
  const gold = plan === "gold";
  const canSell = info.canSell;
  return (
    <section className="card mt-6 p-6">
      <h2 className="font-display text-2xl text-green-800">I tuoi prodotti</h2>
      <p className="mt-2 rounded-xl bg-leaf/60 p-3 text-sm text-green-900/85">
        🚦 <strong>ECO-VISA si basa sul semaforo di sostenibilità</strong>: carica i tuoi
        prodotti mostrando a tutti il loro valore. Per pubblicare la tua bacheca (Silver o
        Gold) serve <strong>almeno un prodotto con il semaforo</strong>.
      </p>

      {prodotti.length > 0 && (
        <ul className="mt-4 space-y-3">
          {prodotti.map((p) => {
            const fp = computeFootprint(
              p.stabilimento_citta,
              p.ingredienti.map((i) => ({ name: i.nome, origin: i.origine }))
            );
            return (
              <li key={p.id} className="rounded-2xl border border-[#e3eed7] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.immagine && (
                      <img src={p.immagine} alt="" className="h-14 w-14 flex-none rounded-lg object-cover" />
                    )}
                    <div>
                      <div className="font-display text-xl text-green-800">{p.nome}</div>
                      <div className="text-xs text-green-900/60">
                        {p.categoria ? p.categoria + " · " : ""}prodotto a {p.stabilimento_citta} ·{" "}
                        {p.ingredienti.length} materie prime
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Semaforo level={fp.level} size="sm" />
                    <div className="text-right">
                      <div className="font-display text-lg text-green-800">
                        {fp.totalCo2Kg.toLocaleString("it-IT")} kg
                      </div>
                      <div className="text-[11px] text-green-900/60">CO₂ trasporto</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {gold && (
                        <FotoProdottoBtn
                          prodottoId={p.id}
                          aziendaId={aziendaId}
                          immagine={p.immagine}
                          onChange={onChange}
                        />
                      )}
                      <button
                        className="text-xs font-bold text-traffic-red hover:underline"
                        onClick={async () => {
                          await supabase.from("prodotti").delete().eq("id", p.id);
                          onChange();
                        }}
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                </div>
                <CategoriaProdotto prodottoId={p.id} categoria={p.categoria} onChange={onChange} />
                {gold ? (
                  <PrezzoProdotto prodottoId={p.id} prezzo={p.prezzo ?? null} onChange={onChange} />
                ) : (
                  p.prezzo && (
                    <div className="mt-2 text-sm font-semibold text-green-800">
                      Prezzo: {formatPrezzo(p.prezzo)}
                    </div>
                  )
                )}
                {canSell && (
                  <PrenotabileToggle
                    prodottoId={p.id}
                    prenotabile={!!p.prenotabile}
                    onChange={onChange}
                  />
                )}
                {info.badgeEmbed && <EmbedSnippet id={p.id} />}
              </li>
            );
          })}
        </ul>
      )}

      <NuovoProdotto
        aziendaId={aziendaId}
        stabilimenti={stabilimenti}
        plan={plan}
        count={prodotti.length}
        onSaved={onChange}
      />
    </section>
  );
}

function FotoProdottoBtn({
  prodottoId,
  aziendaId,
  immagine,
  onChange,
}: {
  prodottoId: string;
  aziendaId: string;
  immagine: string | null;
  onChange: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  return (
    <label className="cursor-pointer text-xs font-bold text-green-700 hover:underline">
      {uploading ? "Carico…" : immagine ? "📷 Cambia foto" : "📷 Aggiungi foto"}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setUploading(true);
          try {
            const url = await caricaImmagineCatalogo(aziendaId, f);
            await supabase.from("prodotti").update({ immagine: url }).eq("id", prodottoId);
            onChange();
          } catch (err) {
            alert((err as Error).message);
          } finally {
            setUploading(false);
          }
        }}
      />
    </label>
  );
}

function PrezzoProdotto({
  prodottoId,
  prezzo,
  onChange,
}: {
  prodottoId: string;
  prezzo: string | null;
  onChange: () => void;
}) {
  const [val, setVal] = useState(formatPrezzo(prezzo));
  const [saving, setSaving] = useState(false);
  const [salvato, setSalvato] = useState(false);

  async function salva() {
    setSaving(true);
    setSalvato(false);
    const { error } = await supabase
      .from("prodotti")
      .update({ prezzo: formatPrezzo(val) || null })
      .eq("id", prodottoId);
    setSaving(false);
    if (error) {
      alert(
        /prezzo/i.test(error.message)
          ? "Per usare il prezzo aggiungi prima la colonna al database (te l'ho indicata)."
          : error.message,
      );
      return;
    }
    setSalvato(true);
    setTimeout(() => setSalvato(false), 1500);
    onChange();
  }

  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl bg-leaf/40 p-2">
      <span className="text-xs font-bold uppercase tracking-wide text-green-700">
        💛 Prezzo (Gold)
      </span>
      <ImportoInput
        value={val}
        onChange={setVal}
        className="field h-9 w-32 py-1"
        placeholder="es. € 4,50"
      />
      <button type="button" className="btn-lime text-sm" onClick={salva} disabled={saving}>
        {saving ? "Salvo…" : salvato ? "Salvato ✓" : "Salva prezzo"}
      </button>
    </div>
  );
}

function CategoriaProdotto({
  prodottoId,
  categoria,
  onChange,
}: {
  prodottoId: string;
  categoria: string | null;
  onChange: () => void;
}) {
  const [val, setVal] = useState(categoria ?? "");
  const [saving, setSaving] = useState(false);
  const [salvato, setSalvato] = useState(false);

  async function salva() {
    setSaving(true);
    setSalvato(false);
    const { error } = await supabase
      .from("prodotti")
      .update({ categoria: val.trim() || null })
      .eq("id", prodottoId);
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setSalvato(true);
    setTimeout(() => setSalvato(false), 1500);
    onChange();
  }

  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl bg-leaf/40 p-2">
      <span className="text-xs font-bold uppercase tracking-wide text-green-700">
        Categoria
      </span>
      <input
        className="field h-9 flex-1 py-1"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Es. Biscotti, Olio, Ortaggi…"
      />
      <button type="button" className="btn-lime text-sm" onClick={salva} disabled={saving}>
        {saving ? "Salvo…" : salvato ? "Salvato ✓" : "Salva"}
      </button>
    </div>
  );
}

function PrenotabileToggle({
  prodottoId,
  prenotabile,
  onChange,
}: {
  prodottoId: string;
  prenotabile: boolean;
  onChange: () => void;
}) {
  const [on, setOn] = useState(prenotabile);
  const [saving, setSaving] = useState(false);

  async function toggle(v: boolean) {
    setOn(v);
    setSaving(true);
    const { error } = await supabase.from("prodotti").update({ prenotabile: v }).eq("id", prodottoId);
    setSaving(false);
    if (error) {
      setOn(!v);
      alert(
        /prenotabile/i.test(error.message)
          ? "Per i servizi prenotabili aggiungi prima la colonna al database (te l'ho indicata)."
          : error.message,
      );
      return;
    }
    onChange();
  }

  return (
    <label className="mt-2 flex items-center gap-2 rounded-xl bg-leaf/40 p-2 text-sm">
      <input
        type="checkbox"
        className="h-5 w-5 accent-[var(--lime-500)]"
        checked={on}
        disabled={saving}
        onChange={(e) => toggle(e.target.checked)}
      />
      <span className="font-semibold text-green-800">
        ✨ Servizio extra prenotabile dal cliente {saving ? "…" : ""}
      </span>
    </label>
  );
}

function StatoBadge({ stato }: { stato: BookingStatus }) {
  const color =
    stato === "confermata"
      ? "bg-traffic-green text-white"
      : stato === "rifiutata" || stato === "annullata"
      ? "bg-[#c9d3da] text-[#33414a]"
      : "bg-badge-yellow text-green-900";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${color}`}>
      {STATO_LABEL[stato]}
    </span>
  );
}

/* ------------------- MESSAGGI (inbox unica) ------------------- */
type InboxItem =
  | { kind: "contatto"; date: string; c: Contatto }
  | { kind: "prenotazione"; date: string; b: Booking };

function MessaggiCard({ ownerId }: { ownerId: string }) {
  const [contatti, setContatti] = useState<Contatto[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, b] = await Promise.all([listContatti(ownerId), listMyBookings(ownerId)]);
    setContatti(c);
    setBookings(b);
    setLoading(false);
  }, [ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  const items: InboxItem[] = useMemo(() => {
    const a: InboxItem[] = contatti.map((c) => ({ kind: "contatto", date: c.createdAt ?? "", c }));
    const d: InboxItem[] = bookings.map((b) => ({ kind: "prenotazione", date: b.createdAt ?? "", b }));
    return [...a, ...d].sort((x, y) => (y.date > x.date ? 1 : x.date > y.date ? -1 : 0));
  }, [contatti, bookings]);

  const nuovi = contatti.filter((c) => c.stato === "nuovo").length;

  async function gestito(id: string, val: boolean) {
    await setContattoGestito(id, val);
    load();
  }

  return (
    <section id="messaggi" className="card mt-6 p-6 scroll-mt-20">
      <h2 className="font-display text-2xl text-green-800">
        Messaggi
        {nuovi > 0 && (
          <span className="ml-2 rounded-full bg-traffic-green px-2 py-0.5 align-middle text-xs font-bold text-white">
            {nuovi} nuovi
          </span>
        )}
      </h2>
      <p className="mt-1 text-sm text-green-900/70">
        Tutto ciò che ti arriva dai clienti: messaggi di «Contatta l&apos;azienda» e
        richieste di prenotazione, dal più recente.
      </p>

      <NotificheToggle />
      <SmsNotificheToggle ownerId={ownerId} />

      {loading ? (
        <p className="mt-4 text-sm text-green-900/60">Caricamento…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-green-900/70">
          Nessun messaggio per ora. Quando un cliente ti scrive o prenota, lo trovi qui
          (e ti arriva anche per email).
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((it) =>
            it.kind === "contatto" ? (
              <li
                key={`c-${it.c.id}`}
                className={`rounded-2xl border p-4 ${
                  it.c.stato === "nuovo" ? "border-traffic-green bg-leaf/40" : "border-[#e3eed7] bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-lime-600">
                      ✉️ Messaggio
                    </div>
                    <div className="font-semibold text-green-800">{it.c.nomeCliente}</div>
                    <div className="text-xs text-green-900/60">{it.c.emailCliente}</div>
                  </div>
                  {it.c.createdAt && (
                    <div className="text-[11px] text-green-900/50">{it.c.createdAt.slice(0, 10)}</div>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-green-900/85">{it.c.messaggio}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={`mailto:${it.c.emailCliente}?subject=${encodeURIComponent(
                      "Risposta al tuo messaggio",
                    )}`}
                    className="rounded-full bg-green-700 px-3 py-1 text-xs font-bold text-white hover:bg-green-800"
                  >
                    ✉️ Rispondi via email
                  </a>
                  <button
                    className="rounded-full border border-green-600 px-3 py-1 text-xs font-bold text-green-700"
                    onClick={() => gestito(it.c.id, it.c.stato !== "gestito")}
                  >
                    {it.c.stato === "gestito" ? "↩︎ Riapri" : "✓ Segna gestito"}
                  </button>
                </div>
              </li>
            ) : (
              <li key={`b-${it.b.id}`} className="rounded-2xl border border-[#e3eed7] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-badge-yellow">
                      🗓️ Prenotazione
                    </div>
                    <div className="font-semibold text-green-800">
                      {it.b.titolo ?? "Servizio"} · {it.b.persone} persone
                    </div>
                    <div className="text-xs text-green-900/60">
                      {it.b.clienteNome} · {it.b.clienteEmail}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-green-800">{euroCents(it.b.totaleCents)}</div>
                    <StatoBadge stato={it.b.stato} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    className="rounded-full border border-green-600 px-3 py-1 text-xs font-bold text-green-700"
                    onClick={() => setChatOpen(chatOpen === it.b.id ? null : it.b.id)}
                  >
                    💬 Chat
                  </button>
                </div>
                {chatOpen === it.b.id && (
                  <ChatPrenotazione prenotazioneId={it.b.id} mittente="azienda" />
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function PrenotazioniCard({ ownerId }: { ownerId: string }) {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setItems(await listMyBookings(ownerId));
    setLoading(false);
  }, [ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, stato: BookingStatus) {
    await setBookingStatus(id, stato);
    await sendMessage(
      id,
      "azienda",
      stato === "confermata"
        ? "La tua prenotazione è stata confermata ✅. A presto!"
        : "Spiacenti, non possiamo accettare questa richiesta. Scrivici pure per un'alternativa.",
    );
    load();
  }

  return (
    <section className="card mt-6 p-6">
      <h2 className="font-display text-2xl text-green-800">Prenotazioni ricevute</h2>
      {loading ? (
        <p className="mt-3 text-sm text-green-900/60">Caricamento…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-green-900/70">
          Nessuna richiesta per ora. Pubblica un servizio extra prenotabile per riceverne.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((b) => (
            <li key={b.id} className="rounded-2xl border border-[#e3eed7] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-green-800">
                    {b.titolo ?? "Servizio"} · {b.persone} persone
                  </div>
                  <div className="text-xs text-green-900/60">
                    {b.clienteNome} · {b.clienteEmail}
                    {b.clienteTel ? ` · ${b.clienteTel}` : ""}
                  </div>
                  <div className="text-xs text-green-900/60">Data richiesta: {b.dataRichiesta}</div>
                  {b.note && <div className="mt-1 text-xs italic text-green-900/55">“{b.note}”</div>}
                </div>
                <div className="text-right">
                  <div className="font-display text-lg text-green-800">{euroCents(b.totaleCents)}</div>
                  <div className="text-[11px] text-green-900/55">
                    commissione {euroCents(b.commissioneCents)}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatoBadge stato={b.stato} />
                {b.paymentStatus === "pagata" && (
                  <span className="rounded-full bg-traffic-green px-2 py-0.5 text-[11px] font-bold text-white">
                    Pagata ✅
                  </span>
                )}
                {b.stato === "in_attesa" && (
                  <>
                    <button
                      className="rounded-full bg-traffic-green px-3 py-1 text-xs font-bold text-white"
                      onClick={() => act(b.id, "confermata")}
                    >
                      Conferma
                    </button>
                    <button
                      className="rounded-full border border-traffic-red px-3 py-1 text-xs font-bold text-traffic-red"
                      onClick={() => act(b.id, "rifiutata")}
                    >
                      Rifiuta
                    </button>
                  </>
                )}
                <button
                  className="rounded-full border border-green-600 px-3 py-1 text-xs font-bold text-green-700"
                  onClick={() => setChatOpen(chatOpen === b.id ? null : b.id)}
                >
                  💬 Messaggi
                </button>
              </div>
              {chatOpen === b.id && <ChatPrenotazione prenotazioneId={b.id} mittente="azienda" />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PagamentiCard({ ownerId, plan }: { ownerId: string; plan: Plan }) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("stripe_accounts")
      .select("charges_enabled")
      .eq("user_id", ownerId)
      .maybeSingle()
      .then(({ data }) => setReady(Boolean((data as { charges_enabled?: boolean })?.charges_enabled)));
    refreshConnectStatus().then((live) => {
      if (live !== null) setReady(live);
    });
  }, [ownerId]);

  // i pagamenti delle prenotazioni servono solo ai piani che possono vendere
  if (!billingEnabled || !PLAN_MAP[plan].canSell) return null;

  async function collega() {
    setBusy(true);
    setMsg(null);
    try {
      await startOnboarding();
    } catch (e) {
      setBusy(false);
      setMsg((e as Error).message);
    }
  }

  return (
    <section className="card mt-6 p-6">
      <h2 className="font-display text-2xl text-green-800">Pagamenti</h2>
      <p className="mt-1 text-sm text-green-900/70">
        Collega Stripe per ricevere online i pagamenti dei servizi extra prenotabili.
        Trattieni l&apos;incasso meno la commissione del piano.
      </p>
      {ready ? (
        <p className="mt-4 rounded-xl bg-leaf px-4 py-3 text-sm font-semibold text-green-800">
          Account Stripe collegato ✅ — puoi ricevere pagamenti.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn-lime" onClick={collega} disabled={busy}>
            {busy ? "Apro Stripe…" : "Collega Stripe"}
          </button>
          {msg && <span className="text-sm font-semibold text-traffic-red">{msg}</span>}
        </div>
      )}
    </section>
  );
}

function EmbedSnippet({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  // URL assoluto per il codice da copiare (va sul sito dell'azienda)
  const code = `<iframe src="https://ecovisa.it/embed/?id=${id}" width="100%" height="430" style="border:0;max-width:480px" title="Passaporto ecologico ECO-VISA"></iframe>`;
  // URL relativo (con eventuale basePath) per l'anteprima dal vivo qui in dashboard
  const previewSrc = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/embed/?id=${id}`;
  return (
    <details className="mt-3 rounded-xl bg-leaf/50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-green-700">
        🔗 Striscia per il tuo sito (anteprima + codice)
      </summary>

      <p className="mt-2 text-xs font-semibold text-green-900/70">Anteprima dal vivo</p>
      <div className="mt-1 flex justify-center rounded-xl bg-white p-2">
        <iframe
          src={previewSrc}
          width="100%"
          height={430}
          style={{ border: 0, maxWidth: 480 }}
          title="Anteprima passaporto ecologico"
        />
      </div>

      <p className="mt-3 text-xs text-green-900/70">
        Copia questa striscia e incollala nel tuo sito web: mostrerà la scheda qui
        sopra, sempre aggiornata in automatico.
      </p>
      <textarea
        readOnly
        value={code}
        onFocus={(e) => e.currentTarget.select()}
        className="field mt-2 h-24 w-full font-mono text-[11px]"
      />
      <button
        type="button"
        className="btn-lime mt-2 text-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard non disponibile */
          }
        }}
      >
        {copied ? "Copiato ✓" : "Copia codice"}
      </button>
    </details>
  );
}

function NuovoProdotto({
  aziendaId,
  stabilimenti,
  plan,
  count,
  onSaved,
}: {
  aziendaId: string;
  stabilimenti: Stabilimento[];
  plan: Plan;
  /** quanti prodotti ha già l'azienda (per il limite del piano) */
  count: number;
  onSaved: () => void;
}) {
  // Diritti per piano: foto solo Gold; servizio prenotabile a chi vende
  // (Silver/Gold); numero massimo di prodotti per piano.
  const info = PLAN_MAP[plan] ?? PLAN_MAP.free;
  const gold = plan === "gold";
  const canSell = info.canSell;
  const limite = info.maxProducts;
  const pieno = count >= limite;
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [stab, setStab] = useState(stabilimenti[0]?.citta ?? "");
  const [ingredienti, setIngredienti] = useState<Ingrediente[]>([
    { nome: "", origine: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [immagine, setImmagine] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // prodotto ordinario oppure servizio extra prenotabile dal cliente
  const [tipoVoce, setTipoVoce] = useState<"prodotto" | "servizio">("prodotto");
  const [accetta, setAccetta] = useState(false);

  useEffect(() => {
    if (!stab && stabilimenti[0]) setStab(stabilimenti[0].citta);
  }, [stabilimenti, stab]);

  // risolve via OpenStreetMap stabilimento + origini digitate
  const { version: geoVersion, loading: geoLoading } = useGeoResolve([
    stab,
    ...ingredienti.map((i) => i.origine),
  ]);

  // calcolo CO2 live (ricalcola anche quando OSM risolve nuove località)
  const fp = useMemo(
    () =>
      computeFootprint(
        stab,
        ingredienti
          .filter((i) => i.nome && i.origine)
          .map((i) => ({ name: i.nome, origin: i.origine }))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stab, ingredienti, geoVersion]
  );

  function setIng(i: number, field: keyof Ingrediente, value: string) {
    setIngredienti((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row))
    );
  }
  function addRow() {
    setIngredienti((prev) => [...prev, { nome: "", origine: "" }]);
  }
  function removeRow(i: number) {
    setIngredienti((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    const validIngr = ingredienti.filter((i) => i.nome.trim() && i.origine.trim());
    if (!nome.trim() || !stab.trim() || validIngr.length === 0) return;
    if (pieno) {
      alert(
        `Il tuo piano (${info.label}) consente fino a ${limite} prodotto/i. Passa a un piano superiore per aggiungerne altri.`,
      );
      return;
    }
    if (tipoVoce === "servizio" && !accetta) {
      alert("Per rendere il servizio prenotabile, spunta l'accettazione.");
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      azienda_id: aziendaId,
      nome,
      categoria: categoria || null,
      stabilimento_citta: stab,
      // foto solo per il piano Gold
      immagine: gold ? immagine : null,
      // servizio prenotabile solo per chi può vendere (Silver/Gold)
      prenotabile: canSell && tipoVoce === "servizio" && accetta,
    };
    let res = await supabase.from("prodotti").insert(payload).select("id").single();
    // se la colonna prenotabile non esiste ancora, riprovo senza
    if (res.error && /prenotabile/i.test(res.error.message)) {
      delete payload.prenotabile;
      res = await supabase.from("prodotti").insert(payload).select("id").single();
    }
    const { data, error } = res;
    if (error || !data) {
      setSaving(false);
      alert("Errore nel salvare il prodotto: " + (error?.message ?? ""));
      return;
    }
    const rows = validIngr.map((i) => ({
      prodotto_id: data.id,
      nome: i.nome,
      origine: i.origine,
    }));
    await supabase.from("ingredienti").insert(rows);
    setSaving(false);
    setNome("");
    setCategoria("");
    setImmagine(null);
    setTipoVoce("prodotto");
    setAccetta(false);
    setIngredienti([{ nome: "", origine: "" }]);
    onSaved();
  }

  const hasStab = stabilimenti.length > 0;

  return (
    <div className="mt-6 rounded-2xl border-2 border-dashed border-[#cfe3b4] bg-leaf/40 p-5">
      <h3 className="font-display text-xl text-green-800">
        Aggiungi un prodotto{" "}
        <span className="text-sm font-normal text-green-900/60">
          ({count}/{limite === Infinity ? "∞" : limite} · piano {info.label})
        </span>
      </h3>
      {!hasStab && (
        <p className="mt-2 text-sm font-semibold text-traffic-red">
          Aggiungi prima almeno uno stabilimento di produzione qui sopra.
        </p>
      )}
      {pieno && (
        <p className="mt-2 text-sm font-semibold text-traffic-red">
          Hai raggiunto il limite di {limite} prodotto/i del piano {info.label}. Passa a
          un piano superiore per aggiungerne altri.
        </p>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="label">Nome prodotto *</span>
          <input className="field mt-1" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Categoria</span>
          <input
            className="field mt-1"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Es. Biscotti"
          />
        </label>
        <label className="block">
          <span className="label">Stabilimento *</span>
          <select className="field mt-1" value={stab} onChange={(e) => setStab(e.target.value)}>
            {stabilimenti.map((s) => (
              <option key={s.id} value={s.citta}>
                {s.citta}
                {s.nome ? ` — ${s.nome}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* tipo voce: prodotto ordinario o servizio extra prenotabile dal cliente.
          Il "servizio prenotabile" è riservato ai piani che possono vendere. */}
      {canSell && (
        <>
          <label className="mt-3 block">
            <span className="label">Tipo</span>
            <select
              className="field mt-1"
              value={tipoVoce}
              onChange={(e) => setTipoVoce(e.target.value as "prodotto" | "servizio")}
            >
              <option value="prodotto">Prodotto ordinario</option>
              <option value="servizio">Servizio extra (prenotabile dal cliente)</option>
            </select>
          </label>
          {tipoVoce === "servizio" && (
            <label className="mt-2 flex items-start gap-2 rounded-xl border-2 border-badge-yellow bg-[#fffbe9] p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 accent-[var(--lime-500)]"
                checked={accetta}
                onChange={(e) => setAccetta(e.target.checked)}
              />
              <span className="text-green-900/85">
                <strong>Rendi prenotabile dai clienti</strong> (visite, laboratori, esperienze):
                accetto che i clienti inviino una richiesta e, a conferma, paghino online via
                Stripe (con la commissione del piano). Compare sia su ECO-VISA sia su BioFido.
              </span>
            </label>
          )}
        </>
      )}

      {/* immagine del prodotto (solo Gold), ridimensionata in automatico */}
      {gold && (
      <div className="mt-3">
        <span className="label">Immagine del prodotto (facoltativa)</span>
        <div className="mt-1 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {immagine ? (
            <img src={immagine} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-leaf text-[10px] text-green-900/50">
              nessuna
            </span>
          )}
          <label className="btn-ghost cursor-pointer text-sm">
            {uploading ? "Carico…" : immagine ? "Cambia foto" : "Carica foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                try {
                  setImmagine(await caricaImmagineCatalogo(aziendaId, f));
                } catch (err) {
                  alert((err as Error).message);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </div>
        <p className="mt-1 text-[11px] text-green-900/50">
          Ridimensionata e alleggerita in automatico.
        </p>
      </div>
      )}

      <div className="mt-4">
        <span className="label">Ingredienti e loro origine</span>
        <div className="mt-2 space-y-2">
          {ingredienti.map((row, i) => {
            const res = fp.ingredients.find((r) => r.name === row.nome);
            const notFound =
              row.origine.trim() !== "" &&
              row.nome.trim() !== "" &&
              !!res &&
              !res.resolved;
            return (
              <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-center">
                <input
                  className="field"
                  value={row.nome}
                  onChange={(e) => setIng(i, "nome", e.target.value)}
                  placeholder="Materia prima (es. Farina di farro)"
                />
                <PlaceAutocomplete
                  value={row.origine}
                  onChange={(v) => setIng(i, "origine", v)}
                  placeholder="Origine (es. Siena)"
                />
                <div className="flex items-center gap-2">
                  {notFound && (
                    <span className="text-xs text-traffic-red">località ?</span>
                  )}
                  {ingredienti.length > 1 && (
                    <button
                      className="text-xs font-bold text-traffic-red hover:underline"
                      onClick={() => removeRow(i)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn-ghost mt-2 text-sm" onClick={addRow}>
          + Aggiungi materia prima
        </button>
      </div>

      {/* anteprima CO2 live */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4">
        <div className="flex items-center gap-3">
          <Semaforo level={fp.level} score={fp.score} />
        </div>
        <div className="text-right">
          <div className="font-display text-3xl text-green-800">
            {fp.totalCo2Kg.toLocaleString("it-IT")} kg
          </div>
          <div className="text-xs text-green-900/60">
            CO₂ di trasporto stimata · {fp.totalKm.toLocaleString("it-IT")} km
          </div>
          {geoLoading && (
            <div className="text-[11px] text-lime-600">🔎 Cerco le località su OpenStreetMap…</div>
          )}
        </div>
      </div>

      <button
        className="btn-lime mt-4"
        onClick={save}
        disabled={saving || !hasStab || !nome.trim() || pieno}
      >
        {saving ? "Salvataggio…" : "Salva prodotto"}
      </button>
    </div>
  );
}
