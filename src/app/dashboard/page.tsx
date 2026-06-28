"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { caricaDatiFatturazione, salvaDatiFatturazione } from "@/lib/fatturazione";
import { caricaDatiBio, salvaDatiBio, ENTI_CERTIFICATORI } from "@/lib/bio";
import { SezioneBio } from "@/components/SezioneBio";
import { SchedaServizi } from "@/components/SchedaServizi";
import { ServiziExtra } from "@/components/ServiziExtra";
import { GoldPromoBanner } from "@/components/GoldPromoBanner";
import { CalcolatoreImpronta } from "@/components/CalcolatoreImpronta";
import { EsperienzeCard } from "@/components/EsperienzeCard";
import { AnteprimaScheda } from "@/components/AnteprimaScheda";
import { OrdiniShopRicevuti } from "@/components/OrdiniShopRicevuti";
import { StatisticheCard } from "@/components/StatisticheCard";
import { caricaImmagineCatalogo } from "@/lib/catalogo";
import { lookupPiva } from "@/lib/fatturazione";
import { getMyPlan } from "@/lib/plan";
import { syncBioFido } from "@/lib/biofido-scheda";
import { formatPrezzo } from "@/lib/prezzo";
import { billingEnabled, startCheckout, openCustomerPortal } from "@/lib/billing";
import { getExtraScelti, setExtraScelto } from "@/lib/extra-selezionati";
import {
  getAcquistoSospeso,
  pulisciAcquistoSospeso,
  type AcquistoSospeso,
} from "@/lib/acquisto-sospeso";
import { PurchasePopup } from "@/components/PurchasePopup";
import { DashboardPlanHeader } from "@/components/DashboardPlanHeader";
import { OnboardingCard } from "@/components/OnboardingCard";
import { URL_BIOFIDO } from "@/lib/portale";
import { CrossPortalBanner } from "@/components/CrossPortalBanner";
import { aziendaSlug } from "@/lib/azienda-pubblica";
import { startOnboarding, refreshConnectStatus, captureBooking, cancelBooking } from "@/lib/connect";
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
import { DashboardShell, BarraTendine, vaiAlPannello, type DashPanel } from "@/components/DashboardShell";
import { LegendaPianiSlider } from "@/components/LegendaPianiSlider";
import { PromoTimer } from "@/components/PromoTimer";
import { contaInSospeso } from "@/lib/contatori";
import { getMyExtras, getStatoOnboarding } from "@/lib/onboarding";

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
  /** 'biofido' = scheda nata su BioFido e rispecchiata qui (si gestisce su BioFido) */
  origine?: string | null;
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
  in_shop?: boolean | null;
  descrizione?: string | null;
  foto2?: string | null;
  giacenza?: number | null;
  confezione?: string | null;
  contenuto?: number | null;
  unita?: string | null;
  ingredienti: Ingrediente[];
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [azienda, setAzienda] = useState<Azienda | null>(null);
  const [stabilimenti, setStabilimenti] = useState<Stabilimento[]>([]);
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  // cambia a ogni salvataggio (prodotto/servizio) per ricaricare l'anteprima scheda
  const [previewKey, setPreviewKey] = useState(0);
  // "pagina prodotti": vista dedicata a tutto schermo per prodotti + servizi extra
  const [vistaProdotti, setVistaProdotti] = useState(false);
  // setGeoV forza il re-render (e il ricalcolo CO₂) quando OSM risolve le località salvate
  const [, setGeoV] = useState(0);
  // piano: attivo (da subscriptions, condiviso con BioFido) e scelto per la configurazione
  const [activePlan, setActivePlan] = useState<Plan>("free");
  const [pianoScelto, setPianoScelto] = useState<Plan>("free");
  const [periodo, setPeriodo] = useState<"monthly" | "annual">("annual");
  // popup-carrello del pagamento (reminder all'azienda quando sceglie un piano)
  const [popupPag, setPopupPag] = useState<{ plan: Plan; period: "monthly" | "annual" } | null>(null);
  // Gate ECO-VISA: non ci si abbona se non si è pubblicato almeno un prodotto col
  // semaforo di sostenibilità (è il cuore del servizio). Mostra l'invito gentile.
  const [gateSemaforo, setGateSemaforo] = useState(false);
  // Acquisto in sospeso (pagamento avviato ma non completato): card "Completa".
  const [sospeso, setSospeso] = useState<AcquistoSospeso | null>(null);
  // onboarding attivo + contatori per i badge della sidebar
  const [onbAttivo, setOnbAttivo] = useState(false);
  const [conte, setConte] = useState({ ordini: 0, prenotazioni: 0 });
  useEffect(() => {
    if (!user) return;
    contaInSospeso().then(setConte).catch(() => {});
    getMyExtras().then((ex) => setOnbAttivo(ex.includes("onboarding"))).catch(() => {});
  }, [user]);

  // ---- caricamento dati ----
  const primoCaricamento = useRef(true);
  const loadAll = useCallback(async () => {
    // solo il PRIMO caricamento mostra "Caricamento…" (che rimonta la pagina e
    // riporta lo scroll in cima): i ricaricamenti dopo un salvataggio sono
    // silenziosi, così resti sulla scheda che stai compilando.
    if (primoCaricamento.current) setLoading(true);
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
    primoCaricamento.current = false;
  }, []);

  // ricarica i dati E aggiorna l'anteprima scheda (dopo salva/elimina prodotto o servizio)
  const refreshAll = useCallback(() => {
    loadAll();
    setPreviewKey((k) => k + 1);
  }, [loadAll]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/accedi");
      return;
    }
    // La dashboard è l'AREA AZIENDE: un cliente non deve finirci. Lo rimando a casa.
    if ((user.user_metadata as { tipo?: string } | undefined)?.tipo === "cliente") {
      router.replace("/");
      return;
    }
    loadAll();
  }, [authLoading, user, router, loadAll]);

  // piano attivo (condiviso con BioFido) + inizializzazione del piano scelto
  useEffect(() => {
    if (!user) return;
    getMyPlan().then((p) => {
      setActivePlan(p);
      // Parto SEMPRE dal piano reale: un Free vede selezionato Free (non più Gold
      // preselezionato da una vecchia scelta in localStorage). Scegliendo un piano
      // diverso si apre il popup-carrello.
      setPianoScelto(p);
      try {
        window.localStorage.setItem("ecovisa_plan", p);
      } catch {
        /* ignore */
      }
    });
  }, [user]);

  // Acquisto in sospeso: al mount leggo il marcatore; se il ritorno è "ok" lo
  // pulisco, altrimenti mostro la card "Completa il tuo acquisto".
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("abbonamento") === "ok") {
      pulisciAcquistoSospeso();
      setSospeso(null);
      return;
    }
    setSospeso(getAcquistoSospeso());
  }, []);

  // Se il piano in sospeso risulta attivo, l'acquisto è concluso: pulisco.
  useEffect(() => {
    if (sospeso && activePlan !== "free" && activePlan === sospeso.plan) {
      pulisciAcquistoSospeso();
      setSospeso(null);
    }
  }, [activePlan, sospeso]);

  function riprendiAcquisto() {
    if (!sospeso) return;
    for (const k of sospeso.extras) setExtraScelto(k, true);
    setPianoScelto(sospeso.plan as Plan);
    setPeriodo(sospeso.period);
    setPopupPag({ plan: sospeso.plan as Plan, period: sospeso.period });
  }

  async function scegliPiano(p: Plan, per: "monthly" | "annual") {
    // Niente abbonamento senza almeno un prodotto/semaforo pubblicato.
    if (p !== "free" && prodotti.length === 0) {
      setGateSemaforo(true);
      return;
    }
    const downgrade = isDowngrade(activePlan, p);
    // Downgrade: avviso che i contenuti/funzioni non inclusi nel piano scelto
    // non saranno più visibili (i dati restano salvati, tornano col re-upgrade).
    if (downgrade) {
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
    // Piano a pagamento → si apre SEMPRE il popup-carrello. Il popup decide poi se
    // fare un nuovo checkout (utente Free) o il cambio piano con conguaglio
    // (utente già abbonato), senza creare doppioni.
    if (p !== "free") setPopupPag({ plan: p, period: per });
  }

  // Acquisto di un SERVIZIO EXTRA dalla dashboard: apre il popup-carrello sul
  // piano minimo che lo include (o sul piano attuale, se già sufficiente), con
  // il servizio già preselezionato — niente più rimando alla pagina esterna.
  function acquistaServizio(key: string) {
    // Anche i servizi extra richiedono un abbonamento → stesso gate del semaforo.
    if (prodotti.length === 0) {
      setGateSemaforo(true);
      return;
    }
    const need = key === "onboarding" ? 2 : 1; // onboarding=Gold, report/badge=Silver
    const rank: Record<string, number> = { free: 0, silver: 1, gold: 2 };
    const target: Plan = (rank[activePlan] ?? 0) >= need ? (activePlan as Plan) : need >= 2 ? "gold" : "silver";
    setExtraScelto(key, true);
    setPianoScelto(target);
    setPeriodo(periodo);
    setPopupPag({ plan: target, period: periodo });
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

  // GATING: senza anagrafica minima (nome + P.IVA o CF + città + indirizzo) non si
  // entra nella dashboard. Così dietro ogni profilo c'è un'azienda reale. SDI/PEC
  // sono richiesti solo all'acquisto di un abbonamento (nel popup di pagamento).
  const a = azienda;
  const anagraficaOk = !!(
    a &&
    a.nome?.trim() &&
    (a.piva?.trim() || a.codice_fiscale?.trim()) &&
    a.citta_sede?.trim() &&
    a.indirizzo?.trim()
  );
  if (!anagraficaOk) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-xs font-bold uppercase tracking-wide text-lime-500">
          Area aziende
        </div>
        <h1 className="title-pangea text-3xl text-green-700 md:text-4xl">
          Completa la tua anagrafica
        </h1>
        <p className="mt-3 rounded-xl bg-[#fff3d4] p-4 text-sm font-semibold text-[#7a5a00]">
          Abbiamo bisogno dei tuoi dati per essere sicuri che tu sia una vera azienda:
          questa sezione è dedicata alle imprese, non ai privati o agli hobbisti. In
          questo modo tuteliamo i consumatori. Completa nome, P.IVA o codice fiscale,
          città e indirizzo per accedere alla dashboard. I dati fiscali completi (SDI o
          PEC) ti verranno richiesti solo al momento dell&apos;acquisto di un abbonamento.
        </p>
        <div className="mt-6">
          <AnagraficaCard
            azienda={azienda}
            initialNome={(user?.user_metadata as { nome?: string })?.nome}
            ownerId={user?.id ?? ""}
            onSaved={loadAll}
            plan={activePlan}
          />
        </div>

        {/* Specchietto: cosa potrai fare con i piani + servizi extra */}
        <div className="mt-10">
          <h2 className="title-pangea text-2xl text-green-700">
            Intanto, scopri cosa potrai fare
          </h2>
          <p className="mt-1 text-sm text-green-900/70">
            Ecco i piani e i servizi extra: sceglierai quando vuoi, dopo aver completato
            l&apos;anagrafica.
          </p>
          <div className="mt-4">
            <PianiAbbonamento />
          </div>
        </div>

        <button
          className="btn-ghost mt-8 text-sm"
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/");
          }}
        >
          Esci
        </button>
      </div>
    );
  }

  // Guscio dashboard stile Hostinger (gemello di BioFido): sidebar + pannelli al
  // centro. Dopo il gating anagrafica, azienda e user esistono.
  if (!user || !azienda) return null;

  const esciBtn = (
    <button
      className="text-sm font-semibold text-traffic-red hover:underline"
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/");
      }}
    >
      ↩ Esci
    </button>
  );

  const topBar = (
    <BarraTendine
      voci={[
        {
          id: "piani",
          icona: "🚀",
          label: "Con cosa vuoi partire",
          tone: "verde",
          content: (
            <>
              <PianoSelector scelto={pianoScelto} attivo={activePlan} onScegli={scegliPiano} />
              <PagamentoFinale
                ownerId={user.id}
                scelto={pianoScelto}
                attivo={activePlan}
                bloccato={prodotti.length === 0}
                onBloccato={() => setGateSemaforo(true)}
                prefill={{
                  ragione_sociale: azienda.nome ?? undefined,
                  partita_iva: azienda.piva ?? undefined,
                  codice_fiscale: azienda.codice_fiscale ?? undefined,
                  indirizzo: azienda.indirizzo ?? undefined,
                  cap: azienda.cap ?? undefined,
                  citta: azienda.citta_sede ?? undefined,
                  provincia: azienda.provincia ?? undefined,
                }}
              />
            </>
          ),
        },
        {
          id: "extra",
          icona: "🎁",
          label: "Aggiungi servizi extra",
          tone: "giallo",
          content: <ServiziExtra showPrices plan={activePlan} onAcquista={acquistaServizio} />,
        },
      ]}
      promo={<PromoOnboarding />}
    />
  );

  const alert =
    sospeso && activePlan !== sospeso.plan ? (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-display text-lg text-green-800">⏳ Hai un acquisto da completare</div>
          <p className="text-sm text-green-900/75">
            Piano {PLAN_MAP[sospeso.plan as Plan]?.label ?? sospeso.plan}
            {sospeso.extras.length ? ` + ${sospeso.extras.length} servizio/i extra` : ""} — pagamento non concluso.
          </p>
        </div>
        <div className="flex flex-none gap-2">
          <button type="button" onClick={riprendiAcquisto} className="btn-lime justify-center text-sm">
            Riprendi e paga
          </button>
          <button
            type="button"
            onClick={() => {
              pulisciAcquistoSospeso();
              setSospeso(null);
            }}
            className="btn-ghost justify-center text-sm"
          >
            Annulla
          </button>
        </div>
      </div>
    ) : null;

  const panels: DashPanel[] = [
    {
      id: "start",
      section: "Lavoro",
      icon: "start",
      label: "Da dove parto",
      content: (
        <StartPanel
          activePlan={activePlan}
          onScegli={scegliPiano}
          onAttivaOnboarding={() => acquistaServizio("onboarding")}
          onbAttivo={onbAttivo}
          prodotti={prodotti}
          aziendaNome={azienda?.nome ?? undefined}
        />
      ),
    },
    {
      id: "prod",
      section: "Lavoro",
      icon: "prodotti",
      label: "Prodotti & semaforo",
      content: (
        <>
          <section className="card border-2 border-lime-500 p-6">
            <h2 className="font-display text-2xl text-green-700">🚦 Il tuo semaforo di sostenibilità</h2>
            <p className="mt-1 text-sm text-green-900/75">
              Compila la scheda del prodotto e ottieni subito il semaforo ecologico, poi salvalo
              nella lista qui sotto.
            </p>
            <div className="mt-5">
              <CalcolatoreImpronta
                nascondiPubblica
                vuoto
                aziendaNome={azienda.nome ?? undefined}
                onAggiungiProdotto={aggiungiProdottoDaSemaforo}
              />
            </div>
          </section>
          <ProdottiCard
            aziendaId={azienda.id}
            stabilimenti={stabilimenti}
            prodotti={prodotti}
            plan={activePlan}
            onChange={refreshAll}
            vista="tutto"
          />
        </>
      ),
    },
    {
      id: "cat",
      section: "Lavoro",
      icon: "catalogo",
      label: "Esperienze in azienda",
      content: <EsperienzeCard ownerId={user.id} plan={pianoScelto} />,
    },
    {
      id: "dati",
      section: "Lavoro",
      icon: "dati",
      label: "Dati & posizione",
      content: (
        <>
          <AnagraficaCard
            azienda={azienda}
            initialNome={(user.user_metadata as { nome?: string })?.nome}
            ownerId={user.id}
            onSaved={loadAll}
            plan={activePlan}
          />
          <StabilimentiCard aziendaId={azienda.id} stabilimenti={stabilimenti} onChange={loadAll} />
        </>
      ),
    },
    {
      id: "bio",
      section: "Lavoro",
      icon: "bio",
      label: "La mia certificazione bio",
      content: (
        <SezioneBio
          ownerId={user.id}
          aziendaNome={azienda.nome ?? undefined}
          aziendaCitta={azienda.citta_sede ?? undefined}
          aziendaLat={azienda.lat ?? undefined}
          aziendaLon={azienda.lon ?? undefined}
        />
      ),
    },
    {
      id: "prev",
      section: "Lavoro",
      icon: "anteprima",
      label: "Anteprima & link",
      content: <AnteprimaScheda ownerId={user.id} plan={pianoScelto} refreshKey={previewKey} />,
    },
    {
      id: "msg",
      section: "Attività",
      icon: "messaggi",
      label: "Messaggi",
      content: <MessaggiCard ownerId={user.id} />,
    },
    {
      id: "pren",
      section: "Attività",
      icon: "prenotazioni",
      label: "Prenotazioni",
      badge: conte.prenotazioni || null,
      content: <PrenotazioniCard ownerId={user.id} />,
    },
    {
      id: "ord",
      section: "Attività",
      icon: "ordini",
      label: "Ordini shop",
      badge: conte.ordini || null,
      content: <OrdiniShopRicevuti />,
    },
    {
      id: "stat",
      section: "Attività",
      icon: "statistiche",
      label: "Statistiche",
      content: <StatisticheCard ownerId={user.id} plan={pianoScelto} />,
    },
    {
      id: "pay",
      section: "Attività",
      icon: "incassi",
      label: "Incassi & Stripe",
      content: <PagamentiCard ownerId={user.id} plan={pianoScelto} />,
    },
    {
      id: "extra",
      section: "Servizi extra",
      icon: "extra",
      tone: "giallo",
      label: "Servizi extra",
      content: (
        <section className="card p-5 md:p-6">
          <h2 className="font-display text-2xl text-green-800">Servizi extra</h2>
          <p className="mt-1 text-sm text-green-900/70">
            Potenzia la tua azienda. Guarda la demo di ciascun servizio.
          </p>
          <div className="mt-4">
            <ServiziExtra showPrices plan={activePlan} onAcquista={acquistaServizio} />
          </div>
          <div className="mt-6">
            <GoldPromoBanner portale="ECO-VISA" plan={pianoScelto} />
          </div>
        </section>
      ),
    },
    {
      id: "onb",
      section: "Servizi extra",
      icon: "onboarding",
      tone: "giallo",
      label: "Ci pensiamo noi",
      content: <OnboardingCard />,
    },
    {
      id: "spedizioni",
      section: "Servizi extra",
      icon: "spedizioni",
      tone: "giallo",
      label: "Spedizioni",
      content: <ServizioInAttivazione titolo="Spedizioni" testo="Presto potrai prenotare e gestire le spedizioni dei tuoi ordini direttamente da qui, via corriere integrato. Stiamo collegando il servizio." />,
    },
    {
      id: "attivi",
      section: "Servizi extra",
      icon: "attivi",
      tone: "giallo",
      label: "Servizi attivi",
      content: <ServiziAttivi />,
    },
  ];

  return (
    <>
      <DashboardShell
        title="La tua dashboard · Area aziende"
        header={esciBtn}
        topBar={topBar}
        alert={alert}
        panels={panels}
        defaultPanel="start"
      />
      {popupPag && (
        <PurchasePopup
          plan={popupPag.plan}
          period={popupPag.period}
          planLabel={PLAN_MAP[popupPag.plan].label}
          planPrice={
            popupPag.period === "annual"
              ? PLAN_MAP[popupPag.plan].annualPrice
              : PLAN_MAP[popupPag.plan].monthlyPrice
          }
          activePlan={activePlan}
          onClose={() => setPopupPag(null)}
        />
      )}
      {gateSemaforo && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-3"
          onClick={() => setGateSemaforo(false)}
        >
          <div className="card w-full max-w-md bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/brand/uomo-semaforo.png`}
              alt="Carica un prodotto e ottieni il semaforo di sostenibilità"
              className="mx-auto w-full max-w-xs"
            />
            <h3 className="mt-3 font-display text-2xl text-green-800">Un attimo!</h3>
            <p className="mt-3 text-green-900/85">
              Prima di abbonarti, carica almeno un prodotto/semaforo di sostenibilità: per pagare
              c&apos;è sempre tempo, prima fai vedere quanto tu e i tuoi prodotti siete speciali!
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setGateSemaforo(false);
                  vaiAlPannello("prod");
                }}
                className="btn-lime flex-1 justify-center"
              >
                🚀 Carica un prodotto
              </button>
              <button type="button" onClick={() => setGateSemaforo(false)} className="btn-ghost flex-1 justify-center">
                Più tardi
              </button>
            </div>
          </div>
        </div>
      )}
      <PromoTimer plan={activePlan} />
    </>
  );
}

