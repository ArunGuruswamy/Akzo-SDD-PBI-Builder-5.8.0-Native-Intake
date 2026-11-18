'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const fsp=require('node:fs/promises'),os=require('node:os');
const P=require('./src/core.js');
const {DirectoryHandle}=require('./fixtures/fs-handles.cjs');
const assets=require('./test-assets.cjs');
const cfg=P.normalizeConfig({projectName:'Synthetic intake',ide:'both',role:'other',sources:{legacy:'Legacy',cdms:'CDMS',dab:'DAB',ui:'UI'}});
const data={number:'FIXTURE-1',title:'Validate a synthetic measurement',description:'Reject negative values with a clear message.',acMode:'draft'};

test('agent display names stay short and host-specific independently of project identity',()=>{
 for(const ide of ['vscode','visualstudio','both']){
  const projectName='A long repository name with spaces and a version 12345';
  const {config,files}=P.setupFiles({...cfg,ide,projectName},assets,'HTML');
  const agents=P.editorAgents(ide);
  assert.equal(Object.keys(files).filter(p=>p.endsWith('.agent.md')).length,Object.keys(agents).length);
  for(const [host,file]of Object.entries(agents)){
   const name=JSON.parse(/^name: (.*)$/m.exec(files[file])[1]);
   assert.equal(name,P.editorAgentName(host));assert.ok(name.length<=32);
   assert.ok(!name.includes(projectName));assert.ok(files[file].includes(projectName));
   assert.ok(files[file].includes('PBI Builder v'+P.VERSION));
  }
  assert.equal(config.projectName,projectName);
 }
});

