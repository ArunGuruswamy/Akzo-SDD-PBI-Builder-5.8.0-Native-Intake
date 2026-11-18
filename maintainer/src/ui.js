'use strict';
const $=id=>document.getElementById(id), assets=JSON.parse($('assets').textContent);
let root=null, config=null, originalHTML='', pbiItems=[], busy=false, currentArchitectureReport=null, sqlPendingAnalysis=null,
 analysisExtensionSnapshot=null,analysisExtensionSha=null,analysisExtensionFolder='',coordinatorSourceHandles=new Map();
function msg(s,error=false){$('message').textContent=s;$('message').classList.toggle('error',error);$('message').style.display='block';}
function clearArchitectureReport(hideChoices=true){currentArchitectureReport=null;$('visualizationPreview').classList.add('hidden');$('visualizationReport').replaceChildren();if(hideChoices)$('visualizationChoices').classList.add('hidden');}
function tab(name){for(const b of document.querySelectorAll('nav button'))b.setAttribute('aria-selected',String(b.dataset.tab===name));for(const p of document.querySelectorAll('.panel'))p.classList.toggle('active',p.id===name);}
for(const b of document.querySelectorAll('nav button'))b.onclick=()=>tab(b.dataset.tab);
async function runAction(fn){if(busy)return;busy=true;const buttons=[...document.querySelectorAll('button')];const prior=buttons.map(b=>b.disabled);buttons.forEach(b=>b.disabled=true);try{await fn();}catch(e){msg(e.name==='AbortError'?'Cancelled. No action was completed.':e.message,true);}finally{buttons.forEach((b,i)=>b.disabled=prior[i]||!!b.dataset.blocked);busy=false;}}
function action(id,fn){$(id).onclick=()=>runAction(fn);}
function coordinatorFolder(){return $('existingPbi').value||$('manualPbi').value.trim();}
function selectedAnalysisTask(){return analysisExtensionSnapshot?.specialistTasks.find(task=>task.taskId===$('analysisTask').value)||null;}
function clearPlanningDisplay(message){
 for(const id of ['planningParentId','planningParentTitle','planningParentDescription','planningParentAcceptanceCriteria','planningParentAttachments'])$(id).textContent='';
 $('planningImplementationChildren').replaceChildren();
 $('planningStatus').textContent=message;$('planningQualityStatus').textContent='Quality validation has not run yet.';$('planningSummary').textContent='';
}
async function renderPlanningDisplay(extension,parentData){
 const parent=parentData.parentPbi,planning=extension.planning;
 $('planningParentId').textContent=parent.pbiId;$('planningParentTitle').textContent=parent.title;
 $('planningParentDescription').textContent=parent.description||'Not supplied.';
 $('planningParentAcceptanceCriteria').textContent=parent.acceptanceCriteria||'Not supplied.';
 $('planningParentAttachments').textContent=parent.attachments.length?parent.attachments.map(item=>
  item.name+' · '+item.kind+' · '+item.location+(item.contentInspected?' · inspected':' · content not inspected')).join('\n'):'None.';
 if(!planning){$('planningStatus').textContent='Parent PBI loaded. Generate a plan after current Phase 04 analysis is consolidated.';
  $('planningQualityStatus').textContent='Quality validation has not run yet.';
  $('planningImplementationChildren').replaceChildren();
  $('planningSummary').textContent='Selected implementation targets: '+(parentData.selectedTargets.join(', ')||'none')+
   '\nNo planning record exists yet.';return;}
 const approvalCurrent=extension.packageApproval&&await PBI.phase01Contracts.isPackageApprovalCurrent(extension.packageApproval,extension),
  authorizationCurrent=extension.implementationAuthorization&&
   await PBI.phase01Contracts.isImplementationAuthorizationCurrent(extension.implementationAuthorization,extension),
  children=extension.analysisPackage.children,rows=planning.traceability.map(row=>
   row.criterionId+' · '+row.disposition+' · '+row.coverageStatus+
   (row.childIds.length?'\n  Children: '+row.childIds.join(', '):'')+
   (row.questionIds.length?'\n  Questions: '+row.questionIds.join(', '):''));
 const quality=extension.refinementQuality,qualityCurrent=quality&&await PBI.phase01Contracts.refinementQualityIsCurrent(extension);
 $('planningImplementationChildren').replaceChildren(...children.map(child=>{
  const option=new Option(child.title+' · '+child.targetRepository.toUpperCase()+' · '+child.provisionalChildId,child.provisionalChildId);
  option.selected=!!authorizationCurrent&&extension.implementationAuthorization.selectedChildIds.includes(child.provisionalChildId);
  return option;
 }));
 $('planningStatus').textContent='Planning status: '+planning.status+' · '+children.length+' provisional children · '+
  (approvalCurrent?'APPROVED':'NOT APPROVED')+' · Builder-native authorization: '+
  (authorizationCurrent?'BOUND · live source recheck required':'NOT GRANTED')+
  ' · handoff v1: UNSUPPORTED';
 $('planningQualityStatus').textContent=!quality?'Refinement quality: NOT VALIDATED · revalidate the plan before approval.':
  'Refinement quality: '+(qualityCurrent?'CURRENT':'STALE')+' · '+quality.score+'/100 · '+quality.readiness+
  ' · '+(quality.packageReadyForApproval?'approval candidate':'approval blocked')+
  ' · SDD implementation authorization: NOT PROVIDED';
 const childQuality=(quality?.children||[]).map(child=>child.childId+' · '+child.repository+' · '+child.score+'/100 · '+child.readiness+
  '\n  Refined child criteria:\n'+(child.refinedAcceptanceCriteria.map(item=>'- '+item.statement+' Expected: '+item.expectedOutcome+
   ' Tests: '+item.testScenarios.join('; ')).join('\n')||'- None; clarification required.')+
  '\n  Domain traceability: '+child.domainTraceability.map(row=>'CDMS '+row.cdms.length+', DAB '+row.dab.length+
   ', Angular '+row.angular.length+', GraphQL '+row.graphql.length+', SQL '+row.sql.length).join('; ')+
  (child.blockers.length?'\n  Blockers: '+child.blockers.join(' | '):'')).join('\n\n');
 $('planningSummary').textContent='Selected implementation targets: '+(planning.selectedTargets.join(', ')||'none')+
  '\nPackage revision: '+planning.packageManifest.packageRevision+
  '\nDependency graph: '+(planning.dependencyGraph.valid?'VALID':'BLOCKED')+
  '\nTraceability:\n'+(rows.join('\n')||'None.')+
  (planning.blockingReasons.length?'\nBlocking reasons:\n'+planning.blockingReasons.map(reason=>'• '+reason).join('\n'):'')+
  (quality?'\n\nQuality dimensions:\n'+quality.dimensions.map(item=>item.label+' · '+item.score+'/100 · weight '+item.weight+'%').join('\n')+
   (quality.blockers.length?'\nHard blockers:\n'+quality.blockers.map(item=>'• '+item.message).join('\n'):'')+
   (childQuality?'\n\nChild quality:\n'+childQuality:'')+
   (quality.recommendations.length?'\n\nRecommendations:\n'+quality.recommendations.map(item=>'• '+item).join('\n'):''):'')+
  '\n\nPackage approval is separate from explicit implementation authorization. Any authorization applies only to a Builder-native export; SDD handoff v1 remains unsupported.';
}
function renderCoordinatorQuestion(extension){
 const box=$('analysisClarification'),question=extension?.questions?.find(item=>item.blocking&&item.status==='pending');
 if(!question){box.classList.add('hidden');$('analysisQuestionText').textContent='';$('analysisQuestionOptions').textContent='';return;}
 box.classList.remove('hidden');$('analysisQuestionText').textContent=question.prompt;
 $('analysisQuestionOptions').textContent=question.options.length?question.options.map(option=>option.key+': '+option.label).join('\n'):'Free-text answer required.';
 $('analysisAnswer').value='';$('analysisQuestionReason').value='';box.dataset.questionId=question.questionId;box.dataset.questionType=question.type;
}
async function refreshCoordinatorDisplay(){
 const status=$('analysisCoordinatorStatus'),folder=coordinatorFolder();
 analysisExtensionSnapshot=null;analysisExtensionSha=null;analysisExtensionFolder=folder;
 $('analysisTask').replaceChildren(new Option(folder?'No Phase 04 tasks prepared':'Select a PBI first',''));
 $('analysisTaskList').replaceChildren();$('analysisReportDetails').classList.add('hidden');$('analysisReportText').textContent='';
 if(!root){status.textContent='Choose a project folder to load the Phase 04 coordinator.';renderCoordinatorQuestion(null);clearPlanningDisplay('Choose a project folder and PBI.');return;}
 if(!folder){status.textContent='Select an existing PBI to load its canonical rules, acceptance criteria and analysis extension.';renderCoordinatorQuestion(null);clearPlanningDisplay('Select an existing PBI.');return;}
 const loaded=await PBI.loadAnalysisExtension(root,folder,{required:false,allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true});
 if(!loaded){status.textContent='No analysis extension exists yet. Register source folders or link the installed SQL/GraphQL references first.';renderCoordinatorQuestion(null);
  if(await PBI.read(root,folder+'/pbi.json')===null)clearPlanningDisplay('Original pbi.json is unavailable; the Parent PBI cannot be displayed.');
  else{const parentData=await PBI.loadPlanningParentPbi(root,folder);await renderPlanningDisplay({planning:null},parentData);}return;}
 analysisExtensionSnapshot=loaded.extension;analysisExtensionSha=loaded.sha256;
 const tasks=[...loaded.extension.specialistTasks].filter(task=>task.schemaVersion===2).sort((a,b)=>a.taskId.localeCompare(b.taskId));
 for(const task of tasks)$('analysisTask').add(new Option(task.specialistType+' · '+task.requirementId+' / '+task.acceptanceCriterionId+' · '+task.lifecycleStatus,task.taskId));
 $('analysisTaskList').replaceChildren(...tasks.map(task=>{
  const card=document.createElement('section'),title=document.createElement('h4'),body=document.createElement('p');
  const stale=task.lifecycleStatus==='STALE'||task.parentCoordinatorRevision!==loaded.extension.coordinator?.inputRevision;
  title.textContent=task.specialistType+' · '+task.requirementId+' / '+task.acceptanceCriterionId;
  body.textContent=(stale?'STALE':task.lifecycleStatus)+' · revision '+task.taskRevision+
   (loaded.extension.specialistResults.some(result=>result.taskId===task.taskId)?' · result persisted':' · no result')+
   (task.executionMode==='MANUAL_EXPORT_IMPORT'?' · manual external execution only':'');
  card.append(title,body);return card;
 }));
 const report=loaded.extension.coordinator?.report;
 if(report){$('analysisReportDetails').classList.remove('hidden');$('analysisReportText').textContent=report.content;}
 const counts={};for(const task of tasks)counts[task.lifecycleStatus]=(counts[task.lifecycleStatus]||0)+1;
 status.textContent='PBI '+loaded.extension.parentPbiId+' · canonical revision '+loaded.extension.parentStateRevision+
  '\nCoordinator revision '+(loaded.extension.coordinator?.inputRevision||'not initialized')+' · '+tasks.length+' tasks'+
  (Object.keys(counts).length?'\n'+Object.entries(counts).map(([key,count])=>key+': '+count).join(' · '):'')+
  '\nSource-root access is session-only. Re-select roots after reload to verify imported evidence. No specialist agent was invoked by the Builder.';
 renderCoordinatorQuestion(loaded.extension);
 if(await PBI.read(root,folder+'/pbi.json')===null)clearPlanningDisplay('Original pbi.json is unavailable; Phase 05 planning is unavailable.');
 else{const parentData=await PBI.loadPlanningParentPbi(root,folder);await renderPlanningDisplay(loaded.extension,parentData);}
}
action('generateImplementationPlan',async()=>{
 needRoot();const folder=coordinatorFolder(),current=await PBI.loadAnalysisExtension(root,folder,{required:true,
  allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true});
 const result=await PBI.generateImplementationPlan(root,folder,{actorRole:'coordinator',expectedSha256:current.sha256,
  sourceHandles:coordinatorSourceHandles});
 await refreshCoordinatorDisplay();
 msg((result.unchanged?'Planning package is unchanged. ':'Planning package saved: ')+result.planning.status+
  ' · '+result.extension.analysisPackage.children.length+' provisional children. Approval does not authorize implementation.');
});
action('refreshRefinementQuality',async()=>{
 needRoot();const folder=coordinatorFolder(),current=await PBI.loadAnalysisExtension(root,folder,{required:true,
  allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true});
 if(!current.extension.planning)throw Error('Generate a planning package before revalidating refinement quality.');
 const result=await PBI.generateImplementationPlan(root,folder,{actorRole:'coordinator',expectedSha256:current.sha256,
  sourceHandles:coordinatorSourceHandles});
 await refreshCoordinatorDisplay();
 msg((result.unchanged?'Refinement quality is current. ':'Refinement quality was revalidated: ')+
  (result.extension.refinementQuality?.score??'not scored')+'/100 · '+(result.extension.refinementQuality?.readiness||'INCOMPLETE')+
  '. A quality score never authorizes development.');
});
action('refreshPlanningFreshness',async()=>{
 needRoot();const folder=coordinatorFolder(),current=await PBI.loadAnalysisExtension(root,folder,{required:true,
  allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true});
 const result=await PBI.refreshPlanningStatus(root,folder,{actorRole:'coordinator',expectedSha256:current.sha256,
  sourceHandles:coordinatorSourceHandles});
 await refreshCoordinatorDisplay();
 msg(result.planningFreshness.status==='NOT_GENERATED'?'No planning package exists yet.':
  'Planning evidence freshness: '+result.planningFreshness.status+
  (result.planningFreshness.errors.length?'\n'+result.planningFreshness.errors.join('\n'):''));
});
action('exportPlanningPackage',async()=>{
 needRoot();const exported=await PBI.exportPlanningPackage(root,coordinatorFolder(),{sourceHandles:coordinatorSourceHandles});
 download(new Blob([exported.json],{type:'application/json'}),exported.filename);
 msg('Exported the planning package ('+exported.package.packageStatus+'). Approval: '+exported.package.approvalStatus+
  '. Child handoff v1 remains unsupported; no work item or implementation was started.');
});
action('approvePlanningPackage',async()=>{
 needRoot();const requestedBy=$('planningRequestedBy').value.trim(),approvedBy=$('planningApprovedBy').value.trim(),
  evidence=$('planningApprovalEvidence').value.trim();
 if(!requestedBy||!approvedBy||!evidence)throw Error('Enter the requester, approver, and approval evidence.');
 if(!confirm('Record durable approval for this exact Parent/Child planning package? This does not authorize SDD implementation or child handoff.'))return msg('Cancelled. No planning approval was recorded.');
 const folder=coordinatorFolder(),current=await PBI.loadAnalysisExtension(root,folder,{required:true}),
  saved=await PBI.approvePlanningPackage(root,folder,{actorRole:'coordinator',expectedSha256:current.sha256,
   requestedBy,approvedBy,evidence,sourceHandles:coordinatorSourceHandles});
 await refreshCoordinatorDisplay();msg('Planning-package approval persisted for package revision '+
  saved.approval.packageRevision+'. This does not authorize implementation.');
});
action('authorizePlanningImplementation',async()=>{
 needRoot();const selectedChildIds=[...$('planningImplementationChildren').selectedOptions].map(option=>option.value).sort(),
  authorizedBy=$('implementationAuthorizedBy').value.trim(),evidence=$('implementationAuthorizationEvidence').value.trim();
 if(!selectedChildIds.length||!authorizedBy||!evidence)
  throw Error('Select one or more complete child PBIs and enter the authorizing person and evidence of explicit implementation intent.');
 if(!confirm('Authorize only these provisional child PBIs for Builder-native export?\n\n'+selectedChildIds.join('\n')+
  '\n\nThis does not create Azure DevOps work items, launch the installed SDD agent, or start implementation.'))
  return msg('Cancelled. No implementation authorization was recorded.');
 const folder=coordinatorFolder(),current=await PBI.loadAnalysisExtension(root,folder,{required:true}),
  saved=await PBI.authorizePlanningImplementation(root,folder,{actorRole:'coordinator',expectedSha256:current.sha256,
   selectedChildIds,authorizedBy,evidence,sourceHandles:coordinatorSourceHandles});
 await refreshCoordinatorDisplay();msg('Persisted Builder-native implementation authorization for '+
  saved.implementationAuthorization.selectedChildIds.length+' selected child PBI(s). SDD handoff remains unsupported.');
});
action('exportChildImplementationPackage',async()=>{
 needRoot();const selectedChildIds=[...$('planningImplementationChildren').selectedOptions].map(option=>option.value).sort();
 if(!confirm('Export only the selected, explicitly authorized child PBIs in the Builder-native format? This does not launch the SDD agent or create work items.'))
  return msg('Cancelled. No child package was exported.');
 const exported=await PBI.exportChildImplementationPackage(root,coordinatorFolder(),{
  sourceHandles:coordinatorSourceHandles,selectedChildIds
 });
 download(new Blob([exported.json],{type:'application/json'}),exported.filename);
 msg('Exported the validated Builder-native child package. SDD handoff v1 remains unsupported; no work item or implementation was started.');
});
action('authorizeSddHandoff',async()=>{
 needRoot();const authorizedBy=$('sddHandoffAuthorizedBy').value.trim(),evidence=$('sddHandoffAuthorizationEvidence').value.trim();
 if(!authorizedBy||!evidence)throw Error('Enter the handoff authorizing person and evidence of explicit SDD handoff intent.');
 if(!confirm('Authorize export of the currently approved and selected child package to the SDD Agent? This does not authorize code edits.'))
  return msg('Cancelled. No SDD handoff authorization was recorded.');
 const folder=coordinatorFolder(),current=await PBI.loadAnalysisExtension(root,folder,{required:true}),
  saved=await PBI.authorizeSddHandoff(root,folder,{actorRole:'coordinator',expectedSha256:current.sha256,
   authorizedBy,evidence,sourceHandles:coordinatorSourceHandles});
 await refreshCoordinatorDisplay();$('sddHandoffStatus').textContent='Handoff authorization persisted for package revision '+
  saved.extension.sddHandoffAuthorization.packageRevision+'. Code edits remain unauthorized.';
 msg('Explicit SDD handoff authorization persisted. It does not authorize code edits.');
});
action('exportSddHandoffPackage',async()=>{
 needRoot();
 if(!confirm('Export the current SDD child handoff v2 package? The Agent importer will not modify application code.'))
  return msg('Cancelled. No SDD handoff package was exported.');
 const exported=await PBI.exportSddHandoffPackage(root,coordinatorFolder(),{sourceHandles:coordinatorSourceHandles});
 download(new Blob([exported.json],{type:'application/json'}),exported.filename);
 $('sddHandoffStatus').textContent='Exported handoff v2 · '+exported.payload.packageId+' · '+exported.package.packageFingerprint;
 msg('Exported SDD child handoff v2. The package is integrity-bound, not digitally signed; Agent import and G4 code-edit approval remain separate.');
});
action('importSddResult',async()=>{
 needRoot();const selected=$('sddResultFile').files?.[0];
 if(!selected)throw Error('Select one structured Agent result JSON file.');
 const resultText=await selected.text(),current=await PBI.loadAnalysisExtension(root,coordinatorFolder(),{required:true}),
  imported=await PBI.importSddResult(root,coordinatorFolder(),resultText,{actorRole:'coordinator',expectedSha256:current.sha256});
 if(imported.status==='DUPLICATE'){$('sddHandoffStatus').textContent='Duplicate result already imported · '+imported.result.childId;return msg('This exact Agent result was already imported.');}
 await refreshCoordinatorDisplay();
 $('sddHandoffStatus').textContent='Imported '+imported.result.executionStatus+' result for '+imported.result.childId+
  ' · '+imported.result.resultFingerprint;
 msg('Validated and imported the structured Agent result. The original Parent PBI and approved planning package were not rewritten.');
});
action('registerAnalysisSourceRoot',async()=>{
 needRoot();const folder=selectedPbi();
 if(!window.showDirectoryPicker)throw Error('Read-only source-folder selection is unavailable in this browser.');
 const sourceHandle=await window.showDirectoryPicker({mode:'read'}),current=await PBI.loadAnalysisExtension(root,folder,{required:false,
  allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true});
 const saved=await PBI.registerAnalysisSourceRoot(root,folder,{repositoryKey:$('analysisSourceRepository').value,sourceHandle,
  actorRole:'coordinator',expectedSha256:current?.sha256||null});
 coordinatorSourceHandles.set(saved.sourceRoot.rootId,sourceHandle);
 await refreshCoordinatorDisplay();msg((saved.unchanged?'Source snapshot already registered: ':'Registered read-only source snapshot: ')+
  saved.sourceRoot.repositoryKey+' @ '+saved.sourceRoot.revision+'. The folder contents were not modified.');
});
action('prepareSpecialistTasks',async()=>{
 needRoot();const folder=selectedPbi(),current=await PBI.loadAnalysisExtension(root,folder,{required:true,
  allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true});
 const result=await PBI.prepareSpecialistTasks(root,folder,{actorRole:'coordinator',expectedSha256:current.sha256});
 await refreshCoordinatorDisplay();msg('Prepared '+result.prepared.length+' read-only specialist tasks. No agent was launched; export and assign each task manually.');
});
action('exportSpecialistTask',async()=>{
 const task=selectedAnalysisTask();if(!task)throw Error('Select a prepared Phase 04 task.');
 const exported=PBI.exportSpecialistTask(task);
 download(new Blob([exported.json],{type:'application/json'}),'PBI-Analysis-'+task.taskId+'.json');
 msg('Exported the read-only task and result template. This did not invoke a specialist.');
});
async function updateSpecialistTaskStatus(status){
 needRoot();const task=selectedAnalysisTask();if(!task)throw Error('Select a Phase 04 task first.');
 const result=await PBI.setSpecialistTaskStatus(root,analysisExtensionFolder,task.taskId,status,{actorRole:'coordinator',expectedSha256:analysisExtensionSha});
 await refreshCoordinatorDisplay();msg('Recorded '+status+' for '+task.taskId+'. This is a manual status assertion; no Builder agent was invoked.');
 return result;
}
action('assignSpecialistTask',()=>updateSpecialistTaskStatus('ASSIGNED'));
action('executeSpecialistTask',()=>updateSpecialistTaskStatus('EXECUTING'));
action('cancelSpecialistTask',()=>updateSpecialistTaskStatus('CANCELLED'));
action('importSpecialistResult',async()=>{
 needRoot();const file=$('analysisResultFile').files?.[0];if(!file)throw Error('Select a structured specialist result JSON file.');
 const parsed=JSON.parse(await file.text()),submitted=parsed.result||parsed.resultTemplate||parsed,folder=selectedPbi();
 const current=await PBI.loadAnalysisExtension(root,folder,{required:true,allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true});
 const result=await PBI.importSpecialistResult(root,folder,submitted,{actorRole:'coordinator',expectedSha256:current.sha256,sourceHandles:coordinatorSourceHandles});
 $('analysisResultFile').value='';await refreshCoordinatorDisplay();
 if(result.status==='RESULT_REJECTED')return msg('Result rejected and the rejection was persisted: '+result.reason,true);
 const unverified=result.result.evidence.some(item=>item.verificationStatus!=='VERIFIED');
 msg('Validated and persisted the specialist result for '+result.result.taskId+'.'+
  (unverified?' Some evidence remains UNVERIFIED because its source was not independently checked.':' All submitted static source hashes were checked against selected roots.'));
});
action('consolidateSpecialistAnalysis',async()=>{
 needRoot();const folder=selectedPbi(),current=await PBI.loadAnalysisExtension(root,folder,{required:true,
  allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true});
 const result=await PBI.consolidateSpecialistAnalysis(root,folder,{actorRole:'coordinator',expectedSha256:current.sha256});
 await refreshCoordinatorDisplay();msg('Consolidated analysis persisted. Unverified or conflicting coverage and unresolved blocking questions remain blockers.');
 return result;
});
action('answerAnalysisQuestion',async()=>{
 needRoot();const questionId=$('analysisClarification').dataset.questionId;
 if(!questionId)throw Error('No pending coordinator clarification is selected.');
 let answer=$('analysisAnswer').value.trim();
 if($('analysisClarification').dataset.questionType==='single-choice'&&answer.startsWith('custom:'))answer={key:'custom',customText:answer.slice(7).trim()};
 const current=await PBI.loadAnalysisExtension(root,selectedPbi(),{required:true,allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true});
 await PBI.answerCoordinatorQuestion(root,selectedPbi(),questionId,answer,$('analysisDecisionMaker').value,{actorRole:'coordinator',expectedSha256:current.sha256});
 await refreshCoordinatorDisplay();msg('Clarification decision persisted. It does not authorize implementation.');
});
async function updateAnalysisQuestionStatus(status){
 const questionId=$('analysisClarification').dataset.questionId;if(!questionId)throw Error('No pending coordinator clarification is selected.');
 const current=await PBI.loadAnalysisExtension(root,selectedPbi(),{required:true,allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true});
 await PBI.setCoordinatorQuestionStatus(root,selectedPbi(),questionId,status,$('analysisQuestionReason').value,{actorRole:'coordinator',expectedSha256:current.sha256});
 await refreshCoordinatorDisplay();msg('Clarification marked '+status+'. It remains blocking until answered.');
}
action('deferAnalysisQuestion',()=>updateAnalysisQuestionStatus('deferred'));
action('cancelAnalysisQuestion',()=>updateAnalysisQuestionStatus('cancelled'));
// Two independent editor boxes; at least one. Both: each editor gets its own agent file, every other file is shared.
function editorSelection(){const v=$('ide-visualstudio').checked,c=$('ide-vscode').checked;if(!v&&!c)throw Error('Select at least one editor: Visual Studio 2026, VS Code or both.');return v&&c?'both':c?'vscode':'visualstudio';}
function getConfig(){return PBI.normalizeConfig({projectName:$('projectName').value,ide:editorSelection(),role:$('role').value,includeReferences:$('includeReferences').checked,sources:{legacy:$('legacyPath').value,dab:$('dabPath').value,cdms:$('cdmsPath').value,ui:$('uiPath').value},others:otherRepos()});}
function otherRepos(){return $('otherRepos').value.split(/\r?\n/).filter(l=>l.trim()).map(l=>{const i=l.indexOf('=');if(i<1)throw Error('Write each other repository as Name = path: '+l.trim());return {name:l.slice(0,i).trim(),path:l.slice(i+1).trim()};});}
function fill(c){$('projectName').value=c.projectName;$('ide-visualstudio').checked=c.ide!=='vscode';$('ide-vscode').checked=c.ide!=='visualstudio';$('role').value=c.role;$('includeReferences').checked=c.includeReferences;for(const key of ['legacy','dab','cdms','ui'])$(key+'Path').value=c.sources[key]==='.'?'':c.sources[key]||'';$('otherRepos').value=(c.others||[]).map(o=>o.name+' = '+o.path).join('\n');previewName();}
function previewName(){$('agentPreview').textContent=[$('ide-visualstudio').checked?'visualstudio':null,$('ide-vscode').checked?'vscode':null].filter(Boolean).map(PBI.editorAgentName).join(' / ')||'Select an editor';for(const key of ['legacy','dab','cdms','ui']){$(key+'Path').disabled=$('role').value===key;$(key+'Path').placeholder=$('role').value===key?'Current repository (registered as .)':'Optional repository path';}}
$('ide-visualstudio').onchange=previewName;$('ide-vscode').onchange=previewName;
$('projectName').oninput=previewName;$('role').onchange=previewName;
function needRoot(){if(!root)throw Error('Choose the project folder first. If folder access is unavailable, use Download ZIP.');}
function needConfig(){if(!config)throw Error('Install the PBI Builder first, select a project that has it installed, or load its config.json for ZIP-only use.');return config;}
async function activeConfig(){needRoot();const raw=await PBI.read(root,PBI.CONFIG);if(!raw)throw Error('This selected project is not installed. Complete Project setup first.');return PBI.normalizeConfig(JSON.parse(raw));}
function absoluteSqlPath(value){return /^[A-Za-z]:[\\/]/.test(value)||/^\\\\[^\\]/.test(value)||value.startsWith('/');}
function selectedSqlFile(inputId,pathId,dataset,metadata){
 const input=$(inputId),file=input.files?.[0],sourcePath=$(pathId).value.trim();
 if(!file)throw Error('Select the '+PBI.sqlMetadata.SOURCES[dataset].label+' export.');
 if(!sourcePath||!absoluteSqlPath(sourcePath))throw Error('Enter an absolute local path for the '+PBI.sqlMetadata.SOURCES[dataset].label+' export.');
 const filename=sourcePath.split(/[\\/]/).pop();
 if(filename.toLowerCase()!==file.name.toLowerCase())throw Error('The entered path filename does not match the selected file name for '+dataset+'. The browser cannot verify the directory portion.');
 return {file,provenance:{path:sourcePath,sourceIdentity:sourcePath,originalFilename:file.name,
  environment:metadata.environment,sourceRevision:metadata.sourceRevision||null,extractedAt:metadata.extractedAt||null}};
}
async function refreshSqlRegistrationDisplay(){
 const status=$('sqlMetadataStatus');
 if(!root){status.textContent='Choose a project folder to inspect the local SQL source registry.';return;}
 const [registered,items]=await Promise.all([PBI.loadSqlSourceRegistry(root,{required:false}),PBI.listPbis(root)]);
 const select=$('sqlLinkPbi'),prior=select.value;
 select.replaceChildren(new Option(items.length?'Choose a PBI':'No saved PBIs found',''));
 for(const item of items)select.add(new Option((item.number?item.number+' · ':'')+item.title+' ['+item.folder.split('/').pop()+']',item.folder));
 if(items.some(item=>item.folder===prior))select.value=prior;
 if(!registered){status.textContent='No SQL reference sources are registered in this project.';return;}
 const lines=registered.registry.sources.map(source=>source.dataset+': '+source.validationStatus+' · '+source.format+' · '+source.recordCount+' rows · SHA-256 '+source.sha256+
  '\n  '+source.path+'\n  '+source.environment+' · extracted '+(source.extractedAt||'UNKNOWN')+' · revision '+(source.sourceRevision||'UNKNOWN')).join('\n');
 status.textContent='Registered provenance only; source files are not copied. Revalidation requires selecting all three current exports.\n'+lines+
  '\nSelect a PBI above to create/update its versioned SQL analysis extension.';
}
async function refreshGraphqlReferenceDisplay(){
 const status=$('graphqlReferenceStatus'),select=$('graphqlLinkPbi');
 if(!root){status.textContent='Choose a project folder to inspect the installed offline reference library.';return;}
 const [raw,items]=await Promise.all([PBI.read(root,PBI.REFERENCE_LIBRARY_FILE),PBI.listPbis(root)]),prior=select.value;
 select.replaceChildren(new Option(items.length?'Choose a PBI':'No saved PBIs found',''));
 for(const item of items)select.add(new Option((item.number?item.number+' · ':'')+item.title+' ['+item.folder.split('/').pop()+']',item.folder));
 if(items.some(item=>item.folder===prior))select.value=prior;
 if(raw===null){status.textContent='The offline reference library is not installed. Use setup to install/update this Builder package.';return;}
 const manifest=JSON.parse(raw);
 status.textContent='Manifest present ('+(Array.isArray(manifest.artifacts)?manifest.artifacts.length:0)+' artifacts; Builder '+String(manifest.packageVersion||'unknown')+
  '). Run offline validation before linking. Hashes are checked against every installed file; validation does not connect to SQL Server.';
}
action('validateGraphqlReferences',async()=>{
 needRoot();
 const library=await PBI.loadReferenceLibrary(root,{validateGraphql:true,validateSql:true}),status=$('graphqlReferenceStatus');
 const schemas=library.schemaResults.map(item=>item.schemaArtifactId+': '+item.typeCount+' GraphQL types · '+item.status).join('\n'),
  counts=library.sqlModel.counts;
 await refreshGraphqlReferenceDisplay();
 status.textContent='All installed reference hashes verified. GraphQL schemas:\n'+schemas+
  '\nCDMS SQL reference model: '+counts.tables+' tables · '+counts.columns+' columns · '+counts.primaryKeys+' PKs · '+counts.foreignKeys+
  ' FKs. These are offline snapshots, not live-system facts.';
});
action('linkGraphqlAnalysis',async()=>{
 needRoot();const folder=$('graphqlLinkPbi').value;
 if(!folder)throw Error('Find and select a PBI before linking GraphQL references.');
 const current=await PBI.loadAnalysisExtension(root,folder,{required:false,allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true});
 if(!confirm((current?'Update the selected Phase 01 analysis extension':'Create a new Phase 01 analysis extension')+
  ' with the validated installed GraphQL SDL snapshot? Any changed analysis invalidates its package approval. This does not authorize implementation.'))return msg('Cancelled. No GraphQL analysis extension was changed.');
 const saved=await PBI.saveGraphqlAnalysisExtension(root,folder,{actorRole:'coordinator',expectedSha256:current?.sha256||null});
 msg((saved.created?'Created':'Updated')+' '+saved.path+' with '+saved.schemaCount+' validated GraphQL SDL artifacts.'+
  (saved.approvalInvalidated?'\nThe prior package approval was invalidated.':'')+
  '\nThe references remain read-only evidence and do not authorize SDD implementation.');
 $('existingPbi').value=folder;await refreshGraphqlReferenceDisplay();await refreshCoordinatorDisplay();
});
async function registerSqlSources(){
 needRoot();
 const metadata={environment:$('sqlEnvironment').value.trim()||'UNKNOWN',sourceRevision:$('sqlSourceRevision').value.trim(),
  extractedAt:$('sqlExtractedAt').value.trim()},specs=[
  ['foreignKeys','sqlForeignKeys','sqlForeignKeysPath'],['primaryKeys','sqlPrimaryKeys','sqlPrimaryKeysPath'],['tables','sqlTables','sqlTablesPath']];
 const inputs={},provenance={};
 for(const [dataset,inputId,pathId]of specs){
  const selected=selectedSqlFile(inputId,pathId,dataset,metadata);
  if(typeof selected.file.arrayBuffer!=='function')throw Error('This browser cannot read the selected SQL export as bytes.');
  inputs[dataset]=new Uint8Array(await selected.file.arrayBuffer());provenance[dataset]=selected.provenance;
 }
 const prior=await PBI.loadSqlSourceRegistry(root,{required:false}),analysis=await PBI.sqlMetadata.analyze(inputs,provenance),
  registry=PBI.sqlMetadata.createSourceRegistry(analysis);
 if(prior)for(const source of registry.sources){
  const previous=prior.registry.sources.find(item=>item.dataset===source.dataset);
  if(previous&&previous.sha256===source.sha256&&previous.sourceIdentity===source.sourceIdentity){
   source.importedAt=previous.importedAt;analysis.datasets[source.dataset].provenance.importedAt=previous.importedAt;
  }
 }
 const saved=await PBI.saveSqlSourceRegistry(root,registry,{actorRole:'coordinator',expectedSha256:prior?.sha256||null});
 sqlPendingAnalysis=analysis;
 await refreshSqlRegistrationDisplay();
 const stats=analysis.counts,diagnostics=analysis.diagnostics;
 $('sqlMetadataStatus').textContent+='\\n\\nLast parse: tables '+stats.tables+' · columns '+stats.columns+' · PKs '+stats.primaryKeys+
  ' · FKs '+stats.foreignKeys+' (verified '+stats.verifiedForeignKeys+', partial '+stats.partialForeignKeys+', ambiguous '+stats.ambiguousForeignKeys+
  ', unresolved '+stats.unresolvedForeignKeys+', conflicting '+stats.conflictingForeignKeys+').\\nDiagnostics: '+diagnostics.length+
  (diagnostics.length?'; '+diagnostics.slice(0,12).map(item=>'['+item.severity+'] '+item.code+': '+item.message).join('\\n')+
   (diagnostics.length>12?'\\n… '+(diagnostics.length-12)+' more.':''):' none.')+
  '\\nProvenance warnings: '+analysis.datasets.tables.provenance.environment+' environment, '+
  (metadata.extractedAt||'UNKNOWN')+' extraction time, '+(metadata.sourceRevision||'UNKNOWN')+' revision.'+
  '\\nSource registry '+(saved.changed?'saved':'unchanged')+' at '+saved.path+'.';
 msg('SQL exports '+(saved.changed?'registered':'revalidated')+'. '+stats.tables+' tables, '+stats.columns+
   ' columns, '+stats.primaryKeys+' PKs and '+stats.foreignKeys+' FKs parsed. Review diagnostics in the SQL metadata panel.');
}
action('registerSqlSources',registerSqlSources);
action('linkSqlAnalysis',async()=>{
 needRoot();if(!sqlPendingAnalysis)throw Error('Register or revalidate all three exports in this session before linking them.');
 const folder=$('sqlLinkPbi').value;if(!folder)throw Error('Find and select a PBI before linking SQL metadata.');
 const current=await PBI.loadAnalysisExtension(root,folder,{required:false,allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true}),
  created=!current,message=(created?'Create a new Phase 01 analysis extension':'Update the selected Phase 01 analysis extension')+
   ' with these SQL evidence records? This changes only the analysis extension, not pbi-state.json or any application repository.'+
   (current?.extension.packageApproval?'\nAny source or mapping change will invalidate the current package approval.':'');
 if(!confirm(message))return msg('Cancelled. No SQL analysis extension was changed.');
 const saved=await PBI.saveSqlAnalysisExtension(root,folder,sqlPendingAnalysis,{actorRole:'coordinator',expectedSha256:current?.sha256||null});
 msg((saved.created?'Created':'Updated')+' '+saved.path+' with '+saved.extension.sqlRelationships.length+
  ' SQL relationship records and '+saved.extension.evidence.filter(item=>item.datasetType).length+
  ' SQL source-row evidence records.'+(saved.approvalInvalidated?'\nThe previous package approval was invalidated.':'')+
  '\nSQL metadata is supporting evidence only; it does not authorize SDD implementation.');
 $('existingPbi').value=folder;await refreshSqlRegistrationDisplay();await refreshCoordinatorDisplay();
});
action('markSqlMissing',async()=>{
 needRoot();
 const datasets=[['sqlMissingForeignKeys','foreignKeys'],['sqlMissingPrimaryKeys','primaryKeys'],['sqlMissingTables','tables']]
  .filter(([id])=>$(id).checked).map(([,dataset])=>dataset);
 if(!datasets.length)throw Error('Select at least one registered SQL export to mark unavailable.');
 const current=await PBI.loadSqlSourceRegistry(root,{required:true});
 if(!confirm('Mark '+datasets.join(', ')+' unavailable? Prior provenance will be preserved, affected evidence will become stale, linked relationships will block approval, and affected package approvals will be invalidated.'))return msg('Cancelled. No SQL source status was changed.');
 const result=await PBI.markSqlSourcesUnavailable(root,datasets,{actorRole:'coordinator',expectedRegistrySha256:current.sha256});
 sqlPendingAnalysis=null;for(const id of ['sqlMissingForeignKeys','sqlMissingPrimaryKeys','sqlMissingTables'])$(id).checked=false;
 await refreshSqlRegistrationDisplay();
 msg('Marked '+result.missing.join(', ')+' unavailable. Invalidated affected PBI analyses: '+(result.invalidated.map(item=>item.folder).join(', ')||'none')+
  '. Re-register all three exports to restore current SQL evidence.');
});
async function solutions(dir,prefix='',depth=0){const items=[];if(depth>2)return items;for await(const [name,h]of dir.entries()){if(h.kind==='file'&&/\.slnx?$/i.test(name))items.push(prefix+name);else if(h.kind==='directory'&&!['.git','.vs','node_modules','bin','obj','packages','playbook'].includes(name)){items.push(...await solutions(h,prefix+name+'/',depth+1));}if(items.length>=30)break;}return items.slice(0,30);}
const sessionRepos=[];
function resetRepositoryState(){
 pbiItems=[];clearArchitectureReport();draftFolder='';draftAttachments=[];lastAnswered='';reviewing=null;done=null;dupMatch=null;pbiRefs=[];lastAccess=undefined;
 analysisExtensionSnapshot=null;analysisExtensionSha=null;analysisExtensionFolder='';coordinatorSourceHandles.clear();
 closeDecisionDialog();
 for(const id of ['pbiTitle','pbiNumber','customProject','pbiScope','pbiDescription','acceptanceCriteria','pbiNotes','businessReason','businessExample','businessUnit','changes','manualPbi','answeredBy','approverName','reviewNote'])$(id).value='';
 $('attachments').value='';$('attachmentList').textContent='';$('changeType').value='unsure';setTarget('');setMode('deep');$('separateDraft').checked=false;showStep(1);
 $('existingPbi').replaceChildren(new Option('Find PBIs in this project',''));$('pbiDetails').textContent='';$('review').replaceChildren();$('reviewCards').replaceChildren();$('approveBox').classList.add('hidden');
 $('questionBox').classList.add('hidden');$('questionList').replaceChildren();$('promptOutput').classList.add('hidden');$('comparisonOutput').classList.add('hidden');
 $('promptText').value='';$('outputWhere').textContent='';$('doneList').replaceChildren();$('donePreview').textContent='';$('donePreview').classList.add('hidden');
 if($('doneDialog').close)$('doneDialog').close();
}
action('pick',async()=>{
 if(!window.showDirectoryPicker)throw Error('Folder access is unavailable in this browser. Open the downloaded HTML in desktop Edge or Chrome, or use Download setup ZIP.');
 const selected=await window.showDirectoryPicker({mode:'readwrite',id:'akzo-pbi-project'});
 let i=-1;for(const [n,h]of sessionRepos.entries())if(await h.isSameEntry(selected))i=n;
 if(i<0){sessionRepos.push(selected);const sel=$('recentRepos');if(sessionRepos.length===1)sel.replaceChildren();sel.add(new Option(selected.name,String(sessionRepos.length-1)));i=sessionRepos.length-1;}
 $('recentRepos').value=String(i);await openRoot(selected);
});
$('recentRepos').onchange=()=>{const h=sessionRepos[+$('recentRepos').value];if(h&&!busy)openRoot(h).catch(e=>msg(e.message,true));};
async function openRoot(selected){
 const selectedWorkspace=await PBI.resolveWorkspace(selected);
 if(selectedWorkspace.configPath==='Source/'+PBI.CONFIG)selected=await selected.getDirectoryHandle('Source');
 clearArchitectureReport();
 sqlPendingAnalysis=null;
 if(!root||!(await root.isSameEntry(selected)))resetRepositoryState();root=selected;config=null;pbiItems=[];$('rootConfirmed').checked=false;$('displayPath').value='';$('allowUpdates').checked=false;$('review').replaceChildren();$('promptOutput').classList.add('hidden');$('comparisonOutput').classList.add('hidden');$('existingPbi').replaceChildren(new Option('Find PBIs in this project',''));$('pbiDetails').textContent='';$('manualPbi').value='';
 const workspace=await PBI.resolveWorkspace(root),current=workspace.config;
 if(current){config=current;fill(config);}else fill({projectName:root.name,ide:'visualstudio',role:'legacy',includeReferences:false,sources:{legacy:'',dab:'',cdms:'',ui:''}});
 let installed='';try{installed=JSON.parse(await PBI.read(root,PBI.MANIFEST)||'{}').packageVersion||'';}catch{installed='unreadable';}
 $('versionBadge').textContent='PBI Builder · '+PBI.VERSION+(installed&&installed!==PBI.VERSION?' · installed '+installed:'');
 $('connectedName').textContent=root.name;$('connectedDetail').textContent=(installed?'Installed: '+installed+(installed===PBI.VERSION?' (up to date). ':'; this file installs '+PBI.VERSION+'. '):'')+(current?'Existing setup loaded. Review setup to upgrade, or use New PBI or Continue PBI.':'Folder selected. Review project settings and install the PBI Builder.');
 let git=false;try{await root.getDirectoryHandle('.git');git=true;}catch(e){if(e.name==='TypeMismatchError')git=true;else if(e.name!=='NotFoundError')throw e;}
 $('rootConfirmed').checked=git;
 const found=await solutions(root);$('solutions').textContent=(git?'Git root marker found. ':'No Git root marker found; confirm this is the correct root. ')+(found.length?'Solutions found (up to 3 folder levels):\n'+found.join('\n'):'No solution found within 3 folder levels. Open the repository folder in VS Code, or locate the correct Visual Studio solution.');
 const old=await PBI.read(root,'.github/agents/akzo-sdd-pbi.agent.md');
 msg((current?'Existing setup loaded.':'Project selected: '+root.name)+(old?'\nAn earlier PBI Builder agent exists. It will be preserved; choose the new project-specific agent name after installation.':''));
 await refreshSqlRegistrationDisplay();await refreshGraphqlReferenceDisplay();await refreshCoordinatorDisplay();await syncJourney();
 if(current&&window.location&&window.location.hash.startsWith('#draft=')){
  const folder=decodeURIComponent(window.location.hash.slice(7));
  await refreshPbis();
  if(!pbiItems.some(item=>item.folder===folder))throw Error('The requested intake draft was not found in the selected project. No other folder was read.');
  $('existingPbi').value=folder;await loadDraft();
 }
}
// Same as Install-PBIBuilder.ps1 -Action Repair: installed settings, updates allowed, edited files never overwritten.
action('repair',async()=>{const c=await activeConfig();const rows=await PBI.plan(root,PBI.setupFiles(c,assets,originalHTML).files,true);renderReview(rows);await applySetup(c,rows,true);});
// Same review, questions and messages as Show-Plan and Invoke-Install in Install-PBIBuilder.ps1.
function planText(c,rows){const counts={};rows.forEach(r=>counts[r.state]=(counts[r.state]||0)+1);return 'Repository: '+root.name+'\nAgent: '+c.agentName+'\nReview: '+Object.entries(counts).map(([k,v])=>v+' '+k).join(', ')+(counts.retire?'\nretire: unchanged earlier-version files are backed up, then removed after the new files are verified.':'')+(counts['retire-conflict']?'\nretire-conflict: edited or unowned earlier-version files are kept. Delete them yourself, or change their name: line to keep a personal copy.':'')+(counts.conflict?'\nconflict: these files differ from the installed record and are never overwritten. Restore or move them, then rerun.':'');}
async function applySetup(c,rows,allow){const plan=planText(c,rows);
 if(rows.some(r=>r.state==='conflict'))throw Error(plan+'\nResolve the conflicts above, then rerun.');
 if(!confirm(plan+'\n\nApply these changes?')){msg('Cancelled. Nothing was changed.');return false;}
 if(!allow&&rows.some(r=>r.state==='update'||r.state==='retire'))allow=confirm('Allow updates to previously installed files and retirement of unchanged earlier-version files, with backups?');
 const r=await PBI.apply(root,rows,allow);config=c;$('connectedDetail').textContent='Installed: '+c.agentName;
 msg('Setup complete: '+r.written+' files saved.'+(r.backups.length?'\nBackups: '+PBI.BASE+'/backups/':'')+(r.retired.length?'\nRetired: '+r.retired.join(', '):'')+(r.kept.length?'\nKept (edited or unowned; review and remove yourself): '+r.kept.join(', '):'')+Object.keys(PBI.editorAgents(c.ide)).map(k=>'\nOpen this repository in '+PBI.EDITORS[k]+' and select '+PBI.editorAgentName(k)+' in Copilot Chat.').join(''));return true;}