/* =============================== PANNELLI SHELL =============================== */
function StartPanel({
  activePlan,
  onScegli,
  onAttivaOnboarding,
  onbAttivo,
  prodotti,
  aziendaNome,
}: {
  activePlan: Plan;
  onScegli: (p: Plan, per: "monthly" | "annual") => void;
  onAttivaOnboarding: () => void;
  onbAttivo: boolean;
  prodotti: Prodotto[];
  aziendaNome?: string;
}) {
  return (
    <div className="space-y-4">
      <DashboardPlanHeader plan={activePlan} crossUrl={URL_BIOFIDO} crossLabel="🐾 Vai su BioFido" crossSeBio />
      {aziendaNome && (
        <CrossPortalBanner
          attiva
          url={`${URL_BIOFIDO}azienda/${aziendaSlug(aziendaNome)}/`}
          altroPortale="BioFido"
        />
      )}
      <LegendaPianiSlider
        activePlan={activePlan}
        onScegli={(p) => onScegli(p, "annual")}
        onAttivaOnboarding={onAttivaOnboarding}
        onboardingAttivo={onbAttivo}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => vaiAlPannello("prod")}
          className="rounded-2xl border-2 border-[#9fcd6f] bg-[#f4faec] p-5 text-left transition hover:-translate-y-0.5"
        >
          <div className="text-3xl">🚦</div>
          <div className="mt-1 font-display text-lg text-[#235d12]">Carica i tuoi PRODOTTI</div>
          <div className="text-xs text-[#5c7a3f]">Col semaforo di sostenibilità (materie prime + origine).</div>
        </button>
        <button
          type="button"
          onClick={() => vaiAlPannello("cat")}
          className="rounded-2xl border-2 border-badge-yellow bg-[#fdf7e6] p-5 text-left transition hover:-translate-y-0.5"
        >
          <div className="text-3xl">✨</div>
          <div className="mt-1 font-display text-lg text-[#7a5b00]">Carica le ESPERIENZE in azienda prenotabili</div>
          <div className="text-xs text-[#8a6f2e]">Visite, laboratori, degustazioni prenotabili.</div>
        </button>
      </div>
      <ProdottiCaricatiMini prodotti={prodotti} />
    </div>
  );
}