test('all startup aliases route to one interactive module, not a bulk questionnaire',()=>{
 const files=P.setupFiles(cfg,assets,'HTML').files;
 const agent=files[P.AGENT],intake=files[P.BASE+'/skills/stage-intake.md'],prompt=files['.github/prompts/akzo-pbi-new.prompt.md'];
 assert.match(agent,/Start PBI \(also Create PBI, New PBI/);
 assert.match(prompt,/Read playbook\/pbi-builder\/skills\/stage-intake\.md/);
 assert.doesNotMatch(prompt+intake,/asked together in one message|Otherwise ask once, in one message|Start PBI\. In one message/);
 for(const part of ['PBI_NUMBER','TITLE','DESCRIPTION','ACCEPTANCE_CRITERIA','ATTACHMENTS','REVIEW','CONFIRMED'])assert.ok(intake.includes(part));
 assert.match(intake,/Only that explicit answer transitions to CONFIRMED and permits analysis/);
});

test('standalone review handoff bypasses PBI folder creation in both profiles',()=>{
 const files=P.setupFiles(cfg,assets,'HTML').files;
 for(const file of [P.AGENT,P.AGENT_VSCODE]){
  assert.match(files[file],/standalone review handoff document uses review-only[\s\S]*Do not create or synchronize a PBI folder/);
 }
});

test('host tool profiles include actual distinct question tools and an explicit fallback',()=>{
 const files=P.setupFiles(cfg,assets,'HTML').files;
 assert.match(files[P.AGENT],/^name: "AKZO PBI Builder \[Visual Studio\]"$/m);
 assert.match(files[P.AGENT_VSCODE],/^name: "AKZO PBI Builder"$/m);
 assert.match(files[P.AGENT],/If the active host is VS Code, stop before intake or repository actions/);
 assert.match(files[P.AGENT_VSCODE],/If the active host is Visual Studio, stop before intake or repository actions/);
 assert.match(files[P.AGENT],/^tools: .*"ask_question"/m);
 assert.doesNotMatch(files[P.AGENT],/^tools: .*"(?:code_search|find_references|vscode\/askQuestions)"/m);
 assert.match(files[P.AGENT_VSCODE],/^tools: .*"vscode\/askQuestions"/m);
 const intake=files[P.BASE+'/skills/stage-intake.md'].replace(/\s+/g,' ');
 assert.match(intake,/In VS Code, call vscode\/askQuestions for the earliest missing stage/);
 assert.match(intake,/exact pending field in chat/);
 assert.doesNotMatch(files[P.AGENT_VSCODE],/akzo_pbi_intake/);
 assert.match(files[P.AGENT_VSCODE],/do not retry or replay the pending stage/);
 assert.match(files[P.AGENT_VSCODE],/Ask only the exact pending field in chat/);
 assert.match(intake,/never fill a missing target automatically/);
 assert.match(intake,/A question tool is not a file picker/);
 assert.match(intake,/single-choice radio buttons, not a multi-select/);
 assert.match(intake,/PBI-Builder\.html#draft=/);
 assert.match(intake,/Require an explicit answer for each, and at least one Yes/);
 for(const [label,multi,count] of [['Source',false,4],['Target',true,3]]){
  const raw=new RegExp(label+' call arguments:\\n```json\\n([^\\n]+)\\n```').exec(files[P.BASE+'/skills/stage-intake.md'])[1];
  const question=JSON.parse(raw).questions[0];
  assert.equal(question.multiSelect,multi);assert.equal(question.allowFreeformInput,false);
  assert.equal(question.options.length,count);assert.ok(question.options.every(o=>!Object.hasOwn(o,'recommended')));
 }
 assert.match(intake,/instead of looping through the same question/);
});

test('VS Code USER_UNAVAILABLE preserves the stage and waits for a direct reply',()=>{
 const files=P.setupFiles(cfg,assets,'HTML').files;
 const intake=files[P.BASE+'/skills/stage-intake.md'];
 const vscode=files[P.AGENT_VSCODE];
 assert.match(intake,/USER_UNAVAILABLE is not an answer/);
 assert.match(intake,/Never automatically retry or replay the same question/);
 assert.match(vscode,/do not retry or replay the pending stage/);
 assert.match(intake,/A valid direct reply\s+to the pending question is sufficient to continue/);
 assert.doesNotMatch(vscode,/AKZO: Continue Confirmed PBI/);
 assert.match(vscode,/Ask only the exact pending field in chat/);
});

test('VS Code resumed confirmed intake uses the exact session and never repeats confirmed fields',()=>{
 const files=P.setupFiles(cfg,assets,'HTML').files;
 const vscode=files[P.AGENT_VSCODE];
 const intake=files[P.BASE+'/skills/stage-intake.md'];
 assert.match(intake,/Explicit Resume or\s+Continue restores only the identified saved intake/);
 assert.doesNotMatch(vscode,/readConfirmed|akzo_pbi_intake/);
 assert.match(intake,/Unique session ID/i);
 assert.match(intake,/Do not repeat completed fields/);
});

test('single source choices map to configured paths without relabelling modern sources as Legacy',()=>{
 assert.deepEqual(P.sourceOptions(cfg).map(o=>o.key),['legacy','cdms','dab','ui']);
 for(const key of ['legacy','cdms','dab','ui']){
  const result=P.newPbi(cfg,{...data,legacy:key,application:'cdms-only'});
  assert.equal(result.request.legacy.key,key);
  assert.equal(result.request.legacy.path,cfg.sources[key]);
  assert.equal(result.request.repositories.find(r=>r.key==='legacy').path,'Legacy');
  if(key!=='legacy')assert.ok(result.files[result.folder+'/REQUEST.md'].includes('Selected source repository'));
 }
 assert.throws(()=>P.newPbi(cfg,{...data,legacy:'unconfigured',application:'ui'}),/not configured/);
 const empty=P.normalizeConfig({...cfg,sources:{legacy:'Legacy'}});
 assert.equal(P.sourceOptions(empty).find(o=>o.key==='cdms').path,'');
 assert.throws(()=>P.newPbi(empty,{...data,legacy:'cdms',application:'ui'}),/not configured/);
});

test('details and exactly selected targets persist, optional criteria are proposed rather than invented',()=>{
 for(const areas of [['cdms'],['dab'],['ui'],['cdms','dab'],['cdms','ui'],['dab','ui'],['cdms','dab','ui']]){
  const result=P.newPbi(cfg,{...data,legacy:'legacy',application:P.targetOf(areas)});
  const saved=JSON.parse(result.files[result.folder+'/pbi.json']);
  assert.equal(saved.number,data.number);assert.equal(saved.title,data.title);assert.equal(saved.description,data.description);
  assert.deepEqual(saved.repositories.filter(r=>r.use==='implement').map(r=>r.key),areas);
  assert.equal(saved.acceptanceCriteriaMode,'draft');assert.equal(saved.acceptanceCriteria,'');
  assert.equal(saved.wizard.status,'ready-for-analysis');
  assert.doesNotMatch(Object.keys(result.files).join('\n'),/HANDOFF-MANIFEST|pbi-state\.json|DECISION-LOG/);
 }
 assert.equal(P.targetOf([]),'unsure');
 const draft=P.newPbi(cfg,{...data,draft:true});
 assert.equal(draft.request.application,'unsure');assert.equal(draft.request.wizard.status,'draft');
});

test('resume instructions use saved intake and corrections without repeating captured answers',()=>{
 const files=P.setupFiles(cfg,assets,'HTML').files,intake=files[P.BASE+'/skills/stage-intake.md'].replace(/\s+/g,' ');
 assert.match(intake,/Back edits only the previous captured field/);
 assert.match(intake,/Correction returns only to the selected step/);
 assert.match(intake,/On Resume, read these saved values and continue only the incomplete step/);
 const example=JSON.parse(/minimal early draft[\s\S]*?```json\n([\s\S]*?)\n```/.exec(files[P.BASE+'/skills/stage-intake.md'])[1]);
 const canonical=P.newPbi(cfg,{...data,draft:true,step:'Requirements'}).request;
 for(const key of Object.keys(example))assert.ok(Object.hasOwn(canonical,key),'native draft field must exist in the canonical intake: '+key);
 assert.deepEqual(example.wizard,{step:'Requirements',status:'draft'});
 assert.equal(example.application,'unsure');assert.equal(example.legacy,null);
 const original=P.newPbi(cfg,{...data,draft:true,step:'Development target'});
 const corrected=P.newPbi(cfg,{...data,title:'Corrected title',draft:true,folder:original.folder,legacy:'dab',application:'ui',step:'Review & start'});
 assert.equal(corrected.folder,original.folder);assert.equal(corrected.request.description,data.description);
 assert.equal(corrected.request.legacy.key,'dab');assert.equal(corrected.request.application,'ui');
});

test('same-version stale startup files require an explicit reviewed update, not agent reselection',async t=>{
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'akzo-intake-update-'));
 t.after(()=>fsp.rm(dir,{recursive:true,force:true}));
 const root=new DirectoryHandle(dir),current=P.setupFiles(cfg,assets,'HTML').files;
 const intake=P.BASE+'/skills/stage-intake.md',prompt='.github/prompts/akzo-pbi-new.prompt.md';
 const stale={...current,[intake]:'Start PBI needs these, asked together in one message.\n',
  [prompt]:'Start PBI. In one message, ask only for what is missing.\n',
  [P.AGENT_VSCODE]:current[P.AGENT_VSCODE].replace('## Interactive Copilot workflow','## Earlier chat workflow')};
 assert.notEqual(stale[P.AGENT_VSCODE],current[P.AGENT_VSCODE]);
 await P.apply(root,await P.plan(root,stale,true));
 const state='{"pbi":"KEEP","decisions":[],"approvals":{"user":null}}\n',statePath='playbook/pbis/keep/pbi-state.json';
 await P.write(root,statePath,state);
 const manifest=JSON.parse(await P.read(root,P.MANIFEST));
 assert.equal(manifest.packageVersion,P.VERSION,'version equality does not prove content equality');
 const rows=await P.plan(root,current,true);
 for(const name of [P.AGENT_VSCODE,intake,prompt])assert.equal(rows.find(r=>r.path===name).state,'update',name);
 await assert.rejects(P.apply(root,rows),/Review and allow updates/);
 assert.equal(await P.read(root,intake),stale[intake],'declined update cannot silently fix the installed copy');
 await P.apply(root,rows,true);
 for(const name of [P.AGENT_VSCODE,intake,prompt])assert.equal(await P.read(root,name),current[name]);
 assert.equal(await P.read(root,statePath),state,'startup update must preserve PBI state');
 await P.write(root,intake,'User-edited intake instructions\n');
 const conflict=await P.plan(root,current,true);
 assert.equal(conflict.find(r=>r.path===intake).state,'conflict','edited installed files require manual resolution');
});
