"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PLAN_MAP, type Plan } from "@/lib/piani";
import {
  listMyExperiences,
  createExperience,
  updateExperience,
  deleteExperience,
  euroCents,
  type Experience,
  type Fascia,
} from "@/lib/bookings";
import { euroToCents } from "@/lib/prezzo";
import { ImportoInput } from "@/components/ImportoInput";
import { caricaImmagineCatalogo, LINGUE_SERVIZIO } from "@/lib/catalogo";

/**
 * Editor delle ESPERIENZE in azienda prenotabili (gemello di BioFido): visite,
 * laboratori, degustazioni. Scrive nella tabella condivisa `esperienze`, così le
 * esperienze sono le stesse sui due portali. L'azienda può indicare foto, lingue,
 * giorni e orario (agenda); il cliente prenota e, dopo l'approvazione, paga.
 */
export function EsperienzeCard({ ownerId, plan }: { ownerId: string; plan: Plan }) {
  const [items, setItems] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [prezzo, setPrezzo] = useState("");
  const [durata, setDurata] = useState("");
  const [maxP, setMaxP] = useState("10");
  // agenda: giorni della settimana in cui si svolge (1=lun…7=dom) + orario fisso
  const [giorni, setGiorni] = useState<number[]>([]);
  const [orario, setOrario] = useState("");
  // fasce orarie prenotabili (max 3) + capienza per fascia
  const [fasce, setFasce] = useState<Fascia[]>([]);
  const [capienza, setCapienza] = useState("");
  const addFascia = () =>
    setFasce((prev) => (prev.length >= 3 ? prev : [...prev, { inizio: "", fine: "" }]));
  const setFascia = (i: number, patch: Partial<Fascia>) =>
    setFasce((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const rmFascia = (i: number) => setFasce((prev) => prev.filter((_, idx) => idx !== i));
  // foto + lingue dell'esperienza (italiano sempre incluso)
  const [immagine, setImmagine] = useState("");
  const [lingue, setLingue] = useState<string[]>(["it"]);
  const [caricando, setCaricando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // id dell'esperienza in modifica (null = sto creando una nuova)
  const [editId, setEditId] = useState<string | null>(null);
  const toggleGiorno = (g: number) =>
    setGiorni((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort()));
  const toggleLingua = (code: string) =>
    setLingue((prev) => {
      const cur = new Set(prev.length ? prev : ["it"]);
      if (code === "it") return [...cur]; // l'italiano è sempre incluso
      if (cur.has(code)) cur.delete(code);
      else if (cur.size < 8) cur.add(code);
      return [...cur];
    });

  const load = useCallback(async () => {
    setLoading(true);
    setItems(await listMyExperiences(ownerId));
    setLoading(false);
  }, [ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  const info = PLAN_MAP[plan];
  const atLimit = items.length >= info.maxEvents;

  function reset() {
    setEditId(null);
    setTitolo("");
    setDescrizione("");
    setPrezzo("");
    setDurata("");
    setMaxP("10");
    setGiorni([]);
    setOrario("");
    setFasce([]);
    setCapienza("");
    setImmagine("");
    setLingue(["it"]);
    setMsg(null);
  }

  // porta un'esperienza esistente nel form per modificarla
  function modifica(e: Experience) {
    setEditId(e.id);
    setTitolo(e.titolo);
    setDescrizione(e.descrizione ?? "");
    setPrezzo((e.prezzoCents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 }));
    setDurata(e.durataMin != null ? String(e.durataMin) : "");
    setMaxP(String(e.maxPersone));
    setGiorni(e.giorniSettimana ?? []);
    setOrario(e.orario ?? "");
    setFasce(e.fasceOrarie ?? []);
    setCapienza(e.capienzaSlot != null ? String(e.capienzaSlot) : "");
    setImmagine(e.immagine ?? "");
    setLingue(e.lingue && e.lingue.length ? e.lingue : ["it"]);
    setMsg(null);
    if (typeof document !== "undefined")
      document.getElementById("esperienze")?.scrollIntoView({ behavior: "smooth" });
  }

  async function salva() {
    const cents = euroToCents(prezzo);
    if (!titolo.trim() || cents == null) {
      setMsg("Inserisci almeno titolo e prezzo.");
      return;
    }
    const fasceValide = fasce.filter((f) => f.inizio && f.fine);
    setSaving(true);
    setMsg(null);
    const dati = {
      titolo,
      descrizione,
      prezzoCents: cents,
      durataMin: durata ? Number(durata) : undefined,
      maxPersone: Math.max(1, Number(maxP) || 1),
      attiva: true,
      giorniSettimana: giorni.length ? giorni : undefined,
      orario: orario || undefined,
      fasceOrarie: fasceValide.length ? fasceValide : undefined,
      capienzaSlot: capienza ? Math.max(1, Number(capienza) || 1) : undefined,
      lingue: lingue.length ? lingue : undefined,
      immagine: immagine || undefined,
    };
    const { error } = editId
      ? await updateExperience(editId, dati)
      : await createExperience(ownerId, dati);
    setSaving(false);
    if (error) {
      setMsg("Errore: " + error);
      return;
    }
    reset();
    load();
  }

  return (
    <section id="esperienze" className="card mt-6 p-6 scroll-mt-20">
      <h2 className="font-display text-2xl text-green-800">
        Le tue esperienze / attività prenotabili
      </h2>
      <p className="mt-1 text-sm text-green-900/70">
        Visite in azienda, laboratori didattici, degustazioni e corsi: queste{" "}
        <strong>si prenotano dalla scheda</strong>. La prenotazione arriva nella tua
        bacheca <em>in attesa</em> e si attiva <strong>solo dopo la tua approvazione</strong>;
        il cliente <strong>paga in anticipo via Stripe</strong>. Commissione{" "}
        {Math.round(info.commissionRate * 100)}% sulle prenotazioni confermate.
      </p>

      {!info.canSell ? (
        <div className="mt-4 rounded-xl bg-leaf p-4 text-sm text-green-900/80">
          Le esperienze prenotabili sono disponibili dai piani{" "}
          <strong>Silver</strong> e <strong>Gold</strong>.{" "}
          <Link href="/abbonamenti" className="font-bold text-green-700 hover:text-lime-500">
            Scopri gli abbonamenti →
          </Link>
        </div>
      ) : (
        <>
          {loading ? (
            <p className="mt-4 text-sm text-green-900/60">Caricamento…</p>
          ) : (
            items.length > 0 && (
              <ul className="mt-4 space-y-2">
                {items.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[#e3eed7] bg-white p-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      {e.immagine ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.immagine} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-leaf text-[10px] text-green-900/40">
                          no foto
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-green-800">{e.titolo}</div>
                        <div className="text-sm text-green-900/60">
                          {euroCents(e.prezzoCents)}
                          {e.durataMin ? ` · ${e.durataMin} min` : ""} · max {e.maxPersone}
                        </div>
                        {(e.giorniSettimana?.length || e.orario) && (
                          <div className="text-xs font-semibold text-green-700">
                            🗓{" "}
                            {e.giorniSettimana?.length
                              ? e.giorniSettimana
                                  .map((g) => ["", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"][g])
                                  .join(", ")
                              : "ogni giorno"}
                            {e.orario ? ` · ${e.orario}` : ""}
                          </div>
                        )}
                        {e.lingue?.length ? (
                          <div className="text-[11px] text-green-900/55">
                            {e.lingue.join(", ").toUpperCase()}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <button
                        className="text-xs font-bold text-green-700 hover:underline"
                        onClick={() => modifica(e)}
                      >
                        Modifica
                      </button>
                      <button
                        className="text-xs font-bold text-traffic-red hover:underline"
                        onClick={async () => {
                          if (confirm("Eliminare questa esperienza?")) {
                            await deleteExperience(e.id);
                            load();
                          }
                        }}
                      >
                        Elimina
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}

          {atLimit && !editId ? (
            <p className="mt-4 rounded-xl bg-leaf p-3 text-sm font-semibold text-green-800">
              Hai raggiunto il limite di esperienze del piano {info.label}. Passa
              a Gold per esperienze illimitate.
            </p>
          ) : (
            <div className="mt-5 rounded-2xl border-2 border-dashed border-[#cfe3b4] bg-leaf/40 p-5">
              <h3 className="font-display text-xl text-green-800">
                {editId ? "Modifica l'esperienza" : "Aggiungi un'esperienza"}
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="label">Titolo *</span>
                  <input
                    className="field mt-1"
                    value={titolo}
                    onChange={(e) => setTitolo(e.target.value)}
                    placeholder="Es. Visita guidata in cantina"
                  />
                </label>
                <label className="block">
                  <span className="label">Prezzo a persona (€) *</span>
                  <ImportoInput value={prezzo} onChange={setPrezzo} placeholder="€ 15,00" />
                </label>
                <label className="block">
                  <span className="label">Durata (min)</span>
                  <input
                    className="field mt-1"
                    value={durata}
                    onChange={(e) => setDurata(e.target.value)}
                    placeholder="90"
                  />
                </label>
                <label className="block">
                  <span className="label">Max persone</span>
                  <input
                    type="number"
                    min={1}
                    className="field mt-1"
                    value={maxP}
                    onChange={(e) => setMaxP(e.target.value)}
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="label">Descrizione</span>
                  <textarea
                    className="field mt-1"
                    rows={2}
                    value={descrizione}
                    onChange={(e) => setDescrizione(e.target.value)}
                  />
                </label>

                {/* foto dell'esperienza */}
                <div className="md:col-span-2">
                  <span className="label">Foto dell&apos;esperienza</span>
                  <div className="mt-1 flex items-center gap-3">
                    {immagine ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={immagine} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-leaf text-[10px] text-green-900/50">
                        nessuna
                      </span>
                    )}
                    <label className="btn-ghost cursor-pointer text-sm">
                      {caricando ? "Carico…" : immagine ? "Cambia foto" : "📷 Carica foto"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setCaricando(true);
                          try {
                            setImmagine(await caricaImmagineCatalogo(ownerId, f));
                          } catch (er) {
                            setMsg((er as Error).message);
                          } finally {
                            setCaricando(false);
                          }
                        }}
                      />
                    </label>
                    {immagine && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-traffic-red"
                        onClick={() => setImmagine("")}
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>
                </div>

                {/* lingue dell'attività (per i turisti) */}
                <div className="md:col-span-2">
                  <span className="label">Lingue dell&apos;attività</span>
                  <span className="mt-0.5 block text-[11px] text-green-900/55">
                    L&apos;italiano è sempre incluso. Aggiungi fino a 8 lingue.
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {LINGUE_SERVIZIO.map((l) => {
                      const attive = lingue.length ? lingue : ["it"];
                      const on = attive.includes(l.code);
                      return (
                        <button
                          key={l.code}
                          type="button"
                          onClick={() => toggleLingua(l.code)}
                          className={`rounded-full px-3 py-1 text-sm font-bold ${
                            on ? "bg-green-700 text-white" : "bg-leaf text-green-800 hover:bg-[#dcebc8]"
                          } ${l.code === "it" ? "opacity-90" : ""}`}
                        >
                          {l.flag} {l.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* AGENDA: quando si svolge l'attività (facoltativo). Se specificato,
                    il cliente potrà prenotare solo questi giorni / a quest'orario. */}
                <div className="md:col-span-2">
                  <span className="label">Giorni in cui si svolge <span className="font-normal text-green-900/50">(facoltativo)</span></span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {[
                      [1, "Lun"], [2, "Mar"], [3, "Mer"], [4, "Gio"],
                      [5, "Ven"], [6, "Sab"], [7, "Dom"],
                    ].map(([g, lab]) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGiorno(g as number)}
                        className={`rounded-full px-3 py-1 text-sm font-bold ${
                          giorni.includes(g as number)
                            ? "bg-green-700 text-white"
                            : "bg-leaf text-green-800 hover:bg-[#dcebc8]"
                        }`}
                      >
                        {lab}
                      </button>
                    ))}
                  </div>
                  <span className="mt-1 block text-[11px] text-green-900/55">
                    Lascia vuoto se l&apos;attività si può fare in qualsiasi giorno.
                  </span>
                </div>
                <label className="block">
                  <span className="label">Orario <span className="font-normal text-green-900/50">(facoltativo)</span></span>
                  <input
                    type="time"
                    className="field mt-1"
                    value={orario}
                    onChange={(e) => setOrario(e.target.value)}
                  />
                  <span className="mt-1 block text-[11px] text-green-900/55">
                    Se lo imposti, il cliente prenoterà a quest&apos;ora (può chiederti una
                    modifica nel messaggio).
                  </span>
                </label>

                {/* FASCE ORARIE prenotabili (max 3) + capienza per fascia */}
                <div className="md:col-span-2 rounded-xl border border-[#e3eed7] bg-leaf/20 p-3">
                  <span className="label">
                    Fasce orarie prenotabili <span className="font-normal text-green-900/50">(facoltative, max 3)</span>
                  </span>
                  <div className="mt-2 space-y-2">
                    {fasce.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          className="field flex-1"
                          value={f.inizio}
                          onChange={(e) => setFascia(i, { inizio: e.target.value })}
                        />
                        <span className="text-green-900/50">–</span>
                        <input
                          type="time"
                          className="field flex-1"
                          value={f.fine}
                          onChange={(e) => setFascia(i, { fine: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => rmFascia(i)}
                          aria-label="Rimuovi fascia"
                          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-xl text-traffic-red hover:bg-white"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  {fasce.length < 3 && (
                    <button
                      type="button"
                      onClick={addFascia}
                      className="mt-2 text-sm font-bold text-green-700 hover:text-lime-600"
                    >
                      + Aggiungi fascia
                    </button>
                  )}
                  <label className="mt-3 block">
                    <span className="label">
                      Capienza per fascia <span className="font-normal text-green-900/50">(posti per data + fascia)</span>
                    </span>
                    <input
                      type="number"
                      min={1}
                      className="field mt-1 w-40"
                      value={capienza}
                      onChange={(e) => setCapienza(e.target.value)}
                      placeholder={`es. ${maxP || "10"}`}
                    />
                    <span className="mt-1 block text-[11px] text-green-900/55">
                      Quando una fascia è al completo per una certa data, il cliente non può più
                      prenotarla. Vuoto = usa il massimo persone qui sopra.
                    </span>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button className="btn-lime" onClick={salva} disabled={saving || !titolo.trim()}>
                  {saving ? "Salvataggio…" : editId ? "Aggiorna esperienza" : "Salva esperienza"}
                </button>
                {editId && (
                  <button type="button" className="btn-ghost text-sm" onClick={reset}>
                    Annulla
                  </button>
                )}
                {msg && (
                  <span className="text-sm font-semibold text-traffic-red">{msg}</span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
