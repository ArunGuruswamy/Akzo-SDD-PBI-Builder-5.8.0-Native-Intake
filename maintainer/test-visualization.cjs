'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const V=require('./src/visualization.js');
const {metadata,state}=require('./fixtures/visualization.cjs');
const copy=value=>JSON.parse(JSON.stringify(value));

test('workflow report shows recorded branches, actors and source references without inventing order',()=>{
 const report=V.createReport('workflow',metadata,state);
 assert.match(report.html,/Existing Business Workflow/);
 assert.match(report.html,/An invalid measurement is rejected with a clear message/);
 assert.match(report.html,/The value is invalid/);
 assert.match(report.html,/Reject the save and show a clear message/);
 assert.match(report.html,/Operator/);
 assert.match(report.html,/Ordering between rules is not established/);
 assert.match(report.html,/<details class="rule" open/);
 assert.match(report.html,/Legacy\/Plugins\/MeasurementCreatePlugin\.cs/);
 assert.match(report.html,/source evidence/);
});

test('missing or incomplete evidence is NOT VERIFIED, never a missing implementation claim',()=>{
 const incomplete=copy(state);
 incomplete.evidence=incomplete.evidence.filter(e=>e.id!=='EV-CDMS');
 const report=V.renderHTML('impact',metadata,incomplete);
 assert.match(report,/NOT VERIFIED/);
 assert.doesNotMatch(report,/MISSING IMPLEMENTATION/i);
 assert.match(report,/Do not interpret this as an implementation gap/);
 const noLocation=copy(state);
 noLocation.evidence.find(e=>e.id==='EV-UI').location='';
 assert.match(V.renderHTML('workflow',metadata,noLocation),/EV-UI · NOT VERIFIED/);
});

test('impact map shows all repository boundaries, target roles, coverage and unknown relationships',()=>{
 const report=V.renderHTML('impact',metadata,state);
 for(const name of ['Custom (Legacy CRM/XRM)','CDMS','DAB (GraphQL)','Shared Angular UI'])assert.ok(report.includes(name),name);
 assert.match(report,/Read-only reference/);
 assert.match(report,/Implementation target/);
 assert.match(report,/proposed extend/);
 assert.match(report,/Branch coverage: COVERED/);
 assert.match(report,/Branch coverage: PARTIAL/);
 assert.match(report,/PARTIAL \(recorded matrix\)/);
 assert.match(report,/no repository-matched source evidence is recorded/);
 assert.match(report,/NOT VERIFIED — no evidence-backed dependency relationship is recorded/);
 assert.match(report,/DAB behavior corresponding to BR-1/);
 assert.match(report,/dependency evidence is not recorded/);
});

test('out-of-scope repositories are not reported as missing or proposed implementation',()=>{
 const outOfScope=copy(state);
 outOfScope.paths.dab.applies=false;
 const report=V.renderHTML('impact',metadata,outOfScope);
 assert.match(report,/NOT IN SCOPE/);
 const dabRow=report.match(/<tr><th>DAB \(GraphQL\) <small>\(dab\)<\/small>.*?<\/tr>/);
 assert.ok(dabRow);
 assert.doesNotMatch(dabRow[0],/proposed extend|EXISTING IMPLEMENTATION|relationship recorded/);

 const branchOutOfScope=copy(state);
 branchOutOfScope.rules[0].branches[0].dab='not-in-scope';
 assert.match(V.renderHTML('impact',metadata,branchOutOfScope),/Branch coverage: NOT IN SCOPE \(recorded matrix\)/);
});

