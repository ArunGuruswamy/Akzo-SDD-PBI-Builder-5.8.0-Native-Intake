'use strict';
(()=>{
 const P=globalThis.PBI,C=P.phase01Contracts,SCHEMA='akzo-sdd-child-handoff',RESULT_SCHEMA='akzo-sdd-agent-result',
  PROTOCOL='AKZO-SDD-BUILDER-AGENT',VERSION=2;
 function requireText(value,name){if(typeof value!=='string'||!value.trim())throw Error(name+' is required.');return value.trim();}
 async function fingerprint(value){return P.hash(C.canonicalJson(value));}
 function withoutFingerprint(record,key){const copy=JSON.parse(JSON.stringify(record));delete copy[key];return copy;}
 function selectedIds(extension){
  const authorization=extension.implementationAuthorization;
  if(!authorization||!Array.isArray(authorization.selectedChildIds)||!authorization.selectedChildIds.length)
   throw Error('A current Builder-native child authorization is required before authorizing an SDD handoff.');
  return [...authorization.selectedChildIds].sort();
 }
 async function validateBase(root,folder,current,sourceHandles){
  const extension=current.extension,approval=extension.packageApproval,authorization=extension.implementationAuthorization;
  if(extension.planning?.status!=='READY_FOR_APPROVAL')throw Error('SDD_HANDOFF_BLOCKED: the current planning package is not ready.');
  if(!approval||!await C.isPackageApprovalCurrent(approval,extension))throw Error('SDD_HANDOFF_BLOCKED: current planning-package approval is required.');
  if(!authorization||!await C.isImplementationAuthorizationCurrent(authorization,extension))
   throw Error('SDD_HANDOFF_BLOCKED: current child selection authorization is required.');
  return P.exportChildImplementationPackage(root,folder,{sourceHandles,selectedChildIds:selectedIds(extension)});
 }
 async function authorizeSddHandoff(root,folder,{actorRole,expectedSha256,authorizedBy,evidence,sourceHandles={}}={}){
  if(actorRole!=='coordinator')throw Error('Only the coordinator may authorize an SDD child handoff.');
  const current=await P.loadAnalysisExtension(root,folder,{required:true,allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true});
  if(current.sha256!==expectedSha256)throw Error('ANALYSIS_EXTENSION_CHANGED: reload before authorizing the SDD handoff.');
  const exported=await validateBase(root,folder,current,sourceHandles),native=exported.package,
   base={schema:'akzo-sdd-handoff-authorization',schemaVersion:1,
    packageId:native.packageId,packageRevision:native.packageRevision,planningFingerprint:native.packageFingerprint,
    approvalFingerprint:native.packageApproval.fingerprint,implementationAuthorizationFingerprint:native.implementationAuthorization.fingerprint,
    selectedChildIds:native.selectedChildIds,decision:'AUTHORIZED',action:'EXPORT_AND_IMPORT_TO_SDD',
    authorizedBy:requireText(authorizedBy,'The handoff authorizing person'),
    evidence:requireText(evidence,'Evidence of explicit handoff intent'),authorizedAt:new Date().toISOString()};
  const record={...base,fingerprint:await fingerprint(base)},
   path=folder+'/SDD-HANDOFF-AUTHORIZATION-r'+native.packageRevision+'.json',
   previous=await P.read(root,path);
  if(previous!==null){
   let stored;try{stored=JSON.parse(previous);}catch(e){if(!(e instanceof SyntaxError))throw e;throw Error('Existing SDD handoff authorization is invalid; preserve it and resolve the conflict manually.');}
   if(stored.fingerprint!==record.fingerprint)throw Error('A different SDD handoff authorization already exists; preserve it and resolve the conflict before reauthorizing.');
   return {authorization:stored,unchanged:true};
  }
  await P.write(root,path,C.canonicalJson(record)+'\n');
  return {authorization:record,unchanged:false};
 }
 async function exportSddHandoffPackage(root,folder,{sourceHandles={}}={}){
  const current=await P.loadAnalysisExtension(root,folder,{required:true,allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true}),
   exported=await validateBase(root,folder,current,sourceHandles),native=exported.package,
   authorizationText=await P.read(root,folder+'/SDD-HANDOFF-AUTHORIZATION-r'+native.packageRevision+'.json');
  let authorization=null;
  if(authorizationText!==null){try{authorization=JSON.parse(authorizationText);}catch(e){if(!(e instanceof SyntaxError))throw e;throw Error('SDD handoff authorization file is invalid.');}}
  if(!authorization||authorization.schema!=='akzo-sdd-handoff-authorization'||authorization.decision!=='AUTHORIZED'||
   authorization.packageId!==native.packageId||authorization.packageRevision!==native.packageRevision||
   authorization.planningFingerprint!==native.packageFingerprint||
   authorization.approvalFingerprint!==native.packageApproval.fingerprint||
   authorization.implementationAuthorizationFingerprint!==native.implementationAuthorization.fingerprint||
   C.canonicalJson(authorization.selectedChildIds)!==C.canonicalJson(native.selectedChildIds)||
   authorization.fingerprint!==await fingerprint(withoutFingerprint(authorization,'fingerprint')))
   throw Error('SDD_HANDOFF_AUTHORIZATION_STALE: authorize the exact current child selection and package before export.');
  const quality=native.refinementQuality,qualityReportIdentity=await fingerprint(quality),
   correlationId='SDD-'+(await fingerprint({packageId:native.packageId,packageRevision:native.packageRevision,
    planningFingerprint:native.packageFingerprint,childIds:native.selectedChildIds})).slice(0,32),
   payload={protocol:{name:PROTOCOL,version:VERSION,compatibleAgentVersions:{minimum:'4.2.7',maximum:'4.2.x'},
    capabilities:['child-import','plan-only','scope-validation','dependency-validation','structured-results']},
    messageType:'handoff.request',correlationId,builderVersion:P.VERSION,packageId:native.packageId,
    packageRevision:native.packageRevision,planningFingerprint:native.packageFingerprint,
    planningManifest:native.planningManifest,
    parentPbiId:native.parentPbiId,parentPbi:native.parentPbi,
    selectedChildIds:native.selectedChildIds,childIdentities:native.children.map(child=>({
     childId:child.provisionalChildId,revision:child.revision,targetRepository:child.targetRepository})),
    repositoryScopes:native.selectedTargets,children:native.children,
    refinedAcceptanceCriteria:native.children.map(child=>({childId:child.provisionalChildId,
     revision:child.revision,criteria:child.refinedAcceptanceCriteria||[]})),
    businessRules:native.traceability.map(row=>({acceptanceCriterionId:row.criterionId,
     childIds:row.childIds,requirementIds:row.requirementIds,disposition:row.disposition})),
    traceability:native.traceability,evidenceReferences:native.evidenceReferences,
    clarificationQuestions:native.clarificationQuestions,
    dependencyGraph:native.dependencyGraph,sharedUiWork:native.sharedUiWork,
    qualityReport:quality,qualityReportIdentity,
    packageApproval:native.packageApproval,implementationAuthorization:native.implementationAuthorization,
    handoffAuthorization:authorization,packageStatus:'AUTHORIZED_FOR_HANDOFF',handoffReady:true,
    implementationStarted:false};
  const canonicalPayload=C.canonicalJson(payload),packageFingerprint=await P.hash(canonicalPayload),
   pkg={schema:SCHEMA,schemaVersion:VERSION,packageFingerprint,canonicalPayload};
  return {package:pkg,payload,json:C.canonicalJson(pkg)+'\n',filename:'PBI-SDD-Child-Handoff-v2.json'};
 }
 function validateRelativeFile(value,name){
  if(typeof value!=='string'||!value||value.startsWith('/')||value.includes('\\')||/^[A-Za-z]:/.test(value)||
   value.split('/').some(part=>!part||part==='.'||part==='..'||/[\x00-\x1f<>:"|?*]/.test(part)))
   throw Error(name+' contains an unsafe repository-relative path.');
 }
 async function importSddResult(root,folder,resultText,{actorRole='coordinator',expectedSha256,sourceHandles={}}={}){
  if(actorRole!=='coordinator')throw Error('Only the coordinator may import SDD child results.');
  let envelope;try{envelope=JSON.parse(resultText);}catch(e){if(!(e instanceof SyntaxError))throw e;throw Error('SDD result is not valid JSON.');}
  if(envelope?.schema!==RESULT_SCHEMA||envelope.schemaVersion!==VERSION||typeof envelope.canonicalPayload!=='string')
   throw Error('SDD result schema or protocol version is unsupported.');
  if(await P.hash(envelope.canonicalPayload)!==envelope.resultFingerprint)throw Error('SDD result fingerprint does not match its payload.');
  let result;try{result=JSON.parse(envelope.canonicalPayload);}catch(e){if(!(e instanceof SyntaxError))throw e;throw Error('SDD result payload is not valid JSON.');}
  const current=await P.loadAnalysisExtension(root,folder,{required:true,allowStaleSqlSources:true,allowStaleGraphql:true,allowStaleApproval:true});
  if(current.sha256!==expectedSha256)throw Error('ANALYSIS_EXTENSION_CHANGED: reload before importing the SDD result.');
  const expected=await exportSddHandoffPackage(root,folder,{sourceHandles}),issued=expected.payload,
   issuedChildIdentities=issued.childIdentities;
  if(result.protocol?.name!==PROTOCOL||result.protocol?.version!==VERSION||
   result.messageType!=='implementation.result'||result.packageId!==issued.packageId||
   result.packageRevision!==issued.packageRevision||result.packageFingerprint!==expected.package.packageFingerprint||
   result.parentPbiId!==issued.parentPbiId||result.correlationId!==issued.correlationId)
   throw Error('SDD result does not match the latest exported package and correlation.');
  const identity=issuedChildIdentities.find(child=>child.childId===result.childId);
  if(!identity||identity.revision!==result.childRevision||identity.targetRepository!==result.repositoryScope)
   throw Error('SDD result refers to an unknown child revision or unauthorized repository scope.');
  if(!['COMPLETED','FAILED','BLOCKED'].includes(result.executionStatus))throw Error('SDD result execution status is unsupported.');
  for(const name of ['changedFiles','testsExecuted','testsPassed','testsFailed','testsNotRun','blockers','evidenceReferences'])
   if(!Array.isArray(result[name]))throw Error('SDD result '+name+' must be an array.');
  for(const file of result.changedFiles)validateRelativeFile(file,'changedFiles');
  for(const evidence of result.evidenceReferences)if(typeof evidence!=='string'||!evidence.trim())
   throw Error('SDD result evidence references must be non-empty strings.');
  const resultPath=folder+'/PBI-SDD-INTEGRATION-RESULTS.json',raw=await P.read(root,resultPath);
  let existing=[];
  if(raw!==null){
   let stored;try{stored=JSON.parse(raw);}catch(e){if(!(e instanceof SyntaxError))throw e;throw Error('Stored SDD integration results are invalid; preserve the file and resolve it manually.');}
   if(stored.schema!=='akzo-sdd-agent-results'||stored.schemaVersion!==VERSION||!Array.isArray(stored.results))
    throw Error('Stored SDD integration result schema is invalid; preserve the file and resolve it manually.');
   existing=stored.results;
  }
  const duplicate=existing.find(item=>item.childId===result.childId&&item.childRevision===result.childRevision);
  if(duplicate){
   if(duplicate.resultFingerprint===envelope.resultFingerprint)return {status:'DUPLICATE',result:duplicate};
   throw Error('A conflicting result already exists for this child revision.');
  }
  const imported={schema:RESULT_SCHEMA,schemaVersion:VERSION,
   resultFingerprint:envelope.resultFingerprint,correlationId:result.correlationId,packageFingerprint:result.packageFingerprint,
   packageId:result.packageId,parentPbiId:result.parentPbiId,childId:result.childId,childRevision:result.childRevision,
   repositoryScope:result.repositoryScope,executionStatus:result.executionStatus,agentVersion:result.agentVersion,
   changedFiles:result.changedFiles,testsExecuted:result.testsExecuted,testsPassed:result.testsPassed,
   testsFailed:result.testsFailed,testsNotRun:result.testsNotRun,blockers:result.blockers,
   evidenceReferences:result.evidenceReferences,importedAt:new Date().toISOString()};
  await P.write(root,resultPath,C.canonicalJson({schema:'akzo-sdd-agent-results',schemaVersion:VERSION,
   results:[...existing,imported]})+'\n');
  return {status:'IMPORTED',result:imported,resultPath};
 }
 Object.assign(P,{authorizeSddHandoff,exportSddHandoffPackage,importSddResult});
})();
