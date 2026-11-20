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
state.formaArchive = { revision: 1, source_id: crypto.randomUUID(), archive: { version: 1, settings: { recDefault: 90 }, graves: {}, items: [
  { t: 'cfg', id: 'cfg', target: { kcal: 2300, kcalOff: 2000, prot: 150, carb: 260, gras: 70 }, updatedAt: ora_ms },
  { t: 's', id: 's1', n: 'Scheda A', giorni: [{ n: 'Push', eser: [{ n: 'Panca piana', serie: 4, rip: '8', peso: 62.5 }, { n: 'Spinte manubri inclinata', serie: 3, rip: '10', peso: 22 }, { n: 'Alzate laterali', serie: 3, rip: '12', peso: 8 }, { n: 'Dip', serie: 3, rip: '10' }, { n: 'French press', serie: 3, rip: '12', peso: 20 }, { n: 'Push-down', serie: 3, rip: '15' }] }], updatedAt: ora_ms },
  { t: 'pa', id: 'allena-' + gs, gs, sid: 's1', gn: 'Push', updatedAt: ora_ms },
  { t: 'l', id: 'l1', d: oggi, n: 'Colazione: yogurt, avena, frutta', q: 100, k: 420, p: 28, c: 50, g: 12, updatedAt: ora_ms },
  { t: 'l', id: 'l2', d: oggi, n: 'Pranzo: riso, pollo, verdure', q: 100, k: 780, p: 46, c: 85, g: 24, updatedAt: ora_ms },
  { t: 'l', id: 'l3', d: oggi, n: 'Spuntino: pane e bresaola', q: 100, k: 220, p: 18, c: 25, g: 8, updatedAt: ora_ms },
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