// Same as Install-PBIBuilder.ps1 -Action Uninstall: unchanged installed files are backed up, then removed.
action('uninstall',async()=>{needRoot();let c=null;try{c=await activeConfig();}catch{}const rows=await PBI.uninstallPlan(root,c);renderReview(rows);
 if(!confirm('Remove the PBI Builder from '+root.name+'?\n\nRemoved (backed up first): '+rows.filter(r=>r.state==='remove').length+' unchanged files.\nKept: playbook/pbis (your PBIs and decisions), knowledge notes, backups and every file you edited.'))return msg('Cancelled. Nothing was changed.');
 const r=await PBI.uninstall(root,rows);config=null;$('connectedDetail').textContent='Not installed.';msg('Uninstalled '+r.removed.length+' files. Backups: '+r.backup+(r.kept.length?'\nKept because they were edited: '+r.kept.join(', '):''));});
function renderReview(rows){const table=document.createElement('table'),head=document.createElement('tr');for(const s of ['Action','File']){const th=document.createElement('th');th.textContent=s;head.append(th);}table.append(head);for(const row of rows){const tr=document.createElement('tr'),state=document.createElement('td'),path=document.createElement('td');state.textContent=row.state;state.className='tag '+row.state;path.textContent=row.path;tr.append(state,path);table.append(tr);}$('review').replaceChildren(table);}
async function getSetupPlan(){needRoot();if(!$('rootConfirmed').checked)throw Error('Confirm that the selected folder is the application repository root.');const entered=$('displayPath').value.trim().replace(/[\\/]+$/, '');if(entered&&entered.split(/[\\/]/).pop().toLowerCase()!==root.name.toLowerCase())throw Error('The pasted path ends in a different folder name. Select the intended repository or correct the display path. The browser-selected folder is the actual destination.');const c=getConfig();const {files}=PBI.setupFiles(c,assets,originalHTML);const rows=await PBI.plan(root,files,true);renderReview(rows);return {c,rows};}
action('preview',async()=>{const {c,rows}=await getSetupPlan();msg(planText(c,rows)+'\nPreview only. No files written.',rows.some(r=>r.state==='conflict'));});
action('install',async()=>{const {c,rows}=await getSetupPlan();if(!await applySetup(c,rows,$('allowUpdates').checked))return;showPrompt('Check the setup in Copilot','playbook/pbi-builder/',`Check this PBI Builder setup. Read ${PBI.BASE}/config.json and ${PBI.BASE}/sources.yaml. Read one relevant application source file and give its path as evidence. Report missing sources. Do not modify files.`,false);});
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
action('setupZip',async()=>{const {config:c,files}=PBI.setupFiles(getConfig(),assets,originalHTML),map={};for(const [p,t]of Object.entries(files))map[p]=await PBI.hash(t);files[PBI.MANIFEST]=JSON.stringify({schemaVersion:1,packageVersion:PBI.VERSION,files:map},null,2)+'\n';download(PBI.zip(files),'Akzo-PBI-Setup-'+c.projectName.replace(/[^a-zA-Z0-9_-]/g,'-')+'.zip');config=c;msg('Setup ZIP prepared. This does not install files. Extract it and copy its CONTENTS into the intended repository root, comparing existing files first. Then open the application and select '+c.agentName+'.');});
action('verify',async()=>{needRoot();const raw=await PBI.read(root,PBI.MANIFEST);if(!raw)throw Error('No PBI Builder installation record found in this folder.');const m=JSON.parse(raw);if(m.schemaVersion!==1||!m.files||typeof m.files!=='object')throw Error('Unrecognized installation record.');const results=[];let bad=0;for(const [p,h]of Object.entries(m.files)){const txt=await PBI.read(root,p);const ok=txt!==null&&await PBI.hash(txt)===h;if(!ok)bad++;results.push((txt===null?'MISSING':ok?'OK':'CHANGED')+'  '+p);}msg(results.join('\n')+'\n\n'+(bad?'Review missing/changed files.':'All recorded files match.')+' This does not verify Copilot discovery, source access or AI output.',bad>0);});
$('importConfig').onchange=async e=>{if(busy)return;try{const file=e.target.files[0];if(!file)return;const c=PBI.normalizeConfig(JSON.parse(await file.text()));root=null;config=c;fill(c);$('rootConfirmed').checked=false;$('solutions').textContent='';$('connectedName').textContent=c.projectName+' (ZIP-only mode)';$('connectedDetail').textContent='Settings loaded. Files and installation have not been checked.';$('existingPbi').replaceChildren(new Option('Enter the existing folder below',''));$('pbiDetails').textContent='';$('promptOutput').classList.add('hidden');$('comparisonOutput').classList.add('hidden');msg('Settings loaded. Use Download intake ZIP or Download refinement ZIP, then extract into the same repository before sending the prompt.');}catch(e){msg('Cannot load config: '+e.message,true);}};
let step=1,draftFolder='',draftAttachments=[],lastAnswered='';
const STEPS=['Requirements','Legacy repository','Development target','Review & start'],TARGET_AREAS=['cdms','dab','ui'],MODE_KEYS=['quick','deep','comprehensive'];
const APP_LABEL=PBI.APPLICATIONS;
const CHANGE_LABEL={new:'A new feature',enhance:'Enhances existing functionality',fix:'Fixes an existing issue',migrate:'Migrates legacy functionality',unsure:'Not sure'};
// CDMS, DAB and the Shared Angular UI are independent checkboxes; the target key is the one for exactly the checked areas.
function target(){return PBI.targetOf(TARGET_AREAS.filter(k=>$('target-'+k).checked))||'unsure';}
function setTarget(v){const t=PBI.TARGETS[PBI.targetKey(v)];for(const k of TARGET_AREAS)$('target-'+k).checked=!!t&&t.implement.includes(k);}
function mode(){return MODE_KEYS.find(k=>$('mode-'+k).checked)||'deep';}
function setMode(v){for(const k of MODE_KEYS)$('mode-'+k).checked=k===(MODE_KEYS.includes(v)?v:'deep');}
function picked(){return [...($('attachments').files||[])];}
function intake(draft=false){const ac=$('acceptanceCriteria').value;return {title:$('pbiTitle').value,description:$('pbiDescription').value,number:$('pbiNumber').value,project:$('customProject').value.trim()||$('targetProject').value,application:target(),legacy:$('legacyRepo').value||undefined,references:pbiRefs.slice(),analysisMode:mode(),acMode:ac.trim()?'enter':'draft',acceptanceCriteria:ac,changeType:$('changeType').value,notes:$('pbiNotes').value,scope:$('pbiScope').value,attachments:picked().map(f=>f.name),businessReason:$('businessReason').value,businessExample:$('businessExample').value,businessUnit:$('businessUnit').value,draft,step:STEPS[step-1],...(draftFolder?{folder:draftFolder,existingAttachments:draftAttachments}:{})};}
function fillProjects(){const sel=$('targetProject'),cur=sel.value,opts=[new Option(config?config.projectName+' (this repository)':'This repository',config?config.projectName:'')];
 if(config)for(const k of ['legacy','dab','cdms','ui'])if(config.sources[k]&&config.sources[k]!=='.'){const v=k.toUpperCase()+' repository ('+config.sources[k]+')';opts.push(new Option(v,v));}
 sel.replaceChildren(...opts);if(opts.some(o=>o.value===cur))sel.value=cur;}
