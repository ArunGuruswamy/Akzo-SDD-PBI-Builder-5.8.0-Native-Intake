'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const C=require('./src/phase01-contracts.js'),P=require('./src/core.js'),{DirectoryHandle,FileHandle}=require('./fixtures/fs-handles.cjs');
const digest=char=>char.repeat(64),clone=value=>JSON.parse(JSON.stringify(value));

async function fixture(){
 const state={schemaVersion:2,pbi:'pbi-phase01',status:'Draft',rules:[]},parentStateRevision=await C.stateRevision(state);
 const extension=C.createAnalysisExtension({parentPbiId:state.pbi,parentStateRevision,packageId:'pkg-phase01'});
 const roots=[
  {rootId:'root-cdms',repositoryKey:'cdms',revision:'cdms-r1',sha256:digest('a')},
  {rootId:'root-dab',repositoryKey:'dab',revision:'dab-r1',sha256:digest('b')},
  {rootId:'root-ui',repositoryKey:'ui',revision:'ui-r1',sha256:digest('c')}
 ];
 extension.sourceRoots=roots;
 const evidence=(evidenceId,repositoryKey,sourceRootId,sourceRevision)=>({
  schema:C.SCHEMAS.evidence,schemaVersion:1,evidenceId,requirementId:'REQ-1',acceptanceCriterionId:'AC-1',
  repositoryKey,sourceRootId,relativePath:'src/Measurement.cs',sourceRevision,sha256:digest('d'),
  symbol:'Measurement.Handle',category:'source-code',verificationMethod:'static-source-review',
  description:'Source declaration and behavior read directly.',executionContext:'source-only; no runtime claim',
  limitations:['Registration and runtime behavior are not established.'],verificationStatus:'VERIFIED',lineStart:10,lineEnd:20
 });
 const sqlEvidence={...evidence('E-SQL','dab','root-dab','dab-r1'),relativePath:'schema/keys.csv',sha256:digest('e'),
  symbol:'dbo.Measurement.MeasurementId',category:'static-schema'};
 extension.evidence=[
  evidence('E-CDMS','cdms','root-cdms','cdms-r1'),
  evidence('E-DAB','dab','root-dab','dab-r1'),
  evidence('E-UI','ui','root-ui','ui-r1'),sqlEvidence
 ];
 const finding=(findingId,status='VERIFIED_EXISTING')=>({
  schema:C.SCHEMAS.coverage,schemaVersion:1,findingId,requirementId:'REQ-1',acceptanceCriterionId:'AC-1',
  repositoryKey:'dab',sourceRevision:'dab-r1',status,originalStatus:null,decisionBlocker:false,
  rationale:'Reviewed source evidence supports this classification.',evidenceRefs:['E-DAB'],blockingQuestionIds:[]
 });
 extension.coverageFindings=[
  finding('F-EXISTING'),
  {...finding('F-GAP','MISSING'),missingBehavior:'The required DAB handler behavior is absent.',
   implementationTasks:['Implement the missing DAB handler behavior.'],testScenarios:['Verify valid and invalid requests.'],
   investigation:{searchedRepositories:['dab'],executionBoundaries:['DAB application source'],searchMethods:['symbol and call-site search'],limitations:[]}}
 ];
 extension.cdmsPluginRules=[{
  schema:C.SCHEMAS.cdmsPluginRule,schemaVersion:1,businessRuleId:'RULE-1',requirementId:'REQ-1',acceptanceCriterionId:'AC-1',
  pluginStatus:'FOUND',pluginProject:'Measurement.Plugins',pluginClass:'MeasurementPlugin',method:'Execute',
  evidenceRefs:['E-CDMS'],sourceEvidenceRefs:['E-CDMS'],registrationEvidenceRefs:[],registrationStatus:'UNVERIFIED',
  crmMessage:null,targetEntity:'measurement',pipelineStage:null,preconditions:[],validationConditions:['Input is valid.'],
  dataDependencies:[],sideEffects:[],unresolvedQuestions:[],decisionBranches:[],relatedEntityFields:[],
  coverageStatus:'VERIFIED_EXISTING'
 }];
 extension.dabTranslations=[{
  schema:C.SCHEMAS.dabTranslation,schemaVersion:1,translationId:'TRANSLATION-1',requirementId:'REQ-1',acceptanceCriterionId:'AC-1',
  cdmsStatus:'FOUND',sourceCdmsBusinessRuleId:'RULE-1',cdmsEvidenceRefs:['E-CDMS'],dabEvidenceRefs:['E-DAB'],
  dabCoverageStatus:'MISSING',fieldMappings:[],missingDabBehavior:'The application handler does not yet implement the required rule.',
  implementationBoundary:'Implement in the DAB application handler and validator.',implementationInstructions:['Implement the missing DAB handler behavior.'],
  testScenarios:['Verify valid and invalid requests.'],unresolvedQuestions:[]
 }];
 extension.sqlRelationships=[{
  schema:C.SCHEMAS.sqlRelationship,schemaVersion:1,relationshipId:'SQL-1',artifactId:'sql-export-1',artifactSha256:digest('e'),
  sourceRootId:'root-dab',relativePath:'schema/keys.csv',environment:'development',sourceRevision:'dab-r1',
  kind:'primary-key',table:{schema:'dbo',name:'Measurement'},primaryKeyColumns:['MeasurementId'],foreignKey:null,
  validationStatus:'VERIFIED',unresolvedSchemaQualification:false,blocking:false,conflictingEvidenceRefs:[],evidenceRefs:['E-SQL'],unresolvedQuestions:[]
 }];
 const nodes=['ui-label','angular-component','binding','model','api-operation','backend-service','entity-field']
  .map((kind,order)=>({nodeId:'NODE-'+order,kind,order,repositoryKey:'ui',relativePath:'src/measurement.ts',symbol:'MeasurementView'}));
 extension.uiMappings=[{
  schema:C.SCHEMAS.uiMapping,schemaVersion:1,mappingId:'UI-1',requirementId:'REQ-1',acceptanceCriterionId:'AC-1',
  displayLabel:'Measurement',status:'VERIFIED',blocking:false,nodes,
  edges:nodes.slice(0,-1).map((node,i)=>({edgeId:'EDGE-'+i,fromNodeId:node.nodeId,toNodeId:nodes[i+1].nodeId,evidenceRefs:['E-UI']})),
  unresolvedQuestions:[]
 }];
 const task={
  schema:C.SCHEMAS.specialistTask,schemaVersion:1,runId:'RUN-1',taskId:'TASK-1',parentPackageId:'pkg-phase01',
  specialistType:'angular-ui',canonicalStateRevision:parentStateRevision,cancellationIdentity:'CANCEL-1',
  sourceSnapshots:[roots[2]],allowedScope:[{sourceRootId:'root-ui',relativePrefix:'src'}],
  allowedOperations:['read','search'],inputEvidenceRefs:['E-UI'],status:'COMPLETED'
 };
 extension.specialistTasks=[task];
 extension.specialistResults=[{
  schema:C.SCHEMAS.specialistResult,schemaVersion:1,runId:task.runId,taskId:task.taskId,parentPackageId:task.parentPackageId,
  specialistType:task.specialistType,cancellationIdentity:task.cancellationIdentity,status:'COMPLETED',cancelled:false,canonicalStateRevision:parentStateRevision,
  sourceSnapshots:[roots[2]],evidenceRefs:['E-UI'],findings:['F-EXISTING'],unresolvedQuestions:[],conflicts:[],errors:[],operations:['read']
 }];
 extension.questions=[{
  schema:C.SCHEMAS.question,schemaVersion:1,questionId:'Q-1',requirementId:'REQ-1',acceptanceCriterionId:'AC-1',
  type:'single-choice',status:'pending',prompt:'Which behavior is intended?',evidenceRefs:[],allowCustom:true,blocking:false,
  blockingScope:'acceptance-criterion',options:[{key:'A',label:'Option A'},{key:'B',label:'Option B'}],answer:null
 }];
 extension.decisions=[];
 extension.analysisPackage.children=[{
  provisionalChildId:'pbi-child-provisional',provisional:true,targetRepository:'dab',responsibility:'Implement the confirmed DAB gap.',
  requirementIds:['REQ-1'],acceptanceCriterionIds:['AC-1'],coverageFindingIds:['F-GAP'],dependencies:[],sharedUiWorkId:null
 }];
 extension.analysisPackage.evidenceRefs=['E-CDMS','E-DAB','E-UI','E-SQL'];
 return {state,extension};
}

