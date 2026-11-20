import fs from 'node:fs';import path from 'node:path';
// Retain the original editor. Adapt hosting only; do not copy any runtime archive.
const source=path.resolve('../Tracking-sportivo'),target=path.resolve('dist/forma');
for(const file of ['data.js','importa.js','scanner.js','app.js','app.css','forma-model.js','font/inter-var.woff2','icons/icon-192-v3.png']){
 fs.mkdirSync(path.dirname(path.join(target,file)),{recursive:true});fs.copyFileSync(path.join(source,file),path.join(target,file));
}
let html=fs.readFileSync(path.join(source,'index.html'),'utf8');
html=html.replace('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">','<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
html=html.replace(/<link rel="(?:manifest|apple-touch-icon|icon)"[^>]+>\n/g,'');
html=html.replace('<link rel="stylesheet" href="app.css">','<link rel="stylesheet" href="app.css"><link rel="stylesheet" href="projects.css"><script>globalThis.FORMA_PROJECTS_HOST=true;</script>');
html=html.replace('<script src="sync.js"></script>','<script>const Sync={schedule(){},signedIn(){return false},panel(){return \'<div class="panel"><div class="label">Collegato a Projects</div><p>Le modifiche si salvano sul tuo account Projects. I turni si modificano nella scheda Turni.</p></div>\'}};</script>');
html=html.replace('<script src="codemind-bridge.js"></script>','').replace('<script src="codemind-workspace.js"></script>','<script src="projects-host.js"></script>');
// Technical infrastructure belongs to the Projects account; retain content, preferences and backup controls.
let app=fs.readFileSync(path.join(target,'app.js'),'utf8');
const pushStart=app.indexOf('  h += `<div class="panel"><div class="label">Notifiche push</div>');
const pushEnd=app.indexOf('  h += `<div class="panel"><div class="label">Recupero fra le serie</div>',pushStart);
if(pushStart<0||pushEnd<0)throw Error('Forma settings layout changed; review the hosting adaptation.');
app=app.slice(0,pushStart)+app.slice(pushEnd);
fs.writeFileSync(path.join(target,'app.js'),app);fs.writeFileSync(path.join(target,'index.html'),html);