function legacyOptions(){return config?PBI.sourceOptions(config):[];}
function fillLegacy(){const sel=$('legacyRepo'),cur=sel.value,o=legacyOptions();
 sel.replaceChildren(new Option('Select source repository',''),...o.map(x=>{const option=new Option((x.label||x.name)+' — '+(x.path==='.'?'this repository':x.path||'not configured — add in Setup'),x.key);option.disabled=!x.path;return option;}));
 if(o.some(x=>x.key===cur))sel.value=cur;showLegacy();}
function showLegacy(){const x=legacyOptions().find(o=>o.key===$('legacyRepo').value);$('legacyInfo').textContent=x?'Repository: '+x.name+'\nLocation: '+(x.path==='.'?'this repository ('+(root?root.name:'.')+')':x.path||'not configured')+' (relative to this repository)\nNot validated in this session. Validate checks the folder name and Git root.':'Select a configured source. Correct unconfigured paths in Setup, then return here.';}
$('legacyRepo').onchange=showLegacy;
action('validateLegacy',async()=>{const x=legacyOptions().find(o=>o.key===$('legacyRepo').value);if(!x)throw Error('Choose a configured legacy repository first.');if(!window.showDirectoryPicker)throw Error('Folder access is unavailable in this browser; the agent verifies access when it reads the source.');
 const d=await window.showDirectoryPicker({mode:'read',id:'akzo-pbi-legacy'}),want=x.path==='.'?(root?root.name:''):x.path.replace(/[\\/]+$/,'').split(/[\\/]/).pop();
 let git=false;try{await d.getDirectoryHandle('.git');git=true;}catch(e){if(e.name==='TypeMismatchError')git=true;}
 if(want&&d.name.toLowerCase()!==want.toLowerCase())throw Error('The selected folder "'+d.name+'" does not match the configured path '+x.path+'. Choose that folder, or correct the path in Setup.');
 $('legacyInfo').textContent='Repository: '+x.name+'\nLocation: '+x.path+'\nValidated: folder "'+d.name+'" found'+(git?' with a Git root.':', but no .git folder: confirm it is the repository root.');msg('Legacy repository validated. Nothing was read or changed.');});
