"use client";

import { useState } from "react";
import type { Plan } from "@/lib/piani";

/**
 * Scheda unica "tutti i servizi": sotto la scelta del piano, mostra in una sola
 * lunga tabella TUTTO ciò che offriamo. I servizi inclusi nel piano selezionato
 * sono attivi; gli altri restano grigi con l'etichetta del piano che li sblocca
 * (Silver / Gold) — così l'azienda ha la panoramica immediata e viene invogliata
 * a salire di piano. Spuntando Silver/Gold qui sopra, la scheda si "accende".
 */
const PRIO: Record<Plan, number> = { free: 0, silver: 1, gold: 2 };
const NOME: Record<Plan, string> = { free: "Free", silver: "Silver", gold: "Gold" };

type Servizio = { icona: string; nome: string; descr: string; min: Plan };

const SERVIZI: Servizio[] = [
  { icona: "📍", nome: "Scheda pubblica del prodotto", descr: "Visibile a tutti, con ingredienti e provenienza.", min: "free" },
  { icona: "🚦", nome: "Semaforo ecologico", descr: "Il giudizio verde/giallo/rosso dell'impronta di trasporto.", min: "free" },
  { icona: "📦", nome: "1° prodotto", descr: "Carica il tuo primo prodotto con il semaforo.", min: "free" },
  { icona: "📷", nome: "Foto del prodotto", descr: "Immagine caricata e alleggerita in automatico.", min: "silver" },
  { icona: "🗂️", nome: "Fino a 10 prodotti", descr: "Pubblica più schede prodotto.", min: "silver" },
  { icona: "📝", nome: "Descrizione, sito web e contatti", descr: "Una scheda azienda più ricca e completa.", min: "silver" },
  { icona: "🔗", nome: "Badge da incorporare sul tuo sito", descr: "Il semaforo del prodotto, sul tuo sito web.", min: "silver" },
  { icona: "⬆️", nome: "Priorità nella vetrina pubblica", descr: "Sali nei risultati della directory.", min: "silver" },
  { icona: "📊", nome: "Statistiche base", descr: "Quante visite riceve la tua scheda.", min: "silver" },
  { icona: "➕", nome: "Fino a 100 prodotti", descr: "Sblocca il «+» per caricarne fino a 100.", min: "gold" },
  { icona: "💶", nome: "Prezzi e prodotti in vendita", descr: "Mostra il prezzo e vendi i tuoi prodotti.", min: "gold" },
  { icona: "🗓️", nome: "Prenotazioni via widget", descr: "I clienti richiedono visite ed esperienze dalla scheda.", min: "gold" },
  { icona: "📈", nome: "Statistiche avanzate", descr: "Andamento nel tempo e area geografica dei visitatori.", min: "gold" },
  { icona: "⭐", nome: "In evidenza", descr: "La tua azienda risalta nella vetrina.", min: "gold" },
];

export function SchedaServizi({ piano }: { piano: Plan; attivo?: Plan }) {
  const [guida, setGuida] = useState(false);
  const incluso = (min: Plan) => PRIO[piano] >= PRIO[min];

  // slot prodotti: 1 (free), fino a 10 (silver), poi il «+» fino a 100 (gold)
  const maxSlot = piano === "free" ? 1 : 10;

  return (
    <section className="card mt-4 p-6">
      <h2 className="font-display text-2xl text-green-800">Tutti i servizi</h2>
      <p className="mt-1 text-sm text-green-900/70">
        Stai vedendo il piano <strong>{NOME[piano]}</strong>: i servizi accesi sono
        inclusi, quelli grigi si sbloccano con Silver o Gold. Cambia piano qui sopra
        per vedere cosa ottieni.
      </p>

      {/* slot prodotti */}
      <div className="mt-5 rounded-2xl border border-[#e3eed7] bg-leaf/30 p-4">
        <div className="text-sm font-bold text-green-800">Prodotti pubblicabili</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {Array.from({ length: 10 }).map((_, i) => {
            const on = i < maxSlot;
            return (
              <span
                key={i}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold ${
                  on
                    ? "bg-green-700 text-white"
                    : "bg-[#e7eddf] text-green-900/35"
                }`}
                title={on ? `Prodotto ${i + 1}` : i === 0 ? "" : "Disponibile con Silver"}
              >
                {i + 1}
              </span>
            );
          })}
          <span
            className={`flex h-9 items-center justify-center gap-1 rounded-lg px-3 text-xs font-bold ${
              piano === "gold"
                ? "bg-badge-yellow text-green-900"
                : "bg-[#e7eddf] text-green-900/35"
            }`}
          >
            + fino a 100
            {piano !== "gold" && <span className="font-normal">(Gold)</span>}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-green-900/55">
          Free: 1 prodotto · Silver: 10 · Gold: il «+» per arrivare fino a 100.
        </p>
      </div>

      {/* elenco di TUTTI i servizi */}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {SERVIZI.map((s) => {
          const on = incluso(s.min);
          return (
            <li
              key={s.nome}
              className={`flex items-start gap-3 rounded-xl border p-3 ${
                on
                  ? "border-green-600/40 bg-white"
                  : "border-[#e3eed7] bg-[#f4f6ef] opacity-70"
              }`}
            >
              <span className={`text-xl ${on ? "" : "grayscale"}`}>{s.icona}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-semibold ${on ? "text-green-800" : "text-green-900/45"}`}
                  >
                    {s.nome}
                  </span>
                  {on ? (
                    <span className="text-sm text-green-600">✓</span>
                  ) : (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        s.min === "gold"
                          ? "bg-badge-yellow text-green-900"
                          : "bg-[#c9d3da] text-[#33414a]"
                      }`}
                    >
                      {NOME[s.min]}
                    </span>
                  )}
                </div>
                <div className={`text-xs ${on ? "text-green-900/65" : "text-green-900/40"}`}>
                  {s.descr}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* guida ai piani */}
      <button
        onClick={() => setGuida((v) => !v)}
        className="mt-4 text-sm font-semibold text-green-700 hover:underline"
      >
        {guida ? "Nascondi la guida ai piani ▲" : "📖 Cosa ottieni con Free, Silver e Gold? — Guida ▼"}
      </button>

      {guida && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[#e3eed7] p-4">
            <div className="font-display text-xl text-green-800">Free</div>
            <p className="mt-1 text-xs text-green-900/70">
              Per iniziare e farti conoscere, gratis.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-green-900/85">
              <li>✓ Scheda pubblica del prodotto</li>
              <li>✓ Semaforo ecologico</li>
              <li>✓ 1 prodotto</li>
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-[#c9d3da] p-4">
            <div className="font-display text-xl text-green-800">Silver</div>
            <p className="mt-1 text-xs text-green-900/70">
              Per chi vuole una vetrina completa.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-green-900/85">
              <li>✓ Tutto il Free, più:</li>
              <li>✓ Fino a 10 prodotti, con foto</li>
              <li>✓ Descrizione, sito web, contatti</li>
              <li>✓ Badge per il tuo sito</li>
              <li>✓ Priorità in vetrina + statistiche base</li>
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-badge-yellow bg-[#fffbe9] p-4">
            <div className="font-display text-xl text-green-800">Gold</div>
            <p className="mt-1 text-xs text-green-900/70">
              Per vendere e farti scegliere.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-green-900/85">
              <li>✓ Tutto il Silver, più:</li>
              <li>✓ Fino a 100 prodotti</li>
              <li>✓ Prezzi e prodotti in vendita</li>
              <li>✓ Prenotazioni via widget</li>
              <li>✓ Statistiche avanzate</li>
              <li>✓ In evidenza nella vetrina</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
