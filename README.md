# CodeMind Projects

Web app personale per organizzare la giornata: agenda e turni di lavoro, università,
lavoro da sviluppatore, palestra e alimentazione, note e to-do. È una PWA in
JavaScript senza librerie né compilazione; i dati stanno su Supabase, protetti
dall'accesso (Row Level Security) e visibili solo al proprio account.

## Cartelle

| Cartella | Cosa contiene |
|---|---|
| `dist/` | L'app pubblicata così com'è: `index.html`, `css/`, `js/`, `forma/`, `assets/` |
| `dist/css/bento.css` | L'aspetto attuale ("Bento", Chakra Petch): si carica per ultimo |
| `dist/forma/` | Palestra e alimentazione (Forma), aperta dentro l'app |
| `supabase/migrations/` | Le modifiche al database, numerate e da eseguire in ordine |
| `tests/` | Test automatici (`npm test`): servizi dell'app e database su PostgreSQL locale |
| `strumenti/` | Server locale senza cache e preparazione della pubblicazione |
| `anteprime/` | Anteprime grafiche approvate e dati finti per provare l'app in locale |

## Provare l'app sul Mac

```sh
python3 strumenti/server-sviluppo.py 4174
```

Apri http://localhost:4174/dist/. In locale il service worker è spento, così ogni
modifica si vede subito (per provare l'offline aggiungi `?offline` all'indirizzo).
Senza `dist/js/config.js` l'app chiede di accedere: per vedere le pagine piene,
nella console del browser esegui `await import('/anteprime/dati-finti.js')`, che
carica dati finti solo in memoria.

## Test

```sh
npm ci
npm test
```

## Pubblicare una nuova versione

1. Alza la versione della cache (altrimenti i telefoni restano sui file vecchi):
   ```sh
   python3 strumenti/prepara-pubblicazione.py 71
   ```
2. `git commit` e `git push` su `main`: GitHub Actions pubblica `dist/` su GitHub Pages
   (scheda **Actions** del repository per vedere l'avanzamento).

### Prima pubblicazione (una volta sola)

1. Repository → **Settings → Pages → Source: GitHub Actions**.
2. Repository → **Settings → Secrets and variables → Actions → Variables**: crea
   `SUPABASE_URL` (`https://<progetto>.supabase.co`) e `SUPABASE_PUBLISHABLE_KEY`
   (la chiave **publishable** o **anon**, mai quella `secret` o `service_role`).
3. In Supabase → **Authentication → URL Configuration**: imposta l'indirizzo di
   GitHub Pages come **Site URL** e aggiungi ai redirect lo stesso indirizzo seguito
   da `#/settings` (serve al recupero password).
4. In Supabase → **Authentication → Sign In / Providers**: disattiva le nuove
   registrazioni. L'app non mostra più "Crea account": entra solo chi ha già l'utente.

## Database

Per un progetto Supabase nuovo si eseguono nel **SQL Editor**, in ordine, tutti i
file di `supabase/migrations/`. Su un database già in uso si eseguono solo quelli
nuovi: dalla versione con ChatGPT a questa serve solo
`012_categoria_sviluppo.sql`, che unisce le categorie dei clienti in "Sviluppo".
Ogni migrazione è una transazione: se qualcosa non torna, il database resta com'era.

## Sull'iPhone

Safari → apri l'indirizzo dell'app → **Condividi → Aggiungi alla schermata Home**.
L'app installata ha una memoria separata da Safari: dopo l'installazione bisogna
accedere di nuovo.

## Portare i dati da Forma (app separata)

1. Nella vecchia Forma: **Impostazioni → Esporta backup** (file JSON).
2. Qui: **Palestra e alimentazione → Preferenze → Ripristina backup** e scegli il file.
   I dati finiscono nell'archivio unico dell'app, sincronizzato tra i dispositivi.
