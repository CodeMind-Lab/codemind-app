import assert from 'node:assert/strict';
import { state } from '../dist/js/services/store.js?v=65';
import { defaultCategoryColors, categoryTextColor } from '../dist/js/utils/agenda.js?v=65';
import { loadAgendaColors, saveAgendaColors } from '../dist/js/services/agendaPreferences.js?v=65';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
state.mode = 'demo';
assert.deepEqual(loadAgendaColors(), defaultCategoryColors);
const custom = { ...defaultCategoryColors, study: '#FFFFFF' };
saveAgendaColors(custom);
assert.equal(loadAgendaColors().study, '#ffffff');
assert.equal(categoryTextColor('#ffffff'), '#0c2441');
assert.equal(categoryTextColor('#000000'), '#ffffff');
const before = storage.get('cm-agenda-colors:demo');
assert.throws(() => saveAgendaColors({ ...custom, study: 'red; background:url(x)' }));
assert.equal(storage.get('cm-agenda-colors:demo'), before);
state.mode = 'cloud'; state.user = { id: 'A' };
assert.deepEqual(loadAgendaColors(), defaultCategoryColors);
saveAgendaColors({ ...defaultCategoryColors, work: '#123456' });
state.user = { id: 'B' };
assert.deepEqual(loadAgendaColors(), defaultCategoryColors);
state.user = { id: 'A' };
assert.equal(loadAgendaColors().work, '#123456');
storage.set('cm-agenda-colors:user:A', '{broken');
assert.deepEqual(loadAgendaColors(), defaultCategoryColors);
storage.set('cm-agenda-colors:user:A', JSON.stringify({ work: '#abcdef', study: 'invalid', unexpected: '#111111' }));
assert.equal(loadAgendaColors().work, '#abcdef');
assert.equal(loadAgendaColors().study, defaultCategoryColors.study);

const luminance = color => {
  const rgb = [1,3,5].map(i => parseInt(color.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
for (const color of [...Object.values(defaultCategoryColors), '#ffffff', '#000000', '#777777', '#ffdd00']) {
  const a = luminance(color), b = luminance(categoryTextColor(color));
  assert((Math.max(a,b) + .05) / (Math.min(a,b) + .05) >= 4.5, color);
}
globalThis.localStorage.setItem = () => { throw Error('Storage blocked'); };
assert.throws(() => saveAgendaColors(custom), /dispositivo/);
console.log('PASS: brand defaults, custom colors, validation, invalid storage fallback, account isolation, readable text contrast and visible storage failure.');
