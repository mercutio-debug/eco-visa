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