function goRepos(){tab('setup');$('repoDetails').open=true;$('legacyPath').focus();msg('Add, correct or remove repositories under "Repositories and reference documents", then click Install / update to save them. Removing one only changes the configuration; its folder is never deleted.');}
action('manageRepos',goRepos);action('fixRepos',goRepos);
// Repository roles for the chosen target, from the same rules the agent follows (PBI.TARGETS).
function showRoles(){const t=PBI.TARGETS[target()];if(!t||!t.implement.length){$('repoRoles').textContent='Choose a target to see each repository\'s role.';return;}const c=config,leg=legacyOptions().find(o=>o.key===$('legacyRepo').value);
 const role=(k,use)=>k==='legacy'?'Legacy — Business Reference':k==='ui'?'Angular UI — Shared Frontend'+(use==='implement'?'':' (not selected; read only for dependencies)'):(k==='cdms'?'CDMS':'DAB')+(use==='implement'?' — Implementation Target':' — Reference (read-only)');
 const path=k=>k==='legacy'&&leg&&(leg.key==='legacy'||!['cdms','dab','ui'].includes(leg.key))?leg.path:c?c.sources[k]:'';
 $('repoRoles').textContent=[...t.reference.map(k=>[k,'reference']),...t.implement.map(k=>[k,'implement'])].map(([k,use])=>role(k,use)+': '+(path(k)?path(k)==='.'?'this repository':path(k):'not configured — use Correct repository paths')).join('\n')+'\nAnalysis order: '+t.order;}
