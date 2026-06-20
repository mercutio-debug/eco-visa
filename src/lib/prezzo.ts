/**
 * Formattazione prezzo in stile italiano: simbolo €, virgola decimale e due
 * cifre. Accetta input "sporchi" ("9", "9.5", "9,50", "€ 9,50", "1.234,56") e li
 * normalizza in "€ 9,50". È idempotente (rieseguirlo non cambia il risultato).
 * Se la stringa non contiene numeri (es. "su richiesta") la lascia invariata.
 */
export function formatPrezzo(raw: string | null | undefined): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";

  // tengo solo cifre e separatori
  const cleaned = s.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(cleaned)) return s; // nessun numero: prezzo testuale, lascio com'è

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let decimalSep = "";
  if (lastComma > -1 && lastDot > -1) decimalSep = lastComma > lastDot ? "," : ".";
  else if (lastComma > -1) decimalSep = ",";
  else if (lastDot > -1) decimalSep = ".";

  let normalized = cleaned;
  if (decimalSep) {
    const thousandSep = decimalSep === "," ? "." : ",";
    normalized = cleaned.split(thousandSep).join("").replace(decimalSep, ".");
  }

  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) return s;
  return "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
