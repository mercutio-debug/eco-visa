import { supabase } from "./supabase";
import type { Plan } from "./piani";

/**
 * Piano corrente dell'utente loggato, letto dalla tabella `subscriptions`
 * (condivisa con BioFido: un solo abbonamento per azienda, valido su entrambi
 * i siti). Ritorna "free" se non loggato, senza riga, o abbonamento annullato.
 */
export async function getMyPlan(): Promise<Plan> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "free";

  const { data } = await supabase
    .from("subscriptions")
    .select("plan,status")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = data as { plan?: Plan; status?: string } | null;
  if (!row || row.status === "canceled" || row.status === "inactive") return "free";
  return row.plan ?? "free";
}