for(const k of TARGET_AREAS)$('target-'+k).onchange=()=>{showRefs();showRoles();$('targetError').textContent='';};
function reviewText(){const d=intake(true),files=[...draftAttachments.map(a=>a.name),...d.attachments],desc=d.description.trim(),leg=legacyOptions().find(o=>o.key===d.legacy);
 return ['PBI number: '+(d.number.trim()||'Not assigned yet'),'PBI title: '+(d.title.trim()||'(missing, required)'),'Description: '+(desc?desc.slice(0,600)+(desc.length>600?' …':''):'(missing, required)'),'Acceptance criteria: '+(d.acceptanceCriteria.trim()?d.acceptanceCriteria.trim().split(/\r?\n/).length+' line(s), kept as entered':'Not supplied; agent will draft for review'),'Attachments: '+(files.join(', ')||'None'),
  (leg&&['cdms','dab','ui'].includes(leg.key)?'Source repository: ':'Legacy repository: ')+(leg?leg.name+' ('+leg.path+')':'(not selected)'),'Development target: '+APP_LABEL[d.application],$('repoRoles').textContent,'Analysis mode: '+PBI.ANALYSIS_MODES[d.analysisMode],'Additional implementation references: '+refText(),'Target project: '+(d.project||'This repository'),'Kind of change: '+(CHANGE_LABEL[d.changeType]||'Not sure')+(d.notes.trim()?'\nNotes: '+d.notes.trim():'')].join('\n');}
function showStep(n){step=Math.max(1,Math.min(STEPS.length,n));STEPS.forEach((_,i)=>{$('step'+(i+1)).classList.toggle('hidden',i+1!==step);const l=$('stepLabel'+(i+1));l.setAttribute('aria-current',i+1===step?'step':'false');l.classList.toggle('done',i+1<step);});$('wizardProgress').textContent='Step '+step+' of '+STEPS.length+' · '+STEPS[step-1];
 if(step===2)fillLegacy();if(step===3)showRoles();if(step===STEPS.length){fillProjects();$('reviewSummary').textContent=reviewText();}}
// Inline validation: each required field shows its own message; returns the first invalid step or 0.
function fieldError(id,text){$(id).setAttribute('aria-invalid',text?'true':'false');$(id+'Error').textContent=text;return !!text;}
function invalidStep(upTo){let bad=0;
 if(upTo>=1){const enteredNumber=$('pbiNumber').value.trim(),e=[fieldError('pbiNumber',enteredNumber?(/^(?:not assigned yet|[A-Za-z0-9][A-Za-z0-9._-]{0,39})$/i.test(enteredNumber)?'':'Use a PBI number, a manual identifier, or Not assigned yet.'):'Choose Not assigned yet or enter a PBI number.'),fieldError('pbiTitle',$('pbiTitle').value.trim()?'':'Enter the PBI title.'),
   fieldError('pbiDescription',$('pbiDescription').value.trim()?'':'Describe the requirement.'),fieldError('acceptanceCriteria','')];if(e.some(Boolean))bad=bad||1;}
 if(upTo>=2&&fieldError('legacyRepo',legacyOptions().some(o=>o.key===$('legacyRepo').value&&o.path)?'':'Choose a configured source repository, or add one in Setup.'))bad=bad||2;
 if(upTo>=3){$('targetError').textContent=target()==='unsure'?'Choose what you are developing this PBI for.':'';if(target()==='unsure')bad=bad||3;}
 return bad;}
$('wizardNext').onclick=()=>{if(step===2&&!$('legacyRepo').options?.length)fillLegacy();const bad=invalidStep(step);if(bad===step){msg('Complete the highlighted fields to continue.',true);return;}showStep(step+1);msg(step===STEPS.length?'Review the summary. Use Back to correct it, then confirm Start analysis.':'Continue with '+STEPS[step-1]+'.');};
$('wizardBack').onclick=()=>showStep(step-1);
$('attachments').onchange=()=>{$('attachmentList').textContent=[...draftAttachments.map(a=>a.name+' (already saved)'),...picked().map(f=>f.name+' ('+Math.max(1,Math.ceil(f.size/1024))+' KB)')].join('\n');};
$('wizardCancel').onclick=()=>{for(const id of ['pbiTitle','pbiNumber','customProject','pbiScope','pbiDescription','acceptanceCriteria','pbiNotes','businessReason','businessExample','businessUnit'])$(id).value='';$('attachments').value='';$('legacyRepo').value='';$('changeType').value='unsure';setTarget('');setMode('deep');pbiRefs=[];showRefs();draftFolder='';draftAttachments=[];$('attachmentList').textContent='';showStep(1);msg('Intake closed. Unsaved changes were cleared; any previously saved draft is kept.');};
// Additional implementation references: configured repositories the target does not already use; none, one or several.
let pbiRefs=[];
function refOptions(){let c=config;if(!c)try{c=getConfig();}catch{c=PBI.normalizeConfig({projectName:'x',role:'other'});}return PBI.referenceOptions(c,target());}
function refText(){const o=refOptions();return pbiRefs.map(k=>(o.find(x=>x.key===k)||{label:k}).label).join(', ')||'none selected';}
function showRefs(){const o=refOptions();pbiRefs=pbiRefs.filter(k=>o.some(x=>x.key===k));$('refSummary').textContent='Additional implementation references: '+refText();}
function openRefs(){const list=$('refList');list.replaceChildren(...refOptions().map(o=>{const l=document.createElement('label'),b=document.createElement('input');b.type='checkbox';b.value=o.key;b.checked=pbiRefs.includes(o.key);const t=document.createElement('span');t.textContent=o.label;l.append(b,t);return l;}));const d=$('refDialog');if(d.showModal&&!d.open)d.showModal();}
$('chooseRefs').onclick=openRefs;
$('refOk').onclick=()=>{pbiRefs=[...$('refList').children].map(l=>l.children[0]).filter(b=>b&&b.checked).map(b=>b.value);const d=$('refDialog');if(d.close)d.close();showRefs();};
showStep(1);
function showPrompt(title,folder,prompt,zipOnly){$('promptOutput').classList.remove('hidden');$('outputTitle').textContent=title;$('outputWhere').textContent=(zipOnly?'ZIP prepared for: ':'Saved in: ')+folder;$('promptText').value=prompt;$('outputInstruction').textContent=(zipOnly?'Extract this ZIP into the intended repository first. ':'')+'In Copilot Chat, select '+Object.keys(PBI.editorAgents(needConfig().ide)).map(PBI.editorAgentName).join(' or ')+', paste this prompt and click Send.';$('promptOutput').scrollIntoView({behavior:'smooth',block:'start'});}
async function createIntake(zipOnly,draft=false){const c=zipOnly?needConfig():await activeConfig();config=c;const files=picked(),data=intake(draft);data.sourceAccess=lastAccess;
 if(!zipOnly&&!draftFolder){const existing=await PBI.listPbis(root),n=data.number.trim(),match=n&&existing.find(x=>x.number===n);
  if(match&&!$('separateDraft').checked){dupMatch={match,zipOnly,draft};$('dupText').textContent='PBI '+n+' is saved in '+match.folder+'. Resume it, review it, or start a new version in a new folder. Nothing has been saved yet.';const d=$('dupDialog');if(d.showModal&&!d.open)d.showModal();msg('PBI '+n+' already exists. Choose Resume, Review or Start New Version. Nothing was saved.');return;}}
 if(!draft){const bad=invalidStep(3);if(bad){showStep(bad);throw Error('Complete the required fields first. Nothing was saved.');}
  if(step!==STEPS.length){showStep(STEPS.length);throw Error('Review the summary and confirm Start before analysis. Nothing was saved.');}}
 // Attachments are redacted and scanned by the core before anything is written.
 data.attachmentContent=await Promise.all(files.map(async f=>new Uint8Array(await f.arrayBuffer())));
 const result=PBI.newPbi(c,data),bytes=result.attachmentBytes;
 if(zipOnly){const all={...result.files};result.attachments.forEach((p,i)=>{all[p]=bytes[i];});download(PBI.zip(all),'PBI-'+(result.request.number||'new')+'-intake.zip');}
 else{const all={...result.files};result.attachments.forEach((p,i)=>{all[p]=bytes[i];});
  if(draftFolder){// Updating a saved draft: earlier versions of intake files and replaced attachments go to history/.
   for(const f of ['REQUEST.md','pbi.json','START-PROMPT.txt']){const old=await PBI.read(root,result.folder+'/'+f);if(old!==null)all[result.folder+'/history/'+f.replace(/(\.[^.]+)$/,'.'+Date.now()+'$1')]=old;}
   for(const p of result.attachments){const old=await PBI.readBytes(root,p);if(old!==null)all[result.folder+'/history/'+p.split('/').pop()+'.'+Date.now()]=old;}
  }
  const rows=await PBI.plan(root,all,false,!!draftFolder);await PBI.apply(root,rows,!!draftFolder);}
 if(draft&&!zipOnly){draftFolder=result.folder;draftAttachments=result.request.attachments;$('attachments').value='';$('attachments').onchange();}else{draftFolder='';draftAttachments=[];}
 showPrompt(draft?'Draft saved':'Start this PBI in Copilot',result.folder,result.prompt,zipOnly);
 msg((zipOnly?'Intake ZIP prepared. It does not contain an AI-refined PBI. Extract it before sending the prompt.':draft?'Draft saved in '+result.folder+'. Resume it later with “Resume draft in New PBI” on the Continue tab, or “Resume PBI” in Copilot.':'Intake saved'+(result.attachments.length?' with '+result.attachments.length+' attachment(s)':'')+'. Copy the prompt below into the selected PBI Builder agent.')+protection(result));await syncJourney();}
function protection(r){return (r.redactions.length?'\nSensitive values replaced with [REDACTED] before saving: '+r.redactions.map(f=>f.kind+' ('+f.count+')').join(', ')+'.':'')+(r.warnings.length?'\nInstruction-like text flagged as untrusted (kept, listed in REQUEST.md): '+r.warnings.length+' line(s).':'');}
let dupMatch=null;
function closeDup(){const d=$('dupDialog');if(d.close)d.close();const m=dupMatch;dupMatch=null;return m;}
action('dupResume',async()=>{const m=closeDup();if(!m)return;await refreshPbis();$('existingPbi').value=m.match.folder;$('existingPbi').onchange();const raw=await PBI.read(root,m.match.folder+'/pbi.json');let draft=false;try{draft=JSON.parse(raw||'{}').wizard?.status==='draft';}catch{}
 if(draft)await loadDraft();else{tab('continue');msg('Selected '+m.match.folder+' in Continue PBI. Describe what to continue, or use Review & approve.');}});
