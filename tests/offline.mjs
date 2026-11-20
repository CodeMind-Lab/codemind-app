// Avvio senza rete: copia dell'ultima apertura salvata, ripristinata e legata all'utente.
import assert from 'node:assert/strict';
const memoria = new Map();
globalThis.localStorage = { getItem: k => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, String(v)), removeItem: k => memoria.delete(k), key: i => [...memoria.keys()][i], get length() { return memoria.size; } };
const { state } = await import('../dist/js/services/store.js?v=65');
const O = await import('../dist/js/services/offline.js?v=75');
const vecchio = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10), recente = new Date().toISOString().slice(0, 10);
Object.assign(state, { mode: 'cloud', offline: false, user: { id: 'u1', email: 'a@b.c' }, timezone: 'Europe/Rome', profile: { id: 'u1' }, projects: [{ id: 'p' }],
  scheduleEntries: [{ id: 'v', entry_date: vecchio }, { id: 'r', entry_date: recente }], weeklyGoals: [], timeLogs: [], formaArchive: { revision: 3, archive: { items: [{ id: 'cfg', t: 'cfg' }] } } });
O.salvaCopiaOffline();
assert.deepEqual(O.ultimoUtente(), { id: 'u1', email: 'a@b.c' });
Object.assign(state, { mode: 'signed_out', user: null, formaArchive: null, scheduleEntries: [], loaded: false });
assert.equal(O.ripristinaOffline({ id: 'altro' }), false); assert.equal(state.mode, 'signed_out');
assert.equal(O.ripristinaOffline(O.ultimoUtente()), true);
assert.equal(state.mode, 'cloud'); assert.ok(state.offline); assert.equal(state.loaded, true); assert.equal(state.formaArchive.revision, 3);
assert.deepEqual(state.scheduleEntries.map(e => e.id), ['r']);
// In modalità offline non si sovrascrive la copia con dati vecchi.
state.formaArchive = null; O.salvaCopiaOffline(); state.offline = false;
assert.equal(JSON.parse(memoria.get('cm-offline:u1')).formaArchive.revision, 3);
memoria.set('cm-offline:u2', '{}'); O.dimenticaCopieAltrui('u1'); assert.equal(memoria.has('cm-offline:u2'), false); assert.equal(memoria.has('cm-offline:u1'), true);
console.log('PASS: avvio offline — copia dell\'ultima apertura per utente, turni recenti, ripristino in sola lettura del cloud, niente sovrascritture offline, copie di altri account rimosse.');
