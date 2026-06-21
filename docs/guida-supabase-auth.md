# Percorso guidato — Supabase Auth & Authentication

Progetto Supabase: **kvpxnxsjiyiixqksinzr** (condiviso da ECO-VISA e BioFido).
Vai su https://supabase.com/dashboard/project/kvpxnxsjiyiixqksinzr → menu **Authentication**.

Domini reali:
- ECO-VISA → `https://ecovisa.it` (Hostinger, root)
- BioFido → `https://mercutio-debug.github.io/biofido` (GitHub Pages, basePath `/biofido`)

Percorsi di redirect usati dal codice:
- conferma iscrizione → `…/benvenuto/`
- recupero / nuova password → `…/reset/`
- conferma cambio email → torna alla Site URL

---

## 1) Authentication → URL Configuration
Serve a far funzionare i link nelle email (conferma iscrizione, recupero password, cambio email).

- **Site URL:** `https://ecovisa.it`
- **Redirect URLs** (clic su *Add URL*, uno per riga — uso i wildcard `**` così coprono tutte le sottopagine):
  - `https://ecovisa.it/**`
  - `https://mercutio-debug.github.io/biofido/**`
  - `https://mercutio-debug.github.io/eco-visa/**`  *(solo se usi anche il mirror GitHub di ECO-VISA)*

> Niente `localhost`: i portali vivono solo online. Se un link in un'email rimanda a localhost, è perché la Site URL è sbagliata.

---