action('dupReview',async()=>{const m=closeDup();if(!m)return;await refreshPbis();$('existingPbi').value=m.match.folder;$('existingPbi').onchange();tab('continue');await loadReview();});
action('dupNew',async()=>{const m=closeDup();if(!m)return;$('separateDraft').checked=true;await createIntake(m.zipOnly,m.draft);});
$('dupCancel').onclick=()=>{closeDup();msg('Cancelled. Nothing was saved.');};
action('saveNew',()=>createIntake(false));action('saveDraft',()=>createIntake(false,true));action('newZip',()=>createIntake(true));
async function refreshPbis(){needRoot();clearArchitectureReport();config=await activeConfig();pbiItems=await PBI.listPbis(root);const select=$('existingPbi');select.replaceChildren(new Option(pbiItems.length?'Choose a PBI':'No saved PBIs found',''));for(const item of pbiItems)select.add(new Option((item.number?item.number+' · ':'')+item.title+' ['+item.folder.split('/').pop()+']',item.folder));$('pbiDetails').textContent='';msg(pbiItems.length+' PBI folders found.');await refreshSqlRegistrationDisplay();await refreshGraphqlReferenceDisplay();await refreshCoordinatorDisplay();await syncJourney();}
action('refresh',refreshPbis);
$('existingPbi').onchange=()=>{const item=pbiItems.find(x=>x.folder===$('existingPbi').value);$('pbiDetails').textContent=item?item.folder+'\nDocuments present: '+(item.present.join(', ')||'Intake metadata only')+(item.metadataWarning?'\n'+item.metadataWarning:'')+'\nFile presence does not prove business approval.':'';};
async function createRefinement(zipOnly){config=zipOnly?needConfig():await activeConfig();const folder=zipOnly?($('existingPbi').value||$('manualPbi').value.trim()):$('existingPbi').value;if(!folder)throw Error(zipOnly?'Select or enter the existing PBI folder.':'Find and select an existing PBI first.');if(!zipOnly&&!(await PBI.listPbis(root)).some(x=>x.folder===folder))throw Error('The selected PBI is no longer available. Refresh the list.');const result=PBI.refinePbi(folder,$('changes').value);if(zipOnly)download(PBI.zip(result.files),'PBI-refinement.zip');else await PBI.apply(root,await PBI.plan(root,result.files));showPrompt('Continue this PBI in Copilot',result.folder,result.prompt,zipOnly);msg(zipOnly?'Refinement ZIP prepared. Extract it into the same repository before sending the prompt.':'Refinement brief saved. Existing PBI documents have not been changed by the form.');}
action('saveRefine',()=>createRefinement(false));
async function loadDraft(){config=await activeConfig();const folder=selectedPbi(),raw=await PBI.read(root,folder+'/pbi.json');if(!raw)throw Error('This PBI has no saved intake (pbi.json). Continue it in Copilot instead.');const r=JSON.parse(raw);
 if(r.wizard?.status!=='draft')throw Error('This PBI was already sent for analysis. Continue or refine it instead; its original request is kept unchanged.');
 const v=(id,x)=>{$(id).value=typeof x==='string'?x:'';};v('pbiTitle',r.title);v('pbiNumber',r.number);v('pbiDescription',r.description);v('acceptanceCriteria',r.acceptanceCriteria);v('pbiNotes',r.notes);v('pbiScope',r.scope);v('businessReason',r.businessReason);v('businessExample',r.businessExample);v('businessUnit',r.businessUnit);
 $('changeType').value=CHANGE_LABEL[r.changeType]?r.changeType:'unsure';setTarget(r.application);setMode(r.analysisMode);fillLegacy();if(r.legacy?.key&&legacyOptions().some(o=>o.key===r.legacy.key))$('legacyRepo').value=r.legacy.key;pbiRefs=Array.isArray(r.references)?r.references.map(String):[];showRefs();
 draftFolder=folder;draftAttachments=Array.isArray(r.attachments)?r.attachments:[];tab('new');showStep(1);
 if([...$('targetProject').children].some(o=>o.value===r.project))$('targetProject').value=r.project;else v('customProject',r.project===config.projectName?'':r.project);
 $('attachments').value='';$('attachments').onchange();showStep(Math.max(1,STEPS.indexOf(r.wizard.step)+1));msg('Draft loaded from '+folder+'. Saving updates this folder; earlier versions go to its history folder.');}
action('loadDraft',loadDraft);
async function stateOf(folder){const raw=await PBI.read(root,folder+'/pbi-state.json');if(raw===null)throw Error('This PBI has no pbi-state.json yet. Start the analysis in Copilot first.');try{return JSON.parse(raw);}catch{throw Error('pbi-state.json is not valid JSON. Ask the agent to repair it.');}}
const decisionDialog=document.createElement('dialog');decisionDialog.id='decisionDialog';decisionDialog.className='wide';decisionDialog.setAttribute('aria-label','Business decisions');
const decisionHost=$('questionBox');decisionHost.parentNode?.insertBefore(decisionDialog,decisionHost);
let decisionSession=null;
function closeDecisionDialog(){decisionDialog.close?.();decisionHost.classList.add('hidden');decisionSession=null;}
function openDecisionDialog(){if(decisionDialog.showModal){decisionDialog.append(decisionHost);if(!decisionDialog.open)decisionDialog.showModal();}}
decisionDialog.oncancel=()=>{closeDecisionDialog();};
const decisionActions=document.createElement('div');decisionActions.className='buttons';
async function saveDecisionReview(draft){if(!decisionSession)throw Error('Reload the questions first.');const session=decisionSession;
 const answers=[...$('questionList').children].map(section=>({...section.decisionAnswer(),by:$('answeredBy').value}));
 for(const [source,digest] of session.sourceFingerprints){const bytes=await PBI.readBytes(root,source),current=bytes===null?null:await PBI.hashBytes(bytes);if(current!==digest)throw Error('Source evidence changed since this popup opened. Reload the questions before saving.');}
 await PBI.recordAnswers(root,session.folder,answers,{draft,expectedState:session.expectedState});
 reviewing=null;$('approveBox').classList.add('hidden');$('reviewCards').replaceChildren();
 closeDecisionDialog();await loadQuestions();if(draft)closeDecisionDialog();
 const continued=draft?null:await PBI.advanceWorkflow(root,session.folder);
 msg(draft?'Decision draft saved. No answers were approved.':'Selected answers saved in the decision log. Unanswered questions remain open.\nNext: '+continued.next.action+' - '+continued.next.next);await syncJourney();}
for(const [label,draft] of [['Save Answers',false],['Save Draft / Decide Later',true],['Cancel',null]]){const button=document.createElement('button');button.textContent=label;button.className=draft===false?'':'secondary';button.onclick=()=>draft===null?closeDecisionDialog():runAction(()=>saveDecisionReview(draft));decisionActions.append(button);}
decisionHost.append(decisionActions);
function questionCard(q,state,invalidEvidence){
 const options=(Array.isArray(q.options)?q.options:[]).filter(o=>o&&o.key),reason=q.recommendationWhy||q.recommendationReason||q.recommendationExplanation;
 const ids=[...new Set(Array.isArray(q.recommendationEvidence)?q.recommendationEvidence:[])],evidence=Array.isArray(state.evidence)?state.evidence:[],criteria=Array.isArray(state.acceptanceCriteria)?state.acceptanceCriteria:[],decisions=Array.isArray(state.decisions)?state.decisions:[],rules=Array.isArray(state.rules)?state.rules:[];
 const excluded=Array.isArray(state.evidenceScope?.exclude)?state.evidenceScope.exclude:[],nonempty=x=>typeof x==='string'&&x.trim();
 const references=ids.map(id=>evidence.find(e=>e&&e.id===id&&!invalidEvidence.has(id)&&e.stale!==true&&PBI.READINESS.evidenceKinds.includes(e.kind)&&PBI.READINESS.evidenceLevels.includes(e.level)
  &&nonempty(e.source)&&nonempty(e.location)&&nonempty(e.summary)&&!excluded.includes(e.system)&&(e.system===undefined||PBI.READINESS.evidenceSystems.includes(e.system))&&(e.component===undefined||PBI.READINESS.evidenceComponents.includes(e.component))&&(e.kind!=='external'||nonempty(e.revision))
  &&(!e.source.startsWith('playbook/pbis/')||e.source.startsWith('playbook/pbis/'+state.pbi+'/')))
  ||criteria.find(a=>a&&a.id===id&&Number.isInteger(a.rev)&&a.rev>=1&&PBI.READINESS.acTypes.includes(a.type)&&PBI.meaningful(a.criterion)&&Array.isArray(a.rules)&&a.rules.length&&a.rules.every(r=>rules.some(x=>x&&x.id===r)))
  ||decisions.find(d=>d&&d.id===id&&d.pbi===state.pbi&&d.status==='approved'&&nonempty(d.evidence)));
 const recommended=typeof reason==='string'&&reason.trim()&&ids.length&&references.every(Boolean)?options.find(o=>o.key===q.recommended):null;
 const section=document.createElement('section'),title=document.createElement('h4'),text=document.createElement('p');
 section.className='question-card';title.textContent=q.id+(q.blocking===true?' · required':' · optional')+(q.status==='deferred'?' · deferred':'');text.textContent=q.question||'(no question text recorded)';section.append(title,text);
 const info=(heading,value)=>{const p=document.createElement('p');p.textContent=heading+': '+(value||'Not recorded.');section.append(p);};
 info('Recommendation',recommended?recommended.key+'. '+recommended.text+' (recommended)':'NO RECOMMENDATION — no evidence-backed option is recorded.');
 info('Why',reason);
 info('Business impact',q.businessImpact);info('Technical impact',q.technicalImpact);
 if(ids.length)info('Evidence',ids.map((id,i)=>id+(references[i]?.source?' · '+references[i].source+' — '+references[i].location+(references[i].kind==='external'?' (external source freshness not verified)':references[i].kind==='repo-file'&&!references[i].sha256?' (no recorded source hash)':''):references[i]?'':' · not verified')).join('\n'));
 if(q.why||q.example)info('Context',[q.why,q.example&&'Example: '+q.example].filter(Boolean).join(' '));
 if(q.answer?.text)info('Previously recorded answer',q.answer.text);
 const label=document.createElement('label');label.textContent='Your answer';const select=document.createElement('select');
 select.append(new Option('Choose an option',''));for(const o of options)select.append(new Option('Option '+o.key+'. '+o.text+(recommended===o?' (recommended)':''),o.key));
 select.append(new Option('Custom answer','custom'),new Option('Decide Later','later'));if(q.answer?.option)select.value=q.answer.option;
 const customLabel=document.createElement('label');customLabel.textContent='Custom answer';const custom=document.createElement('textarea');custom.value=q.answer?.option==='custom'?q.answer.text||'':'';
 custom.classList.toggle('hidden',select.value!=='custom');select.onchange=()=>custom.classList.toggle('hidden',select.value!=='custom');
 section.append(label,select,customLabel,custom);
 const buttons=document.createElement('div');buttons.className='buttons';const save=document.createElement('button');save.textContent=q.answer?'Revise answer':'Save answer';
 save.onclick=()=>runAction(async()=>{if(!$('answeredBy').value.trim())throw Error('Enter your name; it is recorded with the decision.');
  const result=await PBI.recordAnswer(root,selectedPbi(),q.id,{option:select.value,custom:custom.value,by:$('answeredBy').value});lastAnswered=q.id;
  const continued=await PBI.advanceWorkflow(root,selectedPbi());
  const note=result.decision.supersedes?' (earlier decision kept as superseded)':'';await loadQuestions();msg('Saved '+result.decision.id+' for '+q.id+note+'.\nNext: '+continued.next.action+' - '+continued.next.next);});
 buttons.append(save);
 if(q.status!=='deferred'){const defer=document.createElement('button');defer.className='secondary';defer.textContent='Decide later';defer.onclick=()=>runAction(async()=>{await PBI.recordSkip(root,selectedPbi(),q.id);await loadQuestions();msg(q.id+' deferred. It remains unresolved and will not be treated as approval.');});buttons.append(defer);}
 buttons.style.display='none';
 const choices=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Your answer';choices.append(legend);
 const basis=PBI.questionBasis(state,q),draft=q.draftAnswer?.basis===basis?q.draftAnswer:null;
 if(draft){select.value=draft.option;custom.value=draft.text||'';}
 else if(q.evidenceChanged)select.value='';
 else if(!q.answer&&recommended&&references.every(e=>e.kind!=='external'&&(e.kind!=='repo-file'||e.sha256)))select.value=recommended.key;
 const radios=[];
 for(const option of [...options,{key:'custom',text:'Custom Answer'},{key:'later',text:'Decide Later'}]){const row=document.createElement('label'),radio=document.createElement('input'),caption=document.createElement('span');row.className='radio';radio.type='radio';radio.name='answer-'+q.id;radio.value=option.key;radio.checked=select.value===option.key;
  caption.textContent=(['custom','later'].includes(option.key)?'':'Option '+option.key+'. ')+option.text+(recommended?.key===option.key?' - RECOMMENDED':'');
  radio.onchange=()=>{select.value=radio.value;for(const other of radios)other.checked=other===radio;select.onchange();};radios.push(radio);row.append(radio,caption);choices.append(row);}
 select.classList.add('hidden');label.classList.add('hidden');customLabel.classList.toggle('hidden',select.value!=='custom');
 const previousChange=select.onchange;select.onchange=()=>{previousChange();customLabel.classList.toggle('hidden',select.value!=='custom');for(const radio of radios)radio.checked=radio.value===select.value;};select.onchange();
 section.decisionAnswer=()=>({id:q.id,option:select.value,custom:custom.value,invalidate:q.evidenceChanged===true});
 section.append(choices,buttons);return section;
}
async function loadQuestions(id){needRoot();const folder=selectedPbi(),s=await stateOf(folder),expectedState=JSON.stringify(s),p=PBI.questionProgress(s),all=(Array.isArray(s.questions)?s.questions:[]).filter(q=>q&&typeof q.id==='string');
 let questions=id?all.filter(q=>q.id===id):all.filter(q=>q.status!=='superseded'&&!PBI.READINESS.questionResolved.includes(q.status));
 if(id&&!questions.length)throw Error('Question '+id+' is not in this PBI.');
 const needed=new Set(all.flatMap(q=>[...(q.evidence||[]),...(q.recommendationEvidence||[])])),sources=new Map(),invalidEvidence=new Set(),sourceFingerprints=new Map();
 for(const e of Array.isArray(s.evidence)?s.evidence:[]){if(!e||!needed.has(e.id)||e.kind!=='repo-file'||e.stale===true)continue;
  try{PBI.safePath(e.source);}catch{invalidEvidence.add(e.id);continue;}
  if(!sources.has(e.source))sources.set(e.source,[]);sources.get(e.source).push(e);}
 for(const [source,entries] of sources){let bytes;try{bytes=await PBI.readBytes(root,source);}catch(e){if(e.name!=='TypeMismatchError')throw e;bytes=null;}
  const digest=bytes!==null?await PBI.hashBytes(bytes):null;sourceFingerprints.set(source,digest);
  for(const e of entries)if(bytes===null||(typeof e.sha256==='string'&&e.sha256.toLowerCase()!==digest))invalidEvidence.add(e.id);}
 for(const q of all){if(q.status==='superseded'||!PBI.READINESS.questionResolved.includes(q.status))continue;
  if((q.answerBasis&&q.answerBasis!==PBI.questionBasis(s,q))||[...(q.evidence||[]),...(q.recommendationEvidence||[])].some(id=>invalidEvidence.has(id)||(s.evidence||[]).some(e=>e.id===id&&e.stale))){q.evidenceChanged=true;if(!id&&!questions.includes(q))questions.push(q);}}
 if(!questions.length){closeDecisionDialog();$('questionList').replaceChildren();return 'No unresolved business questions: '+p.answered+' of '+p.total+' answered'+(p.deferred.length?'; decide later: '+p.deferred.join(', '):'')+'.';}
 decisionSession={folder,expectedState,sourceFingerprints};
 $('questionBox').classList.remove('hidden');$('questionProgress').textContent=(id?'Editing '+id+'. ':'')+questions.length+' unresolved question(s) shown together; '+p.answered+' already answered and preserved.';
 $('questionList').replaceChildren(...questions.map(q=>questionCard(q,s,invalidEvidence)));openDecisionDialog();return '';}
