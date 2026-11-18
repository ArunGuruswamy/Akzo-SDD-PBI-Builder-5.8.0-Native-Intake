'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const P=require('./src/core.js'),C=require('./src/phase01-contracts.js'),{DirectoryHandle}=require('./fixtures/fs-handles.cjs');
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS',name);}
async function fixture(pbi='pbi-phase04'){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'akzo-phase04-')),root=new DirectoryHandle(dir),
  folder='playbook/pbis/'+pbi,state={schemaVersion:2,pbi,status:'Needs Evidence',rules:[{id:'REQ-1',rule:'The measurement is processed consistently.'}],
   acceptanceCriteria:[{id:'AC-1',criterion:'The measurement result is correct.',rules:['REQ-1']}],questions:[]},
  sourceHandles=new Map(),sourcePaths={};
 await P.write(root,folder+'/pbi-state.json',JSON.stringify(state));
 for(const [repositoryKey,commit] of [['legacy','a'],['cdms','b'],['dab','c'],['ui','d'],['pbi-builder-reference-library','e']]){
  const repoPath=path.join(dir,'source-'+repositoryKey);await fs.mkdir(path.join(repoPath,'.git'),{recursive:true});
  await fs.writeFile(path.join(repoPath,'.git','HEAD'),commit.repeat(40));
  const files=repositoryKey==='pbi-builder-reference-library'?{
   'references/cdms/schema.sql':'CREATE TABLE Measurement (MeasurementId integer PRIMARY KEY);',
   'references/graphql/schema.graphql':'type Query { measurement: String }'
  }:{'src/Handler.cs':'class MeasurementHandler { }'};
  for(const [relative,content] of Object.entries(files)){const full=path.join(repoPath,...relative.split('/'));await fs.mkdir(path.dirname(full),{recursive:true});await fs.writeFile(full,content);}
  sourceHandles.set(repositoryKey,new DirectoryHandle(repoPath));sourcePaths[repositoryKey]=Object.keys(files)[0];
  const saved=await P.registerAnalysisSourceRoot(root,folder,{repositoryKey,sourceHandle:sourceHandles.get(repositoryKey),
   actorRole:'coordinator',expectedSha256:(await P.loadAnalysisExtension(root,folder,{required:false}))?.sha256||null});
  sourceHandles.set(saved.sourceRoot.rootId,sourceHandles.get(repositoryKey));
 }
 return {dir,root,folder,state,sourceHandles,sourcePaths};
}
async function prepare(f,specialistTypes=C.SPECIALISTS){
 const current=await P.loadAnalysisExtension(f.root,f.folder,{required:true});
 return P.prepareSpecialistTasks(f.root,f.folder,{actorRole:'coordinator',expectedSha256:current.sha256,specialistTypes});
}
async function makeResult(f,task,{status='VERIFIED_EXISTING',sourceHandles=f.sourceHandles}={}){
 const preferred=task.specialistType==='graphql-schema'?'pbi-builder-reference-library':null,
  snapshot=task.sourceSnapshots.find(item=>item.repositoryKey===preferred&&sourceHandles.has(item.rootId))||
   task.sourceSnapshots.find(item=>sourceHandles.has(item.rootId))||task.sourceSnapshots[0],
  handle=sourceHandles.get(snapshot.rootId),allowed=task.allowedScope.find(item=>item.sourceRootId===snapshot.rootId),
  candidates=task.specialistType==='sql-relationship'?['references/cdms/schema.sql','playbook/pbi-builder/references/cdms/schema.sql']:
   task.specialistType==='graphql-schema'?['references/graphql/schema.graphql','playbook/pbi-builder/references/graphql/schema.graphql']:['src/Handler.cs'],
  relativePath=candidates.find(item=>allowed.relativePrefix==='*'||item===allowed.relativePrefix||item.startsWith(allowed.relativePrefix+'/'));
 assert.ok(relativePath,'task has a valid evidence path');
 const bytes=await fs.readFile(path.join(handle.path,...relativePath.split('/'))),sha256=crypto.createHash('sha256').update(bytes).digest('hex'),
  evidenceId='E-SF-'+task.taskId+'-1',findingId='SF-'+task.taskId+'-1',
  evidence={schema:C.SCHEMAS.evidence,schemaVersion:1,evidenceId,requirementId:task.requirementId,
   acceptanceCriterionId:task.acceptanceCriterionId,repositoryKey:snapshot.repositoryKey,sourceRootId:snapshot.rootId,
   relativePath,sourceRevision:snapshot.revision,sha256,symbol:'MeasurementHandler',category:
    task.specialistType==='sql-relationship'?'static-schema':task.specialistType==='graphql-schema'?'static-schema':'source-code',
   verificationMethod:'coordinator-local-source-hash',description:'Source file inspected for the assigned criterion.',
   executionContext:'Static source review only.',limitations:['No runtime or registration claim.'],
   verificationStatus:'VERIFIED',lineStart:1,lineEnd:1},
  finding={schema:C.SCHEMAS.coverage,schemaVersion:1,findingId,requirementId:task.requirementId,
   acceptanceCriterionId:task.acceptanceCriterionId,repositoryKey:snapshot.repositoryKey,sourceRevision:snapshot.revision,
   status,originalStatus:null,decisionBlocker:false,rationale:'Classification is supported by the cited source.',
   evidenceRefs:[evidenceId],blockingQuestionIds:[]};
 if(status==='MISSING'){finding.missingBehavior='The required behavior was not found in the inspected source.';
  finding.implementationTasks=['Confirm and implement the missing behavior.'];finding.testScenarios=['Test the required behavior.'];
  finding.investigation={searchedRepositories:[snapshot.repositoryKey],executionBoundaries:['Assigned source snapshot'],
   searchMethods:['static source inspection'],limitations:[]};}
 const result={schema:C.SCHEMAS.specialistResult,schemaVersion:2,taskId:task.taskId,taskRevision:task.taskRevision,
  resultRevision:task.taskRevision,runId:task.runId,parentPackageId:task.parentPackageId,specialistType:task.specialistType,
  cancellationIdentity:task.cancellationIdentity,canonicalStateRevision:task.canonicalStateRevision,
  parentCoordinatorRevision:task.parentCoordinatorRevision,sourceSnapshots:task.sourceSnapshots,status:'COMPLETED',
  validationStatus:'SUBMITTED',submittedAt:'2026-03-01T12:00:00.000Z',evidence:[evidence],evidenceRefs:[evidenceId],
  coverageFindings:[finding],questions:[],findings:['Source inspected.'],unresolvedQuestions:[],conflicts:[],errors:[],operations:['read']};
 return {result,sourceHandles};
}
async function updateTask(f,task,lifecycleStatus='ASSIGNED'){
 const current=await P.loadAnalysisExtension(f.root,f.folder,{required:true});
 return P.setSpecialistTaskStatus(f.root,f.folder,task.taskId,lifecycleStatus,{actorRole:'coordinator',expectedSha256:current.sha256});
}
async function importResult(f,result,sourceHandles){
 const current=await P.loadAnalysisExtension(f.root,f.folder,{required:true});
 return P.importSpecialistResult(f.root,f.folder,result,{actorRole:'coordinator',expectedSha256:current.sha256,sourceHandles});
}
async function main(){
 const f=await fixture();
 try{
  await test('prepares six manual read-only roles, exports stable tasks, and checks scope',async()=>{
   const prepared=await prepare(f);assert.equal(prepared.prepared.length,6);
   const extension=(await P.loadAnalysisExtension(f.root,f.folder,{required:true})).extension;
   assert.deepEqual(extension.specialistTasks.map(task=>task.specialistType).sort(),[...C.SPECIALISTS].sort());
   const task=extension.specialistTasks.find(item=>item.specialistType==='sql-relationship'),exported=P.exportSpecialistTask(task);
   assert.equal(exported.envelope.executionMode,'MANUAL_EXPORT_IMPORT');assert.equal(exported.json,P.exportSpecialistTask(task).json);
   assert.equal(C.authorizeSpecialistOperation(task,'read',task.sourceSnapshots[0].rootId,'references/cdms/schema.sql'),true);
   assert.throws(()=>C.authorizeSpecialistOperation(task,'edit',task.sourceSnapshots[0].rootId,'references/cdms/schema.sql'),/not authorized/);
   assert.throws(()=>P.exportSpecialistTask({...task,schemaVersion:99}),/unsupported schema version/);
  });
  let ext=(await P.loadAnalysisExtension(f.root,f.folder,{required:true})).extension;
  const tasks=[...ext.specialistTasks].sort((a,b)=>a.specialistType.localeCompare(b.specialistType));
  for(const task of tasks)await updateTask(f,task);
  await test('stale hashes, malformed inputs, cancellation, and source scope fail closed with durable rejection',async()=>{
   await updateTask(f,tasks[0],'EXECUTING');
   const executing=await P.loadAnalysisExtension(f.root,f.folder,{required:true});
   await assert.rejects(()=>P.setSpecialistTaskStatus(f.root,f.folder,tasks[0].taskId,'ASSIGNED',
    {actorRole:'coordinator',expectedSha256:executing.sha256}),/cannot change EXECUTING to ASSIGNED/);
   const task=tasks[0],made=await makeResult(f,task),stale={...made.result,parentCoordinatorRevision:'f'.repeat(64)};
   const before=await P.loadAnalysisExtension(f.root,f.folder,{required:true});
   await assert.rejects(()=>P.importSpecialistResult(f.root,f.folder,made.result,{actorRole:'coordinator',expectedSha256:'0'.repeat(64)}),/ANALYSIS_EXTENSION_CHANGED/);
   const rejected=await P.importSpecialistResult(f.root,f.folder,stale,{actorRole:'coordinator',expectedSha256:before.sha256,sourceHandles:made.sourceHandles});
   assert.equal(rejected.status,'RESULT_REJECTED');
   const reloaded=(await P.loadAnalysisExtension(f.root,f.folder,{required:true})).extension;
   assert.ok(reloaded.coordinator.events.some(item=>item.eventType==='RESULT_REJECTED'));
   assert.equal(reloaded.specialistResults.length,0);
   const canceledTask=tasks[1],cancelState=await P.loadAnalysisExtension(f.root,f.folder,{required:true});
   await P.setSpecialistTaskStatus(f.root,f.folder,canceledTask.taskId,'CANCELLED',{actorRole:'coordinator',expectedSha256:cancelState.sha256});
   const canceled=await makeResult(f,canceledTask);
   const canceledState=await P.loadAnalysisExtension(f.root,f.folder,{required:true});
   const cancelResult=await P.importSpecialistResult(f.root,f.folder,canceled.result,{actorRole:'coordinator',
    expectedSha256:canceledState.sha256,sourceHandles:canceled.sourceHandles});
   assert.equal(cancelResult.status,'RESULT_REJECTED');
   const canceledReload=await P.loadAnalysisExtension(f.root,f.folder,{required:true});
   await assert.rejects(()=>P.setSpecialistTaskStatus(f.root,f.folder,canceledTask.taskId,'ASSIGNED',
    {actorRole:'coordinator',expectedSha256:canceledReload.sha256}),/cannot change CANCELLED to ASSIGNED/);
   assert.throws(()=>C.validateSpecialistTask({...tasks[2],allowedOperations:['write']}),/read-only operations/);
   const outOfScope=await makeResult(f,tasks[2]);outOfScope.result.evidence[0].relativePath='../outside.cs';
   assert.equal((await importResult(f,outOfScope.result,outOfScope.sourceHandles)).status,'RESULT_REJECTED');
   const wrongHash=await makeResult(f,tasks[3]);wrongHash.result.evidence[0].sha256='f'.repeat(64);
   assert.equal((await importResult(f,wrongHash.result,wrongHash.sourceHandles)).status,'RESULT_REJECTED');
   let questionState=await P.loadAnalysisExtension(f.root,f.folder,{required:true}),questionExtension=JSON.parse(JSON.stringify(questionState.extension));
   for(const questionId of ['Q-DEFER-1','Q-CANCEL-1'])questionExtension.questions.push({
    schema:C.SCHEMAS.question,schemaVersion:1,questionId,requirementId:'REQ-1',acceptanceCriterionId:'AC-1',
    type:'free-text',status:'pending',prompt:'Record the owner decision.',evidenceRefs:[],allowCustom:false,
    blocking:true,blockingScope:'acceptance-criterion',options:[],answer:null});
   questionExtension.packageRevision++;questionExtension.analysisPackage.packageRevision++;
   questionState=await P.saveAnalysisExtension(f.root,f.folder,questionExtension,{actorRole:'coordinator',expectedSha256:questionState.sha256});
   for(const [questionId,status] of [['Q-DEFER-1','deferred'],['Q-CANCEL-1','cancelled']]){
    const saved=await P.setCoordinatorQuestionStatus(f.root,f.folder,questionId,status,'Awaiting authorized owner input.',
     {actorRole:'coordinator',expectedSha256:questionState.sha256});
    assert.equal(saved.question.status,status);
    questionState=await P.loadAnalysisExtension(f.root,f.folder,{required:true});
    assert.ok(C.packageApprovalBlockers(questionState.extension).some(item=>item==='Question '+questionId+' is '+status+'.'));
   }
  });
  // The rejected tasks are intentionally not reused in this fixture; verify the complete path in a fresh one.
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}
 const good=await fixture('pbi-phase04-good');
 try{
  const prepared=await prepare(good),tasks=(await P.loadAnalysisExtension(good.root,good.folder,{required:true})).extension.specialistTasks;
  const ordered=[...tasks].sort((a,b)=>a.specialistType.localeCompare(b.specialistType));
  for(const task of ordered)await updateTask(good,task);
  await test('valid results persist across reload, idempotent imports hold, and conflicting duplicates are rejected',async()=>{
   for(const [index,task] of ordered.entries()){
    const made=await makeResult(good,task,{status:index===0?'MISSING':'VERIFIED_EXISTING'}),
     imported=await importResult(good,made.result,made.sourceHandles);
    assert.equal(imported.status,'RESULT_VALIDATED');
    const reload=(await P.loadAnalysisExtension(good.root,good.folder,{required:true})).extension;
    assert.equal(reload.specialistResults.length,index+1);assert.equal(reload.specialistResults[index].validationStatus,'VALIDATED');
    assert.equal(reload.specialistTasks.find(item=>item.taskId===task.taskId).lifecycleStatus,'COMPLETE');
    const duplicate=await importResult(good,made.result,made.sourceHandles);assert.equal(duplicate.unchanged,true);
    if(index===0){const conflicting=JSON.parse(JSON.stringify(made.result));conflicting.findings=['Contradictory duplicate.'];
     assert.equal((await importResult(good,conflicting,made.sourceHandles)).status,'RESULT_REJECTED');}
   }
  });
  await test('consolidation creates evidence-backed conflict question; explicit decision resolves it without upgrading unverified evidence',async()=>{
   let current=await P.loadAnalysisExtension(good.root,good.folder,{required:true}),
    first=await P.consolidateSpecialistAnalysis(good.root,good.folder,{actorRole:'coordinator',expectedSha256:current.sha256});
   assert.equal(first.report.coverage[0].status,'CONFLICTING');
   const questionId=first.report.coverage[0].questionIds[0],pending=(await P.loadAnalysisExtension(good.root,good.folder,{required:true})).extension;
   assert.ok(pending.questions.find(item=>item.questionId===questionId&&item.status==='pending'));
   assert.ok(C.packageApprovalBlockers(pending).some(item=>item.includes('CONFLICTING')));
   current=await P.loadAnalysisExtension(good.root,good.folder,{required:true});
   await assert.rejects(()=>P.answerCoordinatorQuestion(good.root,good.folder,questionId,{key:'INVALID'},'reviewer',
    {actorRole:'coordinator',expectedSha256:current.sha256}),/recorded option keys/);
   const answered=await P.answerCoordinatorQuestion(good.root,good.folder,questionId,{key:'STATUS-MISSING'},'reviewer',
    {actorRole:'coordinator',expectedSha256:current.sha256});
   current=await P.loadAnalysisExtension(good.root,good.folder,{required:true});
   const resolved=await P.consolidateSpecialistAnalysis(good.root,good.folder,{actorRole:'coordinator',expectedSha256:current.sha256});
   assert.equal(resolved.report.coverage[0].status,'MISSING');
   assert.deepEqual(resolved.report.coverage[0].decisionIds,[answered.decision.decisionId]);
   assert.deepEqual(C.packageApprovalBlockers((await P.loadAnalysisExtension(good.root,good.folder,{required:true})).extension),[]);
   const changed=JSON.parse(JSON.stringify((await P.loadAnalysisExtension(good.root,good.folder,{required:true})).extension));
   const evidenceIds=new Set(changed.specialistResults[0].evidence.map(item=>item.evidenceId));
   for(const evidence of changed.evidence)if(evidenceIds.has(evidence.evidenceId))evidence.verificationStatus='UNVERIFIED';
   for(const result of changed.specialistResults)for(const evidence of result.evidence)
    if(evidenceIds.has(evidence.evidenceId))evidence.verificationStatus='UNVERIFIED';
   for(const result of changed.specialistResults)for(const finding of result.coverageFindings)
    if(finding.evidenceRefs.some(ref=>evidenceIds.has(ref))){finding.status='UNVERIFIED';finding.verificationTask='Independently verify the cited source content.';}
   for(const finding of changed.coverageFindings)if(finding.evidenceRefs.some(ref=>evidenceIds.has(ref))){
    finding.status='UNVERIFIED';finding.verificationTask='Independently verify the cited source content.';
   }
   assert.ok(C.packageApprovalBlockers(changed).some(item=>item.includes('UNVERIFIED')));
  });
  await test('source snapshot changes stale existing tasks and force a new coordinator revision',async()=>{
   const before=await P.loadAnalysisExtension(good.root,good.folder,{required:true}),oldTask=before.extension.specialistTasks[0],
    newPath=path.join(good.dir,'source-dab-new');
   await fs.mkdir(path.join(newPath,'.git'),{recursive:true});await fs.writeFile(path.join(newPath,'.git','HEAD'),'f'.repeat(40));
   const registered=await P.registerAnalysisSourceRoot(good.root,good.folder,{repositoryKey:'dab',sourceHandle:new DirectoryHandle(newPath),
    actorRole:'coordinator',expectedSha256:before.sha256});
   const stale=registered.extension.specialistTasks.find(item=>item.taskId===oldTask.taskId);
   assert.equal(stale.lifecycleStatus,'STALE');
   const staleRetry=await makeResult(good,oldTask);
   assert.equal((await importResult(good,staleRetry.result,staleRetry.sourceHandles)).status,'RESULT_REJECTED');
   const afterRetry=await P.loadAnalysisExtension(good.root,good.folder,{required:true});
   assert.ok(C.packageApprovalBlockers(afterRetry.extension).some(item=>item.includes('not been consolidated')));
   const newer=await P.prepareSpecialistTasks(good.root,good.folder,{actorRole:'coordinator',expectedSha256:afterRetry.sha256});
   assert.notDeepEqual(newer.prepared,[]);
   assert.ok(newer.extension.specialistTasks.some(item=>item.taskId!==oldTask.taskId));
   assert.ok(C.packageApprovalBlockers(newer.extension).some(item=>item.includes('PREPARED')));
   const current=await P.loadAnalysisExtension(good.root,good.folder,{required:true}),
    report=await P.consolidateSpecialistAnalysis(good.root,good.folder,{actorRole:'coordinator',expectedSha256:current.sha256});
   assert.equal(report.report.coverage[0].status,'UNVERIFIED');
   assert.deepEqual(report.report.coverage[0].evidenceRefs,[],'old-revision specialist findings are excluded from current coverage');
  });
 }finally{await fs.rm(good.dir,{recursive:true,force:true});}
 const unverified=await fixture('pbi-phase04-unverified');
 try{
  await test('missing local source handles downgrade claimed verification and block approval',async()=>{
   await prepare(unverified,['cdms']);
   let extension=(await P.loadAnalysisExtension(unverified.root,unverified.folder,{required:true})).extension,task=extension.specialistTasks[0];
   await updateTask(unverified,task);
   const made=await makeResult(unverified,task),imported=await importResult(unverified,made.result,new Map());
   assert.equal(imported.result.evidence[0].verificationStatus,'UNVERIFIED');
   assert.equal(imported.result.coverageFindings[0].status,'UNVERIFIED');
   extension=(await P.loadAnalysisExtension(unverified.root,unverified.folder,{required:true})).extension;
   assert.ok(C.packageApprovalBlockers(extension).some(item=>item.includes('UNVERIFIED')));
   const report=await P.consolidateSpecialistAnalysis(unverified.root,unverified.folder,{actorRole:'coordinator',
    expectedSha256:(await P.loadAnalysisExtension(unverified.root,unverified.folder,{required:true})).sha256});
   assert.equal(report.report.coverage[0].status,'UNVERIFIED');
   assert.ok(report.report.coverage[0].missingSpecialists.includes('qa-evidence'));
  });
 }finally{await fs.rm(unverified.dir,{recursive:true,force:true});}
 console.log('Phase 04 coordinator tests passed ('+count+' checks).');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