## 2) Authentication → Sign In / Providers → Email
- **Enable Email provider:** ON
- **Confirm email:** ON (l'utente deve confermare l'indirizzo alla registrazione)
- **Secure email change:** ON → al cambio email Supabase chiede conferma **sia dal vecchio sia dal nuovo indirizzo** (consigliato; è ciò che vede l'utente dalla pagina *Il mio account → Cambia email*)
- **Minimum password length:** 8 (consigliato; coerente con le pagine /account e /reset)
- **Require current password when updating:** OFF (la pagina /account cambia password con la sola sessione attiva; con questa opzione ON l'aggiornamento fallirebbe perché il form non chiede la password attuale)
- **Secure password change:** OFF
- (facoltativo) **Prevent use of leaked passwords:** ON — richiede il piano Pro

---

## 3) Authentication → Emails → SMTP Settings  ✅ già fatto
Per non incappare nel rate-limit dell'email integrata di Supabase, l'invio passa da **Resend**:
- **Enable Custom SMTP:** ON
- Host: `smtp.resend.com` · Port: `465`
- Username: `resend`
- Password: una **API key Resend**
- Sender email: `noreply@ecovisa.it` · Sender name: `ECO-VISA & BioFido`

> Verifica solo che sia ancora attivo. Il dominio `ecovisa.it` è già VERIFIED su Resend.

---

## 4) Authentication → Emails → Templates  (da brandizzare)
Di default sono testi grezzi. Incolla i template qui sotto (sezione **Template email pronti**) per allinearli al mood verde dei portali. Quelli utili:
- **Confirm signup** (conferma iscrizione)
- **Reset password** (nuova password)
- **Change Email Address** (cambio email — usato da /account)

> Sono email di **sistema (GoTrue)**, diverse dalle notifiche transazionali (quelle stanno in `supabase/functions/_shared/email.ts`). Vanno brandizzate qui nel pannello.

---

## 5) Authentication → Attack Protection  ✅ già fatto
- **Captcha protection:** ON, provider **Cloudflare Turnstile**
- Il *Secret* è già impostato qui; il *sitekey* è nei workflow GitHub dei due siti.

> Il captcha si prova **solo dal sito vero** (è il frontend a mandare il token). Via API REST il signup fallisce sempre con `captcha_failed`: è normale.

---

## 6) Database → Webhooks (collegati ad Auth)  ✅ già fatto
- Trigger `trg_nuova_iscrizione` su `auth.users` → funzione `notify` → email all'admin di nuova iscrizione.
- Webhook INSERT su `messaggi` e `prenotazioni` → `notify` (email + push).

---

## Gotcha importanti
- **Dopo aver cambiato un secret** (RESEND_API_KEY, NOTIFY_FROM, SITE_URL…) bisogna **rideployare** la edge function interessata: le funzioni leggono i secret a load-time e l'istanza calda tiene il valore vecchio in cache.
- Le funzioni con import condiviso (`notify`, `stripe-webhook`, `booking-pay`) si deployano **solo via CLI** (`npx supabase functions deploy <nome> --no-verify-jwt`): il metodo "incolla nell'editor" carica un solo file e rompe gli import.
- La conferma del **cambio email** reindirizza alla **Site URL**: se vuoi che atterri su una pagina dedicata, aggiungi `emailRedirectTo` lato codice (oggi non impostato: torna alla home).

---

## Template email pronti (mood ECO-VISA · BioFido)
Incolla in Authentication → Emails → Templates. Mantieni le variabili `{{ ... }}`.

### Confirm signup
```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef4e6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
 <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:100%;background:#fff;border:1px solid #e3eed7;border-radius:18px;overflow:hidden;">
   <tr><td style="background:#1c5132;padding:16px 28px;font-family:Georgia,serif;font-size:18px;font-weight:bold;color:#fff;">🌱 ECO-VISA · BioFido</td></tr>
   <tr><td style="padding:28px;color:#1f3d2b;">
     <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;color:#1f3d2b;">Conferma la tua iscrizione</h1>
     <p style="font-size:15px;line-height:1.6;margin:0 0 8px;">Benvenuto! Conferma l'indirizzo email per attivare il tuo account (vale su ECO-VISA e BioFido).</p>
     <table cellpadding="0" cellspacing="0" style="margin:24px 0 4px;"><tr><td style="border-radius:999px;background:#1c5132;">
       <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:bold;color:#fff;text-decoration:none;border-radius:999px;">Conferma email &rarr;</a>
     </td></tr></table>
     <p style="font-size:12px;color:#6b7c70;margin:14px 0 0;">Se non ti sei iscritto tu, ignora questa email.</p>
   </td></tr>
   <tr><td style="border-top:1px solid #e3eed7;padding:16px 28px;background:#fbfdf7;font-size:12px;color:#6b7c70;">🌱 <a href="https://ecovisa.it" style="color:#1c5132;font-weight:bold;text-decoration:none;">ecovisa.it</a></td></tr>
  </table>
 </td></tr>
</table>
```

### Reset password
```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef4e6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
 <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:100%;background:#fff;border:1px solid #e3eed7;border-radius:18px;overflow:hidden;">
   <tr><td style="background:#1c5132;padding:16px 28px;font-family:Georgia,serif;font-size:18px;font-weight:bold;color:#fff;">🌱 ECO-VISA · BioFido</td></tr>
   <tr><td style="padding:28px;color:#1f3d2b;">
     <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;color:#1f3d2b;">Reimposta la password</h1>
     <p style="font-size:15px;line-height:1.6;margin:0 0 8px;">Hai chiesto una nuova password. Clicca qui sotto per impostarla; il link scade a breve.</p>
     <table cellpadding="0" cellspacing="0" style="margin:24px 0 4px;"><tr><td style="border-radius:999px;background:#1c5132;">
       <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:bold;color:#fff;text-decoration:none;border-radius:999px;">Imposta nuova password &rarr;</a>
     </td></tr></table>
     <p style="font-size:12px;color:#6b7c70;margin:14px 0 0;">Se non sei stato tu, ignora pure: la password resta invariata.</p>
   </td></tr>
   <tr><td style="border-top:1px solid #e3eed7;padding:16px 28px;background:#fbfdf7;font-size:12px;color:#6b7c70;">🌱 <a href="https://ecovisa.it" style="color:#1c5132;font-weight:bold;text-decoration:none;">ecovisa.it</a></td></tr>
  </table>
 </td></tr>
</table>
```

### Change Email Address
```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef4e6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
 <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:100%;background:#fff;border:1px solid #e3eed7;border-radius:18px;overflow:hidden;">
   <tr><td style="background:#1c5132;padding:16px 28px;font-family:Georgia,serif;font-size:18px;font-weight:bold;color:#fff;">🌱 ECO-VISA · BioFido</td></tr>
   <tr><td style="padding:28px;color:#1f3d2b;">
     <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;color:#1f3d2b;">Conferma il cambio email</h1>
     <p style="font-size:15px;line-height:1.6;margin:0 0 8px;">Hai chiesto di cambiare l'email di accesso in <strong>{{ .NewEmail }}</strong>. Conferma per renderla effettiva.</p>
     <table cellpadding="0" cellspacing="0" style="margin:24px 0 4px;"><tr><td style="border-radius:999px;background:#1c5132;">
       <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:bold;color:#fff;text-decoration:none;border-radius:999px;">Conferma cambio email &rarr;</a>
     </td></tr></table>
     <p style="font-size:12px;color:#6b7c70;margin:14px 0 0;">Se non sei stato tu, ignora questa email e non cambierà nulla.</p>
   </td></tr>
   <tr><td style="border-top:1px solid #e3eed7;padding:16px 28px;background:#fbfdf7;font-size:12px;color:#6b7c70;">🌱 <a href="https://ecovisa.it" style="color:#1c5132;font-weight:bold;text-decoration:none;">ecovisa.it</a></td></tr>
  </table>
 </td></tr>
</table>
```

### Magic Link (accesso senza password)
```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef4e6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
 <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:100%;background:#fff;border:1px solid #e3eed7;border-radius:18px;overflow:hidden;">
   <tr><td style="background:#1c5132;padding:16px 28px;font-family:Georgia,serif;font-size:18px;font-weight:bold;color:#fff;">🌱 ECO-VISA · BioFido</td></tr>
   <tr><td style="padding:28px;color:#1f3d2b;">
     <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;color:#1f3d2b;">Il tuo link di accesso</h1>
     <p style="font-size:15px;line-height:1.6;margin:0 0 8px;">Clicca qui sotto per entrare nel tuo account, senza password. Il link è valido per pochi minuti e una sola volta.</p>
     <table cellpadding="0" cellspacing="0" style="margin:24px 0 4px;"><tr><td style="border-radius:999px;background:#1c5132;">
       <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:bold;color:#fff;text-decoration:none;border-radius:999px;">Entra ora &rarr;</a>
     </td></tr></table>
     <p style="font-size:12px;color:#6b7c70;margin:14px 0 0;">Se non hai richiesto l'accesso, ignora pure questa email.</p>
   </td></tr>
   <tr><td style="border-top:1px solid #e3eed7;padding:16px 28px;background:#fbfdf7;font-size:12px;color:#6b7c70;">🌱 <a href="https://ecovisa.it" style="color:#1c5132;font-weight:bold;text-decoration:none;">ecovisa.it</a></td></tr>
  </table>
 </td></tr>
</table>
```

### Reauthentication (codice di verifica per azioni sensibili)
Questa email NON ha un pulsante: mostra un **codice** (`{{ .Token }}`) che l'utente digita per confermare un'operazione delicata.
```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef4e6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
 <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:100%;background:#fff;border:1px solid #e3eed7;border-radius:18px;overflow:hidden;">
   <tr><td style="background:#1c5132;padding:16px 28px;font-family:Georgia,serif;font-size:18px;font-weight:bold;color:#fff;">🌱 ECO-VISA · BioFido</td></tr>
   <tr><td style="padding:28px;color:#1f3d2b;">
     <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;color:#1f3d2b;">Codice di verifica</h1>
     <p style="font-size:15px;line-height:1.6;margin:0 0 8px;">Per confermare l'operazione, inserisci questo codice nella pagina da cui l'hai richiesta:</p>
     <div style="margin:20px 0;text-align:center;">
       <span style="display:inline-block;padding:14px 26px;background:#eef4e6;border:1px solid #e3eed7;border-radius:14px;font-family:Georgia,serif;font-size:30px;font-weight:bold;letter-spacing:6px;color:#1c5132;">{{ .Token }}</span>
     </div>
     <p style="font-size:12px;color:#6b7c70;margin:14px 0 0;">Il codice scade a breve. Se non sei stato tu, ignora questa email.</p>
   </td></tr>
   <tr><td style="border-top:1px solid #e3eed7;padding:16px 28px;background:#fbfdf7;font-size:12px;color:#6b7c70;">🌱 <a href="https://ecovisa.it" style="color:#1c5132;font-weight:bold;text-decoration:none;">ecovisa.it</a></td></tr>
  </table>
 </td></tr>
</table>
```
