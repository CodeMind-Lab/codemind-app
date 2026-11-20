// Pagine-contenitore del nuovo menu (19/11/2026). Ogni sezione raccoglie le pagine
// che c'erano già, con una fila di schede in alto: le sezioni vere (Hotel, Sviluppo,
// Note) crescono qui sopra nei passi successivi senza cambiare gli indirizzi.

const schede = (attiva, voci) => `<nav class="schede-sezione" aria-label="Schede della sezione">${voci.map(([chiave, nome, href]) => `<a class="chip ${attiva === chiave ? 'on' : ''}" href="${href}" ${attiva === chiave ? 'aria-current="page"' : ''}>${nome}</a>`).join('')}</nav>`;

export const schedeSviluppo = attiva => schede(attiva, [['panoramica', 'Panoramica', '#/sviluppo'], ['clienti', 'Clienti', '#/sviluppo/clienti'], ['projects', 'Progetti', '#/projects'], ['tasks', 'Attività', '#/tasks'], ['preventivi', 'Preventivi', '#/sviluppo/preventivi'], ['formazione', 'Formazione AI', '#/sviluppo/formazione'], ['archive', 'Archivio', '#/archive']]);
export const schedeNote = attiva => schede(attiva, [['notes', 'Note', '#/notes'], ['daily-todos', 'To-do', '#/daily-todos']]);