function ProdottiCaricatiMini({ prodotti }: { prodotti: Prodotto[] }) {
  return (
    <section className="card p-5">
      <h3 className="font-display text-lg text-green-800">Tutto ciò che hai già caricato</h3>
      {prodotti.length === 0 ? (
        <p className="mt-2 text-sm text-green-900/65">
          Ancora niente: usa le due cornici qui sopra per aggiungere il tuo primo prodotto o servizio.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {prodotti.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-[#e3eed7] bg-white px-4 py-2">
              <span className="h-3 w-3 flex-none rounded-full bg-green-600" />
              <span className="truncate font-semibold text-green-800">{p.nome}</span>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => vaiAlPannello("prod")} className="btn-ghost mt-3 text-sm">
        Gestisci prodotti e servizi →
      </button>
    </section>
  );
}

function PromoOnboarding() {
  return (
    <button
      type="button"
      onClick={() => vaiAlPannello("onb")}
      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border-2 border-badge-yellow bg-[#fffbe9] px-3 py-2 text-left transition hover:bg-[#fff6da]"
    >
      <span className="text-2xl">🪄</span>
      <span className="min-w-0">
        <span className="block font-display text-sm text-[#7a5b00]">Non ho tempo per un sito</span>
        <span className="block truncate text-xs text-[#8a6f2e]">Ci pensiamo noi · guarda la demo</span>
      </span>
    </button>
  );
}

function ServizioInAttivazione({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <section className="card p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl text-green-800">{titolo}</h2>
        <span className="rounded-full bg-badge-yellow/40 px-3 py-1 text-xs font-bold text-[#7a5b00]">
          Servizio in attivazione
        </span>
      </div>
      <p className="mt-3 rounded-xl bg-[#fffbe9] p-4 text-sm text-green-900/80">{testo}</p>
    </section>
  );
}

function ServiziAttivi() {
  const [extras, setExtras] = useState<string[] | null>(null);
  const [statoOnb, setStatoOnb] = useState<string | null>(null);
  useEffect(() => {
    getMyExtras().then(setExtras).catch(() => setExtras([]));
    getStatoOnboarding()
      .then((s) => setStatoOnb((s as { stato?: string } | null)?.stato ?? null))
      .catch(() => {});
  }, []);
  const LABEL: Record<string, string> = {
    onboarding: "Ci pensiamo noi (onboarding negozio)",
    report: "Report di sostenibilità",
    badge: "Badge ECO-VISA",
  };
  return (
    <section className="card p-5 md:p-6">
      <h2 className="font-display text-2xl text-green-800">Servizi attivi</h2>
      <p className="mt-1 text-sm text-green-900/70">Cosa hai già attivato sul tuo account.</p>
      {extras === null ? (
        <p className="mt-4 text-sm text-green-900/60">Caricamento…</p>
      ) : extras.length === 0 ? (
        <p className="mt-4 rounded-xl bg-leaf/40 p-4 text-sm text-green-900/70">
          Non hai ancora attivato servizi extra. Li trovi nella sezione «Servizi extra».
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {extras.map((k) => (
            <div key={k} className="flex items-center gap-3 rounded-xl border border-[#cfe3b4] bg-leaf/30 p-3">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                ✓
              </span>
              <div className="flex-1">
                <div className="font-semibold text-green-800">{LABEL[k] ?? k}</div>
                {k === "onboarding" && statoOnb && <div className="text-xs text-green-900/60">Stato: {statoOnb}</div>}
              </div>
              <span className="text-xs font-semibold text-green-700">Attivo</span>
            </div>
          ))}
        </div>
      )}
    </section>
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
  bloccato = false,
  onBloccato,
}: {
  ownerId: string;
  scelto: Plan;
  attivo: Plan;
  prefill?: PrefillFatturazione;
  bloccato?: boolean;
  onBloccato?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fatturazioneOk, setFatturazioneOk] = useState(false);

  const giaAttivo = attivo === scelto && attivo !== "free";

  async function paga(per: "monthly" | "annual") {
    if (bloccato) {
      onBloccato?.();
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await startCheckout(scelto, per, getExtraScelti());
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
  plan,
}: {
  azienda: Azienda | null;
  initialNome?: string;
  ownerId: string;
  onSaved: () => void;
  plan: Plan;
}) {
  // foto + descrizione + sito azienda: da Silver in su (Free = solo segnaposto)
  const richProfile = PLAN_MAP[plan].richProfile;
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
  // indirizzo "bloccato" dopo la verifica P.IVA (compilato da VIES): si modifica
  // solo premendo «Modifica», così si riduce l'errore di battitura dell'azienda.
  const [indirizzoBloccato, setIndirizzoBloccato] = useState(false);
  // centro di ripiego della mappa quando non c'è ancora una posizione salvata:
  // così la mappa è SEMPRE visibile (centrata sulla città) e si può trascinare
  // il segnaposto anche prima di premere «Localizza».
  const [cittaCenter, setCittaCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [sito, setSito] = useState(azienda?.sito_web ?? "");
  const [descrizione, setDescrizione] = useState(azienda?.descrizione ?? "");
  const [immagine, setImmagine] = useState<string | null>(azienda?.immagine ?? null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Dati fiscali (SDI/PEC/email) e bio: in UI un'unica anagrafica; dietro restano
  // le tabelle dedicate (dati_fatturazione, azienda_bio).
  const [sdi, setSdi] = useState("");
  const [pec, setPec] = useState("");
  const [emailFatt, setEmailFatt] = useState("");
  const [isBio, setIsBio] = useState(false);
  const [enteCert, setEnteCert] = useState("");
  const [numeroCert, setNumeroCert] = useState("");
  const [autocert, setAutocert] = useState(false);

  // carica dati fiscali e bio (riga propria via RLS)
  useEffect(() => {
    caricaDatiFatturazione().then((d) => {
      if (!d) return;
      setSdi(d.codice_sdi && d.codice_sdi !== "0000000" ? d.codice_sdi : "");
      setPec(d.pec ?? "");
      setEmailFatt(d.email ?? "");
    });
    caricaDatiBio().then((b) => {
      if (!b) return;
      setIsBio(!!b.is_bio);
      setEnteCert(b.ente_certificatore ?? "");
      setNumeroCert(b.numero_certificazione ?? "");
      setAutocert(!!b.autocertificato);
    });
  }, [ownerId]);

  // Se non c'è una posizione salvata ma c'è la città, centro la mappa sulla città
  // (solo per inquadrare: il pin diventa "vero" solo quando lo trascini/localizzi).
  useEffect(() => {
    if (coord || !citta.trim()) return;
    let vivo = true;
    prefetchGeocode(citta.trim()).then((c) => {
      if (vivo && c) setCittaCenter({ lat: c.lat, lon: c.lon });
    });
    return () => {
      vivo = false;
    };
  }, [citta, coord]);

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
        if (d.provincia) setProvincia(d.provincia);
        if (d.cap) setCap(d.cap);
        if (d.indirizzo) {
          // indirizzo ufficiale dal registro: lo compilo e lo BLOCCO (riduce gli
          // errori di battitura → geolocalizzazione più precisa). Poi geocodifico.
          setIndirizzo(d.indirizzo);
          setIndirizzoBloccato(true);
          const p = await geocodeIndirizzo(
            d.indirizzo,
            d.citta ?? citta,
            d.provincia ?? provincia ?? undefined,
          );
          if (p) setCoord(p);
        }
        setMsg(
          d.indirizzo
            ? "Dati recuperati dal registro VIES ✓ — indirizzo bloccato: se serve premi «Modifica» e correggi il pin sulla mappa."
            : "Dati recuperati dal registro VIES ✓ — l'indirizzo non risulta, inseriscilo a mano.",
        );
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLookupBusy(false);
    }
  }

  async function save() {
    // scheda nata su BioFido (rispecchiata qui): si modifica SOLO su BioFido,
    // altrimenti le modifiche verrebbero sovrascritte al primo salvataggio lì.
    if (azienda?.origine === "biofido") {
      setMsg("Questa scheda è gestita su BioFido: modificala da lì.");
      return;
    }
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
      // foto + descrizione + sito solo da Silver in su (Free = solo segnaposto)
      sito_web: richProfile ? sito || null : null,
      descrizione: richProfile ? descrizione.trim() || null : null,
      immagine: richProfile ? immagine || null : null,
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
    // salva anche dati fiscali + bio (best-effort: non bloccano l'anagrafica)
    if (!error && ownerId) {
      try {
        await salvaDatiFatturazione(ownerId, {
          ragione_sociale: nome,
          partita_iva: piva,
          codice_fiscale: (cfUguale ? piva : cf) || "",
          indirizzo,
          cap,
          citta,
          provincia,
          paese: "IT",
          codice_sdi: sdi.trim() ? sdi.trim().toUpperCase() : "0000000",
          pec: pec.trim(),
          email: emailFatt.trim(),
        });
      } catch {
        /* tabella/colonne fatturazione assenti: ignora */
      }
      try {
        await salvaDatiBio(ownerId, {
          is_bio: isBio,
          ente_certificatore: enteCert,
          numero_certificazione: numeroCert,
          autocertificato: autocert,
        });
      } catch {
        /* tabella azienda_bio assente: ignora */
      }
      // Allinea il segnaposto su BioFido alla posizione PRECISA appena salvata,
      // così non resta il vecchio centro-paese se ti eri iscritto prima di
      // spostare il pin (update best-effort: se non sei sulla mappa, è un no-op).
      if (coord) {
        try {
          await supabase
            .from("biofido_businesses")
            .update({ lat: coord.lat, lon: coord.lon })
            .eq("owner", ownerId);
        } catch {
          /* non iscritto a BioFido o colonna assente: ignora */
        }
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
      {azienda?.origine === "biofido" && (
        <div className="mt-4 rounded-2xl border-2 border-[#cfe0b0] bg-leaf/50 p-4">
          <div className="flex items-center gap-2 font-display text-base text-green-800">
            <span className="rounded-md bg-green-700 px-2 py-0.5 text-sm font-bold tracking-wide text-white">
              BioFido
            </span>
            Questa scheda è gestita su BioFido
          </div>
          <p className="mt-1 text-sm text-green-900/75">
            La tua azienda è nata su <strong>BioFido</strong>, il portale gemello: qui è in{" "}
            <strong>sola lettura</strong>. Per modificare i dati vai su BioFido — gli
            aggiornamenti compaiono in automatico anche su ECO-VISA.
          </p>
          <a
            href={URL_BIOFIDO}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-lime mt-3 inline-flex"
          >
            🐾 Vai a modificare su BioFido →
          </a>
        </div>
      )}
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
        {richProfile && (
          <label className="block">
            <span className="label">Sito web</span>
            <input className="field mt-1" value={sito} onChange={(e) => setSito(e.target.value)} />
          </label>
        )}

        {/* Indirizzo preciso: serve a posizionare il segnaposto sulla mappa
            (di BioFido e della ricerca) sul punto esatto, non sul centro del comune. */}
        <label className="block md:col-span-2">
          <span className="label">Indirizzo (via e numero civico)</span>
          <div className="mt-1 flex gap-2">
            <div className="flex-1">
              {indirizzoBloccato ? (
                <input
                  className="field bg-leaf/40 disabled:opacity-100"
                  value={indirizzo}
                  disabled
                  aria-label="Indirizzo dal registro P.IVA (bloccato)"
                />
              ) : (
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
              )}
            </div>
            {indirizzoBloccato ? (
              <button
                type="button"
                className="btn-ghost whitespace-nowrap text-sm"
                onClick={() => setIndirizzoBloccato(false)}
              >
                ✏️ Modifica
              </button>
            ) : (
              <button
                type="button"
                className="btn-ghost whitespace-nowrap text-sm"
                onClick={localizza}
                disabled={geoBusy || !indirizzo.trim() || !citta.trim()}
              >
                {geoBusy ? "Cerco…" : "📍 Localizza"}
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-green-900/55">
            {indirizzoBloccato
              ? "Indirizzo dal registro P.IVA (VIES). Premi «Modifica» per correggerlo; poi sistema il pin sulla mappa."
              : "Inizia a scrivere e scegli un suggerimento: posiziona il segnaposto da solo. In alternativa, premi «Localizza» o trascina il pin sulla mappa."}
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

        {/* Mappa SEMPRE visibile: centrata sulla posizione salvata, o sulla città,
            o (in mancanza) sull'Italia. L'utente trascina il pin per la precisione. */}
        <div className="block md:col-span-2">
          <span className="label">Posizione sulla mappa</span>
          <p className="mt-1 mb-2 text-[11px] text-green-900/55">
            {coord
              ? "Trascina il segnaposto (o tocca un punto) per correggere la posizione esatta. Ricordati di premere «Aggiorna dati» per salvarla."
              : "Scegli un indirizzo dai suggerimenti o premi «Localizza»; poi trascina il segnaposto sul punto esatto. La posizione si salva con «Aggiorna dati»."}
          </p>
          <MappaPicker
            lat={(coord ?? cittaCenter)?.lat ?? 41.9028}
            lon={(coord ?? cittaCenter)?.lon ?? 12.4964}
            onChange={(la, lo) => setCoord({ lat: la, lon: lo })}
          />
        </div>
        {richProfile && (
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
        )}

        {/* Immagine dell'azienda (copertina): compare nella scheda pubblica e,
            per i Gold, in cima al widget sulla mappa di BioFido. Da Silver in su. */}
        {richProfile ? (
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
        ) : (
          <p className="rounded-xl bg-leaf/50 p-3 text-xs text-green-900/70 md:col-span-2">
            Con <strong>Free</strong> la tua azienda compare come segnaposto sulla mappa
            (posizione, tipo e nome). <strong>Foto, descrizione e sito web</strong> si sbloccano
            dal piano <strong>Silver</strong>.
          </p>
        )}
      </div>

      {/* DATI PER LA FATTURA: non obbligatori ora, richiesti all'acquisto */}
      <div className="mt-4 rounded-2xl border border-[#e3eed7] bg-leaf/30 p-4">
        <div className="font-display text-lg text-green-800">Dati per la fattura</div>
        <p className="mt-0.5 text-xs text-green-900/65">
          Non obbligatori ora; necessari quando acquisti un abbonamento (fattura
          elettronica). Indica SDI <strong>oppure</strong> PEC.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="label">Codice SDI</span>
            <input
              className="field mt-1"
              value={sdi}
              maxLength={7}
              onChange={(e) => setSdi(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7))}
              placeholder="7 caratteri"
            />
          </label>
          <label className="block">
            <span className="label">PEC</span>
            <input
              className="field mt-1"
              value={pec}
              onChange={(e) => setPec(e.target.value)}
              placeholder="pec@esempio.it"
            />
          </label>
          <label className="block">
            <span className="label">Email referente</span>
            <input
              className="field mt-1"
              value={emailFatt}
              onChange={(e) => setEmailFatt(e.target.value)}
              placeholder="email personale"
            />
          </label>
        </div>
      </div>

      {/* PRODUTTORE BIOLOGICO → BioFido */}
      <div className="mt-3 rounded-2xl border border-[#cfe6b0] bg-leaf/30 p-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--lime-500)]"
            checked={isBio}
            onChange={(e) => setIsBio(e.target.checked)}
          />
          <span className="font-display text-lg text-green-800">
            🌱 Sono un produttore biologico — iscrivimi anche a BioFido
          </span>
        </label>
        {isBio && (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="label">Ente certificatore</span>
              <input
                className="field mt-1"
                list="enti-cert"
                value={enteCert}
                onChange={(e) => setEnteCert(e.target.value)}
                placeholder="Es. ICEA, Suolo e Salute…"
              />
              <datalist id="enti-cert">
                {ENTI_CERTIFICATORI.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="label">Numero di iscrizione</span>
              <input
                className="field mt-1"
                value={numeroCert}
                onChange={(e) => setNumeroCert(e.target.value)}
              />
            </label>
            <label className="flex items-start gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 accent-[var(--lime-500)]"
                checked={autocert}
                onChange={(e) => setAutocert(e.target.checked)}
              />
              <span className="text-green-900/80">
                Dichiaro che i dati di certificazione biologica sono veritieri
                (autocertificazione).
              </span>
            </label>
          </div>
        )}
      </div>

      {azienda?.origine !== "biofido" && (
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-lime" onClick={save} disabled={saving || !nome}>
            {saving ? "Salvataggio…" : azienda ? "Aggiorna dati" : "Salva azienda"}
          </button>
          {msg && <span className="text-sm font-semibold text-green-700">{msg}</span>}
        </div>
      )}
      {azienda?.origine === "biofido" && msg && (
        <p className="mt-4 text-sm font-semibold text-green-700">{msg}</p>
      )}
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
  vista = "tutto",
}: {
  aziendaId: string;
  stabilimenti: Stabilimento[];
  prodotti: Prodotto[];
  plan: Plan;
  onChange: () => void;
  /** "form" = solo cornice "inserisci prodotto"; "lista" = solo elenco prodotti */
  vista?: "form" | "lista" | "tutto";
}) {
  // Diritti per piano: foto e prezzo sono riservati al Gold; i servizi
  // prenotabili a chi può vendere (Silver e Gold); la categoria è per tutti.
  const info = PLAN_MAP[plan] ?? PLAN_MAP.free;
  const gold = plan === "gold";
  const canSell = info.canSell;
  return (
    <section
      id="i-tuoi-prodotti"
      className={`card mt-6 p-6 scroll-mt-20 ${
        vista === "form" ? "border-2 border-green-600/30 bg-leaf/20" : ""
      }`}
    >
      <h2 className="font-display text-2xl text-green-800">
        {vista === "lista" ? "I tuoi prodotti" : "Aggiungi prodotto"}
      </h2>
      {vista === "form" && (
        <p className="mt-0.5 text-sm font-semibold text-green-700">
          🚦 e calcola il tuo semaforo di sostenibilità
        </p>
      )}
      {vista !== "lista" && (
        <p className="mt-2 rounded-xl bg-leaf/60 p-3 text-sm text-green-900/85">
          🚦 <strong>ECO-VISA si basa sul semaforo di sostenibilità</strong>: carica i tuoi
          prodotti mostrando a tutti il loro valore. Per pubblicare la tua bacheca (Silver o
          Gold) serve <strong>almeno un prodotto con il semaforo</strong>.
        </p>
      )}

      {vista !== "form" && prodotti.length === 0 && (
        <p className="mt-3 text-sm text-green-900/60">
          Non hai ancora prodotti: aggiungili dalla cornice «Inserisci prodotto» in alto.
        </p>
      )}

      {vista !== "form" && prodotti.length > 0 && (
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
                      {info.richProfile && (
                        <FotoProdottoBtn
                          prodottoId={p.id}
                          aziendaId={aziendaId}
                          immagine={p.immagine}
                          onChange={onChange}
                        />
                      )}
                      {gold && (
                        <Foto2ProdottoBtn
                          prodottoId={p.id}
                          aziendaId={aziendaId}
                          foto2={p.foto2 ?? null}
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
                {info.richProfile && (
                  <DescrizioneProdotto
                    prodottoId={p.id}
                    descrizione={p.descrizione ?? null}
                    onChange={onChange}
                  />
                )}
                {gold && (
                  <ConfezioneProdotto
                    prodottoId={p.id}
                    confezione={p.confezione ?? null}
                    contenuto={p.contenuto ?? null}
                    unita={p.unita ?? null}
                    onChange={onChange}
                  />
                )}
                {canSell && (
                  <PrenotabileToggle
                    prodottoId={p.id}
                    prenotabile={!!p.prenotabile}
                    onChange={onChange}
                  />
                )}
                {gold && (
                  <ShopToggle
                    prodottoId={p.id}
                    inShop={!!p.in_shop}
                    onChange={onChange}
                  />
                )}
                {gold && p.in_shop && (
                  <GiacenzaProdotto
                    prodottoId={p.id}
                    giacenza={p.giacenza ?? null}
                    onChange={onChange}
                  />
                )}
                {info.badgeEmbed && <EmbedSnippet id={p.id} />}
              </li>
            );
          })}
        </ul>
      )}

      {vista !== "lista" && (
        <NuovoProdotto
          aziendaId={aziendaId}
          stabilimenti={stabilimenti}
          plan={plan}
          count={prodotti.length}
          onSaved={onChange}
          soloProdotto
        />
      )}
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
        ✨ Esperienza in azienda prenotabile dal cliente {saving ? "…" : ""}
      </span>
    </label>
  );
}

/** Flag e-commerce: il prodotto è ordinabile dai clienti nello shop (Gold). */
function ShopToggle({
  prodottoId,
  inShop,
  onChange,
}: {
  prodottoId: string;
  inShop: boolean;
  onChange: () => void;
}) {
  const [on, setOn] = useState(inShop);
  const [saving, setSaving] = useState(false);

  async function toggle(v: boolean) {
    setOn(v);
    setSaving(true);
    const { error } = await supabase.from("prodotti").update({ in_shop: v }).eq("id", prodottoId);
    setSaving(false);
    if (error) {
      setOn(!v);
      alert(
        /in_shop/i.test(error.message)
          ? "Per lo shop aggiungi prima la colonna 'in_shop' al database (te l'ho indicata)."
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
        🛒 Ordinabile dallo shop dai clienti {saving ? "…" : ""}
      </span>
    </label>
  );
}

/** Giacenza a magazzino del prodotto (Gold). Vuoto = non gestita/illimitata. */
function GiacenzaProdotto({
  prodottoId,
  giacenza,
  onChange,
}: {
  prodottoId: string;
  giacenza: number | null;
  onChange: () => void;
}) {
  const [val, setVal] = useState(giacenza == null ? "" : String(giacenza));
  const [saving, setSaving] = useState(false);
  const [salvato, setSalvato] = useState(false);

  async function salva() {
    setSaving(true);
    setSalvato(false);
    const n = val.trim() === "" ? null : Math.max(0, Math.floor(Number(val)) || 0);
    // salvo anche la giacenza INIZIALE (= scorta piena di riferimento): serve per
    // i reminder a metà / un terzo / esaurito. Se la colonna non c'è ancora, ripiego.
    const patch: Record<string, unknown> = { giacenza: n };
    if (n != null) patch.giacenza_iniziale = n;
    let { error } = await supabase.from("prodotti").update(patch).eq("id", prodottoId);
    if (error && /giacenza_iniziale/i.test(error.message)) {
      ({ error } = await supabase.from("prodotti").update({ giacenza: n }).eq("id", prodottoId));
    }
    setSaving(false);
    if (error) {
      alert(
        /giacenza/i.test(error.message)
          ? "Per il magazzino aggiungi prima la colonna 'giacenza' al database (te l'ho indicata)."
          : error.message,
      );
      return;
    }
    setSalvato(true);
    setTimeout(() => setSalvato(false), 1500);
    onChange();
  }

  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl bg-leaf/40 p-2">
      <span className="text-xs font-bold uppercase tracking-wide text-green-700">
        📦 Magazzino (Gold)
      </span>
      <input
        type="number"
        min={0}
        className="field h-9 w-28 py-1"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="qtà · vuoto = ∞"
      />
      <button type="button" className="btn-lime text-sm" onClick={salva} disabled={saving}>
        {saving ? "Salvo…" : salvato ? "Salvato ✓" : "Salva"}
      </button>
    </div>
  );
}

/** Seconda foto del prodotto (es. l'etichetta) — Gold. */
function Foto2ProdottoBtn({
  prodottoId,
  aziendaId,
  foto2,
  onChange,
}: {
  prodottoId: string;
  aziendaId: string;
  foto2: string | null;
  onChange: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  return (
    <label className="cursor-pointer text-xs font-bold text-green-700 hover:underline">
      {uploading ? "Carico…" : foto2 ? "🏷️ Cambia 2ª foto" : "🏷️ Foto etichetta"}
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
            const { error } = await supabase.from("prodotti").update({ foto2: url }).eq("id", prodottoId);
            if (error) throw error;
            onChange();
          } catch (err) {
            alert(
              /foto2/i.test((err as Error).message)
                ? "Per la 2ª foto aggiungi prima la colonna 'foto2' al database (te l'ho indicata)."
                : (err as Error).message,
            );
          } finally {
            setUploading(false);
          }
        }}
      />
    </label>
  );
}

/** Descrizione estesa del prodotto (Gold), mostrata nella scheda pubblica. */
function DescrizioneProdotto({
  prodottoId,
  descrizione,
  onChange,
}: {
  prodottoId: string;
  descrizione: string | null;
  onChange: () => void;
}) {
  const [val, setVal] = useState(descrizione ?? "");
  const [saving, setSaving] = useState(false);
  const [salvato, setSalvato] = useState(false);

  async function salva() {
    setSaving(true);
    setSalvato(false);
    const { error } = await supabase
      .from("prodotti")
      .update({ descrizione: val.trim() || null })
      .eq("id", prodottoId);
    setSaving(false);
    if (error) {
      alert(
        /descrizione/i.test(error.message)
          ? "Per la descrizione prodotto aggiungi prima la colonna 'descrizione' al database (te l'ho indicata)."
          : error.message,
      );
      return;
    }
    setSalvato(true);
    setTimeout(() => setSalvato(false), 1500);
    onChange();
  }

  return (
    <div className="mt-2 rounded-xl bg-leaf/40 p-2">
      <span className="text-xs font-bold uppercase tracking-wide text-green-700">
        Descrizione prodotto (Gold)
      </span>
      <textarea
        className="field mt-1 w-full"
        rows={3}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Racconta il prodotto: lavorazione, gusto, formato, cosa c'è sull'etichetta…"
      />
      <button type="button" className="btn-lime mt-1 text-sm" onClick={salva} disabled={saving}>
        {saving ? "Salvo…" : salvato ? "Salvato ✓" : "Salva descrizione"}
      </button>
    </div>
  );
}

const CONFEZIONI = ["flacone", "barattolo", "sacchetto", "scatola", "bottiglia", "vasetto", "confezione"];
const UNITA_CONTENUTO = ["gr", "kg", "l", "dl", "ml", "cl", "pz"];

/** Confezione + contenuto del prodotto (Gold): es. flacone · 10 ml. */
function ConfezioneProdotto({
  prodottoId,
  confezione,
  contenuto,
  unita,
  onChange,
}: {
  prodottoId: string;
  confezione: string | null;
  contenuto: number | null;
  unita: string | null;
  onChange: () => void;
}) {
  const [c, setC] = useState(confezione ?? "");
  const [q, setQ] = useState(contenuto != null ? String(contenuto) : "");
  const [u, setU] = useState(unita ?? "");
  const [saving, setSaving] = useState(false);
  const [salvato, setSalvato] = useState(false);

  async function salva() {
    setSaving(true);
    setSalvato(false);
    const { error } = await supabase
      .from("prodotti")
      .update({
        confezione: c.trim() || null,
        contenuto: q.trim() === "" ? null : Number(q),
        unita: u.trim() || null,
      })
      .eq("id", prodottoId);
    setSaving(false);
    if (error) {
      alert(
        /confezione|contenuto|unita/i.test(error.message)
          ? "Per confezione e contenuto aggiungi prima le colonne al database (te le ho indicate)."
          : error.message,
      );
      return;
    }
    setSalvato(true);
    setTimeout(() => setSalvato(false), 1500);
    onChange();
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-leaf/40 p-2">
      <span className="text-xs font-bold uppercase tracking-wide text-green-700">
        Confezione
      </span>
      <select className="field h-9 py-1" value={c} onChange={(e) => setC(e.target.value)}>
        <option value="">—</option>
        {CONFEZIONI.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        step="any"
        className="field h-9 w-20 py-1"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="qtà"
      />
      <select className="field h-9 py-1" value={u} onChange={(e) => setU(e.target.value)}>
        <option value="">unità</option>
        {UNITA_CONTENUTO.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <button type="button" className="btn-lime text-sm" onClick={salva} disabled={saving}>
        {saving ? "Salvo…" : salvato ? "Salvato ✓" : "Salva"}
      </button>
    </div>
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

  async function act(b: Booking, stato: BookingStatus) {
    try {
      if (stato === "confermata") {
        if (b.paymentStatus === "autorizzata") await captureBooking(b.id);
        else await setBookingStatus(b.id, "confermata");
      } else {
        if (b.paymentStatus === "autorizzata") await cancelBooking(b.id);
        else await setBookingStatus(b.id, "rifiutata");
      }
    } catch (e) {
      alert((e as Error).message);
      return;
    }
    await sendMessage(
      b.id,
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
          Nessuna richiesta per ora. Pubblica un'esperienza in azienda prenotabile per riceverne.
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
                  <div className="text-xs text-green-900/60">Data richiesta: {b.dataRichiesta}</div>
                  {/* scheda cliente per fattura/contatto */}
                  <div className="mt-2 rounded-xl bg-leaf/40 p-2.5 text-xs text-green-900/85">
                    <div className="font-bold uppercase tracking-wide text-green-700">Dati cliente</div>
                    <div className="mt-0.5 space-y-0.5">
                      <div>👤 {b.clienteNome || "—"}</div>
                      <div>✉️ {b.clienteEmail || "—"}</div>
                      <div>📞 {b.clienteTel || "— (non fornito)"}</div>
                      <div>🧾 CF: {b.clienteCf || "— (non fornito)"}</div>
                      <div>📍 {b.clienteIndirizzo || "— (non fornito)"}</div>
                    </div>
                  </div>
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
                {b.paymentStatus === "autorizzata" && (
                  <span className="rounded-full bg-badge-yellow px-2 py-0.5 text-[11px] font-bold text-[#7a5a00]">
                    💳 Pagata · fondi bloccati
                  </span>
                )}
                {b.stato === "in_attesa" && (
                  <>
                    <button
                      className="rounded-full bg-traffic-green px-3 py-1 text-xs font-bold text-white"
                      onClick={() => act(b, "confermata")}
                    >
                      {b.paymentStatus === "autorizzata" ? "Approva e incassa" : "Conferma"}
                    </button>
                    <button
                      className="rounded-full border border-traffic-red px-3 py-1 text-xs font-bold text-traffic-red"
                      onClick={() => act(b, "rifiutata")}
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
  soloProdotto = false,
}: {
  aziendaId: string;
  stabilimenti: Stabilimento[];
  plan: Plan;
  /** quanti prodotti ha già l'azienda (per il limite del piano) */
  count: number;
  onSaved: () => void;
  /** true = solo prodotto (niente toggle "servizio"): i servizi stanno nella loro cornice */
  soloProdotto?: boolean;
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
  // campi extra del SERVIZIO speciale (attività in azienda): descrizione estesa,
  // durata e una foto in più (oltre alla copertina).
  const [descrizione, setDescrizione] = useState("");
  const [durata, setDurata] = useState("");
  const [foto2, setFoto2] = useState<string | null>(null);
  const [uploading2, setUploading2] = useState(false);
  // campi di VENDITA del prodotto (solo Gold), così la scheda si salva COMPLETA
  // in un unico passaggio: prezzo, confezione/contenuto, ordinabile + giacenza.
  const [prezzo, setPrezzo] = useState("");
  const [confezione, setConfezione] = useState("");
  const [contenuto, setContenuto] = useState("");
  const [unita, setUnita] = useState("");
  const [inShop, setInShop] = useState(false);
  const [giacenzaVal, setGiacenzaVal] = useState("");
  const MAX_DESC = 2000;

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
    const isServizioMode = tipoVoce === "servizio";
    if (!nome.trim() || !stab.trim()) return;
    // il semaforo (ingredienti) riguarda SOLO i prodotti, non i servizi speciali
    if (!isServizioMode && validIngr.length === 0) {
      alert("Aggiungi almeno una materia prima con la sua origine: è il semaforo del prodotto.");
      return;
    }
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
    const isServizio = canSell && tipoVoce === "servizio" && accetta;
    const payload: Record<string, unknown> = {
      azienda_id: aziendaId,
      nome,
      categoria: categoria || null,
      stabilimento_citta: stab,
      // foto del prodotto: da Silver in su (richProfile); Free = solo nome + semaforo
      immagine: info.richProfile ? immagine : null,
      // servizio prenotabile solo per chi può vendere (Silver/Gold)
      prenotabile: isServizio,
    };
    // dati extra del servizio speciale: descrizione estesa, durata, 2ª foto
    if (isServizio) {
      if (descrizione.trim()) payload.descrizione = descrizione.trim().slice(0, MAX_DESC);
      if (durata.trim()) payload.durata = durata.trim();
      if (gold && foto2) payload.foto2 = foto2;
      if (gold && prezzo.trim()) payload.prezzo = prezzo.trim();
    } else {
      // PRODOTTO ordinario. La DESCRIZIONE (come la foto) è da Silver in su.
      if (info.richProfile && descrizione.trim())
        payload.descrizione = descrizione.trim().slice(0, MAX_DESC);
      // Prezzo, 2ª foto, confezione/contenuto e tasto Ordina (shop) sono solo Gold.
      if (gold) {
        if (prezzo.trim()) payload.prezzo = prezzo.trim();
        if (foto2) payload.foto2 = foto2;
        if (confezione.trim()) payload.confezione = confezione.trim();
        if (contenuto.trim()) payload.contenuto = Number(contenuto) || null;
        if (unita.trim()) payload.unita = unita.trim();
        if (inShop) {
          payload.in_shop = true;
          const g = giacenzaVal.trim() === "" ? null : Math.max(0, Math.floor(Number(giacenzaVal)) || 0);
          if (g != null) {
            payload.giacenza = g;
            payload.giacenza_iniziale = g;
          }
        }
      }
    }
    let res = await supabase.from("prodotti").insert(payload).select("id").single();
    // se una colonna non esiste ancora nel DB, la tolgo e riprovo (così il
    // salvataggio non si rompe finché non lanci la migrazione)
    for (const col of [
      "prenotabile", "descrizione", "durata", "foto2", "prezzo",
      "confezione", "contenuto", "unita", "in_shop", "giacenza", "giacenza_iniziale",
    ]) {
      if (res.error && new RegExp(`\\b${col}\\b`, "i").test(res.error.message)) {
        delete payload[col];
        res = await supabase.from("prodotti").insert(payload).select("id").single();
      }
    }
    const { data, error } = res;
    if (error || !data) {
      setSaving(false);
      alert("Errore nel salvare il prodotto: " + (error?.message ?? ""));
      return;
    }
    // ingredienti (semaforo) solo per i prodotti
    if (validIngr.length) {
      const rows = validIngr.map((i) => ({
        prodotto_id: data.id,
        nome: i.nome,
        origine: i.origine,
      }));
      await supabase.from("ingredienti").insert(rows);
    }
    setSaving(false);
    setNome("");
    setCategoria("");
    setImmagine(null);
    setTipoVoce("prodotto");
    setAccetta(false);
    setDescrizione("");
    setDurata("");
    setFoto2(null);
    setPrezzo("");
    setConfezione("");
    setContenuto("");
    setUnita("");
    setInShop(false);
    setGiacenzaVal("");
    setIngredienti([{ nome: "", origine: "" }]);
    onSaved();
  }

  const hasStab = stabilimenti.length > 0;

  return (
    <div className="mt-6 rounded-2xl border-2 border-dashed border-[#cfe3b4] bg-leaf/40 p-5">
      <h3 className="font-display text-xl text-green-800">
        {tipoVoce === "servizio" ? "🎓 Nuovo servizio speciale" : "🚦 Nuova scheda prodotto"}{" "}
        <span className="text-sm font-normal text-green-900/60">
          ({count}/{limite === Infinity ? "∞" : limite} · piano {info.label})
        </span>
      </h3>
      {tipoVoce !== "servizio" && (
        <p className="mt-1 text-xs text-green-900/70">
          🚦 Su ECO-VISA, per essere visibili serve <strong>almeno un prodotto con il semaforo</strong>:
          inserisci le materie prime qui sotto — prezzo, foto e descrizione si salvano <strong>tutti
          insieme</strong>, in un solo passaggio.
        </p>
      )}
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

      <div className="mt-3 space-y-3">
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
          Il "servizio prenotabile" è riservato ai piani che possono vendere.
          In modalità soloProdotto il toggle sparisce: i servizi hanno la loro cornice. */}
      {!soloProdotto && canSell && (
        <div className="mt-3">
          <label className="flex items-start gap-2 rounded-xl border-2 border-badge-yellow bg-[#fffbe9] p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-[var(--lime-500)]"
              checked={tipoVoce === "servizio"}
              onChange={(e) => setTipoVoce(e.target.checked ? "servizio" : "prodotto")}
            />
            <span className="text-green-900/85">
              🎓 Salva come <strong>servizio speciale</strong> prenotabile in azienda
              <span
                title="Spuntando questa casella, il prodotto si configura come SERVIZIO EXTRA che si svolge in azienda — visita guidata, laboratorio, attività esperienziale… Il cliente potrà prenotarlo (scegliendo un giorno sul calendario) e, alla conferma, pagarlo online."
                className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-green-700 text-[10px] font-bold text-white"
                aria-label="Cos'è un servizio speciale"
              >
                ?
              </span>
            </span>
          </label>

          {tipoVoce === "servizio" && (
            <div className="mt-2 space-y-3 rounded-xl border border-badge-yellow bg-[#fffef6] p-3">
              <label className="block">
                <span className="label">Descrizione estesa dell&apos;attività</span>
                <textarea
                  className="field mt-1"
                  rows={3}
                  maxLength={MAX_DESC}
                  value={descrizione}
                  onChange={(e) => setDescrizione(e.target.value)}
                  placeholder="Racconta com'è l'esperienza: cosa si fa, cosa è incluso, per chi è adatta…"
                />
                <span className="text-[11px] text-green-900/45">{descrizione.length}/{MAX_DESC}</span>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="label">Durata</span>
                  <input
                    className="field mt-1"
                    value={durata}
                    onChange={(e) => setDurata(e.target.value)}
                    placeholder="Es. 2 ore, mezza giornata…"
                  />
                </label>
                {gold && (
                  <label className="block">
                    <span className="label">Prezzo a persona</span>
                    <input
                      className="field mt-1"
                      value={prezzo}
                      onChange={(e) => setPrezzo(e.target.value)}
                      placeholder="€ 15,00"
                    />
                  </label>
                )}
              </div>
              {gold && (
                <div>
                  <span className="label">Foto extra dell&apos;attività (facoltativa)</span>
                  <div className="mt-1 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {foto2 ? (
                      <img src={foto2} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-leaf text-[10px] text-green-900/50">
                        nessuna
                      </span>
                    )}
                    <label className="btn-ghost cursor-pointer text-sm">
                      {uploading2 ? "Carico…" : foto2 ? "Cambia foto" : "Carica foto"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setUploading2(true);
                          try {
                            setFoto2(await caricaImmagineCatalogo(aziendaId, f));
                          } catch (err) {
                            alert((err as Error).message);
                          } finally {
                            setUploading2(false);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 accent-[var(--lime-500)]"
                  checked={accetta}
                  onChange={(e) => setAccetta(e.target.checked)}
                />
                <span className="text-green-900/85">
                  <strong>Confermo</strong>: i clienti possono inviare una richiesta e, a
                  conferma, pagare online via Stripe (con la commissione del piano). Compare
                  su ECO-VISA e BioFido.
                </span>
              </label>
            </div>
          )}
        </div>
      )}


      {tipoVoce !== "servizio" && (
      <>
      <div className="mt-4">
        <span className="label">Materie prime e loro origine (il semaforo)</span>
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
      </>
      )}

      {/* PRODOTTO Gold: prezzo, descrizione, 2ª foto, confezione, shop+giacenza — tutto in un salvataggio */}
      {tipoVoce !== "servizio" && info.richProfile && (
        <div className="mt-4 space-y-3 rounded-xl border border-[#e3eed7] bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
            📸 Vetrina del prodotto
            {!gold && (
              <span className="rounded-full bg-leaf px-2 py-0.5 text-[11px] font-bold text-green-700">
                foto + descrizione
              </span>
            )}
          </div>
          {gold && (
          <div className="space-y-3">
            <label className="block">
              <span className="label">Prezzo</span>
              <input className="field mt-1" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} placeholder="€ 12,00" />
            </label>
            <label className="block">
              <span className="label">Contenitore</span>
              <select className="field mt-1" value={confezione} onChange={(e) => setConfezione(e.target.value)}>
                <option value="">—</option>
                {["flacone", "barattolo", "sacchetto", "scatola", "bottiglia", "vasetto", "confezione"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Contenuto + unità di misura</span>
              <div className="mt-1 flex gap-2">
                <input type="number" min={0} step="any" className="field" value={contenuto} onChange={(e) => setContenuto(e.target.value)} placeholder="10" />
                <select className="field !w-28" value={unita} onChange={(e) => setUnita(e.target.value)}>
                  <option value="">unità</option>
                  {["gr", "kg", "l", "dl", "ml", "cl", "pz"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
            </label>
          </div>
          )}
          <label className="block">
            <span className="label">Descrizione del prodotto</span>
            <textarea
              className="field mt-1"
              rows={3}
              maxLength={MAX_DESC}
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="Racconta il prodotto: cos'è, com'è fatto, cosa lo rende speciale…"
            />
            <span className="text-[11px] text-green-900/45">{descrizione.length}/{MAX_DESC}</span>
          </label>
          <div>
            <span className="label">Foto 1 (copertina)</span>
            <div className="mt-1 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {immagine ? (
                <img src={immagine} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-leaf text-[10px] text-green-900/50">nessuna</span>
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
          </div>
          {gold && (
          <div>
            <span className="label">Foto 2 (etichetta)</span>
            <div className="mt-1 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {foto2 ? (
                <img src={foto2} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-leaf text-[10px] text-green-900/50">nessuna</span>
              )}
              <label className="btn-ghost cursor-pointer text-sm">
                {uploading2 ? "Carico…" : foto2 ? "Cambia foto" : "Carica foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setUploading2(true);
                    try {
                      setFoto2(await caricaImmagineCatalogo(aziendaId, f));
                    } catch (err) {
                      alert((err as Error).message);
                    } finally {
                      setUploading2(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>
          )}
          {gold && (
            <>
              <label className="flex items-center gap-2 text-sm text-green-900/85">
                <input type="checkbox" className="h-5 w-5 accent-[var(--lime-500)]" checked={inShop} onChange={(e) => setInShop(e.target.checked)} />
                🛒 Ordinabile dallo shop (vendita online)
              </label>
              {inShop && (
                <label className="block">
                  <span className="label">Giacenza a magazzino (pezzi)</span>
                  <input className="field mt-1 !w-40" value={giacenzaVal} onChange={(e) => setGiacenzaVal(e.target.value)} placeholder="Es. 30" inputMode="numeric" />
                </label>
              )}
            </>
          )}
        </div>
      )}

      <button
        className="btn-lime mt-4"
        onClick={save}
        disabled={saving || !hasStab || !nome.trim() || pieno}
      >
        {saving ? "Salvataggio…" : tipoVoce === "servizio" ? "Salva servizio speciale" : "Salva prodotto"}
      </button>
    </div>
  );
}