test('acceptance trace links canonical criteria to rules, evidence and expected behavior',()=>{
 const report=V.renderHTML('traceability',metadata,state);
 assert.match(report,/Given an invalid measurement, when it is saved/);
 assert.match(report,/BR-1/);
 assert.match(report,/EV-CDMS/);
 assert.match(report,/Reject the save and show a clear message/);
 assert.match(report,/id="criterion-/);
 assert.match(report,/<details class="trace-card" open/);
});

test('untrusted PBI text is escaped and is never executed as HTML',()=>{
 const hostile=copy(state);
 hostile.rules[0].rule='<img src=x onerror=alert(1)>';
 hostile.evidence[0].source='</li><script>alert(1)</script><li>';
 hostile.evidence[0].summary='PRIVATE SOURCE EXCERPT';
 hostile.acceptanceCriteria[0].criterion='<svg onload=alert(1)>';
 const hostileMetadata={...metadata,title:'<iframe src=javascript:alert(1)>'};
 const report=V.renderHTML('complete',hostileMetadata,hostile);
 assert.match(report,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.match(report,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.match(report,/&lt;svg onload=alert\(1\)&gt;/);
 assert.match(report,/&lt;iframe src=javascript:alert\(1\)&gt;/);
 assert.doesNotMatch(report,/<script\b|<img\b|<svg\b|<iframe\b/i);
 assert.doesNotMatch(report,/PRIVATE SOURCE EXCERPT/);
});

test('standalone HTML works offline without scripts, remote assets or outbound links',()=>{
 const report=V.renderHTML('complete',metadata,state);
 assert.match(report,/Content-Security-Policy/);
 assert.match(report,/default-src 'none'/);
 assert.doesNotMatch(report,/<script\b|https?:\/\/|<link\b|<img\b/i);
 assert.match(report,/<details|<nav/);
 assert.doesNotMatch(report,/animation|@keyframes/);
 assert.ok(Buffer.byteLength(report)<30000,'fixture report stays lightweight');
});

test('report loading reads only local PBI metadata and state and leaves approval data unchanged',async()=>{
 const before=JSON.stringify({metadata,state});
 const calls=[];
 const report=await V.loadReport('complete',async path=>{
  calls.push(path);
  return path==='pbi.json'?JSON.stringify(metadata):JSON.stringify(state);
 });
 assert.deepEqual(calls,['pbi.json','pbi-state.json']);
 assert.equal(JSON.stringify({metadata,state}),before);
 assert.doesNotMatch(report.html,/HANDOFF-MANIFEST|Approve &amp; Generate/);
 assert.equal(V.approveAndGenerate,undefined);
});

test('optional visualization failures are explicit and do not write files',async()=>{
 const calls=[];
 await assert.rejects(V.loadReport('workflow',async path=>{
  calls.push(path);
  if(path==='pbi-state.json')throw Error('Local read denied');
  return JSON.stringify(metadata);
 }),/Visualization failed: Local read denied/);
 assert.deepEqual(calls,['pbi.json','pbi-state.json']);
});

test('browser action is manual, numbered, read-only and separate from approval handlers',()=>{
 const shell=fs.readFileSync(path.join(__dirname,'src/shell.html'),'utf8');
 const ui=fs.readFileSync(path.join(__dirname,'src/ui.js'),'utf8');
 assert.match(shell,/id="viewPbiArchitecture"[^>]*>View PBI Architecture/);
 assert.match(shell,/id="visualizationChoices" class="card hidden"/);
 for(const label of ['1. Existing Business Workflow','2. Repository Impact Map','3. Acceptance Criteria Traceability','4. Complete Visual Report'])assert.ok(shell.includes(label));
 assert.match(ui,/PBIVisualization\.loadReport\(view,name=>PBI\.read\(root,folder\+'\/'\+name\)\)/);
 const reportAction=ui.slice(ui.indexOf('async function createArchitectureReport'),ui.indexOf("action('visualizeWorkflow'"));
 assert.doesNotMatch(reportAction,/PBI\.(?:write|apply|plan|approveAndGenerate|exportHandoff)\(/);
});

test('invalid and duplicate records fail explicitly rather than producing success-shaped output',()=>{
 assert.throws(()=>V.createReport('workflow',metadata,{rules:'bad'}),/rules must be an array/);
 assert.throws(()=>V.createReport('workflow',metadata,{rules:[{id:'BR-1'},{id:'BR-1'}]}),/duplicate business rule ID/);
 assert.throws(()=>V.createReport('unknown',metadata,state),/supported architecture view/);
});
