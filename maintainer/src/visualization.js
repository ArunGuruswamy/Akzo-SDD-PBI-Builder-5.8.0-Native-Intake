(function (global) {
'use strict';

const VIEWS={
 workflow:'Existing Business Workflow',
 impact:'Repository Impact Map',
 traceability:'Acceptance Criteria Traceability',
 complete:'Complete Visual Report'
};
const DEFAULT_REPOSITORIES={legacy:'Legacy',cdms:'CDMS',dab:'DAB',ui:'Shared Angular UI'};
const STYLES=`.visual-report{max-width:1100px;margin:0 auto;padding:24px;color:#211d35;font:15px/1.55 Segoe UI,Arial,sans-serif}
.visual-report h1,.visual-report h2,.visual-report h3{line-height:1.25}
.visual-report header{padding:18px 22px;background:#211d35;color:#fff;border-radius:12px}
.visual-report header p{margin:5px 0;color:#e4def0}
.visual-report nav{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.visual-report nav a,.visual-report .evidence-link{color:#5236ab}
.visual-report section{margin:18px 0;padding:18px;background:#fff;border:1px solid #e3deed;border-radius:12px}
.visual-report .flow{display:grid;gap:14px}
.visual-report .rule,.visual-report .branch,.visual-report .repo-card,.visual-report .trace-card{padding:14px;border:1px solid #d8d1e5;border-radius:9px}
.visual-report .branches{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-top:12px}
.visual-report .branch:before{content:"↓";display:block;color:#5236ab;font-weight:700}
.visual-report .rule-title{font-weight:700;color:#5236ab}
.visual-report .status{font-weight:700}
.visual-report .not-verified{color:#8a4d00}
.visual-report .evidence-list{display:grid;gap:8px;padding-left:22px}
.visual-report .muted{color:#686276}
.visual-report table{width:100%;border-collapse:collapse}
.visual-report th,.visual-report td{text-align:left;vertical-align:top;padding:9px;border-bottom:1px solid #e3deed}
.visual-report details{margin:10px 0}
.visual-report summary{cursor:pointer;font-weight:700;color:#5236ab}
.visual-report .note{padding:10px 12px;background:#f6f2ff;border-left:3px solid #5236ab}
@media(max-width:680px){.visual-report{padding:10px}.visual-report section{padding:12px}.visual-report table{display:block;overflow-x:auto}}`;

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=(value,label)=>{if(value===undefined)return [];if(!Array.isArray(value))throw Error('Invalid PBI state: '+label+' must be an array.');return value;};
const text=value=>typeof value==='string'?value.trim():'';
const stableId=(prefix,id)=>prefix+'-'+Array.from(String(id)).map(c=>c.codePointAt(0).toString(16)).join('_');
const ids=value=>Array.isArray(value)?value.filter(id=>typeof id==='string'&&id.trim()):[];
const notVerified='NOT VERIFIED — no matching source evidence is recorded. Do not interpret this as an implementation gap.';
const outOfScopePath=path=>!!path&&((['not-applicable','not-in-scope'].includes(text(path.status).toLowerCase()))||path.applies===false);

function uniqueRecords(items,label){
 const seen=new Set();
 for(const item of items){
  if(!item||typeof item!=='object'||!text(item.id))throw Error('Invalid PBI state: '+label+' records need stable IDs.');
  if(seen.has(item.id))throw Error('Invalid PBI state: duplicate '+label+' ID '+item.id+'.');
  seen.add(item.id);
 }
 return items;
}
function verifiedSource(e){
 return !!e&&e.kind==='repo-file'&&e.stale!==true&&!['unverified','stale','invalid','failed','not verified'].includes(text(e.verification).toLowerCase())
  &&!!text(e.repository)&&!!text(e.source)&&!!text(e.location);
}
function createReport(view,metadata,state){
 if(!Object.prototype.hasOwnProperty.call(VIEWS,view))throw Error('Choose a supported architecture view.');
 if(!metadata||typeof metadata!=='object'||!state||typeof state!=='object')throw Error('PBI metadata and pbi-state.json are required.');
 const rules=uniqueRecords(list(state.rules,'rules'),'business rule');
 const criteria=uniqueRecords(list(state.acceptanceCriteria,'acceptanceCriteria'),'acceptance criterion');
 const evidence=uniqueRecords(list(state.evidence,'evidence'),'evidence');
 const actors=list(state.actors,'actors'),decisions=list(state.decisions,'decisions'),dependencies=list(state.dependencies,'dependencies');
 const evidenceById=new Map(evidence.map(e=>[e.id,e])),rulesById=new Map(rules.map(r=>[r.id,r]));
 const repositories=new Map();
 for(const r of list(metadata.repositories,'repositories')){
  if(r&&text(r.key))repositories.set(r.key,{label:text(r.area)||DEFAULT_REPOSITORIES[r.key]||r.key,use:text(r.use)||'unknown',path:text(r.path)});
 }
 const repoKeys=new Set([...Object.keys(DEFAULT_REPOSITORIES),...repositories.keys(),...Object.keys(state.paths||{}),...evidence.map(e=>text(e.repository)).filter(Boolean)]);
 for(const r of rules)for(const key of Object.keys(r.paths||{}))repoKeys.add(key);
 for(const key of repoKeys)if(!repositories.has(key))repositories.set(key,{label:DEFAULT_REPOSITORIES[key]||key,use:'unknown',path:''});
 const repoLabel=key=>repositories.get(key)?.label||DEFAULT_REPOSITORIES[key]||key||'Repository not recorded';
 const cited=(values,key)=>ids(values).map(id=>evidenceById.get(id)).filter(e=>verifiedSource(e)&&(!key||e.repository===key));
 const evidenceLinks=(values,key)=>{
  const refs=ids(values);
  if(!refs.length)return '<span class="status not-verified">'+esc(notVerified)+'</span>';
  return refs.map(id=>cited([id],key).length
   ?'<a class="evidence-link" href="#'+stableId('evidence',id)+'">'+esc(id)+' · '+esc(repoLabel(evidenceById.get(id).repository))+' · '+esc(evidenceById.get(id).source)+' — '+esc(evidenceById.get(id).location)+'</a>'
   :'<span class="not-verified">'+esc(id)+' · NOT VERIFIED</span>').join('; ');
 };
 const evidenceSummary=(rule,key)=>{
  const found=cited(rule.evidence,key);
  return found.length?'<span class="status">EXISTING IMPLEMENTATION · source evidence recorded ('+found.map(e=>'<a class="evidence-link" href="#'+stableId('evidence',e.id)+'">'+esc(e.id)+'</a>').join(', ')+')</span>':'<span class="status not-verified">'+esc(notVerified)+'</span>';
 };
 const branchEvidence=(branch,key)=>evidenceLinks(branch.evidence,key);
 const ruleText=rule=>esc(rule.rule||'(Business rule text not recorded)');
 const branchMarkup=rule=>{
  const branches=list(rule.branches||[],'business rule branches');
  if(!branches.length)return '<p class="not-verified">'+esc('NOT VERIFIED — no decision branch or workflow order is recorded; no sequence is inferred.')+'</p>';
  return '<div class="branches">'+branches.map(branch=>'<article class="branch"><strong>Decision / condition</strong><p>'+esc(branch.condition||'(Condition not recorded)')+'</p><strong>Expected behavior</strong><p>'+esc(branch.expected||'(Expected behavior not recorded)')+'</p><p><strong>Source evidence:</strong> '+branchEvidence(branch)+'</p></article>').join('')+'</div>';
 };
 const workflow=()=>{
  const actorMarkup=actors.length?'<h3>Actors and boundaries</h3><ul>'+actors.map(a=>'<li>'+esc(a&&a.role||a&&a.id||'Actor')+(a&&a.permissions?': '+esc(a.permissions):'')+'</li>').join('')+'</ul>':'';
  const decisionMarkup=decisions.length?'<h3>Recorded decisions and states</h3><ul>'+decisions.map(d=>'<li><strong>'+esc(d&&d.id||'Decision')+' · '+esc(d&&d.status||'status not recorded')+'</strong>: '+esc(d&&(d.decision||d.text)||'Decision text not recorded')+'</li>').join('')+'</ul>':'';
  return '<section id="existing-workflow"><h2>Existing Business Workflow</h2><p class="note">Rule-level flow from recorded conditions and outcomes. Ordering between rules is not established by this view. Evidence is shown as recorded and is not re-read or re-hashed here.</p>'+actorMarkup+decisionMarkup+'<div class="flow">'+(rules.length?rules.map(rule=>'<details class="rule" open id="'+stableId('rule',rule.id)+'"><summary class="rule-title">'+esc(rule.id)+' · '+ruleText(rule)+'</summary><p><strong>Decision status:</strong> '+esc(rule.decision||'Not recorded')+' · <strong>Target action:</strong> '+esc(rule.targetAction||'Not recorded')+'</p><p><strong>Business context:</strong> '+esc(rule.context||'Not recorded')+'</p>'+branchMarkup(rule)+'<p><strong>Rule source evidence:</strong> '+evidenceLinks(rule.evidence)+'</p></details>').join(''):'<p class="not-verified">'+esc('NOT VERIFIED — no business rules are recorded for this PBI.')+'</p>')+'</div></section>';
 };
 const impact=()=>{
  const rows=[...repoKeys].sort().map(key=>{
   const repo=repositories.get(key),isOut=!!(state.paths&&state.paths[key]&&state.paths[key].applies===false);
   const existing=rules.filter(r=>!outOfScopePath(r.paths&&r.paths[key])).map(r=>evidenceSummary(r,key)).filter(x=>!x.includes(notVerified));
   const proposals=rules.filter(r=>repo.use==='implement'&&state.paths?.[key]?.applies!==false&&!outOfScopePath(r.paths&&r.paths[key])&&['implement','extend'].includes(text(r.targetAction).toLowerCase())).map(r=>'<div>'+esc(r.id)+' · proposed '+esc(r.targetAction)+'</div>');
   const relations=rules.map(r=>{
    const path=r.paths&&r.paths[key];
    if(outOfScopePath(path))return '';
    const refs=path&&cited(path.evidence,key);
    if(path&&(path.status||'').toLowerCase()==='reaches'&&refs&&refs.length)return '<div>'+esc(r.id)+' · relationship recorded ('+refs.map(e=>'<a class="evidence-link" href="#'+stableId('evidence',e.id)+'">'+esc(e.id)+'</a>').join(', ')+')</div>';
    return '';
   }).filter(Boolean);
   const outOfScope=repo.use==='reference'?'Reference only':isOut?'Not in scope':'';
   const scopeLabel=isOut?'NOT IN SCOPE':repo.use==='implement'?'Implementation target':repo.use==='reference'?'Read-only reference':'Role not recorded';
   const noScope='<span class="muted">NOT IN SCOPE</span>';
   return '<tr><th>'+esc(repo.label)+' <small>('+esc(key)+')</small></th><td>'+esc(scopeLabel)+'</td><td>'+(isOut?noScope:existing.join('')||'<span class="not-verified">'+esc(notVerified)+'</span>')+'</td><td>'+(isOut?noScope:proposals.join('')||'<span class="muted">No proposed change is recorded for this repository.</span>')+'</td><td>'+(isOut?noScope:relations.join('')||'<span class="not-verified">NOT VERIFIED — no evidence-backed dependency relationship is recorded.</span>')+'</td></tr>';
  }).join('');
  const ruleMap='<h3>Legacy-to-modern rule map</h3><table><thead><tr><th>Business rule</th>'+[...repoKeys].sort().map(key=>'<th>'+esc(repoLabel(key))+'</th>').join('')+'</tr></thead><tbody>'+rules.map(rule=>'<tr><th>'+esc(rule.id)+' · '+ruleText(rule)+'</th>'+[...repoKeys].sort().map(key=>{
   const path=rule.paths&&rule.paths[key],scope=outOfScopePath(path)||state.paths&&state.paths[key]&&state.paths[key].applies===false;
   const cell=scope?'<span class="muted">NOT IN SCOPE</span>':evidenceSummary(rule,key);
   const branchRows=list(rule.branches||[],'business rule branches').map(branch=>{
    if(scope)return '<small class="muted">NOT IN SCOPE</small>';
    const coverage=text(branch[key]);
    if(!coverage)return '<small class="not-verified">Branch coverage: NOT VERIFIED</small>';
    if(['not-applicable','not-in-scope'].includes(coverage.toLowerCase()))return '<small class="muted">Branch coverage: NOT IN SCOPE (recorded matrix)</small>';
   const citedBranch=cited(branch.evidence,key);
   return '<small>Branch coverage: '+esc(coverage.toUpperCase())+' (recorded matrix) · '+(citedBranch.length?'repository-matched evidence: '+branchEvidence(branch,key):'<span class="not-verified">NOT VERIFIED — no repository-matched source evidence is recorded.</span>')+'</small>';
   }).join('<br>');
   return '<td>'+cell+(branchRows?'<br>'+branchRows:'')+'</td>';
  }).join('')+'</tr>').join('')+'</tbody></table>';
  const depMarkup=dependencies.length?'<ul>'+dependencies.map(d=>{
   const item=d&&typeof d==='object'?d:{},desc=text(item.description||item.name||item.id)||(typeof d==='string'?d:'Dependency');
   const found=cited(item.evidence);
   return '<li>'+esc(desc)+' · '+(found.length?'evidence recorded: '+found.map(e=>'<a class="evidence-link" href="#'+stableId('evidence',e.id)+'">'+esc(e.id)+'</a>').join(', '):'<span class="not-verified">NOT VERIFIED — dependency evidence is not recorded.</span>')+'</li>';
  }).join('')+'</ul>':'<p class="not-verified">NOT VERIFIED — no dependency records are present. Unrecorded dependencies are not ruled out.</p>';
  return '<section id="repository-impact"><h2>Repository Impact Map</h2><p class="note">Scope comes from pbi.json repository roles; implementation and branch relationships come from pbi-state.json. Unlocated evidence is never classified as an implementation gap.</p>'+ruleMap+'<h3>Impact and dependencies</h3><table><thead><tr><th>Repository</th><th>Scope</th><th>Existing implementation</th><th>Proposed changes</th><th>Verified dependencies</th></tr></thead><tbody>'+rows+'</tbody></table><h3>Unknown dependencies</h3>'+depMarkup+'</section>';
 };
 const traceability=()=>{
  return '<section id="acceptance-traceability"><h2>Acceptance Criteria Traceability</h2><div class="flow">'+(criteria.length?criteria.map(ac=>{
   const linked=ids(ac.rules),foundRules=linked.map(id=>rulesById.get(id)).filter(Boolean);
   const missing=linked.filter(id=>!rulesById.has(id));
   const ruleMarkup=linked.length?linked.map(id=>rulesById.has(id)?'<li><a href="#'+stableId('rule',id)+'">'+esc(id)+'</a> · '+ruleText(rulesById.get(id))+'</li>':'<li class="not-verified">'+esc(id)+' · NOT VERIFIED — referenced business rule is not recorded.</li>').join(''):'<li class="not-verified">NOT VERIFIED — no business rule is linked.</li>';
   const evIds=foundRules.flatMap(r=>ids(r.evidence));
   const expected=foundRules.flatMap(r=>list(r.branches||[],'business rule branches').filter(b=>ids(b.acceptance).includes(ac.id)).map(b=>b.expected).filter(Boolean));
   return '<details class="trace-card" open id="'+stableId('criterion',ac.id)+'"><summary>'+esc(ac.id)+' · '+esc(ac.type||'Acceptance criterion')+'</summary><p><strong>Acceptance criterion:</strong> '+esc(ac.criterion||'(Criterion text not recorded)')+'</p><p><strong>Business rule:</strong></p><ul>'+ruleMarkup+'</ul><p><strong>Source evidence:</strong> '+(evIds.length?evidenceLinks([...new Set(evIds)]):'<span class="not-verified">NOT VERIFIED — linked rule source evidence is not recorded.</span>')+'</p><p><strong>Expected behavior:</strong> '+(expected.length?expected.map(esc).join('; '):'<span class="muted">Canonical acceptance criterion: '+esc(ac.criterion||'Not recorded')+'</span>')+'</p>'+(missing.length?'<p class="not-verified">'+esc(notVerified)+'</p>':'')+'</details>';
  }).join(''):'<p class="not-verified">NOT VERIFIED — no acceptance criteria are recorded for this PBI.</p>')+'</div></section>';
 };
 const allEvidence=()=>{
  return '<section id="source-evidence"><h2>Source Evidence</h2><p class="muted">Source excerpts are intentionally omitted. References are identifiers, repository keys, paths and symbols/locations recorded in the PBI state.</p><ol class="evidence-list">'+(evidence.length?evidence.map(e=>'<li id="'+stableId('evidence',e.id)+'"><strong>'+esc(e.id)+' · '+esc(repoLabel(e.repository))+'</strong><br><span class="'+(verifiedSource(e)?'status':'status not-verified')+'">'+(verifiedSource(e)?'SOURCE REFERENCE RECORDED':'NOT VERIFIED')+'</span><br>'+esc(e.source||'(source path not recorded)')+' — '+esc(e.location||'(symbol/location not recorded)')+'</li>').join(''):'<li class="not-verified">NOT VERIFIED — no source evidence records are present.</li>')+'</ol></section>';
 };
 const parts=[];
 if(view==='workflow'||view==='complete')parts.push({id:'existing-workflow',title:'Existing Business Workflow',html:workflow()});
 if(view==='impact'||view==='complete')parts.push({id:'repository-impact',title:'Repository Impact Map',html:impact()});
 if(view==='traceability'||view==='complete')parts.push({id:'acceptance-traceability',title:'Acceptance Criteria Traceability',html:traceability()});
 parts.push({id:'source-evidence',title:'Source Evidence',html:allEvidence()});
 const nav=parts.map((part,i)=>'<a href="#'+part.id+'">'+(i+1)+'. '+esc(part.title)+'</a>').join('');
 const title=VIEWS[view],pbiName=[metadata.number,metadata.title].filter(Boolean).map(esc).join(' · ')||esc(metadata.pbi||state.pbi||'PBI');
 const fragment='<main class="visual-report"><header><h1>'+esc(title)+'</h1><p>'+pbiName+'</p><p>PBI state: '+esc(state.status||'Not recorded')+'</p></header><nav aria-label="Report sections">'+nav+'</nav>'+parts.map(part=>part.html).join('')+'</main>';
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'"><title>'+esc(title)+' · '+pbiName+'</title><style>'+STYLES+'</style></head><body>'+fragment+'</body></html>';
 const filename='PBI-architecture-'+String(metadata.number||metadata.title||'report').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)+'.html';
 return {html,fragment,filename,title};
}
async function loadReport(view,readFile){
 try{
  if(typeof readFile!=='function')throw Error('PBI file reader is unavailable.');
  const [metadataText,stateText]=await Promise.all([readFile('pbi.json'),readFile('pbi-state.json')]);
  if(typeof metadataText!=='string'||typeof stateText!=='string')throw Error('This PBI needs pbi.json and pbi-state.json before a visualization can be generated.');
  return createReport(view,JSON.parse(metadataText),JSON.parse(stateText));
 }catch(error){throw new Error('Visualization failed: '+(error&&error.message?error.message:String(error)));}
}

const api={VIEWS,STYLES,createReport,loadReport,renderHTML:(view,metadata,state)=>createReport(view,metadata,state).html};
global.PBIVisualization=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
