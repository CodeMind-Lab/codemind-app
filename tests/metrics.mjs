import assert from 'node:assert/strict';
import { completionCount,localISODate } from '../dist/js/utils/dates.js?v=65';
import { progress } from '../dist/js/utils/helpers.js?v=65';
import { state,activeTasks } from '../dist/js/services/store.js?v=65';
import { dashboard } from '../dist/js/modules/dashboard.js?v=65';
assert.equal(progress([]),0);
assert.equal(progress([{status:'completed'},{status:'todo'},{status:'testing'}]),33);
assert.equal(localISODate('2026-09-14T23:30:00Z','Europe/Rome'),'2026-09-15');
assert.equal(localISODate('invalid','Europe/Rome'),null);
const tasks=[
 {status:'completed',completed_at:'2026-09-14T08:00:00Z'},
 {status:'completed',completed_at:'2026-09-15T08:00:00Z'},
 {status:'todo',completed_at:'2026-09-14T08:00:00Z'},
 {status:'completed',completed_at:'invalid'}
];
assert.equal(completionCount(tasks,'2026-09-14','2026-09-14','Europe/Rome'),1);
state.projects=[{id:'a',name:'Active',status:'active'},{id:'b',name:'Archive',status:'archived'}];
state.tasks=[{id:'1',project_id:'a',status:'todo',due_date:'2000-01-01',priority:'urgent'}, {id:'2',project_id:'b',status:'completed'}, {id:'3',project_id:'missing',status:'todo'}];
assert.equal(activeTasks().length,1);
const html=dashboard();
assert(html.includes('0% del totale'));
assert(!html.includes('NaN'));
assert(!html.includes('undefined'));
console.log('PASS: zero/rounded progress, timezone boundaries, invalid/future completions excluded, archive/orphan filtering and empty dashboard formulas.');
