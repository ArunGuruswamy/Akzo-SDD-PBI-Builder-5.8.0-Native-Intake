'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fsSync=require('node:fs'),fs=require('node:fs/promises'),
 {execFileSync}=require('node:child_process'),
 os=require('node:os'),path=require('node:path');
const P=require('./src/core.js'),C=require('./src/phase01-contracts.js'),Q=require('./src/refinement-quality.js'),
 {DirectoryHandle}=require('./fixtures/fs-handles.cjs');
require('./src/phase06-handoff.js');
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS',name);}
async function fixture(name,{criteria=1,targets=['dab','ui']}={}){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'akzo-phase05-')),root=new DirectoryHandle(dir),pbi='pbi-'+name,folder='playbook/pbis/'+pbi,
  state={schemaVersion:2,pbi,status:'Needs Evidence',rules:[{id:'REQ-1',rule:'The measurement is processed consistently.',
   preconditions:'The request contains a supported measurement and user context.',validationLogic:'Validate required measurement fields and access.',
   successBehavior:'Persist one measurement and return its identifier.',failureBehavior:'Return a user-visible error without losing entered data.',
   coverage:['positive','negative','regression']}],
   acceptanceCriteria:Array.from({length:criteria},(_,i)=>({id:'AC-'+(i+1),criterion:'The measurement result '+(i+1)+' is correct.',rules:['REQ-1']})),questions:[]},
  sourceHandles=new Map(),repositoryPaths={};
 await P.write(root,folder+'/pbi-state.json',JSON.stringify(state));
 const request={schemaVersion:1,title:'Improve measurement handling',number:'123456',description:'Preserve the current measurement workflow.',
  acceptanceCriteria:state.acceptanceCriteria.map(row=>row.criterion).join('\n'),attachments:[],
  repositories:targets.map(key=>({key,use:'implement',area:key.toUpperCase(),path:'../'+key}))};
 await P.write(root,folder+'/pbi.json',JSON.stringify(request));
 for(const [index,repositoryKey] of ['legacy','cdms','dab','ui','pbi-builder-reference-library'].entries()){
  const repoPath=path.join(dir,'source-'+repositoryKey);await fs.mkdir(path.join(repoPath,'.git'),{recursive:true});
  await fs.writeFile(path.join(repoPath,'.git','HEAD'),String.fromCharCode(97+index).repeat(40));
  const relativePath=repositoryKey==='ui'?'src/MeasurementForm.ts':'src/Handler.cs',
   bytes=Buffer.from(repositoryKey==='ui'?'export class MeasurementForm {}':'class MeasurementHandler {}');
  await fs.mkdir(path.dirname(path.join(repoPath,...relativePath.split('/'))),{recursive:true});
  await fs.writeFile(path.join(repoPath,...relativePath.split('/')),bytes);
  const handle=new DirectoryHandle(repoPath);repositoryPaths[repositoryKey]={relativePath,bytes};
  const saved=await P.registerAnalysisSourceRoot(root,folder,{repositoryKey,sourceHandle:handle,actorRole:'coordinator',
   expectedSha256:(await P.loadAnalysisExtension(root,folder,{required:false}))?.sha256||null});
  sourceHandles.set(saved.sourceRoot.rootId,handle);
 }
 return {dir,root,folder,state,request,sourceHandles,repositoryPaths};
}
async function load(f){return P.loadAnalysisExtension(f.root,f.folder,{required:true});}
async function createAnalysis(f,{gapStatus='MISSING',includeCdms=false,includeDab=true,includeUi=false,conflict=false,
 includeRefinedCriteria=true}={}){
 let current=await load(f);
 const prepared=await P.prepareSpecialistTasks(f.root,f.folder,{actorRole:'coordinator',expectedSha256:current.sha256});
 for(const taskId of prepared.prepared){
  current=await load(f);const task=current.extension.specialistTasks.find(row=>row.taskId===taskId);
  const status=task.specialistType==='angular-ui'&&conflict?'VERIFIED_EXISTING':gapStatus,
   target=task.specialistType==='cdms'&&includeCdms?'cdms':
    task.specialistType==='angular-ui'&&includeUi?'ui':task.specialistType==='dab'&&includeDab?'dab':null;
  await P.setSpecialistTaskStatus(f.root,f.folder,task.taskId,'ASSIGNED',{actorRole:'coordinator',expectedSha256:current.sha256});
  current=await load(f);
  let evidence=[],coverageFindings=[],evidenceRefs=[];
  if(target){
   const snapshot=task.sourceSnapshots.find(item=>item.repositoryKey===target),source=f.sourceHandles.get(snapshot.rootId),
    info=f.repositoryPaths[target],evidenceId='E-SF-'+task.taskId+'-1',findingId='SF-'+task.taskId+'-1',
    sha256=crypto.createHash('sha256').update(info.bytes).digest('hex'),
    evidenceItem={schema:C.SCHEMAS.evidence,schemaVersion:1,evidenceId,requirementId:task.requirementId,
     acceptanceCriterionId:task.acceptanceCriterionId,repositoryKey:target,sourceRootId:snapshot.rootId,
     relativePath:info.relativePath,sourceRevision:snapshot.revision,sha256,symbol:target==='ui'?'MeasurementForm':'MeasurementHandler',
     category:'source-code',verificationMethod:'coordinator-local-source-hash',description:'Inspected implementation source.',
     executionContext:'Static source review only.',limitations:['No runtime or registration claim.'],
     verificationStatus:'VERIFIED',lineStart:1,lineEnd:1},
    finding={schema:C.SCHEMAS.coverage,schemaVersion:1,findingId,requirementId:task.requirementId,
     acceptanceCriterionId:task.acceptanceCriterionId,repositoryKey:target,sourceRevision:snapshot.revision,
     status:target==='ui'&&conflict?'VERIFIED_EXISTING':gapStatus,originalStatus:null,decisionBlocker:false,
     rationale:'The classification is supported by the cited source.',evidenceRefs:[evidenceId],blockingQuestionIds:[]};
   if(finding.status==='MISSING'||finding.status==='PARTIALLY_IMPLEMENTED'){
    finding.missingBehavior='The required measurement behavior is missing.';
    finding.implementationTasks=['Implement the confirmed measurement behavior.'];
    finding.testScenarios=['Verify the measurement result for a valid input.'];
     if(includeRefinedCriteria){
      finding.existingFunctionalityToPreserve=['Preserve the current measurement workflow.'];
      finding.refinedAcceptanceCriteria=[{
      statement:'Implement the '+target+' owner behavior for '+task.acceptanceCriterionId+'.',
      expectedOutcome:'The '+target+' owner returns the persisted measurement result for '+task.acceptanceCriterionId+'.',
      testScenarios:['Submit a valid request and verify the persisted result.','Submit an invalid request and verify a validation error.'],
      scenarioTypes:['positive','negative','regression'],evidenceRefs:[evidenceId]
      }];
     }
    finding.investigation={searchedRepositories:[target],executionBoundaries:['Assigned source snapshot'],
     searchMethods:['Static source inspection'],limitations:[]};
    finding.implementationTarget=target;
   }
   if(target==='ui'&&!conflict){
    finding.sharedUiIdentity={angularProject:'measurement-app',component:'MeasurementForm',feature:'measurement entry',
     service:'MeasurementService',apiBoundary:'Measurement API'};
    finding.expectedInteractions=['Submit the measurement entry to the existing API.'];
   }
   evidence=[evidenceItem];coverageFindings=[finding];evidenceRefs=[evidenceId];
  }
  const result={schema:C.SCHEMAS.specialistResult,schemaVersion:2,taskId:task.taskId,taskRevision:task.taskRevision,
   resultRevision:task.taskRevision,runId:task.runId,parentPackageId:task.parentPackageId,specialistType:task.specialistType,
   cancellationIdentity:task.cancellationIdentity,canonicalStateRevision:task.canonicalStateRevision,
   parentCoordinatorRevision:task.parentCoordinatorRevision,sourceSnapshots:task.sourceSnapshots,status:'COMPLETED',
   validationStatus:'SUBMITTED',submittedAt:'2026-03-01T12:00:00.000Z',evidence,evidenceRefs,coverageFindings,
   questions:[],findings:['Source inspected.'],unresolvedQuestions:[],conflicts:[],errors:[],operations:['read']};
  const saved=await P.importSpecialistResult(f.root,f.folder,result,{actorRole:'coordinator',expectedSha256:current.sha256,
   sourceHandles:f.sourceHandles});
  assert.equal(saved.status,'RESULT_VALIDATED');
 }
 current=await load(f);
 return P.consolidateSpecialistAnalysis(f.root,f.folder,{actorRole:'coordinator',expectedSha256:current.sha256});
}
async function plan(f){
 const current=await load(f);
 return P.generateImplementationPlan(f.root,f.folder,{actorRole:'coordinator',expectedSha256:current.sha256,sourceHandles:f.sourceHandles});
}
async function main(){
 assert.equal(Q.readinessFor(90),'QUALITY_READY_CANDIDATE');
 assert.equal(Q.readinessFor(89),'NEEDS_REVIEW');
 assert.equal(Q.readinessFor(75),'NEEDS_REVIEW');
 assert.equal(Q.readinessFor(74),'INCOMPLETE');
 assert.equal(Q.readinessFor(100,true),'INCOMPLETE');
 count++;console.log('PASS quality thresholds and hard-blocker override');
 const covered=await fixture('covered',{targets:['dab']});
 try{
  await createAnalysis(covered,{gapStatus:'VERIFIED_EXISTING'});
  const result=await plan(covered);
  assert.equal(result.planning.status,'NO_IMPLEMENTATION_REQUIRED');
  assert.equal(result.extension.analysisPackage.children.length,0);
  assert.equal(result.extension.refinementQuality.readiness,'QUALITY_READY_CANDIDATE');
  assert.equal(result.extension.refinementQuality.packageReadyForApproval,true);
  const legacyPlanning=JSON.parse(JSON.stringify(result.extension));
  delete legacyPlanning.refinementQuality;delete legacyPlanning.planning.refinementQualityVersion;
  legacyPlanning.planning.packageManifest.builderVersion='5.7.0';
  assert.equal((await C.createPackageApprovalRequest(legacyPlanning,{requestedBy:'Coordinator'})).status,'PENDING',
   '5.7 planning and approval behavior remains compatible without a 5.8 quality policy marker');
  assert.ok(result.planning.traceability.every(row=>row.disposition==='COVERED_EXISTING'));
  assert.deepEqual(Object.keys((await P.loadPlanningParentPbi(covered.root,covered.folder)).parentPbi).sort(),
   ['acceptanceCriteria','attachments','description','pbiId','title']);
  let loaded=await load(covered);
  const approved=await P.approvePlanningPackage(covered.root,covered.folder,{actorRole:'coordinator',
   expectedSha256:loaded.sha256,approvedBy:'Product Owner',requestedBy:'Coordinator',evidence:'Reviewed complete existing coverage.',
   sourceHandles:covered.sourceHandles});
  loaded=await load(covered);
  assert.equal(loaded.extension.packageApproval.approvedBy,'Product Owner');
  assert.equal(await C.isPackageApprovalCurrent(loaded.extension.packageApproval,loaded.extension),true);
  assert.equal((await P.exportPlanningPackage(covered.root,covered.folder,{sourceHandles:covered.sourceHandles})).package.handoffReady,false);
  assert.equal(approved.approval.decision,'APPROVED');
  await assert.rejects(()=>P.authorizePlanningImplementation(covered.root,covered.folder,{actorRole:'coordinator',
   expectedSha256:loaded.sha256,selectedChildIds:[],authorizedBy:'Product Owner',evidence:'No implementation is required.',
   sourceHandles:covered.sourceHandles}),/planning package is NO_IMPLEMENTATION_REQUIRED/i);
  const changed=JSON.parse(JSON.stringify(loaded.extension)),changedEvidenceId=changed.evidence[0].evidenceId;
  changed.evidence[0].description+=' Changed after review.';
  for(const result of changed.specialistResults)for(const item of result.evidence)
   if(item.evidenceId===changedEvidenceId)item.description+=' Changed after review.';
  assert.equal(await C.isPackageApprovalCurrent(loaded.extension.packageApproval,changed),false);
  count++;console.log('PASS verified existing coverage, exact Parent PBI shape, durable approval, fingerprint invalidation, and handoff-v1 isolation');
 }finally{await fs.rm(covered.dir,{recursive:true,force:true});}
 const gap=await fixture('gaps',{criteria:2,targets:['dab','ui']});
 try{
  const consolidated=await createAnalysis(gap,{gapStatus:'MISSING',includeUi:true});
  assert.deepEqual(consolidated.report.coverage.map(row=>row.status),['MISSING','MISSING']);
  const generated=await plan(gap),children=generated.extension.analysisPackage.children,
   uiChildren=children.filter(item=>item.targetRepository==='ui'),backend=children.filter(item=>item.targetRepository==='dab');
  assert.equal(generated.planning.status,'READY_FOR_APPROVAL');
  assert.equal(uiChildren.length,1,'the identical Angular responsibility is planned once across criteria');
  assert.equal(backend.length,2);
  assert.equal(generated.planning.sharedUiWork.length,1);
  assert.equal(generated.planning.dependencyGraph.valid,true);
  assert.equal(generated.planning.dependencyGraph.edges.length,2);
  assert.notEqual(generated.planning.packageManifest.fingerprint,'0'.repeat(64));
  assert.ok(generated.planning.dependencyGraph.implementationOrder.indexOf(backend[0].provisionalChildId)<
   generated.planning.dependencyGraph.implementationOrder.indexOf(uiChildren[0].provisionalChildId));
  assert.deepEqual(generated.planning.traceability.map(row=>row.disposition),['ASSIGNED_TO_CHILD','ASSIGNED_TO_CHILD']);
  assert.ok(children.every(item=>item.provisional&&item.provisionalChildId.startsWith('LOCAL-PBI-')));
  assert.ok(children.every(item=>item.refinedAcceptanceCriteria.length>0));
  assert.equal(generated.extension.refinementQuality.readiness,'QUALITY_READY_CANDIDATE',
   JSON.stringify({blockers:generated.extension.refinementQuality.blockers,dimensions:generated.extension.refinementQuality.dimensions}));
  assert.equal(generated.extension.refinementQuality.packageReadyForApproval,true);
  assert.equal(generated.extension.refinementQuality.developmentReady,false);
  const partialCriteria=JSON.parse(JSON.stringify(generated.extension)),partialUi=partialCriteria.analysisPackage.children
   .find(item=>item.targetRepository==='ui');
  partialUi.refinedAcceptanceCriteria=partialUi.refinedAcceptanceCriteria.slice(0,1);
  const partialQuality=await Q.evaluate({extension:partialCriteria,state:gap.state,contracts:C});
  assert.ok(partialQuality.blockers.some(item=>item.code==='CHILD_CRITERIA_COVERAGE_INCOMPLETE'),
   'every linked Parent criterion must have refined child criteria');
  const stable=await plan(gap);
  assert.equal(stable.unchanged,true);
  assert.equal(stable.extension.planning.packageManifest.fingerprint,generated.extension.planning.packageManifest.fingerprint);
  await assert.rejects(()=>P.generateImplementationPlan(gap.root,gap.folder,{actorRole:'coordinator',
   expectedSha256:consolidated.sha256,sourceHandles:gap.sourceHandles}),/ANALYSIS_EXTENSION_CHANGED/);
  assert.deepEqual(stable.extension.analysisPackage.children.map(item=>[item.provisionalChildId,item.revision]),
   children.map(item=>[item.provisionalChildId,item.revision]));
  const request=JSON.parse(await P.read(gap.root,gap.folder+'/pbi.json'));
  request.description='Preserve the current workflow and show the revised design intent.';
  await P.write(gap.root,gap.folder+'/pbi.json',JSON.stringify(request));
  const revised=await plan(gap),priorUi=uiChildren[0];
  assert.equal(revised.extension.analysisPackage.children.find(item=>item.targetRepository==='ui').provisionalChildId,priorUi.provisionalChildId);
  assert.equal(revised.extension.analysisPackage.children.find(item=>item.targetRepository==='ui').revision,priorUi.revision+1);
  let current=await load(gap);
  await P.approvePlanningPackage(gap.root,gap.folder,{actorRole:'coordinator',expectedSha256:current.sha256,
   approvedBy:'Product Owner',requestedBy:'Coordinator',evidence:'Reviewed verified gaps and traceability.',
   sourceHandles:gap.sourceHandles});
  current=await load(gap);
  assert.equal(await C.isPackageApprovalCurrent(current.extension.packageApproval,current.extension),true);
  const selectedChildIds=current.extension.analysisPackage.children.map(item=>item.provisionalChildId).sort(),
   authorized=await P.authorizePlanningImplementation(gap.root,gap.folder,{actorRole:'coordinator',expectedSha256:current.sha256,
    selectedChildIds,authorizedBy:'Product Owner',evidence:'Explicitly authorized the reviewed Builder-native child plan.',
    sourceHandles:gap.sourceHandles});
  assert.equal(authorized.extension.packageRevision,current.extension.packageRevision,
   'authorization metadata does not create a new planning revision');
  assert.equal(authorized.extension.packageApproval.fingerprint,current.extension.packageApproval.fingerprint,
   'implementation authorization does not change the review approval');
  current=await load(gap);
  assert.equal(await C.isImplementationAuthorizationCurrent(current.extension.implementationAuthorization,current.extension),true,
   'authorization persists across Builder reload');
  const nativeExport=await P.exportChildImplementationPackage(gap.root,gap.folder,{sourceHandles:gap.sourceHandles,selectedChildIds});
  assert.equal(nativeExport.package.schema,C.SCHEMAS.nativeChildExport);
  assert.equal(nativeExport.package.packageStatus,'AUTHORIZED_FOR_IMPLEMENTATION');
  assert.equal(nativeExport.package.exportFingerprint,await C.nativeChildExportFingerprint(nativeExport.package));
  assert.deepEqual(nativeExport.package.children.map(item=>item.provisionalChildId).sort(),selectedChildIds);
  assert.deepEqual(nativeExport.package.dependencyGraph.implementationOrder,generated.planning.dependencyGraph.implementationOrder);
  assert.equal(nativeExport.package.children.filter(item=>item.targetRepository==='ui').length,1,
   'shared UI work is included once in the native export');
  assert.equal(nativeExport.package.handoffReady,false);
  assert.equal(nativeExport.package.implementationStarted,false);
  C.validateNativeChildExport(nativeExport.package);
  let latest=await load(gap);
  const handoffAuthorized=await P.authorizeSddHandoff(gap.root,gap.folder,{actorRole:'coordinator',
   expectedSha256:latest.sha256,authorizedBy:'Product Owner',evidence:'Approved handoff to the SDD Agent.',
   sourceHandles:gap.sourceHandles});
  assert.equal(handoffAuthorized.authorization.action,'EXPORT_AND_IMPORT_TO_SDD');
  const sddExport=await P.exportSddHandoffPackage(gap.root,gap.folder,{sourceHandles:gap.sourceHandles});
  assert.equal(sddExport.package.schema,'akzo-sdd-child-handoff');
  assert.equal(sddExport.package.schemaVersion,2);
  assert.equal(await P.hash(sddExport.package.canonicalPayload),sddExport.package.packageFingerprint);
  assert.equal(sddExport.payload.handoffReady,true);
  assert.equal(sddExport.payload.implementationStarted,false);
  assert.equal(sddExport.payload.messageType,'handoff.request');
  assert.equal(sddExport.payload.children.length,selectedChildIds.length);
  if(process.env.AKZO_SDD_AGENT){
   const agentRoot=process.env.AKZO_SDD_AGENT,helper=path.join(agentRoot,'copilot','modules','investigate','scripts','akzo.ps1'),
    agentHome=await fs.mkdtemp(path.join(os.tmpdir(),'akzo-phase06-agent-')),handoffPath=path.join(agentHome,'handoff-v2.json'),
    repoRoots={};
   try{
    await fs.writeFile(handoffPath,sddExport.json,'utf8');
    for(const scope of sddExport.payload.repositoryScopes){
     const folder=path.join(agentHome,'repositories',scope),source=gap.repositoryPaths[scope];
     repoRoots[scope]=folder;
     await fs.mkdir(path.join(folder,path.dirname(source.relativePath)),{recursive:true});
     await fs.writeFile(path.join(folder,...source.relativePath.split('/')),source.bytes);
     execFileSync('git',['init','--quiet'],{cwd:folder});
     execFileSync('git',['config','user.email','phase06@example.invalid'],{cwd:folder});
     execFileSync('git',['config','user.name','Phase 06 fixture'],{cwd:folder});
     execFileSync('git',['add','--all'],{cwd:folder});
     execFileSync('git',['commit','--quiet','-m','synthetic fixture'],{cwd:folder});
    }
    const config={version:1,tasksDir:path.join(agentHome,'tasks'),repos:Object.entries(repoRoots).map(([id,repoPath])=>
     ({id,path:repoPath,purpose:'Isolated Phase 06 fixture'}))};
    await fs.writeFile(path.join(agentHome,'repos.json'),JSON.stringify(config),'utf8');
    const invoke=(...args)=>{
     const text=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',helper,...args],{
      encoding:'utf8',env:{...process.env,AKZO_AGENT_HOME:agentHome}
     }).trim();
     return JSON.parse(text);
    };
    const rejectPackage=async(name,mutate)=>{
     const payload=JSON.parse(sddExport.package.canonicalPayload);
     mutate(payload);
     const canonicalPayload=C.canonicalJson(payload),candidate={schema:'akzo-sdd-child-handoff',schemaVersion:2,
      packageFingerprint:await P.hash(canonicalPayload),canonicalPayload},candidatePath=path.join(agentHome,name+'.json');
     await fs.writeFile(candidatePath,C.canonicalJson(candidate),'utf8');
     const rejected=invoke('builderimport','-Source',candidatePath,'-Confirmed');
     assert.equal(rejected.status,'HANDOFF_REJECTED',name);
    };
    const noConsent=invoke('builderimport','-Source',handoffPath);
    assert.equal(noConsent.status,'HANDOFF_REJECTED');
    const capabilities=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',helper,'buildercapabilities'],{
     encoding:'utf8',env:{...process.env,AKZO_AGENT_HOME:agentHome}
    }));
    assert.equal(capabilities.protocol.name,'AKZO-SDD-BUILDER-AGENT');
    assert.equal(capabilities.protocol.version,2);
    assert.ok(capabilities.capabilities.includes('structured-results'));
    const olderAgent=path.join(agentHome,'older-agent'),olderScript=path.join(olderAgent,'copilot','modules','investigate','scripts','akzo.ps1');
    await fs.mkdir(path.dirname(olderScript),{recursive:true});
    await fs.copyFile(helper,olderScript);
    await fs.copyFile(path.join(path.dirname(helper),'multi-repo.ps1'),path.join(path.dirname(olderScript),'multi-repo.ps1'));
    await fs.writeFile(path.join(olderAgent,'VERSION'),'4.2.6\n','utf8');
    const tooOldText=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',olderScript,
     'builderimport','-Source',handoffPath,'-Confirmed'],{encoding:'utf8',env:{...process.env,AKZO_AGENT_HOME:agentHome}}).trim();
    const tooOld=JSON.parse(tooOldText);
    assert.equal(tooOld.status,'HANDOFF_REJECTED');
    assert.match(tooOld.issues.join(' '),/requires SDD Agent 4\.2\.7 or later/i);
    const fingerprintTamper=JSON.parse(JSON.stringify(sddExport.package));
    fingerprintTamper.packageFingerprint='0'.repeat(64);
    const fingerprintTamperPath=path.join(agentHome,'fingerprint-tamper.json');
    await fs.writeFile(fingerprintTamperPath,C.canonicalJson(fingerprintTamper),'utf8');
    assert.equal(invoke('builderimport','-Source',fingerprintTamperPath,'-Confirmed').status,'HANDOFF_REJECTED');
    await rejectPackage('unsupported-protocol',payload=>{payload.protocol.version=3;});
    await rejectPackage('missing-approval',payload=>{payload.packageApproval.decision='NOT_APPROVED';});
    await rejectPackage('unsafe-evidence-path',payload=>{payload.evidenceReferences[0].relativePath='../outside.cs';});
    await rejectPackage('scope-escalation',payload=>{payload.children[0].targetRepository='legacy';});
    await rejectPackage('invalid-child-revision',payload=>{payload.children[0].revision=0;});
    await rejectPackage('invalid-quality',payload=>{payload.qualityReport.readiness='STALE';});
    await rejectPackage('dependency-cycle',payload=>{const id=payload.children[0].provisionalChildId;
     payload.dependencyGraph.edges.push({sourceChildId:id,targetChildId:id,dependencyType:'TEST_CYCLE'});});
    const corruptPath=path.join(agentHome,'corrupt.json');
    await fs.writeFile(corruptPath,'{','utf8');
    assert.equal(invoke('builderimport','-Source',corruptPath,'-Confirmed').status,'HANDOFF_REJECTED');
    const before=new Map();
    for(const [scope,repoPath] of Object.entries(repoRoots)){
     const source=gap.repositoryPaths[scope],file=path.join(repoPath,...source.relativePath.split('/'));
     before.set(file,await fs.readFile(file));
    }
    const accepted=invoke('builderimport','-Source',handoffPath,'-Confirmed');
    assert.equal(accepted.status,'HANDOFF_ACCEPTED');
    assert.equal(accepted.response.capabilityNegotiation.accepted,true);
    const duplicate=invoke('builderimport','-Source',handoffPath,'-Confirmed');
    assert.equal(duplicate.status,'ALREADY_IMPORTED');
    await rejectPackage('reused-package-identity',payload=>{payload.correlationId='SDD-'+'0'.repeat(32);});
    const child=sddExport.payload.children.find(item=>!sddExport.payload.dependencyGraph.edges.some(edge=>
     edge.sourceChildId===item.provisionalChildId));
    assert.ok(child,'synthetic child graph should have an independent root');
    const repoId=child.targetRepository,packagePath=accepted.response.packagePath;
    const evidence=child.verifiedImplementationReferences.find(item=>item.repositoryKey===repoId);
    assert.ok(evidence,'synthetic child should have an in-scope source reference');
    const evidencePath=path.join(repoRoots[repoId],...evidence.relativePath.split('/'));
    await fs.writeFile(evidencePath,'stale evidence');
    const stalePlan=invoke('builderplan','-Source',packagePath,'-Id',child.provisionalChildId,'-Repo',repoId);
    assert.equal(stalePlan.status,'CHILD_PLAN_BLOCKED');
    assert.match(stalePlan.blockers.join(' '),/changed since Builder approval/i);
    await fs.writeFile(evidencePath,gap.repositoryPaths[repoId].bytes);
    const planned=invoke('builderplan','-Source',packagePath,'-Id',child.provisionalChildId,'-Repo',repoId);
    const dependentEdge=sddExport.payload.dependencyGraph.edges[0];
    if(dependentEdge){
     const dependent=sddExport.payload.children.find(item=>item.provisionalChildId===dependentEdge.sourceChildId);
     const predecessorResult=path.join(path.dirname(packagePath),
      'result-'+dependentEdge.targetChildId.replace(/[^A-Za-z0-9._-]/g,'_')+'.json');
     await fs.writeFile(predecessorResult,'{','utf8');
     const corruptDependency=invoke('builderplan','-Source',packagePath,'-Id',dependent.provisionalChildId,'-Repo',dependent.targetRepository);
     assert.equal(corruptDependency.status,'CHILD_PLAN_BLOCKED');
     assert.match(corruptDependency.blockers.join(' '),/result could not be validated/i);
     await fs.unlink(predecessorResult);
     const pending=invoke('builderplan','-Source',packagePath,'-Id',dependent.provisionalChildId,'-Repo',dependent.targetRepository);
     assert.equal(pending.status,'CHILD_PLAN_BLOCKED');
     assert.match(pending.blockers.join(' '),/no verified COMPLETED result/i);
     assert.equal(pending.codeChangesMade,false);
    }
    assert.equal(planned.status,'CHILD_PLAN_READY');
    assert.equal(planned.plan.status,'PLAN_ONLY_REVIEW_REQUIRED');
    assert.equal(planned.plan.codeChangesMade,false);
    assert.equal(planned.plan.childPbiId,child.provisionalChildId);
    const wrongRepo=sddExport.payload.repositoryScopes.find(scope=>scope!==repoId);
    if(wrongRepo){
     const blocked=invoke('builderplan','-Source',packagePath,'-Id',child.provisionalChildId,'-Repo',wrongRepo);
     assert.equal(blocked.status,'CHILD_PLAN_BLOCKED');
     assert.equal(blocked.codeChangesMade,false);
    }
    const afterPlan=new Map();
    for(const file of before.keys())afterPlan.set(file,await fs.readFile(file));
    for(const file of before.keys())assert.deepEqual(afterPlan.get(file),before.get(file),'plan generation must not modify app files');
    const reportPath=path.join(agentHome,'result-data.json');
    await fs.writeFile(reportPath,JSON.stringify({executionStatus:'COMPLETED',changedFiles:[],testsExecuted:[],
     testsPassed:[],testsFailed:[],testsNotRun:[],blockers:[],evidenceReferences:[]}));
    const completionGate=invoke('builderresult','-Source',packagePath,'-Id',child.provisionalChildId,
     '-Repo',repoId,'-Report',reportPath);
    assert.equal(completionGate.status,'CODE_EDIT_APPROVAL_REQUIRED');
    assert.equal(fsSync.existsSync(path.join(path.dirname(packagePath),
     'result-'+child.provisionalChildId.replace(/[^A-Za-z0-9._-]/g,'_')+'.json')),false);
    await fs.writeFile(reportPath,JSON.stringify({executionStatus:'BLOCKED',changedFiles:[],testsExecuted:[],
     testsPassed:[],testsFailed:[],testsNotRun:['NOT_RUN: plan-only integration test'],blockers:['No code execution was authorized.'],
     evidenceReferences:[]}));
    const resultExport=invoke('builderresult','-Source',packagePath,'-Id',child.provisionalChildId,
     '-Repo',repoId,'-Report',reportPath);
    assert.equal(resultExport.status,'RESULT_EXPORTED');
    const generatedResult=await fs.readFile(resultExport.resultPath,'utf8');
    latest=await load(gap);
    const roundTrip=await P.importSddResult(gap.root,gap.folder,generatedResult,
     {actorRole:'coordinator',expectedSha256:latest.sha256,sourceHandles:gap.sourceHandles});
    assert.equal(roundTrip.status,'IMPORTED');
    assert.equal(roundTrip.result.executionStatus,'BLOCKED');
    latest=await load(gap);
    const duplicateResult=await P.importSddResult(gap.root,gap.folder,generatedResult,
     {actorRole:'coordinator',expectedSha256:latest.sha256,sourceHandles:gap.sourceHandles});
    assert.equal(duplicateResult.status,'DUPLICATE');
    const conflictEnvelope=JSON.parse(generatedResult),conflictPayload=JSON.parse(conflictEnvelope.canonicalPayload);
    conflictPayload.blockers.push('Conflicting duplicate result.');
    conflictEnvelope.canonicalPayload=JSON.stringify(conflictPayload);
    conflictEnvelope.resultFingerprint=await P.hash(conflictEnvelope.canonicalPayload);
    await assert.rejects(()=>P.importSddResult(gap.root,gap.folder,JSON.stringify(conflictEnvelope),
     {actorRole:'coordinator',expectedSha256:latest.sha256,sourceHandles:gap.sourceHandles}),/conflicting result already exists/i);
    const generatedEnvelope=JSON.parse(generatedResult),staleResult=JSON.parse(generatedEnvelope.canonicalPayload);
    staleResult.correlationId='SDD-'+'0'.repeat(32);
    const staleCanonical=JSON.stringify(staleResult),staleEnvelope={schema:'akzo-sdd-agent-result',schemaVersion:2,
     resultFingerprint:await P.hash(staleCanonical),canonicalPayload:staleCanonical};
    await assert.rejects(()=>P.importSddResult(gap.root,gap.folder,JSON.stringify(staleEnvelope),
     {actorRole:'coordinator',expectedSha256:latest.sha256,sourceHandles:gap.sourceHandles}),
     /does not match the latest exported package/i);
    for(const file of before.keys())assert.deepEqual(await fs.readFile(file),before.get(file),'handoff import and feedback must not modify app files');
    console.log('PASS real Builder exporter -> Agent importer/plan/result exporter -> Builder result importer (isolated fixtures)');
   }finally{await fs.rm(agentHome,{recursive:true,force:true});}
  }else{
   console.log('SKIP real Agent integration: set AKZO_SDD_AGENT to the authorized Agent source root.');
  }
  const unsupportedNativeExport=JSON.parse(JSON.stringify(nativeExport.package));
  unsupportedNativeExport.children[0].schemaVersion=3;
  assert.throws(()=>C.validateNativeChildExport(unsupportedNativeExport),/unsupported schema version/i);
  await assert.rejects(()=>P.exportChildImplementationPackage(gap.root,gap.folder,{sourceHandles:gap.sourceHandles,
   selectedChildIds:[backend[0].provisionalChildId]}),/missing required dependency|complete shared UI work group/i);
  const changedAuthorizedChild=JSON.parse(JSON.stringify(current.extension));
  changedAuthorizedChild.analysisPackage.children[0].implementationGap+=' changed';
  assert.equal(await C.isImplementationAuthorizationCurrent(current.extension.implementationAuthorization,changedAuthorizedChild),false,
   'child edits invalidate implementation authorization');
  const changedAuthorizedParent=JSON.parse(JSON.stringify(current.extension));
  changedAuthorizedParent.planning.parentPbi.acceptanceCriteria+=' changed';
  assert.equal(await C.isImplementationAuthorizationCurrent(current.extension.implementationAuthorization,changedAuthorizedParent),false,
   'Parent requirement edits invalidate implementation authorization');
  const changedAuthorizedRelationship=JSON.parse(JSON.stringify(current.extension));
  changedAuthorizedRelationship.planning.dependencyGraph.edges[0].rationale+=' changed';
  assert.equal(await C.isImplementationAuthorizationCurrent(current.extension.implementationAuthorization,changedAuthorizedRelationship),false,
   'relationship edits invalidate implementation authorization');
  const changedChild=JSON.parse(JSON.stringify(current.extension));
  changedChild.analysisPackage.children[0].implementationGap+=' changed';
  assert.equal(await C.isPackageApprovalCurrent(current.extension.packageApproval,changedChild),false);
  assert.equal(await C.refinementQualityIsCurrent(changedChild),false,'child-definition changes invalidate refinement quality');
  const changedEvidence=JSON.parse(JSON.stringify(current.extension)),evidenceId=changedEvidence.evidence[0].evidenceId;
  changedEvidence.evidence[0].description+=' changed';
  for(const result of changedEvidence.specialistResults)for(const item of result.evidence)
   if(item.evidenceId===evidenceId)item.description+=' changed';
  assert.equal(await C.refinementQualityIsCurrent(changedEvidence),false,'evidence changes invalidate refinement quality');
  assert.equal(await C.isImplementationAuthorizationCurrent(current.extension.implementationAuthorization,changedEvidence),false,
   'evidence edits invalidate implementation authorization');
  const changedRelationship=JSON.parse(JSON.stringify(current.extension));
  changedRelationship.planning.dependencyGraph.edges[0].rationale+=' changed';
  assert.equal(await C.refinementQualityIsCurrent(changedRelationship),false,'relationship changes invalidate refinement quality');
  const changedParent=JSON.parse(JSON.stringify(current.extension));
  changedParent.planning.parentPbi.acceptanceCriteria+=' changed';
  assert.equal(await C.isPackageApprovalCurrent(current.extension.packageApproval,changedParent),false);
  assert.equal(await C.refinementQualityIsCurrent(changedParent),false,'Parent requirement changes invalidate refinement quality');
  const exported=await P.exportPlanningPackage(gap.root,gap.folder,{sourceHandles:gap.sourceHandles});
  assert.equal(exported.package.approvalStatus,'APPROVED');
  assert.equal(exported.package.approval.decision,'APPROVED');
  assert.equal(exported.package.packageStatus,'READY_FOR_APPROVAL');
  assert.equal(exported.package.handoffReady,false);
  const uiSource=gap.sourceHandles.get(current.extension.evidence.find(item=>item.repositoryKey==='ui').sourceRootId);
  const changedBytes=Buffer.from('export class MeasurementForm { changed() {} }');
  await fs.writeFile(path.join(uiSource.path,'src','MeasurementForm.ts'),changedBytes);
  const stale=await P.refreshPlanningStatus(gap.root,gap.folder,{actorRole:'coordinator',expectedSha256:current.sha256,
   sourceHandles:gap.sourceHandles});
  assert.equal(stale.extension.planning.status,'STALE');
  assert.equal(stale.extension.packageApproval,undefined);
  assert.equal(stale.extension.implementationAuthorization,undefined);
  assert.equal(stale.approvalInvalidated,true);
  assert.equal(stale.implementationAuthorizationInvalidated,true);
  assert.equal((await P.exportPlanningPackage(gap.root,gap.folder,{sourceHandles:gap.sourceHandles})).package.freshness.status,'STALE');
  count++;console.log('PASS evidence-driven children, UI deduplication, dependency order, stable IDs/revisions, approval, and stale-source invalidation');
 }finally{await fs.rm(gap.dir,{recursive:true,force:true});}
 const conflict=await fixture('conflict',{targets:['dab','ui']});
 try{
  const consolidated=await createAnalysis(conflict,{gapStatus:'MISSING',includeUi:true,conflict:true});
  assert.equal(consolidated.report.coverage[0].status,'CONFLICTING');
  const generated=await plan(conflict);
  assert.equal(generated.planning.status,'BLOCKED');
  assert.equal(generated.planning.traceability[0].disposition,'BLOCKED_BY_CONFLICT');
  assert.ok(generated.extension.questions.some(question=>question.blocking&&question.status==='pending'));
  assert.ok(C.packageApprovalBlockers(generated.extension).length>0);
  await assert.rejects(()=>P.authorizePlanningImplementation(conflict.root,conflict.folder,{actorRole:'coordinator',
   expectedSha256:generated.sha256,selectedChildIds:[],authorizedBy:'Product Owner',evidence:'Attempted authorization.',
   sourceHandles:conflict.sourceHandles}),/IMPLEMENTATION_AUTHORIZATION_BLOCKED/i);
  await assert.rejects(()=>P.approvePlanningPackage(conflict.root,conflict.folder,{actorRole:'coordinator',
   expectedSha256:generated.sha256,approvedBy:'Product Owner',requestedBy:'Coordinator',evidence:'Attempted approval.',
   sourceHandles:conflict.sourceHandles}),/blocked|CONFLICTING|BLOCKED/i);
  const cycleChildren=[{provisionalChildId:'LOCAL-PBI-A',targetRepository:'dab'},{provisionalChildId:'LOCAL-PBI-B',targetRepository:'ui'}],
   edge=(sourceChildId,targetChildId,edgeId)=>({sourceChildId,targetChildId,edgeId,dependencyType:'BACKEND_API_BEFORE_UI',
    rationale:'Synthetic cycle validation.',evidenceRefs:['E-TEST'],verificationStatus:'VERIFIED',blocking:false});
  const cycle=C.validateDependencyGraph(cycleChildren,{edges:[edge('LOCAL-PBI-A','LOCAL-PBI-B','DEP-A'),
   edge('LOCAL-PBI-B','LOCAL-PBI-A','DEP-B')]},{selectedTargets:['dab','ui']});
  assert.equal(cycle.valid,false);assert.ok(cycle.errors.some(message=>message.includes('cycle')));
  const unsupportedCrossRepository=C.validateDependencyGraph([
   {provisionalChildId:'LOCAL-PBI-DAB',targetRepository:'dab'},
   {provisionalChildId:'LOCAL-PBI-CDMS',targetRepository:'cdms'}
  ],{edges:[edge('LOCAL-PBI-DAB','LOCAL-PBI-CDMS','DEP-CROSS')]},{selectedTargets:['cdms','dab']});
  assert.equal(unsupportedCrossRepository.valid,false);
  assert.ok(unsupportedCrossRepository.errors.some(message=>message.includes('Cross-repository dependency is unsupported')));
  count++;console.log('PASS unresolved conflicts block approval and dependency cycles fail closed');
 }finally{await fs.rm(conflict.dir,{recursive:true,force:true});}
 const scoped=await fixture('scope',{targets:['dab']});
 try{
  await createAnalysis(scoped,{gapStatus:'MISSING',includeUi:true});
  const blocked=await plan(scoped),question=blocked.extension.questions.find(item=>item.prompt.includes('outside the selected implementation targets'));
  assert.equal(blocked.planning.status,'BLOCKED');
  assert.ok(question&&question.status==='pending');
  let current=await load(scoped);
  const answer=await P.answerCoordinatorQuestion(scoped.root,scoped.folder,question.questionId,{key:'EXCLUDE_SCOPE'},
   'Product Owner',{actorRole:'coordinator',expectedSha256:current.sha256});
  assert.equal(answer.extension.planning.status,'STALE');
  current=await load(scoped);
  await P.consolidateSpecialistAnalysis(scoped.root,scoped.folder,{actorRole:'coordinator',expectedSha256:current.sha256});
  const resolved=await plan(scoped),row=resolved.planning.traceability[0];
  assert.equal(answer.decision.decision,'EXCLUDE_SCOPE');
  assert.equal(resolved.planning.status,'READY_FOR_APPROVAL');
  assert.equal(row.disposition,'ASSIGNED_TO_CHILD');
  assert.equal(row.scopeDecisionId,answer.decision.decisionId);
  assert.deepEqual(row.targetRepositories,['dab']);
  count++;console.log('PASS out-of-scope UI work remains blocked until an explicit scope decision is recorded');
 }finally{await fs.rm(scoped.dir,{recursive:true,force:true});}
 const partial=await fixture('partial',{targets:['dab']});
 try{
  await createAnalysis(partial,{gapStatus:'PARTIALLY_IMPLEMENTED'});
  const generated=await plan(partial);
  assert.equal(generated.planning.status,'READY_FOR_APPROVAL');
  assert.equal(generated.extension.analysisPackage.children.length,1);
  assert.equal(generated.extension.analysisPackage.children[0].implementationGap,'The required measurement behavior is missing.');
  count++;console.log('PASS partially implemented coverage creates one evidence-backed gap child');
 }finally{await fs.rm(partial.dir,{recursive:true,force:true});}
 const cdms=await fixture('cdms',{targets:['cdms']});
 try{
  await createAnalysis(cdms,{gapStatus:'MISSING',includeCdms:true,includeDab:false});
  const generated=await plan(cdms),child=generated.extension.analysisPackage.children[0];
  assert.equal(generated.planning.status,'READY_FOR_APPROVAL',JSON.stringify({
   blockingReasons:generated.planning.blockingReasons,traceability:generated.planning.traceability,
   coverage:generated.extension.coordinator.report.coverage
  }));
  assert.equal(generated.extension.analysisPackage.children.length,1);
  assert.equal(child.targetRepository,'cdms');
  assert.equal(child.verifiedImplementationReferences[0].repositoryKey,'cdms');
  assert.equal(generated.planning.traceability[0].disposition,'ASSIGNED_TO_CHILD');
  count++;console.log('PASS CDMS ownership is assigned only from validated, hashed CDMS evidence');
 }finally{await fs.rm(cdms.dir,{recursive:true,force:true});}
 const unverified=await fixture('unverified',{targets:['dab']});
 try{
  unverified.sourceHandles.clear();
  const consolidated=await createAnalysis(unverified,{gapStatus:'MISSING',includeRefinedCriteria:false});
  assert.equal(consolidated.report.coverage[0].status,'UNVERIFIED');
  const generated=await plan(unverified);
  assert.equal(generated.planning.status,'BLOCKED');
  assert.equal(generated.extension.analysisPackage.children.length,0);
  assert.ok(generated.planning.blockingReasons.some(reason=>reason.includes('UNVERIFIED')));
  count++;console.log('PASS evidence without independently available source handles cannot produce a child or approval');
 }finally{await fs.rm(unverified.dir,{recursive:true,force:true});}
  const unrefined=await fixture('unrefined',{targets:['dab']});
  try{
   await createAnalysis(unrefined,{gapStatus:'MISSING',includeRefinedCriteria:false});
   const generated=await plan(unrefined),report=generated.extension.refinementQuality;
   assert.equal(generated.extension.analysisPackage.children[0].refinedAcceptanceCriteria.length,0);
   assert.ok(generated.extension.questions.some(question=>question.questionId===report.clarificationQuestions[0].questionId&&
    question.status==='pending'&&question.blocking));
   assert.ok(generated.extension.analysisPackage.children[0].blockingQuestionIds.includes(report.clarificationQuestions[0].questionId),
    'child-level clarification is linked to the incomplete child');
   assert.equal(report.readiness,'INCOMPLETE');
   assert.equal(report.packageReadyForApproval,false);
   assert.ok(report.blockers.some(item=>item.code==='CHILD_ACCEPTANCE_CRITERIA_REQUIRED'));
   await assert.rejects(()=>P.authorizePlanningImplementation(unrefined.root,unrefined.folder,{actorRole:'coordinator',
    expectedSha256:generated.sha256,selectedChildIds:generated.extension.analysisPackage.children.map(item=>item.provisionalChildId),
    authorizedBy:'Product Owner',evidence:'Attempted incomplete authorization.',sourceHandles:unrefined.sourceHandles}),
    /IMPLEMENTATION_AUTHORIZATION_BLOCKED/i);
   const changedQuestion=JSON.parse(JSON.stringify(generated.extension));
   changedQuestion.questions[0].status='deferred';
   assert.equal(await C.refinementQualityIsCurrent(changedQuestion),false,'question status changes invalidate refinement quality');
   await assert.rejects(()=>C.createPackageApprovalRequest(generated.extension,{requestedBy:'Coordinator'}),
    /package approval blocked/i);
   count++;console.log('PASS missing child outcomes remain a blocking clarification and cannot be approved');
  }finally{await fs.rm(unrefined.dir,{recursive:true,force:true});}
 console.log('Phase 05 planning tests passed ('+count+' checks).');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
