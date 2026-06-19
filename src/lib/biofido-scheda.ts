/**
 * Scheda mappa BioFido gestita DA ECO-VISA (login unico).
 * Scrive/legge la stessa tabella Supabase `biofido_businesses` usata dall'app
 * BioFido: così un'azienda iscritta su ECO-VISA compila qui la sua scheda e
 * compare subito sulla mappa di BioFido, senza un secondo accesso.
 */
import { supabase } from "./supabase";

export type BioCategory = "agricola" | "negozio" | "ristorante" | "artigiano";

export const BIO_CATEGORIES: { id: BioCategory; label: string; emoji: string }[] = [
  { id: "agricola", label: "Azienda agricola", emoji: "🌾" },
  { id: "negozio", label: "Negozio prodotti bio", emoji: "🛒" },
  { id: "ristorante", label: "Ristorante / agriturismo", emoji: "🍽️" },
  { id: "artigiano", label: "Artigiano", emoji: "🛠️" },
];

export type BioPlan = "free" | "silver" | "gold";

export type BioScheda = {
  id?: string;
  name: string;
  category: BioCategory;
  plan: BioPlan;
  city: string;
  lat: number;
  lon: number;
  address?: string;
  description?: string;
  website?: string;
  phone?: string;
};

type Row = {
  id: string | number;
  name: string;
  category: string;
  plan: string;
  lat: number;
  lon: number;
  city: string;
  address?: string | null;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  owner?: string | null;
};

/** Scheda BioFido del produttore loggato (se già creata). */
export async function loadMyBioScheda(owner: string): Promise<BioScheda | null> {
  const { data } = await supabase
    .from("biofido_businesses")
    .select("id,name,category,plan,lat,lon,city,address,description,website,phone,owner")
    .eq("owner", owner)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const r = data as Row;
  return {
    id: String(r.id),
    name: r.name,
    category: (r.category as BioCategory) ?? "agricola",
    plan: (r.plan as BioPlan) ?? "free",
    city: r.city,
    lat: Number(r.lat),
    lon: Number(r.lon),
    address: r.address ?? undefined,
    description: r.description ?? undefined,
    website: r.website ?? undefined,
    phone: r.phone ?? undefined,
  };
}

/** Crea o aggiorna la scheda mappa del produttore. */
export async function saveMyBioScheda(
  owner: string,
  input: BioScheda,
  id?: string,
): Promise<{ error?: string }> {
  const payload = {
    owner,
    name: input.name,
    category: input.category,
    plan: input.plan,
    lat: input.lat,
    lon: input.lon,
    city: input.city,
    address: input.address || null,
    description: input.description || null,
    website: input.website || null,
    phone: input.phone || null,
  };
  const { error } = id
    ? await supabase.from("biofido_businesses").update(payload).eq("id", id)
    : await supabase.from("biofido_businesses").insert(payload);
  return { error: error?.message };
}
