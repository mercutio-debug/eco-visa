"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Turnstile, turnstileAttivo } from "@/components/Turnstile";

// base path del portale (vuoto su ecovisa.it, "/biofido" su GitHub Pages):
// serve per far tornare il link di conferma email sulla pagina di benvenuto.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Tipo = "azienda" | "cliente";

export default function RegistratiPage() {
  const router = useRouter();
  // Tipo di account: azienda (vende) o cliente (ordina). Preselezionabile con
  // ?tipo=cliente (es. dal pulsante "Iscriviti come cliente").
  const [tipo, setTipo] = useState<Tipo>(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("tipo") === "cliente"
      ? "cliente"
      : "azienda",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [anchePerBiofido, setAnchePerBiofido] = useState(false);

  const isAzienda = tipo === "azienda";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 6) {
      setError("La password deve avere almeno 6 caratteri.");
      return;
    }
    if (turnstileAttivo && !captcha) {
      setError("Conferma di non essere un robot.");
      return;
    }
    setLoading(true);
    // Il tipo va nei metadati: un trigger DB crea il profilo (profiles.tipo).
    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          tipo,
          ...(isAzienda ? { vuole_biofido: anchePerBiofido } : {}),
        },
        captchaToken: captcha ?? undefined,
        emailRedirectTo: `${window.location.origin}${BASE}/benvenuto/`,
      },
    });
    setLoading(false);
    if (signErr) {
      setError(
        /already registered/i.test(signErr.message)
          ? "Utente già registrato. Accedi con le tue credenziali."
          : signErr.message,
      );
      setCaptcha(null);
      setCaptchaKey((k) => k + 1);
      return;
    }
    // email già presente: Supabase risponde con un utente SENZA identità (anti-enumerazione)
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setInfo(null);
      setError(
        "Utente già registrato. Lo stesso account vale su ECO-VISA e BioFido: accedi con le tue credenziali.",
      );
      setCaptcha(null);
      setCaptchaKey((k) => k + 1);
      return;
    }
    const notaBiofido =
      isAzienda && anchePerBiofido
        ? " Potrai accedere anche su BioFido con queste stesse credenziali."
        : "";
    if (data.session) {
      // conferma email disattivata: si entra subito
      let dest = "";
      try {
        dest = sessionStorage.getItem("postLoginRedirect") ?? "";
        if (dest) sessionStorage.removeItem("postLoginRedirect");
      } catch {
        /* ignore */
      }
      // aziende → dashboard; clienti → dove stavano (es. la scheda da cui ordinavano) o home
      router.push(isAzienda ? "/dashboard" : dest || "/");
    } else {
      // conferma email attiva: bisogna confermare prima di accedere
      setInfo(
        "Account creato! Ti abbiamo inviato un'email di conferma a " +
          email +
          ". Conferma l'indirizzo, poi accedi." +
          notaBiofido,
      );
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      {/* Selettore tipo account */}
      <div className="flex gap-1 rounded-full bg-leaf p-1">
        <button
          type="button"
          onClick={() => setTipo("azienda")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${
            isAzienda ? "bg-green-700 text-white" : "text-green-800 hover:text-green-700"
          }`}
        >
          Sono un&apos;azienda
        </button>
        <button
          type="button"
          onClick={() => setTipo("cliente")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${
            !isAzienda ? "bg-green-700 text-white" : "text-green-800 hover:text-green-700"
          }`}
        >
          Sono un cliente
        </button>
      </div>

      <div className="mt-6 text-xs font-bold uppercase tracking-wide text-lime-500">
        {isAzienda ? "Area aziende" : "Area clienti"}
      </div>
      <h1 className="title-pangea mt-2 text-4xl text-green-700">
        {isAzienda ? "Iscrivi la tua azienda" : "Crea il tuo account cliente"}
      </h1>
      <p className="mt-3 text-green-900/80">
        {isAzienda
          ? "Ti bastano email e password. Il nome dell'azienda e gli altri dati li inserisci dopo, dalla tua dashboard."
          : "Registrati per ordinare i prodotti delle aziende. Bastano email e password; nome e indirizzo di spedizione li inserisci al momento dell'ordine."}
      </p>

      <form onSubmit={handleSubmit} className="card mt-8 space-y-4 p-6">
        <label className="block">
          <span className="label">Email (sarà il tuo username)</span>
          <input
            type="email"
            className="field mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isAzienda ? "azienda@esempio.it" : "nome@esempio.it"}
            required
          />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input
            type="password"
            className="field mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Almeno 6 caratteri"
            required
          />
        </label>

        {isAzienda && (
          <label className="flex items-start gap-2 rounded-xl bg-leaf/50 p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-[var(--lime-500)]"
              checked={anchePerBiofido}
              onChange={(e) => setAnchePerBiofido(e.target.checked)}
            />
            <span className="text-sm text-green-900/90">
              <strong>Iscrivimi anche a BioFido</strong> — la mappa del biologico a
              chilometro zero. Stesso account, stesse credenziali (richiede la
              certificazione bio nella scheda).
            </span>
          </label>
        )}

        {error && <p className="text-sm font-semibold text-traffic-red">{error}</p>}
        {info && (
          <p className="rounded-lg bg-leaf p-3 text-sm font-semibold text-green-700">
            {info}
          </p>
        )}

        <Turnstile key={captchaKey} onToken={setCaptcha} />

        <button
          type="submit"
          className="btn-lime w-full"
          disabled={loading || (turnstileAttivo && !captcha)}
        >
          {loading ? "Creazione in corso…" : "Crea account"}
        </button>
        <p className="text-center text-sm text-green-900/70">
          Hai già un account?{" "}
          <Link href="/accedi" className="font-bold text-green-700 hover:text-lime-500">
            Accedi
          </Link>
        </p>
      </form>
    </div>
  );
}
