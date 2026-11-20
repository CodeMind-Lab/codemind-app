import fs from 'node:fs';
import assert from 'node:assert/strict';
const calls=[];
const bucket={
 upload: async (path,file,options)=>{calls.push({path,file,options});return {data:{path},error:null};},
 list: async ()=>({data:[],error:null}),
 download: async ()=>({data:new Blob(['example']),error:null}),
 remove: async ()=>({data:[],error:null})
};
globalThis.__attachmentTest={state:{mode:'cloud',user:{id:'owner'},projects:[{id:'project'}]},client:{storage:{from:()=>bucket}}};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
const source=fs.readFileSync('dist/js/services/attachmentsService.js','utf8').replace(/import \{ state \}[^;]+;/,"const state=globalThis.__attachmentTest.state;").replace(/import \{ getClient \}[^;]+;/,"const getClient=async()=>globalThis.__attachmentTest.client;");
const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const filename='Foto città (progetto) 📷.png';
await api.uploadAttachment('project',new File(['sample'],filename,{type:'image/png'}));
assert.match(calls[0].path,/^owner\/project\/[A-Za-z0-9_-]+$/);
assert.equal(api.fileName(calls[0].path.split('/').at(-1)),filename);
assert.equal(calls[0].options.upsert,false);
await assert.rejects(api.uploadAttachment('project',new File([], 'empty')),/vuoto/);
await assert.rejects(api.uploadAttachment('project',{size:api.MAX_FILE_SIZE+1}),/10 MB/);
await assert.rejects(api.uploadAttachment('missing',new File(['test'],'test')),/disponibile/);
await assert.rejects(api.downloadAttachment('project','../other'),/non valido/);
const taskId='11111111-1111-4111-8111-111111111111';
globalThis.__attachmentTest.state.tasks=[{id:taskId,project_id:'project'}];
await api.uploadAttachment('project',new File(['checklist'],'checklist.xlsx'),taskId);
const taskName=calls.at(-1).path.split('/').at(-1);
assert.equal(api.attachmentTask(taskName),taskId);
assert.equal(api.fileName(taskName),'checklist.xlsx');
assert.equal(api.attachmentTask(calls[0].path.split('/').at(-1)),null);
bucket.list=async()=>({data:[{id:'1',name:taskName,created_at:'2026-01-01'},{id:'2',name:calls[0].path.split('/').at(-1),created_at:'2026-01-01'}],error:null});
assert.equal((await api.listAttachments('project',taskId)).length,1);
assert.equal((await api.listAttachments('project')).length,2);
await assert.rejects(api.uploadAttachment('project',new File(['x'],'x'),'missing'),/Attività non disponibile/);
globalThis.__attachmentTest.state.mode='demo';
await assert.rejects(api.listAttachments('project'),/Collega Supabase/);
delete globalThis.__attachmentTest;
console.log('Attachment service: Unicode filenames, unique paths, size validation, project scope and demo guard OK');
