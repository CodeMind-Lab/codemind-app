import { pages } from '../router.js?v=65';
import { icon } from '../utils/helpers.js?v=65';
// Il menu deciso il 19/11/2026: tre gruppi più le Impostazioni in fondo.
const groups = [
  ['Giornata', ['dashboard', 'today']],
  ['Studio e lavoro', ['university', 'hotel', 'sviluppo']],
  ['Persona', ['sport', 'notes']],
  ['', ['settings']],
];
// Le pagine "figlie" accendono la voce della sezione a cui appartengono.
const parent = { projects: 'sviluppo', tasks: 'sviluppo', archive: 'sviluppo', 'daily-todos': 'notes' };
const icons = { dashboard: 'oggi', today: 'agenda', university: 'university', hotel: 'hotel', sviluppo: 'sviluppo', sport: 'sport', notes: 'notes', settings: 'settings' };
// Sul telefono la barra in basso tiene le quattro cose che si aprono in giro:
// il resto sta sotto "Altro".
const mobile = [['dashboard', 'Oggi', 'oggi', '#/dashboard'], ['today', 'Agenda', 'agenda', '#/today'], ['sport', 'Palestra', 'sport', '#/sport'], ['pasti', 'Pasti', 'pasti', '#/sport/cibo']];

export function navigation(page, id) {
  const current = parent[page] || page;
  const link = key => `<a class="nav-item ${current === key ? 'active' : ''}" href="#/${key}" title="${pages[key]}" ${current === key ? 'aria-current="page"' : ''}>${icon(icons[key])}<span class="nav-label">${pages[key]}</span></a>`;
  const desktop = groups.map(([label, keys], i) => `<div class="nav-group nav-group-${i}">${label ? `<span class="nav-group-label">${label}</span>` : ''}${keys.map(link).join('')}</div>`).join('');
  const mobileActive = key => key === 'pasti' ? page === 'sport' && id === 'cibo' : key === 'sport' ? page === 'sport' && id !== 'cibo' : current === key;
  const bar = `<div class="nav-mobile">${mobile.map(([key, label, ic, href]) => `<a class="nav-item ${mobileActive(key) ? 'active' : ''}" href="${href}">${icon(ic)}<span class="nav-label">${label}</span></a>`).join('')}<button id="navigation-more" class="nav-item nav-more" aria-expanded="false" aria-controls="navigation">${icon('altro')}<span class="nav-label">Altro</span></button></div>`;
  return desktop + bar;
}
