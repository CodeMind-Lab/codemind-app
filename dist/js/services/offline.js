// Avvio senza rete (soprattutto in palestra, dall'iPhone). Dopo ogni caricamento dal cloud
// si tiene sul dispositivo una copia di quello che serve a Palestra e alla giornata: turni,
// obiettivi della settimana, archivio di Forma. Se all'avvio il cloud non risponde, l'app
// riparte da questa copia; le modifiche di Palestra restano in attesa e partono al ritorno
// della rete (vedi palestraService.js). Le altre sezioni aspettano la connessione.
import { state } from './store.js?v=65';

const CHIAVE = id => 'cm-offline:' + id, ULTIMO = 'cm-offline-ultimo';
const CAMPI = ['profile', 'timezone', 'scheduleEntries', 'weeklyGoals', 'timeLogs', 'formaArchive', 'projects'];

export function salvaCopiaOffline() {
  if (state.mode !== 'cloud' || state.offline || !state.user?.id) return;
  try {
    const da = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
    const copia = Object.fromEntries(CAMPI.map(k => [k, state[k]]));
    copia.scheduleEntries = (state.scheduleEntries || []).filter(e => !e.entry_date || e.entry_date >= da);
    copia.timeLogs = (state.timeLogs || []).filter(l => !l.started_at || l.started_at.slice(0, 10) >= da);
    localStorage.setItem(CHIAVE(state.user.id), JSON.stringify({ salvata: new Date().toISOString(), ...copia }));
    localStorage.setItem(ULTIMO, JSON.stringify({ id: state.user.id, email: state.user.email || '' }));
  } catch { /* memoria piena: l'app funziona lo stesso, solo non offline */ }
}

// Utente dell'ultima apertura, per ripartire quando nemmeno la sessione si può rinnovare.
export function ultimoUtente() { try { return JSON.parse(localStorage.getItem(ULTIMO) || 'null'); } catch { return null; } }

export function ripristinaOffline(utente) {
  if (!utente?.id) return false;
  let copia;
  try { copia = JSON.parse(localStorage.getItem(CHIAVE(utente.id)) || 'null'); } catch { return false; }
  if (!copia) return false;
  for (const k of CAMPI) if (copia[k] !== undefined) state[k] = copia[k];
  state.user = { id: utente.id, email: utente.email || '' };
  state.mode = 'cloud';
  state.offline = copia.salvata;
  state.loaded = true;
  return true;
}
// Alla prima apertura dopo aver cambiato account la copia dell'altro utente non serve più.
export function dimenticaCopieAltrui(id) {
  try {
    const chiavi = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    for (const k of chiavi) if (k?.startsWith('cm-offline:') && k !== CHIAVE(id)) localStorage.removeItem(k);
  } catch { /* niente */ }
}