action('loadQuestions',async()=>{const info=await loadQuestions();msg(info||'Answer the independent questions below, enter custom answers when needed, or defer a question.');});
const selectExistingPbi=$('existingPbi').onchange;
$('existingPbi').onchange=()=>{selectExistingPbi();syncJourney();const folder=$('existingPbi').value;setTimeout(()=>{if($('existingPbi').value===folder)runAction(async()=>{await refreshCoordinatorDisplay();if(folder&&await PBI.read(root,folder+'/pbi-state.json'))await loadQuestions();});},0);};
window.addEventListener?.('focus',()=>{if(root&&!decisionDialog.open&&$('existingPbi').value)runAction(async()=>{if(await PBI.read(root,selectedPbi()+'/pbi-state.json'))await loadQuestions();});});
action('editPrevious',async()=>{needRoot();const p=PBI.questionProgress(await stateOf(selectedPbi())),prev=lastAnswered||p.answeredQuestions.filter(q=>q.answeredAt).sort((a,b)=>String(a.answeredAt).localeCompare(String(b.answeredAt))).map(q=>q.id).pop();
 if(!prev)throw Error('No answered question to edit yet.');await loadQuestions(prev);msg('Change the answer and submit. The earlier decision is kept as superseded.');});
action('showDecisions',async()=>{needRoot();const d=PBI.questionProgress(await stateOf(selectedPbi())).decisions;msg(d.length?d.map(x=>x.id+' · '+(x.status||'?')+(x.supersedes?' · replaces '+x.supersedes:'')+(x.decision?'\n  '+x.decision:'')+(x.evidence?'\n  '+x.evidence:'')).join('\n'):'No decisions recorded for this PBI yet.');});action('refineZip',()=>createRefinement(true));
action('copyPrompt',async()=>{try{await navigator.clipboard.writeText($('promptText').value);msg('Prompt copied. Paste it into your project’s PBI Builder in Copilot Chat.');}catch{$('promptText').focus();$('promptText').select();msg('Automatic clipboard access is unavailable. The prompt is selected: press Ctrl+C to copy.');}});
$('versionBadge').textContent='PBI Builder · '+PBI.VERSION;
document.addEventListener('DOMContentLoaded',()=>{originalHTML='<!doctype html>\n'+document.documentElement.outerHTML;previewName();if(window.location&&(window.location.hash==='#new'||window.location.hash.startsWith('#draft='))){tab('new');showStep(1);msg('Interactive intake: choose the installed project folder, then complete these four steps. Saved draft links restore captured answers. This is the browser form, not an IDE popup.');}if(!window.showDirectoryPicker)msg('Folder access is not available here. Open this downloaded file in desktop Edge or Chrome, or use the ZIP fallback.',true);});

async function createComparison(zipOnly){
 const c=zipOnly?needConfig():await activeConfig();
 if(!zipOnly&&!(await PBI.read(root,PBI.AGENT)))throw Error('Install the version '+PBI.VERSION+' setup first so the current agent is available.');
 config=c;
 const result=PBI.comparison(c,{title:$('comparisonTitle').value,description:$('comparisonDescription').value},$('comparisonBaseline').value);
 if(zipOnly)download(PBI.zip(result.files),'Akzo-PBI-'+result.id+'.zip');
 else await PBI.apply(root,await PBI.plan(root,result.files));
 $('comparisonOutput').classList.remove('hidden');
 $('comparisonWhere').textContent=result.reportFolder;
 $('comparisonNext').textContent=zipOnly?'ZIP prepared only. Extract it into the project with version '+PBI.VERSION+' installed before sending these prompts. It includes the baseline agent.':'Both original requests and the '+PBI.BASELINES[result.baseline].label+' baseline agent are saved. Start separate new chats and use the exact agent names below. Remove comparison agents after the trial.';
 for(const r of result.runs){$(r.profile+'Name').textContent=r.agentName;$(r.profile+'Prompt').value=r.prompt;}
 msg(zipOnly?'Comparison ZIP prepared. No AI tasks have run.':'Comparison ready. No AI tasks have run and no savings have been measured.');
 $('comparisonOutput').scrollIntoView({behavior:'smooth',block:'start'});
}
action('saveComparison',()=>createComparison(false));
action('comparisonZip',()=>createComparison(true));
async function copyComparison(profile){const el=$(profile+'Prompt');try{await navigator.clipboard.writeText(el.value);msg('Prompt copied. Start a new Copilot chat and select '+$(profile+'Name').textContent+'.');}catch{el.focus();el.select();msg('Press Ctrl+C to copy the selected prompt.');}}
action('copyBaseline',()=>copyComparison('baseline'));
action('copyCurrent',()=>copyComparison('current'));
action('cleanupComparison',async()=>{needRoot();const r=await PBI.cleanupComparison(root,await activeConfig());msg((r.removed.length?'Removed: '+r.removed.join(', '):'No unchanged comparison agents found.')+(r.kept.length?'\nKept because they were edited: '+r.kept.join(', '):'')+'\nTrial folders and results are kept.');});
function selectedPbi(){const folder=$('existingPbi').value||$('manualPbi').value.trim();if(!folder)throw Error('Find and select an existing PBI first.');return folder;}
action('exportHandoff',async()=>{needRoot();const r=await PBI.exportHandoff(root,selectedPbi()),h=r.handoff;msg('Wrote '+r.files.join(' and ')+'\nReadiness: '+r.report.computedStatus+' · rules: '+h.rules.length+' · branches: '+h.rules.reduce((n,x)=>n+x.branches.length,0)+' · open gaps: '+h.gaps.length+' · disposition: '+r.disposition+'\n'+(r.disposition==='DEVELOPMENT_READY'?'Use Start Development to hand the approved PBI to the Akzo Master SDD agent.':'Not approved for development: share it as a working draft only.')+' Earlier exports were copied to history/.');});
// Start Development: the verified handoff and, per implementation target, the command that queues its Refined PBI for the Akzo Master
// SDD agent. A browser cannot start another agent: the commands are copied, and the SDD agent still asks for its own selection and approval.
async function startDevelopment(folder,out){needRoot();const repo=$('displayPath').value.trim(),r=await PBI.startDevelopment(root,folder,repo),m=r.manifest;
 const text=['Start Development · '+(m.pbi.number?'PBI '+m.pbi.number+' · ':'')+(m.pbi.title||folder),
  'Handoff verified: '+r.disposition+'. '+m.files.length+' files match HANDOFF-MANIFEST.json and the approval by '+m.approval.by+', '+m.approval.at+'.'+(r.adopted?' The handoff was created now from that approval; nothing was approved again.':''),'',
  '1. In PowerShell'+(repo?'':' opened at the repository root')+', queue each Refined PBI for the Akzo Master SDD agent:',
  ...r.targets.flatMap(t=>['',t.area+(t.repository?' ('+t.repository+')':'')+': '+t.document,t.command]),'',
  ...(r.references.length?['Read-only references (never changed): '+r.references.map(x=>x.area||x.key).join(', '),'']:[]),
  '2. Open the target repository, select the Akzo Master SDD agent in Copilot Chat and type: start',
  'The commands only queue the PBI; they start nothing. The SDD agent asks you to confirm the PBI and approve the implementation.'].join('\n');
 if(out){out.textContent=text;out.classList.remove('hidden');}
 let copied=false;try{await navigator.clipboard.writeText(r.targets.map(t=>t.command).join('\n'));copied=true;}catch{}
 msg(text+'\n\n'+(copied?'The commands are on the clipboard. Copying them does not start the SDD agent.':'Copy the commands above; the clipboard is not available here.'));}
action('startDevelopmentPbi',()=>startDevelopment(selectedPbi()));
action('checkReadiness',async()=>{needRoot();const {report:r,next}=await PBI.advanceWorkflow(root,selectedPbi());msg('Readiness for '+r.pbi+'\nComputed status: '+r.computedStatus+(r.claimedStatus?' (claimed: '+r.claimedStatus+')':'')+'\nFinal PBIs allowed: '+(r.finalAllowed?'yes':'no')+'\n\n'+(r.issues.map(x=>'['+x.cap+'] '+x.code+' '+x.ref+': '+x.message).join('\n')||'No issues found.')+(PBI.READINESS.statuses.indexOf(r.computedStatus)>=3?'\n\nApproval basis (the final approval is recorded by Review & approve; give the agent a block only for an external PO/BA or technical approval it records):\n'+Object.entries(r.review).map(([k,v])=>k+' (fingerprint '+v.fingerprint+'): '+JSON.stringify(v.basis)).join('\n'):'')+'\n\nNext: '+next.next+(next.decision?'\n'+next.decision.options.map(o=>o.key+'. '+o.text+(o.recommended?' (recommended)':'')).join('\n'):'')+'\n\nThis checks completeness and consistency only, not business correctness or who approved.',!r.finalAllowed);});
action('discoverSources',async()=>{needRoot();const {result:m,metrics}=await PBI.measure(()=>PBI.discoverSources(root,needConfig()));showRun('Discover sources',metrics);const ch=m.changes;lastAccess=Object.fromEntries(m.sources.map(s=>[s.key,s.status]));
 msg([(m.written?'Wrote ':'Checked (no changes written) ')+PBI.SOURCE_MAP.replace('source-map.json','SOURCE-MAP.md')+' ('+m.filesScanned+' files scanned'+(m.truncated?', stopped early':'')+').','Solutions: '+m.solutions.length+' · projects: '+m.projects.length,...m.sources.map(s=>s.key+': '+s.status+(s.checkedFile?' (read '+s.checkedFile+')':s.reason?' ('+s.reason+')':'')),
  'Since the last map: '+ch.added.length+' added, '+ch.modified.length+' changed, '+ch.removed.length+' removed; '+ch.reused+' unchanged solution/project file(s) reused without rereading.',
  (m.repository?'Repository: '+(m.repository.branch||'detached')+' @ '+(m.repository.commit||'unknown').slice(0,12)+'. ':'')+m.fileIndex.files+' source file names indexed in '+m.fileIndex.path.split('/').pop()+'.'].join('\n'),m.sources.some(s=>s.status==='configured-inaccessible'));await syncJourney();});
action('refreshEvidence',async()=>{needRoot();const {result:r,metrics}=await PBI.measure(()=>PBI.refreshEvidence(root));showRun('Refresh evidence',metrics);msg(r.checked||r.skipped.length?'Checked '+r.checked+' evidence entries. Newly fingerprinted: '+r.fingerprinted.length+'. Reusable unchanged: '+r.reusable.length+'. Stale: '+(r.stale.join(', ')||'none')+'.'+(r.skipped.length?' Outside this repository (not fingerprinted): '+r.skipped.join(', ')+'.':'')+(r.written?' Index updated.':' No changes.'):'No evidence index found at '+PBI.KNOWLEDGE+'. The agent creates it when it records reusable knowledge.',r.stale.length>0);});

// ---- Run details and the journey bar ----
// Counts of what an operation actually did stay collapsed; nothing is sent anywhere.
function showRun(label,m){$('runDetailsText').textContent=label+'\nFile opens: '+m.fileOpens+' ('+m.distinctFiles+' distinct, '+m.repeatedOpens+' repeated, '+m.missingOpens+' missing)\nBytes read: '+m.bytesRead+'\nDirectory entries listed: '+m.entriesListed+' · size checks: '+m.statChecks+'\nWrites: '+m.writes+' ('+m.bytesWritten+' bytes) · unchanged writes skipped: '+m.skippedWrites+'\nElapsed: '+m.elapsedMs+' ms\nModel tokens and agent tool calls are reported by the chat host, not by this page.';$('runDetails').classList.remove('hidden');}
// The journey follows saved files only: repositories, then the workflow stages Intake to COMPLETE (PBI.PHASES). It never blocks an action.
const JOURNEY=['repos','enter','analyze','questions','review','approve','refined','complete'];let lastAccess;
function showJourney(stage){JOURNEY.forEach((k,i)=>{const li=$('journey-'+k);li.classList.toggle('done',i<stage);li.setAttribute('aria-current',i===stage?'step':'false');});}
async function syncJourney(){
 try{
  if(!root||!config){showJourney(0);return;}
  let folder=null;try{folder=selectedPbi();}catch{}
  if(!folder){showJourney(1);return;}
  const raw=await PBI.read(root,folder+'/pbi-state.json');
  if(raw===null){showJourney(2);return;}
  const st=JSON.parse(raw),progress=PBI.questionProgress(st);
  if(progress.next||progress.deferred.length){showJourney(3);return;}
  const check=await PBI.checkPbi(root,folder);
  showJourney(check.computedStatus==='Development-Ready'&&check.finalAllowed?(await PBI.finalArtifacts(root,folder,st)?7:6):PBI.approvalBlockers(check).length?4:5);
 }catch{showJourney(root&&config?1:0);}
}