async function main(){
 const {state,extension}=await fixture();
 assert.equal(C.COVERAGE_STATUSES.length,5);
 for(const [internal,expected]of Object.entries({
  VERIFIED_IMPLEMENTED:'VERIFIED_EXISTING',PARTIALLY_IMPLEMENTED:'PARTIALLY_IMPLEMENTED',
  VERIFIED_MISSING:'MISSING',UNVERIFIED_SOURCE:'UNVERIFIED',UNVERIFIED_RUNTIME:'UNVERIFIED',
  BUSINESS_DECISION_REQUIRED:'UNVERIFIED'
 }))assert.equal(C.normalizeCoverageStatus(internal).status,expected);
 assert.equal(C.normalizeCoverageStatus('BUSINESS_DECISION_REQUIRED').decisionBlocker,true);
 assert.throws(()=>C.normalizeCoverageStatus('UNKNOWN'),/unknown/);
 const normalizedDecision=C.normalizeCoverageFinding({...extension.coverageFindings[0],status:'BUSINESS_DECISION_REQUIRED',
  verificationTask:'Resolve the recorded business decision.',blockingQuestionIds:['Q-1']});
 assert.equal(normalizedDecision.originalStatus,'BUSINESS_DECISION_REQUIRED');assert.equal(normalizedDecision.decisionBlocker,true);
 assert.equal(C.validateCoverageFinding(normalizedDecision),normalizedDecision);
 assert.throws(()=>C.validateAnalysisExtension({...extension,schemaVersion:2}),/schemaVersion 1/);
 assert.equal(C.validateAnalysisExtension(extension,{parentPbiId:state.pbi}),extension);
 assert.throws(()=>C.validateEvidence({...extension.evidence[0],relativePath:'../secrets.txt'}),/repository-relative/);
 assert.throws(()=>C.validateEvidence({...extension.evidence[0],sha256:'bad'}),/SHA-256/);
 const staleEvidence=clone(extension);staleEvidence.evidence.find(item=>item.evidenceId==='E-DAB').verificationStatus='STALE';
 assert.throws(()=>C.validateAnalysisExtension(staleEvidence),/verified coverage and investigated gaps require verified evidence/);
 assert.throws(()=>C.validateCoverageFinding({...extension.coverageFindings[0],implementationTasks:['Change behavior']}),/cannot recommend implementation/);
 assert.throws(()=>C.validateCoverageFinding({...extension.coverageFindings[1],investigation:undefined}),/investigation/);
 assert.throws(()=>C.validateCoverageFinding({...extension.coverageFindings[0],status:'UNVERIFIED',verificationTask:undefined}),/verificationTask/);
 assert.throws(()=>C.validateCdmsPluginRule({...extension.cdmsPluginRules[0],registrationStatus:'VERIFIED'} ,extension.evidence),/registration or runtime evidence/);
 assert.throws(()=>C.validateDabTranslation({...extension.dabTranslations[0],implementationInstructions:['Create a CRM plugin.']},extension.evidence),/CRM plugin infrastructure/);
 assert.throws(()=>C.validateDabTranslation({...extension.dabTranslations[0],implementationBoundary:'Implement a CRM plugin.'},extension.evidence),/CRM plugin infrastructure/);
 assert.throws(()=>C.validateDabTranslation({...extension.dabTranslations[0],cdmsStatus:'NOT_FOUND',sourceCdmsBusinessRuleId:null},extension.evidence),/CDMS investigation/);
 assert.throws(()=>C.validateSqlRelationship({...extension.sqlRelationships[0],unresolvedSchemaQualification:true},extension.evidence),/cannot be verified/);
 assert.throws(()=>C.validateSqlRelationship({...extension.sqlRelationships[0],kind:'foreign-key',primaryKeyColumns:[],
  foreignKey:{constraintId:'FK-1',referencedTable:{schema:'dbo',name:'Parent'},columns:[
   {ordinal:2,localColumn:'PartB',referencedColumn:'PartB'},{ordinal:1,localColumn:'PartA',referencedColumn:'PartA'}]}},extension.evidence),/ordered by contiguous ordinal/);
 assert.throws(()=>C.validateAnalysisExtension({...extension,sqlRelationships:[{...extension.sqlRelationships[0],artifactSha256:digest('9')}]}),/exact source artifact and hash/);
 assert.throws(()=>C.validateUiMapping({...extension.uiMappings[0],edges:extension.uiMappings[0].edges.slice(1)},extension.evidence),/consecutive/);

 const task=extension.specialistTasks[0];
 assert.equal(C.authorizeSpecialistOperation(task,'search','root-ui','src/components/view.ts'),true);
 assert.throws(()=>C.authorizeSpecialistOperation(task,'write','root-ui','src/file.ts'),/not authorized/);
 assert.throws(()=>C.authorizeSpecialistOperation(task,'read','root-ui','private/file.ts'),/outside its allowed scope/);
 const staleResult=clone(extension.specialistResults[0]);staleResult.sourceSnapshots[0].sha256=digest('9');
 assert.throws(()=>C.validateSpecialistResult(staleResult,task),/source revision\/hash is stale/);
 assert.throws(()=>C.validateSpecialistResult({...extension.specialistResults[0],cancellationIdentity:'CANCEL-OLD'},task),/cancellation identity is stale/);
 assert.throws(()=>C.validateSpecialistResult({...extension.specialistResults[0],cancelled:true},task),/cancelled specialist results/);
 assert.throws(()=>C.validateQuestion({...extension.questions[0],status:'answered',answer:{source:'user',answeredAt:'now',stateRevision:extension.parentStateRevision,value:''}}),/cannot be empty/);
 const answeredQuestion={...extension.questions[0],status:'answered',answer:{source:'user',answeredAt:'now',stateRevision:extension.parentStateRevision,value:'A'}};
 assert.equal(C.validateQuestion(answeredQuestion),answeredQuestion);
 const reordered=clone(extension);reordered.sourceRoots.reverse();reordered.evidence.reverse();reordered.coverageFindings.reverse();

 const approvalRequest=await C.createPackageApprovalRequest(extension,{requestedBy:'coordinator'});
 const approval=await C.recordPackageApproval(extension,approvalRequest,{approvedBy:'reviewer',approvedAt:'2026-01-01T00:00:00Z',evidence:'Approved in the review record.'});
 assert.equal(approval.packageId,extension.analysisPackage.packageId);
 assert.equal(approval.packageRevision,extension.packageRevision);
 assert.equal(approval.requestId,approvalRequest.requestId);
 assert.equal(approval.requestedBy,'coordinator');
 assert.equal(approval.decision,'APPROVED');
 assert.equal(approval.status,'APPROVED');
 assert.equal(approval.fingerprint,approvalRequest.fingerprint);
 assert.equal(approval.approvedBy,'reviewer');
 assert.equal(approval.approvedAt,'2026-01-01T00:00:00Z');
 assert.equal(approval.evidence,'Approved in the review record.');
 assert.equal(await C.isPackageApprovalCurrent(approval,extension),true);
 assert.equal(await C.packageApprovalFingerprint(reordered),approval.fingerprint,'unordered contract sets have a stable fingerprint');
 const cyclic=clone(extension);cyclic.metadata={};cyclic.metadata.self=cyclic.metadata;
 await assert.rejects(()=>C.packageApprovalFingerprint(cyclic),/cycles/);
 const sameApproval=clone(extension);sameApproval.generatedAt='later';
 assert.equal(await C.packageApprovalFingerprint(sameApproval),approval.fingerprint,'volatile timestamps do not change the approval basis');
 const changedApproval=clone(extension);changedApproval.evidence[0].description+=' Updated observation.';
 assert.equal(await C.isPackageApprovalCurrent(approval,changedApproval),false,'evidence changes invalidate approval');
 const changedRequirement=clone(extension);changedRequirement.coverageFindings[0].requirementId='REQ-2';
 assert.equal(await C.isPackageApprovalCurrent(approval,changedRequirement),false,'requirement identity changes invalidate approval');
 const changedEvidenceHash=clone(extension);changedEvidenceHash.evidence.find(item=>item.evidenceId==='E-DAB').sha256=digest('9');
 assert.equal(await C.isPackageApprovalCurrent(approval,changedEvidenceHash),false,'evidence hash changes invalidate approval');
 const changedRelationship=clone(extension);changedRelationship.sqlRelationships[0].table.name='MeasurementArchive';
 assert.equal(await C.isPackageApprovalCurrent(approval,changedRelationship),false,'relationship changes invalidate approval');
 const changedAnswer=clone(extension);changedAnswer.questions[0].status='answered';
 changedAnswer.questions[0].answer={source:'user',answeredAt:'2026-01-01T00:00:00Z',stateRevision:extension.parentStateRevision,value:'A'};
 assert.equal(await C.isPackageApprovalCurrent(approval,changedAnswer),false,'question answers invalidate approval');
 const changedChild=clone(extension);changedChild.analysisPackage.children[0].responsibility+=' Include the verified exception path.';
 assert.equal(await C.isPackageApprovalCurrent(approval,changedChild),false,'child definitions invalidate approval');
 const changedRevision=clone(extension);changedRevision.packageRevision++;changedRevision.analysisPackage.packageRevision++;
 assert.equal(await C.isPackageApprovalCurrent(approval,changedRevision),false,'package revisions invalidate approval');
 await assert.rejects(()=>C.recordPackageApproval(changedApproval,approvalRequest,{approvedBy:'reviewer',approvedAt:'now',evidence:'reviewed'}),/stale/);
 for(const status of ['pending','cancelled','deferred']){
  const blocked=clone(extension);blocked.questions[0].blocking=true;blocked.questions[0].status=status;
  blocked.analysisPackage.blockingQuestionIds=['Q-1'];
  assert.match(C.packageApprovalBlockers(blocked).join('\n'),new RegExp('Q-1 is '+status));
  const forgedBlockedApproval={...approval,fingerprint:await C.packageApprovalFingerprint(blocked)};
  assert.equal(await C.isPackageApprovalCurrent(forgedBlockedApproval,blocked),false,'unresolved blocking questions cannot validate even a matching fingerprint');
  await assert.rejects(()=>C.createPackageApprovalRequest(blocked,{requestedBy:'coordinator'}),/approval blocked/);
  await assert.rejects(()=>C.recordPackageApproval(blocked,approvalRequest,{approvedBy:'reviewer',approvedAt:'now',evidence:'reviewed'}),/approval request is for a different package revision|approval request is stale|approval blocked/);
 }

 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'akzo-phase01-'));
 try{
  const root=new DirectoryHandle(temp),folder='playbook/pbis/'+state.pbi,stateText=JSON.stringify(state,null,2);
  await P.write(root,folder+'/pbi-state.json',stateText);
  const invalidStateFolder='playbook/pbis/pbi-invalid-state';await P.write(root,invalidStateFolder+'/pbi-state.json','null');
  await assert.rejects(()=>P.saveAnalysisExtension(root,invalidStateFolder,extension,{actorRole:'coordinator',expectedSha256:null}),/matching legacy pbi-state.json schemaVersion 2/);
  assert.equal(await P.loadAnalysisExtension(root,folder,{required:false}),null,'legacy PBIs can omit the extension');
  await assert.rejects(()=>P.loadAnalysisExtension(root,folder,{required:true}),/ANALYSIS_EXTENSION_REQUIRED/);
  await assert.rejects(()=>P.saveAnalysisExtension(root,folder,extension,{actorRole:'specialist',expectedSha256:null}),/Only the coordinator/);
  let saved=await P.saveAnalysisExtension(root,folder,extension,{actorRole:'coordinator',expectedSha256:null});
  assert.equal(saved.extension.packageRevision,1);assert.equal((await P.loadAnalysisExtension(root,folder,{required:true})).sha256,saved.sha256);
  saved=await P.savePackageApproval(root,folder,approvalRequest,{approvedBy:'reviewer',approvedAt:'2026-01-01T00:00:00Z',evidence:'Approved in the review record.'},
   {actorRole:'coordinator',expectedSha256:saved.sha256});
  assert.deepEqual(saved.extension.packageApproval,approval,'approval records are persisted in the versioned extension');
  const reloaded=await P.loadAnalysisExtension(root,folder,{required:true});
  assert.deepEqual(reloaded.extension.packageApproval,approval,'reloading preserves the durable package approval');
  assert.equal(await C.isPackageApprovalCurrent(reloaded.extension.packageApproval,reloaded.extension),true);
  assert.equal(reloaded.extension.packageApproval.packageId,extension.analysisPackage.packageId);
  assert.equal(reloaded.extension.packageApproval.packageRevision,extension.packageRevision);
  await assert.rejects(()=>P.startDevelopment(root,folder),/Start Development needs an approved PBI/,'analysis package approval cannot authorize SDD implementation');
  const changedRoots=clone(extension.sourceRoots);changedRoots[0].sha256=digest('9');
  await assert.rejects(()=>P.loadAnalysisExtension(root,folder,{currentSourceRoots:changedRoots}),/source revision or hash changed/);
  assert.equal(await P.read(root,folder+'/pbi-state.json'),stateText,'the legacy state file remains byte-identical');
  const handoffPackage=await P.developmentPackage(root,folder,[]);
  assert.equal(handoffPackage[`supporting/pbi-state.json`] instanceof Uint8Array,true);
  assert.equal(handoffPackage[P.ANALYSIS_EXTENSION_FILE],undefined,'the extension and its analysis approval stay outside handoff v1');
  assert.equal(JSON.stringify(handoffPackage).includes('Approved in the review record.'),false,'analysis approval is not SDD implementation authorization');
  await assert.rejects(()=>P.saveAnalysisExtension(root,folder,extension,{actorRole:'coordinator',expectedSha256:null}),/ANALYSIS_EXTENSION_CHANGED/);
  const changedWithoutRevision=clone(saved.extension);changedWithoutRevision.questions[0].prompt+=' Updated.';
  await assert.rejects(()=>P.saveAnalysisExtension(root,folder,changedWithoutRevision,{actorRole:'coordinator',expectedSha256:saved.sha256}),/ANALYSIS_EXTENSION_REVISION/);

  const next=changedWithoutRevision;next.packageRevision++;next.analysisPackage.packageRevision++;
  let fail=true;const original=FileHandle.prototype.createWritable;
  FileHandle.prototype.createWritable=async function(){
   const writer=await original.call(this);
   if(this.name!==P.ANALYSIS_EXTENSION_FILE||!fail)return writer;
   return {write:writer.write,abort:writer.abort,close:async()=>{if(fail){fail=false;await fs.writeFile(this.path,'partial extension');throw Error('injected extension write failure');}return writer.close();}};
  };
  let update;
  try{await assert.rejects(()=>P.saveAnalysisExtension(root,folder,next,{actorRole:'coordinator',expectedSha256:saved.sha256}),/File write failed: injected extension write failure/);}
  finally{FileHandle.prototype.createWritable=original;}
  assert.equal((await P.loadAnalysisExtension(root,folder,{required:true})).sha256,saved.sha256,'failed extension writes restore the prior file');

  update=await P.saveAnalysisExtension(root,folder,next,{actorRole:'coordinator',expectedSha256:saved.sha256});
  assert.equal(update.approvalInvalidated,true,'changed package content invalidates the stored approval');
  assert.equal(update.extension.packageApproval,undefined,'stale approval is removed when changed content is saved');
  assert.equal(await C.isPackageApprovalCurrent(approval,next),false);
  const backupPath=update.backups.find(item=>item.endsWith('/'+P.ANALYSIS_EXTENSION_FILE));
  assert.ok(backupPath,'extension update creates a Builder-managed backup');
  const rolled=await P.rollbackAnalysisExtension(root,folder,{actorRole:'coordinator',backupPath,expectedSha256:update.sha256});
  assert.equal(rolled.extension.packageRevision,3,'rollback creates a new revision');
  assert.equal(rolled.extension.questions[0].prompt,extension.questions[0].prompt);
  assert.equal(rolled.extension.packageApproval,undefined,'rollback to prior content does not revive an old approval');
  const changedState={...state,status:'Needs Evidence'};await P.write(root,folder+'/pbi-state.json',JSON.stringify(changedState));
  await assert.rejects(()=>P.loadAnalysisExtension(root,folder,{required:true}),/ANALYSIS_EXTENSION_STALE/);
  const unsupported=clone(rolled.extension);unsupported.schemaVersion=2;
  await P.write(root,folder+'/'+P.ANALYSIS_EXTENSION_FILE,JSON.stringify(unsupported));
  await assert.rejects(()=>P.loadAnalysisExtension(root,folder,{required:true}),/schemaVersion 1/,'unsupported persisted extension versions fail closed');
 }finally{await fs.rm(temp,{recursive:true,force:true});}
 console.log('Phase 01 contract and persistence tests passed.');
}

main().catch(error=>{console.error(error);process.exitCode=1;});
