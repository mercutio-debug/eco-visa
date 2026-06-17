import {
  geocode,
  haversineKm,
  nearestItalianPort,
  ROAD_FACTOR,
  type GeoPoint,
} from "./geo";

/* ============================================================
   Modello di calcolo ECO-VISA (come da progetto)
   - materie prime europee: camion = 800 g CO2 / km
   - materie prime extra-UE: nave = 30 g CO2 / km (tratta marittima)
                              + camion dal porto di sbarco allo stabilimento
   ============================================================ */

export const TRUCK_G_PER_KM = 800;
export const SHIP_G_PER_KM = 30;

export type EcoLevel = "verde" | "giallo" | "rosso";

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
};

export type ProductFootprint = {
  plant: string;
  resolvedPlant: boolean;
  ingredients: IngredientResult[];
  totalKm: number;
  totalCo2Kg: number;
  avgKm: number; // distanza MEDIA di trasporto delle materie prime (criterio semaforo)
  score: number; // 0..100 (più alto = meglio)
  level: EcoLevel;
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
    };
  }

  const legs: Leg[] = [];

  if (o.eu) {
    // tutta la tratta via camion
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
  };
}

/* SOGLIE DEL SEMAFORO — criterio OGGETTIVO: distanza MEDIA di trasporto delle
   materie prime (km), indipendente da quantità e numero di ingredienti, allineata
   alla filiera corta / km0. Una sola materia prima da fuori UE porta al rosso. */
export const SOGLIA_VERDE_KM = 200; //  ≤ 200 km: filiera corta (≤ 70 km = km0 puro)
export const SOGLIA_GIALLO_KM = 700; // ≤ 700 km: scala nazionale / europea

export function levelFromAvgKm(avgKm: number, presenzaExtraUe: boolean): EcoLevel {
  if (presenzaExtraUe || avgKm > SOGLIA_GIALLO_KM) return "rosso";
  if (avgKm > SOGLIA_VERDE_KM) return "giallo";
  return "verde";
}

export function scoreFromAvgKm(avgKm: number): number {
  // 0 km → 100 ; 1000 km → 0
  return Math.max(0, Math.min(100, Math.round(100 - avgKm / 10)));
}

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

  // Criterio semaforo: distanza media delle materie prime riconosciute.
  const risolti = results.filter((r) => r.resolved);
  const avgKm = risolti.length
    ? Math.round(risolti.reduce((s, r) => s + r.totalKm, 0) / risolti.length)
    : 0;
  const presenzaExtraUe = risolti.some((r) => !r.eu);

  return {
    plant: plant.name,
    resolvedPlant: true,
    ingredients: results,
    totalKm,
    totalCo2Kg,
    avgKm,
    score: scoreFromAvgKm(avgKm),
    level: levelFromAvgKm(avgKm, presenzaExtraUe),
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