// ---- Review & approve: one final approval, generation and downloads ----
let reviewing=null;
const DOC_LABEL={'Refined-PBI-CDMS.md':'Refined PBI: CDMS backend','Refined-PBI-DAB.md':'Refined PBI: DAB backend','Refined-PBI-UI.md':'Refined PBI: Shared Angular UI','REFINED-PBI.md':'Refined PBI'};
function card(title,text,cls){const sec=document.createElement('section'),h=document.createElement('h4'),p=document.createElement('p');h.textContent=title;p.textContent=text;if(cls)p.className=cls;sec.append(h,p);return sec;}
async function loadReview(){needRoot();const folder=selectedPbi(),r=await PBI.checkPbi(root,folder,true),reviewedSnapshot=r.reviewedContent,cr=await PBI.contentReview(root,folder);
 // A credential in a working document blocks approval; instruction-like text is shown, never removed.
 const blockers=[...PBI.approvalBlockers(r),...cr.blocking.map(s=>({code:'SENSITIVE_DATA',ref:s.path,message:s.kind+' ('+s.count+'). Ask the agent to replace it with [REDACTED: '+s.kind+'].'}))];
 let st={},req={};try{st=JSON.parse(await PBI.read(root,folder+'/pbi-state.json')||'{}')||{};}catch{}try{req=JSON.parse(await PBI.read(root,folder+'/pbi.json')||'{}')||{};}catch{}
 const L=x=>Array.isArray(x)?x.filter(y=>y&&typeof y==='object'):[],codes=new Set(r.issues.map(i=>i.code)),t=PBI.TARGETS[PBI.targetKey(req.application)]||PBI.TARGETS.unsure,applies=k=>st.paths?.[k]?.applies===true;
 const reqIssues=r.issues.filter(i=>/^(NO_RULES|NO_ACS|CONTENT_MISSING|MISSING_COVERAGE|AC_|RULE_INCOMPLETE)/.test(i.code));
 const ev=L(st.evidence),lv=['code','registration','reach','runtime'].map(l=>ev.filter(e=>e.level===l).length+' '+l).join(', '),warnings=r.warnings||[],vc=v=>ev.filter(e=>(e.verification||'VERIFIED')===v).length;
 const gapText=ref=>{const [rid,gid]=String(ref).split('/'),g=L(L(st.rules).find(x=>x.id===rid)?.gaps).find(x=>x.id===gid);return g?.description?' — '+g.description:'';};
 const owned=k=>L(st.rules).filter(x=>x.paths?.[k]&&x.paths[k].status!=='not-applicable').length;
 const q=L(st.questions),open=q.filter(x=>x.blocking===true&&!['resolved','answered','approved','not-applicable','superseded'].includes(x.status));
 if(reviewedSnapshot!==await PBI.reviewFingerprint(root,folder))throw Error('PBI changed while it was being reviewed. Reload the review before approving.');
 reviewing={folder,req,st,check:r,blockers,reviewedSnapshot};
 $('reviewCards').replaceChildren(
  card('PBI',(req.number?'PBI '+req.number+' · ':'')+(req.title||st.pbi||folder)+'\n'+folder+'\nDevelopment target: '+(PBI.APPLICATIONS[req.application]||'Not recorded')),
  card('Requirements and acceptance criteria',L(st.rules).length+' business rules · '+L(st.acceptanceCriteria).length+' acceptance criteria\n'+(reqIssues.length?'Incomplete: '+reqIssues.map(i=>i.code+' '+i.ref).join(', '):'Complete: every rule has its required criteria.'),reqIssues.length?'bad':'good'),
  card('Repository analysis','Legacy: '+(req.legacy?req.legacy.name+' ('+req.legacy.path+')':'not recorded')+'\nAnalysis mode: '+(PBI.ANALYSIS_MODES[req.analysisMode]||'Deep')+'\nPaths in scope: '+(Object.keys(st.paths||{}).filter(applies).join(', ')||'none')+'\nEvidence: '+ev.length+' records ('+lv+'); '+vc('VERIFIED')+' verified, '+vc('ASSUMED')+' assumed, '+vc('UNAVAILABLE')+' unavailable'+(ev.some(e=>e.kind==='external')?'\nExternal evidence uses recorded revisions; current source freshness outside this repository is not checked.':'')),
  card('Implementation approach',(t.implement.length?t.implement.map(k=>(k==='ui'?'Shared Angular UI':k.toUpperCase())+': '+(applies(k)?owned(k)+' rule(s)':'not applying ('+(st.paths?.[k]?.reason||'no reason')+')')).join('\n')+'\nDeliverables (Refined PBI): '+t.documents.filter(n=>applies({'Refined-PBI-CDMS.md':'cdms','Refined-PBI-DAB.md':'dab','Refined-PBI-UI.md':'ui'}[n])).join(', '):'No development target recorded: one REFINED-PBI.md.')),
  card('Business decisions',L(st.decisions).filter(d=>d.status==='approved').length+' approved decision(s)\n'+(open.length?'Open blocking questions: '+open.map(x=>x.id).join(', '):'No open blocking questions')+(q.some(x=>x.status==='deferred')?'\nDecide later: '+q.filter(x=>x.status==='deferred').map(x=>x.id).join(', '):''),open.length?'bad':'good'),
  card('Untrusted content and sensitive data',(cr.secrets.length?'Values that look like credentials: '+cr.secrets.map(s=>s.path+': '+s.kind+' ('+s.count+')').join(', '):'No credentials detected.')+'\n'+(cr.instructions.length?'Instruction-like text (untrusted, not followed):\n'+cr.instructions.slice(0,8).map(w=>'- '+w.source+':'+w.line+' '+w.kind+': "'+w.text+'"').join('\n')+(cr.instructions.length>8?'\n… and '+(cr.instructions.length-8)+' more':''):'No instruction-like text detected.')+(cr.unscanned.length?'\nNot scanned (binary or large): '+cr.unscanned.join(', '):''),cr.blocking.length||cr.instructions.length?'bad':'good'),
  card('Technical readiness','Status: '+r.computedStatus+'\n'+(blockers.length?blockers.map(i=>'['+i.code+'] '+i.ref+': '+i.message).join('\n'):'No blockers. Your approval is the only step left.'+(codes.has('APPROVAL_STALE')?' The earlier approval is stale because the content changed.':'')),blockers.length?'bad':'good'),...(warnings.length?[card('Warnings (these do not block approval)',warnings.map(w=>'['+w.impact+'] '+w.ref+(w.code==='GAP_OPEN'?gapText(w.ref):': '+w.message)).join('\n'),'')]:[]));
 const plan=req.analysisPlan?.passes||[];
 $('evidenceDetailsText').textContent=[plan.length?'Analysis plan\n'+plan.map((p,i)=>(i+1)+'. '+p.key+': '+p.scope).join('\n')+(req.analysisPlan.ui?'\nShared UI: '+req.analysisPlan.ui.reason:''):'',
  'Evidence records ('+ev.length+')\n'+(ev.map(e=>'- '+e.id+' ['+e.level+', '+(e.verification||'VERIFIED')+(e.stale===true?', stale':'')+'] '+e.source+' — '+e.location+(e.revision?' ('+e.revision+')':'')+': '+e.summary).join('\n')||'None recorded.'),
  warnings.length?'Warnings ('+warnings.length+')\n'+warnings.map(w=>'- ['+w.impact+'] '+w.ref+': '+w.message+(w.code==='GAP_OPEN'?gapText(w.ref):'')).join('\n'):''].filter(Boolean).join('\n\n');
 $('evidenceDetails').classList.remove('hidden');$('approveBox').classList.remove('hidden');$('approveGenerate').dataset.blocked=blockers.length?'1':'';$('approveGenerate').disabled=blockers.length>0;
 msg(blockers.length?'Not ready for approval: '+blockers.length+' blocker(s) are listed under Technical readiness. Request Changes sends them to the agent.':'Ready for your approval. Approve & Generate records it and generates the final PBIs.',blockers.length>0);
 showJourney(r.computedStatus==='Development-Ready'&&r.finalAllowed?(await PBI.finalArtifacts(root,folder,st)?7:6):blockers.length?4:5);}
action('loadReview',loadReview);
function needReview(){if(!reviewing||reviewing.folder!==selectedPbi())throw Error('Review the selected PBI first.');return reviewing;}
action('approveGenerate',async()=>{const v=needReview();if(v.blockers.length)throw Error('Resolve the blockers under Technical readiness first.');if(!$('approverName').value.trim())throw Error('Enter your name to approve.');
 const r=await PBI.approveAndGenerate(root,v.folder,$('approverName').value,v.reviewedSnapshot);await refreshPbis();$('existingPbi').value=v.folder;await loadReview();showDone(r,v.req);});
action('requestChanges',async()=>{const v=needReview(),note=$('reviewNote').value.trim();if(!note)throw Error('Describe the changes you request.');
 const result=PBI.refinePbi(v.folder,'Change requested at Review & approve:\n'+note+(v.blockers.length?'\n\nOpen blockers:\n'+v.blockers.map(i=>'['+i.code+'] '+i.ref+': '+i.message).join('\n'):''));await PBI.apply(root,await PBI.plan(root,result.files));
 showPrompt('Request changes in Copilot',result.folder,result.prompt,false);msg('Change request saved. Nothing was approved. Send the prompt to the agent, then review again.');});
action('saveReviewDraft',async()=>{const v=needReview(),path=v.folder+'/history/REVIEW-'+new Date().toISOString().replace(/[-:TZ.]/g,'')+'.md';
 await PBI.write(root,path,PBI.redactSecrets('# Review saved as draft (not approved)\n\nReviewer: '+($('approverName').value.trim()||'not given')+'\n\n'+[...$('reviewCards').children].map(x=>'## '+x.children[0].textContent+'\n\n'+x.children[1].textContent).join('\n\n')+'\n\n## Note\n\n'+($('reviewNote').value.trim()||'None')+'\n').text);
 msg('Saved as draft in '+path+'. Nothing was approved.');});
async function saveFile(blob,name){if(window.showSaveFilePicker){try{const h=await window.showSaveFilePicker({suggestedName:name}),w=await h.createWritable();await w.write(blob);await w.close();msg('Saved '+name+'.');return;}catch(e){if(e.name==='AbortError'){msg('Download cancelled.');return;}throw e;}}download(blob,name);msg('Downloaded '+name+'.');}
// Every download is read back from the generated file and checked against the hash recorded at generation.
async function generated(name){const x=done.files.find(f=>f.name===name);if(!x)throw Error('Not generated: '+name);const b=await PBI.readBytes(root,x.path);if(b===null||await PBI.hashBytes(b)!==x.sha256)throw Error(name+' is missing or changed since it was generated. Generate again from Review & approve.');return b;}
const MIME={md:'text/markdown',json:'application/json',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
let done=null;
function showDone(r,req){done=r;const list=$('doneList');
 $('doneSummary').textContent=(req.number?'PBI '+req.number+' · ':'')+(req.title||r.folder)+'\nStatus: '+r.check.computedStatus+' · '+r.documents.length+' PBI(s) generated and verified.';
 list.replaceChildren(...r.documents.map(doc=>{const row=document.createElement('div'),t=document.createElement('strong');row.className='doc-row';t.textContent=(DOC_LABEL[doc]||doc)+' ('+doc+')';row.append(t);const base=doc.replace(/\.md$/,'');
  for(const [kind,label] of [['docx','Download DOCX'],['md','Download MD'],['json','Download JSON'],['preview','Preview']]){const b=document.createElement('button');b.className='secondary';b.textContent=label;
   b.onclick=async()=>{try{if(kind==='preview'){const p=$('donePreview');p.textContent=new TextDecoder().decode(await generated(doc));p.classList.remove('hidden');return;}const n=base+'.'+kind;await saveFile(new Blob([await generated(n)],{type:MIME[kind]}),n);}catch(e){msg(e.message,true);}};row.append(b);}
  return row;}));
 $('donePath').textContent='Saved in '+r.folder+' in the selected repository, with the development handoff (HANDOFF-MANIFEST.json). Browsers cannot open File Explorer; open this folder from your editor.';$('donePreview').classList.add('hidden');$('devHandoff').classList.add('hidden');
 const d=$('doneDialog');if(d.showModal&&!d.open)d.showModal();msg('Refined PBI generated successfully: '+r.documents.join(', ')+' (with DOCX and JSON). Every file was verified. COMPLETE. Development handoff: business-rules.json, BRANCH-COVERAGE-MATRIX.md and HANDOFF-MANIFEST.json ('+r.handoff.disposition+').');}
action('startDevelopment',()=>{if(!done)throw Error('Generate the final PBIs first.');return startDevelopment(done.folder,$('devHandoff'));});
action('downloadAll',async()=>{if(!done)throw Error('Generate the final PBIs first.');
 await saveFile(PBI.zip(await PBI.developmentPackage(root,done.folder,done.files)),done.folder.split('/').pop()+'-final-pbis.zip');});
$('doneClose').onclick=()=>{const d=$('doneDialog');if(d.close)d.close();};
$('viewPbiArchitecture').onclick=()=>{
 try{
  needRoot();
  const folder=selectedPbi();
  if(!pbiItems.some(item=>item.folder===folder))throw Error('Select a PBI found in the selected project first; ZIP-only folders cannot be read here.');
  clearArchitectureReport(false);
  $('visualizationChoices').classList.remove('hidden');
  $('visualizationChoices').scrollIntoView({behavior:'smooth',block:'nearest'});
  msg('Choose one numbered report. It reads the saved PBI state only; it does not change approval or handoff files.');
 }catch(error){msg('Visualization unavailable: '+error.message,true);}
};
async function createArchitectureReport(view){
 needRoot();
 const folder=selectedPbi();
 if(!pbiItems.some(item=>item.folder===folder))throw Error('Select a PBI found in the selected project first; ZIP-only folders cannot be read here.');
 clearArchitectureReport(false);
 const report=await PBIVisualization.loadReport(view,name=>PBI.read(root,folder+'/'+name));
 currentArchitectureReport=report;
 $('visualizationReport').innerHTML='<style>'+PBIVisualization.STYLES+'</style>'+report.fragment;
 $('visualizationPreview').classList.remove('hidden');
 $('visualizationPreview').scrollIntoView({behavior:'smooth',block:'start'});
 msg(report.title+' is ready. The report uses recorded evidence references and has not changed the PBI, approval or handoff files.');
}
action('visualizeWorkflow',()=>createArchitectureReport('workflow'));
action('visualizeImpact',()=>createArchitectureReport('impact'));
action('visualizeTraceability',()=>createArchitectureReport('traceability'));
action('visualizeComplete',()=>createArchitectureReport('complete'));
action('downloadPbiArchitecture',async()=>{
 if(!currentArchitectureReport)throw Error('Generate a visual report first.');
 await saveFile(new Blob([currentArchitectureReport.html],{type:'text/html;charset=utf-8'}),currentArchitectureReport.filename);
});
$('closePbiArchitecture').onclick=()=>clearArchitectureReport();
const existingPbiOnChange=$('existingPbi').onchange;
$('existingPbi').onchange=()=>{clearArchitectureReport();if(existingPbiOnChange)existingPbiOnChange();};
