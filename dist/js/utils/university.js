const PREFIX='CODEMIND_UNIVERSITY_V1\n';
export const studyStatuses={planned:'Da iniziare',studying:'In studio',ready:'Da sostenere',passed:'Superato'};
export function universityData(project) {
  if(!project?.notes?.startsWith(PREFIX))return null;
  try {const data=JSON.parse(project.notes.slice(PREFIX.length));return data.kind==='university-subject'&&data.version===1?data:null;} catch{return null;}
}
export function universityNotes(project){return universityData(project)?.notes??project?.notes??'';}
export function encodeUniversity(data){return PREFIX+JSON.stringify({...data,kind:'university-subject',version:1});}
export function validateSubject(data){
 const d={...data};
 for(const key of ['institution','degree','academicYear','year','semester','professor','email','location','examMode','schedule','syllabus','books','notes','examDate','examTime','enrolmentDate','code']) d[key]=String(d[key]||'').trim();
 if(!Object.hasOwn(studyStatuses,d.studyStatus))throw Error('Scegli uno stato di studio valido.');
 d.credits=d.credits===''||d.credits==null?null:Number(d.credits);
 if(d.credits!==null&&(!Number.isFinite(d.credits)||d.credits<=0||d.credits>120))throw Error('Inserisci CFU maggiori di 0 e non superiori a 120.');
 d.grade=d.grade===''||d.grade==null?null:Number(d.grade);
 d.passFail=!!d.passFail;d.honours=!!d.honours;
 if(d.grade!==null&&(!Number.isInteger(d.grade)||d.grade<18||d.grade>30))throw Error('Il voto deve essere un intero tra 18 e 30.');
 if(d.honours&&d.grade!==30)throw Error('La lode può essere assegnata solo a un voto di 30.');
 if(d.passFail&&(d.grade!==null||d.honours))throw Error('Un’idoneità non prevede voto o lode.');
 if(d.studyStatus==='passed'&&d.grade===null&&!d.passFail)throw Error('Per un esame superato indica il voto oppure seleziona Idoneità.');
 if(d.studyStatus!=='passed'&&(d.grade!==null||d.honours||d.passFail))throw Error('Se registri un voto o un’idoneità, imposta lo stato su Superato.');
 if(d.enrolmentDate&&d.examDate&&d.enrolmentDate>d.examDate)throw Error('La scadenza di iscrizione non può essere successiva all’esame.');
 if(d.notes.length>20000||d.syllabus.length>12000||d.books.length>6000)throw Error('Accorcia gli appunti, il programma o la bibliografia.');
 return d;
}
export function universityStats(projects){
 const data=projects.map(universityData).filter(Boolean),passed=data.filter(d=>d.studyStatus==='passed');
 const graded=passed.filter(d=>!d.passFail&&Number.isInteger(d.grade)&&d.grade>=18&&d.grade<=30);
 const weighted=graded.filter(d=>Number(d.credits)>0),weight=weighted.reduce((s,d)=>s+Number(d.credits),0);
 return {subjects:data.length,passed:passed.length,credits:passed.reduce((s,d)=>s+(Number(d.credits)||0),0),totalCredits:data.reduce((s,d)=>s+(Number(d.credits)||0),0),mean:graded.length?graded.reduce((s,d)=>s+d.grade,0)/graded.length:null,weighted:weight?weighted.reduce((s,d)=>s+d.grade*Number(d.credits),0)/weight:null,honours:passed.filter(d=>d.honours).length,missingCredits:passed.filter(d=>!d.credits).length};
}

// Keep project and study destinations separate without migrating saved data.
export function workspaceProjects(projects, projectId = "") {
 const subject = !!universityData(projects.find(p => p.id === projectId));
 return projects.filter(p => !!universityData(p) === subject && (p.status !== "archived" || p.id === projectId));
}
