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

export type EcoLevel = "verde" | "giallo" | "rosso";

/* ============================================================
   CRITERIO SEMAFORO (giudizio proporzionale, non somma matematica)
   - ogni MATERIA PRIMA ha un suo tier in base alla distanza:
       km0      ≤ 70 km   (SUPER GREEN, km0)
       verde_intenso ≤ 200 km
       verde_chiaro  ≤ 500 km
       verde_pallido ≤ 1000 km  (copre la produzione italiana)
       giallo   1000–2000 km
       rosso    > 2000 km
   - il SEMAFORO GRANDE è un giudizio di massima sulle proporzioni
     dei colori delle materie prime (così i prodotti con tanti
     ingredienti non sono più penalizzati dalla somma).
   ============================================================ */
export type TierIng =
  | "km0"
  | "verde_intenso"
  | "verde_chiaro"
  | "verde_pallido"
  | "giallo"
  | "rosso";

export type Giudizio =
  | "verde_plus"
  | "verde"
  | "verde_chiaro"
  | "giallo"
  | "rosso"
  | "rosso_intenso";

export function tierIngrediente(km: number): TierIng {
  if (km <= 70) return "km0";
  if (km <= 200) return "verde_intenso";
  if (km <= 500) return "verde_chiaro";
  if (km <= 1000) return "verde_pallido";
  if (km <= 2000) return "giallo";
  return "rosso";
}

/** I 4 verdi contano come "verde" nel giudizio complessivo. */
export function categoriaDiTier(t: TierIng): EcoLevel {
  if (t === "giallo") return "giallo";
  if (t === "rosso") return "rosso";
  return "verde";
}

/** Giudizio del semaforo grande dalle categorie delle materie prime. */
export function giudizioDaCategorie(cats: EcoLevel[]): Giudizio {
  const n = cats.length;
  if (n === 0) return "verde";
  const g = cats.filter((c) => c === "verde").length;
  const r = cats.filter((c) => c === "rosso").length;
  if (r === n) return "rosso_intenso"; // tutti rossi
  if (r * 2 >= n) return "rosso"; // metà o più rossi
  if (r >= 1) return "giallo"; // c'è un rosso (ma meno della metà)
  if (g === n) return "verde_plus"; // tutti verdi
  if (g * 2 > n) return "verde"; // più della metà verdi (resto giallo)
  if (g * 2 === n) return "verde_chiaro"; // metà verdi, metà gialli
  return "giallo"; // più della metà gialli
}

const SCORE_GIUDIZIO: Record<Giudizio, number> = {
  verde_plus: 100,
  verde: 85,
  verde_chiaro: 70,
  giallo: 45,
  rosso: 20,
  rosso_intenso: 5,
};

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
  level: Giudizio; // giudizio proporzionale del semaforo grande
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
      tier: "rosso",
    };
  }

  const legs: Leg[] = [];

  if (viaCamion(o.lat, o.lon)) {
    // Europa + Nord Africa: tutta la tratta via camion
    const km = Math.round(haversineKm(o, plant) * ROAD_FACTOR);
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
    tier: tierIngrediente(totalKm),
  };
}

/** Soglie dei tier per-ingrediente (km), esposte per la pagina di trasparenza. */
export const SOGLIE_TIER_KM = {
  km0: 70,
  verde_intenso: 200,
  verde_chiaro: 500,
  verde_pallido: 1000,
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
      level: "rosso",
    };
  }

  const results = ingredients
    .filter((i) => i.name.trim() && i.origin.trim())
    .map((i) => computeIngredient(i, plant));

  const totalKm = results.reduce((s, r) => s + r.totalKm, 0);
  const totalCo2g = results.reduce((s, r) => s + r.co2g, 0);
  const totalCo2Kg = Math.round(totalCo2g / 1000);

  // Criterio semaforo: GIUDIZIO proporzionale sui colori delle materie prime.
  const risolti = results.filter((r) => r.resolved);
  const avgKm = risolti.length
    ? Math.round(risolti.reduce((s, r) => s + r.totalKm, 0) / risolti.length)
    : 0;
  const giud = giudizioDaCategorie(risolti.map((r) => categoriaDiTier(r.tier)));

  return {
    plant: plant.name,
    resolvedPlant: true,
    ingredients: results,
    totalKm,
    totalCo2Kg,
    avgKm,
    score: SCORE_GIUDIZIO[giud],
    level: giud,
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
