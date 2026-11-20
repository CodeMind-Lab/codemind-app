// Dati FINTI per guardare l'app in locale senza toccare l'account vero.
// Si incolla nella console (o si lancia dal pannello Browser) su http://localhost:4174/dist/
// e riempie la memoria della pagina: niente viene salvato né mandato a Supabase.
// Le date partono da "oggi" (giorno del computer), così la pagina Oggi ha sempre qualcosa.
const v = '?v=65';
const { state } = await import('/dist/js/services/store.js' + v);
const { shiftValues, commuteValues } = await import('/dist/js/utils/workShifts.js' + v);
const { toInstant, weekStart } = await import('/dist/js/utils/agenda.js' + v);
const { today, shiftDate } = await import('/dist/js/utils/dates.js' + v);
const { render } = await import('/dist/js/app.js?v=68');
const tz = 'Europe/Rome', oggi = today(tz), lun = weekStart(oggi);
const id = () => crypto.randomUUID();
const ora = (d, h) => toInstant(`${d}T${h}`, tz);

state.projects = [
  { id: 'p-forma', name: 'Forma', status: 'active', color: '#1E8DBA', notes: '' },
  { id: 'p-dld', name: 'Studio Design', status: 'active', color: '#5B4BC4', notes: '' },
  { id: 'p-algo', name: 'Algoritmi e Strutture Dati', status: 'active', color: '#0B7FA6', notes: 'CODEMIND_UNIVERSITY_V1\n' + JSON.stringify({ kind: 'university-subject', version: 1, studyStatus: 'studying', credits: 9 }) },
];
state.tasks = [];
const voci = [];
const turni = ['apertura', 'apertura', 'off', 'chiusura', 'chiusura', 'notte', 'off'];
turni.forEach((preset, i) => {
  const d = shiftDate(lun, i);
  const t = { id: id(), ...shiftValues(d, { preset }, tz), category: 'work', planned_minutes: preset === 'off' ? 0 : 480, project_id: null, notes: preset === 'chiusura' ? 'Note di turno: 2 consegne dal collega del mattino' : '', is_completed: false };
  voci.push(t);
  if (t.kind === 'shift') for (const leg of ['outbound', 'return']) voci.push({ id: id(), ...commuteValues(t, leg, tz), is_completed: false, project_id: null, notes: '' });
});
const att = (d, da, a, title, category, extra = {}) => voci.push({ id: id(), title, category, kind: 'activity', entry_date: d, starts_at: ora(d, da), ends_at: ora(d, a), planned_minutes: 0, project_id: null, notes: '', is_completed: false, ...extra });
att(oggi, '09:30', '11:00', 'Studio · Algoritmi e Strutture Dati', 'study', { project_id: 'p-algo', is_completed: true, notes: 'Lezioni 9–10: liste e stack, esercizi' });
att(oggi, '11:15', '12:30', 'Sviluppo · Studio Design', 'dev', { project_id: 'p-dld', notes: 'Pagina prodotto: varianti e carrello' });
att(oggi, '13:30', '14:15', 'Palestra · Push', 'gym');
att(lun, '17:00', '18:30', 'Studio · Algoritmi', 'study', { project_id: 'p-algo', is_completed: true });
att(shiftDate(lun, 2), '09:30', '12:00', 'Studio · Algoritmi', 'study', { project_id: 'p-algo', is_completed: true });
att(shiftDate(lun, 2), '17:30', '18:45', 'Palestra', 'gym', { is_completed: true, sport_session_key: 'finto' });
voci.push({ id: id(), title: 'Chiamare il commercialista', category: 'personal', kind: 'activity', entry_date: oggi, starts_at: null, ends_at: null, planned_minutes: 15, project_id: null, notes: '', is_completed: false });
state.scheduleEntries = voci;
const fatti = voci.filter(v => v.category === 'study' && v.is_completed);
state.timeLogs = fatti.map(v => ({ id: id(), entry_id: v.id, started_at: v.starts_at, ended_at: v.ends_at }));
state.weeklyGoals = [
  { id: id(), title: 'Studio', week_start: lun, category: 'study', unit: 'minutes', target: 480, stretch_target: 480, project_id: null },
  { id: id(), title: 'Sviluppo · Studio Design', week_start: lun, category: 'dev', unit: 'minutes', target: 360, stretch_target: 360, project_id: 'p-dld' },
  { id: id(), title: 'Palestra', week_start: lun, category: 'gym', unit: 'sessions', target: 2, stretch_target: 3, project_id: null },
];
const gs = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'][(new Date(oggi + 'T12:00:00Z').getUTCDay() + 6) % 7];
const ora_ms = Date.now();
const ieri = shiftDate(oggi, -1), l = (d, slot, n, q, k, p, c, g) => ({ t: 'l', id: id(), d, slot, n, q, k, p, c, g, updatedAt: ora_ms });
state.formaArchive = { revision: 1, source_id: crypto.randomUUID(), archive: { version: 1, settings: { recDefault: 90 }, graves: {}, items: [
  { t: 'cfg', id: 'cfg', target: { kcal: 2000, kcalOff: 1900, prot: 130, carb: 200, gras: 65, acqua: 2500, passi: 8000, olio: 25 }, profilo: { nome: '', altezza: 178, pesoObiettivo: 75, giroObiettivo: 88 }, updatedAt: ora_ms },
  { t: 's', id: 's1', n: 'PPL 4 giorni', giorni: [{ n: 'Push A', eser: [{ n: 'Panca piana bilanciere', serie: 4, rip: '8–10', peso: 60 }, { n: 'Spinte manubri panca inclinata', serie: 3, rip: '10', peso: 22 }, { n: 'Croci ai cavi', serie: 3, rip: '12–15', peso: 12 }, { n: 'Military press', serie: 3, rip: '8', peso: 35 }, { n: 'Alzate laterali', serie: 3, rip: '15', peso: 8 }, { n: 'Push-down alla corda', serie: 3, rip: '12', peso: 25 }] }, { n: 'Pull A', eser: [{ n: 'Trazioni', serie: 4, rip: '6–8' }, { n: 'Rematore bilanciere', serie: 4, rip: '8', peso: 50 }] }], updatedAt: ora_ms },
  { t: 'pa', id: 'allena-' + gs, gs, sid: 's1', gn: 'Push A', updatedAt: ora_ms },
  { t: 'w', id: 'w1', d: shiftDate(oggi, -6), sid: 's1', sn: 'PPL 4 giorni', gn: 'Push A', fine: true, dur: 58, inizio: ora_ms - 6 * 864e5, eser: [], updatedAt: ora_ms },
  { t: 'w', id: 'w2', d: shiftDate(oggi, -2), sid: 's1', sn: 'PPL 4 giorni', gn: 'Pull A', fine: true, dur: 61, inizio: ora_ms - 2 * 864e5, eser: [], updatedAt: ora_ms },
  { t: 'gt', id: 'gt1', n: 'Giorno on', tipo: 'on', righe: [{ slot: 'spuntino2', n: 'Banana', q: 120, k: 65, p: 1.2, c: 15.4, g: 0.3 }, { slot: 'spuntino2', n: 'Parmigiano Reggiano', q: 20, k: 392, p: 33.5, c: 0, g: 28.1 }, { slot: 'cena', n: 'Salmone', q: 150, k: 185, p: 18.4, c: 1, g: 12 }, { slot: 'cena', n: 'Patate', q: 250, k: 85, p: 2.1, c: 18, g: 1 }, { slot: 'cena', n: 'Lattuga', q: 80, k: 19, p: 1.8, c: 2.2, g: 0.4 }], updatedAt: ora_ms },
  { t: 'p', id: 'piano-' + gs, gs, gt: 'gt1', updatedAt: ora_ms },
  { t: 'g', id: 'g-' + oggi, d: oggi, acqua: 1250, passi: 5430, updatedAt: ora_ms },
  { t: 'm', id: 'm1', d: shiftDate(oggi, -15), peso: 79, updatedAt: ora_ms }, { t: 'm', id: 'm2', d: shiftDate(oggi, -1), peso: 78.4, updatedAt: ora_ms },
  { t: 'a', id: 'a1', n: 'Skyr naturale · Exquisa', k: 63, p: 11, c: 4, g: 0.2, cat: 'Latticini/Uova', ean: '4019300005307', updatedAt: ora_ms },
  { t: 'r', id: 'r1', n: 'Bowl riso e tonno', righe: [{ n: 'Riso basmati', q: 80, k: 350, p: 7, c: 78, g: 0.6 }, { n: 'Tonno al naturale', q: 80, k: 103, p: 25, c: 0, g: 0.3 }], updatedAt: ora_ms },
  l(oggi, 'colazione', 'Yogurt greco 0% grassi', 170, 59, 10.3, 3.6, 0.4), l(oggi, 'colazione', "Fiocchi d'avena", 40, 372, 13.3, 66, 7), l(oggi, 'colazione', 'Mirtilli', 80, 45, 0.9, 10, 0.2),
  l(oggi, 'spuntino1', 'Mandorle', 18, 603, 22, 4.6, 55.3),
  l(oggi, 'pranzo', 'Petto di pollo', 150, 100, 23, 0, 1.2), l(oggi, 'pranzo', 'Riso basmati', 80, 350, 7, 78, 0.6), l(oggi, 'pranzo', 'Zucchine', 200, 11, 1.3, 1.4, 0.1), l(oggi, 'pranzo', 'Olio di oliva extra vergine', 10, 899, 0, 0, 99.9),
  l(ieri, 'pranzo', 'Pasta di semola', 90, 353, 12, 72, 1.5), l(ieri, 'cena', 'Merluzzo', 200, 71, 17, 0, 0.3), l(ieri, 'colazione', 'Skyr naturale · Exquisa', 150, 63, 11, 4, 0.2),
] } };
// Lavoro Hotel: contratto di prova (paga fissa con 13ª e 14ª), assenze, una busta paga.
const mesePrima = new Date(Date.UTC(Number(oggi.slice(0, 4)), Number(oggi.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10);
state.hotelContratto = { id: 'contratto', netto_mensile: 1500, lordo_mensile: null, mensilita_extra: [{ mese: 7, nome: '14ª' }, { mese: 12, nome: '13ª' }], ore_giornaliere: 8, ore_settimanali: 40, notte_inizio: '22:00', notte_fine: '06:00', ferie_giorni_anno: 26, permessi_ore_anno: 72, ferie_saldo_iniziale: 3, permessi_saldo_iniziale: 8, anno_saldo: Number(oggi.slice(0, 4)), note: '', updated_at: new Date().toISOString() };
state.hotelAssenze = [
  { id: id(), data: shiftDate(oggi, 3), tipo: 'ferie', ore: null, note: 'Ponte' },
  { id: id(), data: shiftDate(oggi, 4), tipo: 'ferie', ore: null, note: '' },
  { id: id(), data: shiftDate(oggi, -9), tipo: 'permesso', ore: 2, note: 'Visita medica' },
  { id: id(), data: oggi.slice(0, 5) + '02-10', tipo: 'malattia', ore: null, note: '' },
];
state.bustePaga = [{ id: id(), mese: mesePrima, netto: 1486.4, lordo: 1920, ore_pagate: 168, straordinari_pagati: 4, note: 'Trattenuta sindacale', updated_at: new Date().toISOString() }];
for (const v of state.scheduleEntries.filter(e => e.kind === 'shift' && e.entry_date <= oggi).slice(-3)) v.notes = 'Consegne: camera 214 late check-out, taxi alle 6:00 per la 108.';
// Lavoro Sviluppo: clienti, preventivi con incassi, formazione.
state.clienti = [
  { id: 'c-sd', nome: 'Studio Design', referente: 'Marco', email: 'info@example.com', telefono: '', sito: 'https://example.com', colore: '#5B4BC4', interno: false, archiviato: false, note: 'Shopify', updated_at: new Date().toISOString() },
  { id: 'c-bb', nome: 'B&B Esempio', referente: '', email: '', telefono: '', sito: '', colore: '#E2553C', interno: false, archiviato: false, note: '', updated_at: new Date().toISOString() },
  { id: 'c-mio', nome: 'Progetti miei', referente: '', email: '', telefono: '', sito: '', colore: '#0B1A2E', interno: true, archiviato: false, note: '', updated_at: new Date().toISOString() },
];
for (const p of state.projects) p.cliente_id = { 'p-dld': 'c-sd', 'p-forma': 'c-mio' }[p.id] || null;
state.preventivi = [
  { id: 'pr1', cliente_id: 'c-sd', project_id: 'p-dld', titolo: 'Shop Shopify · fase 2', importo: 1200, stato: 'accettato', data: shiftDate(oggi, -20), scadenza: shiftDate(oggi, 5), note: '', updated_at: new Date().toISOString() },
  { id: 'pr2', cliente_id: 'c-bb', project_id: null, titolo: 'Pagina prenotazioni', importo: 450, stato: 'accettato', data: shiftDate(oggi, -10), scadenza: null, note: '', updated_at: new Date().toISOString() },
  { id: 'pr3', cliente_id: 'c-bb', project_id: null, titolo: 'Restyling logo', importo: 250, stato: 'inviato', data: shiftDate(oggi, -3), scadenza: null, note: '', updated_at: new Date().toISOString() },
];
state.incassi = [{ id: id(), preventivo_id: 'pr1', data: shiftDate(oggi, -15), importo: 400, note: 'Acconto', updated_at: new Date().toISOString() }];
state.formazione = [
  { id: id(), titolo: 'RAG e ricerca vettoriale', tipo: 'corso', link: 'https://example.com/rag', stato: 'in_corso', ore_previste: 10, ore_fatte: 6, note: '', updated_at: new Date().toISOString() },
  { id: id(), titolo: 'Agenti con strumenti e MCP', tipo: 'documentazione', link: '', stato: 'da_fare', ore_previste: 4, ore_fatte: 0, note: '', updated_at: new Date().toISOString() },
];
state.lavoroError = '';
// Università: Algoritmi con 30 lezioni (intermedia fino alla 20), Machine Learning da iniziare.
const uni = (dati) => 'CODEMIND_UNIVERSITY_V1\n' + JSON.stringify({ kind: 'university-subject', version: 1, ...dati });
state.projects.find(p => p.id === 'p-algo').notes = uni({ studyStatus: 'studying', credits: 9, lezioniTotali: 30, intermediaFino: 20, professor: 'Docente del corso', syllabus: 'Algoritmi e pseudocodice\nComplessità\nListe, pile e code\nAlberi e grafi', examMode: 'Prova intermedia online e finale in presenza.' });
state.projects.push({ id: 'p-ml', name: 'Machine Learning e Artificial Intelligence', status: 'active', color: '#0B7FA6', notes: uni({ studyStatus: 'planned', credits: 9, lezioniTotali: 45, intermediaFino: 34 }) });
state.uniLezioni = Array.from({ length: 12 }, (_, i) => ({ id: id(), materia_id: 'p-algo', numero: i + 1, titolo: i === 0 ? 'Introduzione agli algoritmi' : '', seguita: true, data_seguita: shiftDate(oggi, -30 + i * 2), note: '', updated_at: new Date().toISOString() }));
state.uniPiano = [['1', 'Pseudocodice, cicli e funzioni', '1–2', 10, true], ['2', 'Ricerca in un array, potenze e logaritmi', '3, 7', 10, true], ['3', 'Ricorsione e Torre di Hanoi', '4', 10, true], ['4', 'Crescita delle funzioni', '5–6', 10, false]].map(([settimana, argomento, lezioni, ore, fatto], i) => ({ id: id(), materia_id: 'p-algo', posizione: i + 1, settimana, argomento, lezioni, ore, fatto, note: '', updated_at: new Date().toISOString() }));
state.uniAppelli = [{ id: id(), materia_id: 'p-algo', data: shiftDate(oggi, 25), ora: '10:00:00', prova: 'intermedia', modalita: 'online', iscrizione_entro: shiftDate(oggi, 4), iscritto: false, esito: '', punti: null, note: '', updated_at: new Date().toISOString() }, { id: id(), materia_id: 'p-ml', data: shiftDate(oggi, 53), ora: null, prova: 'finale', modalita: 'in presenza', iscrizione_entro: null, iscritto: true, esito: '', punti: null, note: '', updated_at: new Date().toISOString() }];
state.uniSimulazioni = [[-18, 14], [-11, 19], [-4, 17]].map(([g, c]) => ({ id: id(), materia_id: 'p-algo', data: shiftDate(oggi, g), prova: 'intermedia', domande: 24, corrette: c, minuti: 40, note: '', updated_at: new Date().toISOString() }));
state.uniErrori = [{ id: id(), materia_id: 'p-algo', lezione: 7, domanda: 'Complessità della ricerca binaria su un array ordinato', risposta: 'O(log n)', spiegazione: '', ripassi: 1, prossimo_ripasso: oggi, risolto: false, updated_at: new Date().toISOString() }, { id: id(), materia_id: 'p-algo', lezione: 4, domanda: 'Caso base nella ricorsione di Hanoi', risposta: 'n = 1: un solo spostamento', spiegazione: '', ripassi: 2, prossimo_ripasso: shiftDate(oggi, 5), risolto: false, updated_at: new Date().toISOString() }];
state.uniElaborati = [{ id: id(), materia_id: 'p-algo', titolo: 'Relazione sugli algoritmi di ordinamento', scadenza: shiftDate(oggi, 30), stato: 'in_corso', punti: null, link: '', note: '', updated_at: new Date().toISOString() }];
state.universitaError = '';
state.mode = 'cloud'; state.loaded = true; state.user = { id: 'prova', email: 'prova@esempio.it' }; state.agendaAvailable = true;
render();
'dati finti caricati';
