import {
  geocode,
  haversineKm,
  nearestItalianPort,
  ROAD_FACTOR,
  type GeoPoint,
} from "./geo";

/* ============================================================
   Modello di calcolo ECO-VISA (come da progetto)
   - materie prime EUROPEE e del NORD AFRICA: camion = 800 g CO2 / km
     (Marocco, Algeria, Tunisia, Libia, Egitto: collegati via gomma/traghetto)
   - materie prime del resto del mondo: nave = 30 g CO2 / km (tratta marittima)
                              + camion dal porto di sbarco allo stabilimento
   ============================================================ */

export const TRUCK_G_PER_KM = 800;
export const SHIP_G_PER_KM = 30;

/**
 * Modalità di trasporto in base alla GEOGRAFIA dell'origine:
 *  - CAMION per tutta l'Europa e per il Nord Africa;
 *  - NAVE per tutto il resto del mondo.
 */
function viaCamion(lat: number, lon: number): boolean {
  const europa = lat >= 34 && lat <= 72 && lon >= -25 && lon <= 45;
  const nordAfrica = lat >= 19 && lat < 37 && lon >= -17 && lon <= 33;
  return europa || nordAfrica;
}

/** Macro-regione di provenienza, per il giudizio geografico del semaforo. */
export type Regione = "italia" | "europa" | "america_africa" | "asia";

export function regioneDi(g: GeoPoint): Regione {
  if (g.country === "Italia") return "italia";
  if (g.lon > 45) return "asia"; // Medio Oriente e Asia
  if (g.lon < -25) return "america_africa"; // Americhe
  if (g.lat < 34) return "america_africa"; // Africa
  return "europa";
}

/** Lampada "a 3 colori" del semaforo grande (verde/giallo/rosso). */
export type EcoLevel = "verde" | "giallo" | "rosso";

/* ============================================================
   SCALA A 8 TONALITÀ (per ingrediente E per prodotto)
   Tier del singolo ingrediente in base a DISTANZA + GEOGRAFIA:
     super_green     ≤ 70 km    (km0)
     verde           ≤ 200 km
     verde_chiaro    ≤ 1000 km  (copre l'Italia e i vicini)
     giallo_chiaro   1000–2000 km, in Italia
     giallo_scuro    1000–2000 km, fuori Italia
     rosso_chiaro    > 2000 km, in Europa
     rosso_scuro     > 2000 km, America/Africa
     rosso_scurissimo  Asia (rosso sangue scurissimo)
   ============================================================ */
export type TierIng =
  | "super_green"
  | "verde"
  | "verde_chiaro"
  | "giallo_chiaro"
  | "giallo_scuro"
  | "rosso_chiaro"
  | "rosso_scuro"
  | "rosso_scurissimo";

/** Il PRODOTTO è giudicato sulla stessa scala a 8 tonalità. */
export type Giudizio = TierIng;

export function tierIngrediente(km: number, reg: Regione): TierIng {
  if (km <= 70) return "super_green";
  if (km <= 200) return "verde";
  if (km <= 1000) return "verde_chiaro";
  if (km <= 2000) return reg === "italia" ? "giallo_chiaro" : "giallo_scuro";
  if (reg === "asia") return "rosso_scurissimo";
  if (reg === "america_africa") return "rosso_scuro";
  return "rosso_chiaro";
}

/** Le 3 tonalità verdi → "verde"; le 2 gialle → "giallo"; le 3 rosse → "rosso". */
export function categoriaDiTier(t: TierIng): EcoLevel {
  if (t === "super_green" || t === "verde" || t === "verde_chiaro") return "verde";
  if (t === "giallo_chiaro" || t === "giallo_scuro") return "giallo";
  return "rosso";
}

/* ============================================================
   EQUAZIONE DEL SEMAFORO GRANDE (punteggio pesato, non proporzionale)
   - ogni ingrediente vale un punteggio qualità 0..100;
   - il prodotto = MEDIA dei punteggi;
   - FRENO DURO: anche un solo "rosso scurissimo" (Asia) impedisce il verde
     (il prodotto non supera mai il giallo scuro).
   ============================================================ */
