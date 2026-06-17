import { supabase } from "./supabase";
import type { Plan } from "./piani";

/**
 * Pagamenti dei piani via Stripe Checkout.
 *
 * ECO-VISA e BioFido condividono lo stesso database Supabase e le stesse Edge
 * Functions: un abbonamento attivato da qui vale anche su BioFido (un unico
 * piano per azienda). La chiave segreta Stripe resta nelle Edge Functions.
 *
 * Finché NEXT_PUBLIC_BILLING_ENABLED non è "true", la dashboard ricade sul
 * salvataggio locale della scelta e l'app resta navigabile.
 */
export const billingEnabled =
  process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

const FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout`
  : "";

/**
 * Avvia il Checkout Stripe per un piano a pagamento e reindirizza l'utente.
 * Lancia un errore (messaggio leggibile) se qualcosa non va.
 */
export async function startCheckout(
  plan: Plan,
  period: "monthly" | "annual",
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Accedi per attivare un abbonamento.");
  }

  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ plan, period, returnUrl: window.location.origin }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "" }));
    throw new Error(error || "Impossibile avviare il pagamento. Riprova.");
  }

  const { url } = await res.json();
  if (!url) throw new Error("Sessione di pagamento non disponibile.");
  window.location.href = url;
}
