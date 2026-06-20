import { supabase } from "./supabase";
import { PLAN_MAP, type Plan } from "./piani";

/**
 * Prenotazioni dei SERVIZI EXTRA (gemello di BioFido). Scrive nella stessa
 * tabella `prenotazioni` e usa la stessa edge function `booking-pay`: il cliente
 * invia la richiesta, il produttore conferma, poi il cliente paga via Stripe.
 * La commissione si calcola dal piano del produttore (PLAN_MAP).
 */
export function commissionCents(plan: Plan, totaleCents: number): number {
  return Math.round(totaleCents * PLAN_MAP[plan].commissionRate);
}

export const euroCents = (c: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(c / 100);

/** Crea una richiesta di prenotazione per un servizio extra. */
export async function createServizioBooking(input: {
  ownerId: string;
  ownerPlan: Plan;
  servizioNome: string;
  prezzoCents: number;
  clienteNome: string;
  clienteEmail: string;
  clienteTel?: string;
  dataRichiesta: string;
  persone: number;
  note?: string;
}): Promise<{ error?: string }> {
  const totaleCents = input.prezzoCents * Math.max(1, input.persone);
  const commCents = commissionCents(input.ownerPlan, totaleCents);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { error } = await supabase.from("prenotazioni").insert({
    esperienza_id: null,
    titolo: input.servizioNome,
    owner: input.ownerId,
    cliente_user_id: session?.user.id ?? null,
    cliente_nome: input.clienteNome,
    cliente_email: input.clienteEmail,
    cliente_tel: input.clienteTel || null,
    data_richiesta: input.dataRichiesta,
    persone: input.persone,
    note: input.note || null,
    totale_cents: totaleCents,
    commissione_rate: PLAN_MAP[input.ownerPlan].commissionRate,
    commissione_cents: commCents,
    stato: "in_attesa",
  });
  return { error: error?.message };
}

/* ---------------- gestione prenotazioni ricevute (produttore) ---------------- */

export type BookingStatus = "in_attesa" | "confermata" | "rifiutata" | "annullata";

export const STATO_LABEL: Record<BookingStatus, string> = {
  in_attesa: "In attesa",
  confermata: "Confermata",
  rifiutata: "Rifiutata",
  annullata: "Annullata",
};

export type Booking = {
  id: string;
  titolo?: string;
  clienteNome: string;
  clienteEmail: string;
  clienteTel?: string;
  dataRichiesta: string;
  persone: number;
  note?: string;
  totaleCents: number;
  commissioneCents: number;
  stato: BookingStatus;
  paymentStatus: "non_pagata" | "pagata" | "rimborsata";
  createdAt?: string;
};

type BookRow = {
  id: number | string;
  titolo?: string | null;
  cliente_nome: string;
  cliente_email: string;
  cliente_tel: string | null;
  data_richiesta: string;
  persone: number;
  note: string | null;
  totale_cents: number;
  commissione_cents: number;
  stato: BookingStatus;
  payment_status?: "non_pagata" | "pagata" | "rimborsata" | null;
  created_at?: string;
};

const fromBookRow = (r: BookRow): Booking => ({
  id: String(r.id),
  titolo: r.titolo ?? undefined,
  clienteNome: r.cliente_nome,
  clienteEmail: r.cliente_email,
  clienteTel: r.cliente_tel ?? undefined,
  dataRichiesta: r.data_richiesta,
  persone: r.persone,
  note: r.note ?? undefined,
  totaleCents: r.totale_cents,
  commissioneCents: r.commissione_cents,
  stato: r.stato,
  paymentStatus: r.payment_status ?? "non_pagata",
  createdAt: r.created_at,
});

export async function listMyBookings(owner: string): Promise<Booking[]> {
  const { data } = await supabase
    .from("prenotazioni")
    .select("*")
    .eq("owner", owner)
    .order("created_at", { ascending: false });
  return ((data as BookRow[]) ?? []).map(fromBookRow);
}

export async function setBookingStatus(id: string, stato: BookingStatus): Promise<void> {
  await supabase.from("prenotazioni").update({ stato }).eq("id", id);
}

/* ------------------------------ messaggi (chat) ------------------------------- */

export type Mittente = "azienda" | "cliente";

export type Message = {
  id: string;
  prenotazioneId: string;
  mittente: Mittente;
  testo: string;
  createdAt?: string;
};

type MsgRow = {
  id: number | string;
  prenotazione_id: number | string;
  mittente: Mittente;
  testo: string;
  created_at?: string;
};

const fromMsgRow = (r: MsgRow): Message => ({
  id: String(r.id),
  prenotazioneId: String(r.prenotazione_id),
  mittente: r.mittente,
  testo: r.testo,
  createdAt: r.created_at,
});

export async function listMessages(prenotazioneId: string): Promise<Message[]> {
  const { data } = await supabase
    .from("messaggi")
    .select("*")
    .eq("prenotazione_id", prenotazioneId)
    .order("created_at", { ascending: true });
  return ((data as MsgRow[]) ?? []).map(fromMsgRow);
}

export async function sendMessage(
  prenotazioneId: string,
  mittente: Mittente,
  testo: string,
): Promise<{ error?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { error } = await supabase.from("messaggi").insert({
    prenotazione_id: prenotazioneId,
    mittente,
    sender_id: session?.user.id ?? null,
    testo,
  });
  return { error: error?.message };
}