const QUALITA: Record<TierIng, number> = {
  super_green: 100,
  verde: 92,
  verde_chiaro: 82,
  giallo_chiaro: 62,
  giallo_scuro: 48,
  rosso_chiaro: 34,
  rosso_scuro: 24,
  rosso_scurissimo: 8,
};

function bandaDaPunteggio(score: number): Giudizio {
  if (score >= 95) return "super_green";
  if (score >= 86) return "verde";
  if (score >= 70) return "verde_chiaro";
  if (score >= 56) return "giallo_chiaro";
  if (score >= 42) return "giallo_scuro";
  if (score >= 30) return "rosso_chiaro";
  if (score >= 16) return "rosso_scuro";
  return "rosso_scurissimo";
}

/** Giudizio del prodotto (livello + punteggio 0..100) dai tier degli ingredienti. */
export function giudizioProdotto(tiers: TierIng[]): { level: Giudizio; score: number } {
  if (!tiers.length) return { level: "verde_chiaro", score: 82 };
  let score = Math.round(tiers.reduce((s, t) => s + QUALITA[t], 0) / tiers.length);
  // freno duro: un rosso scurissimo non porta mai al verde (max giallo scuro = 49)
  if (tiers.includes("rosso_scurissimo")) score = Math.min(score, 49);
  return { level: bandaDaPunteggio(score), score };
}

/** Consigli contestuali per gli ingredienti lontani (giallo/rosso). */
export function consigliIngredienti(ings: { name: string; tier: TierIng }[]): string[] {
  const out: string[] = [];
  for (const i of ings) {
    if (categoriaDiTier(i.tier) === "verde") continue;
    const n = i.name.toLowerCase();
    if (n.includes("zucchero di canna") || n.includes("canna")) {
      out.push(
        "È vero, lo zucchero di canna di solito arriva da lontano — perché non provare dolcificanti locali come malto d'orzo, miele o zucchero di barbabietola grezzo?",
      );
    } else if (n.includes("cacao") || n.includes("cioccolat") || n.includes("caffè") || n.includes("caffe") || n.includes("vaniglia") || n.includes("spezie") || n.includes("pepe")) {
      out.push(
        `«${i.name}» arriva per natura da lontano: è difficile sostituirlo, ma sceglierlo da filiere certificate e a basso impatto fa la differenza.`,
      );
    } else {
      out.push(
        `«${i.name}» arriva da lontano: dove possibile, una materia prima più vicina migliorerebbe il semaforo.`,
      );
    }
  }
  return [...new Set(out)].slice(0, 3);
}

export type IngredientInput = {
  name: string;
  origin: string; // località di produzione della materia prima
};

export type Leg = {
  mode: "nave" | "camion";
  from: string;
  to: string;
  km: number;
  co2g: number;
};

export type IngredientResult = {
  name: string;
  origin: string;
  resolved: boolean; // località riconosciuta?
  eu: boolean;
  totalKm: number;
  co2g: number;
  legs: Leg[];
  tier: TierIng; // colore della singola materia prima (per il mini-semaforo)
};

export type ProductFootprint = {
  plant: string;
  resolvedPlant: boolean;
  ingredients: IngredientResult[];
  totalKm: number;
  totalCo2Kg: number;
  avgKm: number; // distanza media (solo informativa)
  score: number; // 0..100 (più alto = meglio)
  level: Giudizio; // giudizio a 8 tonalità del semaforo grande
  consigli: string[]; // suggerimenti contestuali (materie prime lontane)
};

