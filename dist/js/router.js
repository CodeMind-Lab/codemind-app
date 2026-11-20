// Titoli delle pagine. Le chiavi restano quelle storiche dell'indirizzo (#/today è
// l'Agenda, #/projects è Lavoro Sviluppo) così i collegamenti già salvati funzionano.
export const pages = {
  dashboard: 'Oggi', today: 'Agenda', university: 'Università', hotel: 'Lavoro Hotel',
  sviluppo: 'Lavoro Sviluppo', projects: 'Progetti', tasks: 'Attività', archive: 'Archivio',
  sport: 'Palestra e alimentazione', notes: 'Note e to-do', 'daily-todos': 'To-do',
  settings: 'Impostazioni',
};
export function route() {
  const [, requested = 'dashboard', id] = location.hash.split('/');
  const aliases = { agenda:'today', journal:'dashboard', calendar:'today', notebook:'daily-todos', statistics:'dashboard' };
  return {page: aliases[requested] || requested || 'dashboard', id};
}
