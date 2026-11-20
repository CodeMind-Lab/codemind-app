import { state } from './store.js?v=65';
import { categories, categoryColors, defaultCategoryColors } from '../utils/agenda.js?v=65';

const key = () => `cm-agenda-colors:${state.mode === 'cloud' ? `user:${state.user?.id || 'signed-out'}` : state.mode}`;
const validColor = color => /^#[0-9a-f]{6}$/i.test(color);

export function loadAgendaColors() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key()) || '{}'); } catch { saved = {}; }
  Object.assign(categoryColors, defaultCategoryColors);
  if (saved && typeof saved === 'object') for (const category of Object.keys(categories)) {
    if (typeof saved[category] === 'string' && validColor(saved[category])) categoryColors[category] = saved[category].toLowerCase();
  }
  return { ...categoryColors };
}

export function saveAgendaColors(values) {
  const colors = Object.fromEntries(Object.keys(categories).map(category => {
    if (typeof values[category] !== 'string' || !validColor(values[category])) throw Error('Scegli un colore valido per ogni categoria.');
    return [category, values[category].toLowerCase()];
  }));
  try { localStorage.setItem(key(), JSON.stringify(colors)); }
  catch { throw Error('Non riesco a salvare i colori su questo dispositivo.'); }
  Object.assign(categoryColors, colors);
}