/** calcola km + CO2 di una singola materia prima fino allo stabilimento */
export function computeIngredient(
  ing: IngredientInput,
  plant: GeoPoint
): IngredientResult {
  const o = geocode(ing.origin);
  if (!o) {
    return {
      name: ing.name,
      origin: ing.origin,
      resolved: false,
      eu: false,
      totalKm: 0,
      co2g: 0,
      legs: [],
      tier: "rosso_scuro",
    };
  }

  const legs: Leg[] = [];
  const SAME_TOWN_KM = 5; // entro ~5 km in linea d'aria = stesso comune → km0, 0 CO₂

  if (viaCamion(o.lat, o.lon)) {
    // Europa + Nord Africa: tutta la tratta via camion. Stesso comune → 0.
    const straight = haversineKm(o, plant);
    const km = straight < SAME_TOWN_KM ? 0 : Math.round(straight * ROAD_FACTOR);
    legs.push({
      mode: "camion",
      from: o.name,
      to: plant.name,
      km,
      co2g: km * TRUCK_G_PER_KM,
    });
  } else {
    // tratta marittima fino al porto italiano + camion fino allo stabilimento
    const port = nearestItalianPort(plant);
    const seaKm = Math.round(haversineKm(o, port));
    const roadKm = Math.round(haversineKm(port, plant) * ROAD_FACTOR);
    legs.push({
      mode: "nave",
      from: o.name,
      to: port.name,
      km: seaKm,
      co2g: seaKm * SHIP_G_PER_KM,
    });
    legs.push({
      mode: "camion",
      from: port.name,
      to: plant.name,
      km: roadKm,
      co2g: roadKm * TRUCK_G_PER_KM,
    });
  }

  const totalKm = legs.reduce((s, l) => s + l.km, 0);
  const co2g = legs.reduce((s, l) => s + l.co2g, 0);

  return {
    name: ing.name,
    origin: o.name,
    resolved: true,
    eu: o.eu,
    totalKm,
    co2g,
    legs,
    tier: tierIngrediente(totalKm, regioneDi(o)),
  };
}

/** Soglie dei tier per-ingrediente (km), esposte per la pagina di trasparenza. */
export const SOGLIE_TIER_KM = {
  super_green: 70,
  verde: 200,
  verde_chiaro: 1000,
  giallo: 2000,
} as const;

/** calcola l'impronta completa di un prodotto */
export function computeFootprint(
  plantName: string,
  ingredients: IngredientInput[]
): ProductFootprint {
  const plant = geocode(plantName);
  if (!plant) {
    return {
      plant: plantName,
      resolvedPlant: false,
      ingredients: [],
      totalKm: 0,
      totalCo2Kg: 0,
      avgKm: 0,
      score: 0,
      level: "rosso_scuro",
      consigli: [],
    };
  }

  const results = ingredients
    .filter((i) => i.name.trim() && i.origin.trim())
    .map((i) => computeIngredient(i, plant));

  const totalKm = results.reduce((s, r) => s + r.totalKm, 0);
  const totalCo2g = results.reduce((s, r) => s + r.co2g, 0);
  const totalCo2Kg = Math.round(totalCo2g / 1000);

  // Solo le materie prime con località riconosciuta entrano nel giudizio.
  const risolti = results.filter((r) => r.resolved);
  const avgKm = risolti.length
    ? Math.round(risolti.reduce((s, r) => s + r.totalKm, 0) / risolti.length)
    : 0;
  const { level, score } = giudizioProdotto(risolti.map((r) => r.tier));
  const consigli = consigliIngredienti(risolti.map((r) => ({ name: r.name, tier: r.tier })));

  return {
    plant: plant.name,
    resolvedPlant: true,
    ingredients: results,
    totalKm,
    totalCo2Kg,
    avgKm,
    score,
    level,
    consigli,
  };
}

/** CO2 per la consegna dallo stabilimento all'utente (per le alternative) */
export function deliveryCo2Kg(plantName: string, userName: string): number | null {
  const a = geocode(plantName);
  const b = geocode(userName);
  if (!a || !b) return null;
  const km = haversineKm(a, b) * ROAD_FACTOR;
  return Math.round((km * TRUCK_G_PER_KM) / 1000);
}

export function distanceKm(aName: string, bName: string): number | null {
  const a = geocode(aName);
  const b = geocode(bName);
  if (!a || !b) return null;
  return Math.round(haversineKm(a, b));
}
