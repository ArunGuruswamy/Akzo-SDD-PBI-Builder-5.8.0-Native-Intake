(function (global) {
'use strict';

const SCHEMAS=Object.freeze({
 analysisExtension:'akzo-pbi-analysis-extension',
 evidence:'akzo-evidence',
 coverage:'akzo-coverage-finding',
 cdmsPluginRule:'akzo-cdms-plugin-rule',
 dabTranslation:'akzo-cdms-dab-translation',
 sqlRelationship:'akzo-sql-relationship',
 uiMapping:'akzo-ui-mapping',
 specialistTask:'akzo-specialist-task',
 specialistResult:'akzo-specialist-result',
 coordinator:'akzo-analysis-coordinator',
 question:'akzo-analysis-question',
 decision:'akzo-analysis-decision',
 package:'akzo-analysis-package',
 sqlMetadata:'akzo-pbi-sql-metadata',
 graphqlMetadata:'akzo-pbi-graphql-metadata',
 graphqlMapping:'akzo-pbi-graphql-mapping',
 approvalRequest:'akzo-package-approval-request',
 approval:'akzo-package-approval',
 implementationAuthorization:'akzo-implementation-authorization',
 nativeChildExport:'akzo-builder-native-child-implementation-package',
 planning:'akzo-parent-child-planning',
 plannedChild:'akzo-planned-child-pbi',
 refinementQuality:'akzo-pbi-refinement-quality'
});
const COVERAGE_STATUSES=['VERIFIED_EXISTING','PARTIALLY_IMPLEMENTED','MISSING','CONFLICTING','UNVERIFIED'];
const REFINEMENT_QUALITY_MODEL_VERSION='1.0.0';
const PLANNING_TARGETS=['cdms','dab','ui'];
const PLANNING_DISPOSITIONS=['COVERED_EXISTING','ASSIGNED_TO_CHILD','EXCLUDED_BY_SCOPE_DECISION',
 'BLOCKED_BY_EVIDENCE','BLOCKED_BY_SCOPE','BLOCKED_BY_CONFLICT'];
const INTERNAL_STATUSES=['VERIFIED_IMPLEMENTED','PARTIALLY_IMPLEMENTED','VERIFIED_MISSING','UNVERIFIED_SOURCE','UNVERIFIED_RUNTIME','BUSINESS_DECISION_REQUIRED'];
const EVIDENCE_CATEGORIES=['source-code','static-schema','operation-client','registration','runtime','test','business-decision'];
const EVIDENCE_VERIFICATION=['VERIFIED','UNVERIFIED','STALE','CONFLICTING'];
const SPECIALISTS=['cdms','dab','angular-ui','graphql-schema','sql-relationship','qa-evidence'];
const READ_ONLY_OPERATIONS=['read','search','symbol','hash','list'];
const TASK_LIFECYCLE_STATUSES=['PREPARED','ASSIGNED','EXECUTING','RESULT_SUBMITTED','RESULT_VALIDATED','RESULT_REJECTED','COMPLETE','STALE','CANCELLED'];
const QUESTION_TYPES=['single-choice','multiple-choice','free-text','developer-clarification','business-rule-ambiguity','entity-mapping-ambiguity','technical-conflict'];
const QUESTION_STATUSES=['pending','answered','deferred','cancelled'];
const VOLATILE_KEYS=new Set(['createdAt','updatedAt','generatedAt','answeredAt','approvedAt','requestedAt','completedAt','recordedAt']);
const SET_ARRAY_KEYS=new Set([
 'evidenceRefs','requirementIds','acceptanceCriterionIds','coverageFindingIds','blockingQuestionIds',
 'inputEvidenceRefs','dependencies','crossRepositoryDependencies','unresolvedQuestions','searchedRepositories',
 'executionBoundaries','searchMethods','limitations','allowedOperations','sourceRootIds','findings','conflicts','errors','operations'
]);
const INTERNAL_MAP=Object.freeze({
 VERIFIED_IMPLEMENTED:'VERIFIED_EXISTING',
 PARTIALLY_IMPLEMENTED:'PARTIALLY_IMPLEMENTED',
 VERIFIED_MISSING:'MISSING',
 UNVERIFIED_SOURCE:'UNVERIFIED',
 UNVERIFIED_RUNTIME:'UNVERIFIED',
 BUSINESS_DECISION_REQUIRED:'UNVERIFIED'
});
const utf8=new TextEncoder();

function fail(message){throw new Error('Phase 01 contract: '+message);}
function object(value,name){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)fail(name+' must be a plain object.');
 return value;
}
function text(value,name,{max=2048,allowEmpty=false}={}){
 if(typeof value!=='string'||(!allowEmpty&&!value.trim())||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))fail(name+' must be a valid '+(allowEmpty?'string':'non-empty string')+'.');
 return value;
}
function id(value,name){text(value,name,{max:160});if(!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value))fail(name+' must be a portable identifier.');return value;}
function oneOf(value,values,name){if(!values.includes(value))fail(name+' is unsupported: '+String(value));return value;}
function list(value,name,{min=0,unique=false}={}){
 if(!Array.isArray(value)||value.length<min)fail(name+' must be an array'+(min?' with at least '+min+' item(s)':'')+'.');
 const out=value.map((x,i)=>text(x,name+'['+i+']'));
 if(unique&&new Set(out).size!==out.length)fail(name+' must not contain duplicates.');
 return out;
}
function records(value,name,{min=0}={}){
 if(!Array.isArray(value)||value.length<min)fail(name+' must be an array'+(min?' with at least '+min+' item(s)':'')+'.');
 return value.map((x,i)=>object(x,name+'['+i+']'));
}
function sha(value,name){if(typeof value!=='string'||!/^[a-f0-9]{64}$/i.test(value))fail(name+' must be a SHA-256 hex digest.');return value.toLowerCase();}
function revision(value,name){return text(value,name,{max:256});}
function relativePath(value,name){
 text(value,name,{max:1024});
 if(value.startsWith('/')||value.includes('\\')||/^[A-Za-z]:/.test(value)||value.split('/').some(part=>!part||part==='.'||part==='..'||/[\x00-\x1f<>:"|?*]/.test(part)||/[. ]$/.test(part)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(part)))fail(name+' must be a safe repository-relative path.');
 return value;
}
function contract(value,schema,name){
 object(value,name);
 if(value.schema!==schema||value.schemaVersion!==1)fail(name+' must use '+schema+' schemaVersion 1.');
 return value;
}
function versionedContract(value,schema,name,versions){
 object(value,name);
 if(value.schema!==schema||!versions.includes(value.schemaVersion))fail(name+' has an unsupported schema version.');
 return value;
}
function refs(value,name){return list(value,name,{unique:true});}
function uniqueBy(rows,key,name){
 const seen=new Set();
 for(const row of rows){const value=row[key];if(seen.has(value))fail(name+' contains duplicate '+key+': '+value);seen.add(value);}
}
function ensureRefs(ids,recordsById,name){
 for(const ref of ids)if(!recordsById.has(ref))fail(name+' refers to missing evidence '+ref+'.');
}
function evidenceIndex(rows){return new Map(rows.map(row=>[row.evidenceId,row]));}
function validateSourceRoots(rows){
 const roots=records(rows,'sourceRoots');
 uniqueBy(roots,'rootId','sourceRoots');
 for(const root of roots){
  id(root.rootId,'sourceRoot.rootId');text(root.repositoryKey,'sourceRoot.repositoryKey',{max:100});
  revision(root.revision,'sourceRoot.revision');sha(root.sha256,'sourceRoot.sha256');
 }
 return roots;
}

function normalizeCoverageStatus(status){
 if(Object.prototype.hasOwnProperty.call(INTERNAL_MAP,status))return {
  status:INTERNAL_MAP[status],originalStatus:status,
  decisionBlocker:status==='BUSINESS_DECISION_REQUIRED'
 };
 if(COVERAGE_STATUSES.includes(status))return {status,originalStatus:null,decisionBlocker:false};
 fail('coverage status is unknown: '+String(status));
}
function normalizeCoverageFinding(record){
 object(record,'coverage finding');
 if(record.schema!==undefined||record.schemaVersion!==undefined){
  if(record.schema!==SCHEMAS.coverage||record.schemaVersion!==1)fail('coverage finding has an unsupported existing schema version.');
 }
 const mapped=normalizeCoverageStatus(record.status);
 return {...record,schema:SCHEMAS.coverage,schemaVersion:1,status:mapped.status,originalStatus:mapped.originalStatus,
  decisionBlocker:mapped.decisionBlocker};
}
function validateCoverageFinding(record){
 contract(record,SCHEMAS.coverage,'coverage finding');
 id(record.findingId,'findingId');id(record.requirementId,'requirementId');id(record.acceptanceCriterionId,'acceptanceCriterionId');
 text(record.repositoryKey,'repositoryKey',{max:100});revision(record.sourceRevision,'sourceRevision');
 oneOf(record.status,COVERAGE_STATUSES,'status');
 if(typeof record.decisionBlocker!=='boolean')fail('decisionBlocker must be boolean.');
 if(record.originalStatus===undefined)fail('originalStatus must be explicit or null.');
 if(record.originalStatus!==null){
  oneOf(record.originalStatus,INTERNAL_STATUSES,'originalStatus');
  if(INTERNAL_MAP[record.originalStatus]!==record.status)fail('originalStatus does not normalize to status.');
 }
 if(record.decisionBlocker!==(record.originalStatus==='BUSINESS_DECISION_REQUIRED'))fail('business-decision blockers must remain distinct.');
 text(record.rationale,'rationale');
 refs(record.evidenceRefs,'evidenceRefs');
 list(record.blockingQuestionIds,'blockingQuestionIds',{unique:true});
 if(record.status==='VERIFIED_EXISTING'){
  if(!record.evidenceRefs.length)fail('VERIFIED_EXISTING requires evidence.');
  if((record.implementationTasks||[]).length)fail('VERIFIED_EXISTING cannot recommend implementation work.');
 }
 if(record.status==='PARTIALLY_IMPLEMENTED'||record.status==='MISSING'){
  text(record.missingBehavior,'missingBehavior');
  list(record.implementationTasks,'implementationTasks',{min:1});
  list(record.testScenarios,'testScenarios',{min:1});
  if(!record.evidenceRefs.length)fail(record.status+' requires investigation evidence.');
 }
 if(record.status==='MISSING'){
  const search=object(record.investigation,'investigation');
  list(search.searchedRepositories,'investigation.searchedRepositories',{min:1});
  list(search.executionBoundaries,'investigation.executionBoundaries',{min:1});
  list(search.searchMethods,'investigation.searchMethods',{min:1});
  list(search.limitations,'investigation.limitations');
 }
 if(record.status==='CONFLICTING'){
  text(record.conflictDescription,'conflictDescription');
  if(record.evidenceRefs.length<2)fail('CONFLICTING requires at least two evidence references.');
  if(!record.blockingQuestionIds?.length)fail('CONFLICTING requires a blocking resolution question.');
 }
 if(record.status==='UNVERIFIED'){
  text(record.verificationTask,'verificationTask');
  if(record.decisionBlocker===true&&!record.blockingQuestionIds?.length)fail('Business-decision blockers require a blocking question.');
 }
 if(record.implementationTarget!==undefined)oneOf(record.implementationTarget,PLANNING_TARGETS,'implementationTarget');
 for(const field of ['existingFunctionalityToPreserve','expectedInteractions','validationRequirements','errorHandlingRequirements'])
  if(record[field]!==undefined)list(record[field],'coverage '+field);
 if(record.refinedAcceptanceCriteria!==undefined){
  const criteria=records(record.refinedAcceptanceCriteria,'coverage refinedAcceptanceCriteria');
  for(const criterion of criteria){
   text(criterion.statement,'refined criterion statement',{max:2000});
   text(criterion.expectedOutcome,'refined criterion expectedOutcome',{max:2000});
   list(criterion.testScenarios,'refined criterion testScenarios',{min:1});
   list(criterion.scenarioTypes,'refined criterion scenarioTypes',{min:1,unique:true});
   for(const type of criterion.scenarioTypes)oneOf(type,['positive','negative','boundary','permission','integration','regression'],'refined scenario type');
   refs(criterion.evidenceRefs,'refined criterion evidenceRefs');
   if(!criterion.evidenceRefs.length)fail('refined criterion evidenceRefs must not be empty.');
  }
 }
 if(record.sharedUiIdentity!==undefined&&record.sharedUiIdentity!==null){
  const identity=object(record.sharedUiIdentity,'sharedUiIdentity');
  for(const field of ['angularProject','component','feature'])text(identity[field],'sharedUiIdentity.'+field,{max:256});
  for(const field of ['service','apiBoundary'])if(identity[field]!==null&&identity[field]!==undefined)text(identity[field],'sharedUiIdentity.'+field,{max:256});
 }
 if(record.implementationDependencies!==undefined){
  const dependencies=records(record.implementationDependencies,'implementationDependencies'),keys=new Set();
  for(const dependency of dependencies){
   oneOf(dependency.targetRepository,PLANNING_TARGETS,'implementation dependency targetRepository');
   oneOf(dependency.dependencyType,['BACKEND_API_BEFORE_UI','GRAPHQL_CONTRACT_BEFORE_CLIENT','SHARED_MODEL_BEFORE_HANDLER',
    'BUSINESS_DECISION_BEFORE_IMPLEMENTATION','VALIDATION_BEFORE_UI'],'implementation dependency type');
   text(dependency.rationale,'implementation dependency rationale');refs(dependency.evidenceRefs,'implementation dependency evidenceRefs');
   if(typeof dependency.verified!=='boolean')fail('implementation dependency verified must be boolean.');
   const key=dependency.targetRepository+'|'+dependency.dependencyType;if(keys.has(key))fail('implementation dependencies contain a duplicate target/type.');keys.add(key);
  }
 }
 return record;
}
function validateImplementationAuthorization(record){
 versionedContract(record,SCHEMAS.implementationAuthorization,'implementation authorization',[1]);
 id(record.authorizationId,'implementation authorizationId');id(record.packageId,'implementation authorization packageId');
 if(!Number.isInteger(record.packageRevision)||record.packageRevision<1)fail('implementation authorization packageRevision must be positive.');
 sha(record.packageFingerprint,'implementation authorization packageFingerprint');
 sha(record.approvalFingerprint,'implementation authorization approvalFingerprint');
 oneOf(record.decision,['AUTHORIZED'],'implementation authorization decision');
 oneOf(record.scope,['BUILDER_NATIVE_CHILD_EXPORT_ONLY'],'implementation authorization scope');
 list(record.selectedChildIds,'authorized child IDs',{min:1,unique:true});
 text(record.authorizedBy,'implementation authorizedBy');text(record.evidence,'implementation authorization evidence');
 text(record.authorizedAt,'implementation authorizedAt');sha(record.fingerprint,'implementation authorization fingerprint');
 return record;
}
function validateNativeChildExport(record){
 versionedContract(record,SCHEMAS.nativeChildExport,'Builder-native child export',[1]);
 id(record.packageId,'native child export packageId');id(record.parentPbiId,'native child export parentPbiId');
 if(!Number.isInteger(record.packageRevision)||record.packageRevision<1)fail('native child export packageRevision must be positive.');
 sha(record.packageFingerprint,'native child export packageFingerprint');
 oneOf(record.packageStatus,['AUTHORIZED_FOR_IMPLEMENTATION'],'native child export packageStatus');
 const authorization=validateImplementationAuthorization(record.implementationAuthorization);
 const approval=validatePackageApproval(record.packageApproval);
 if(authorization.packageId!==record.packageId||authorization.packageRevision!==record.packageRevision||
  authorization.packageFingerprint!==record.packageFingerprint||authorization.approvalFingerprint!==approval.fingerprint||
  approval.packageId!==record.packageId||approval.packageRevision!==record.packageRevision)
  fail('native child export authorization is bound to a different package.');
 const manifest=object(record.planningManifest,'native child export planningManifest');
 if(manifest.schema!=='akzo-parent-child-planning-package'||manifest.schemaVersion!==1||
  manifest.packageId!==record.packageId||manifest.parentPbiId!==record.parentPbiId||
  manifest.packageRevision!==record.packageRevision||manifest.fingerprint!==record.packageFingerprint||
  manifest.status!=='READY_FOR_APPROVAL'||manifest.handoffReady!==false)
  fail('native child export planning manifest is stale or incompatible.');
 const children=records(record.children,'native child export children',{min:1}),ids=children.map(child=>child.provisionalChildId);
 uniqueBy(children,'provisionalChildId','native child export children');
 if(canonicalJson(ids.sort())!==canonicalJson([...authorization.selectedChildIds].sort()))
  fail('native child export children do not match the authorized selection.');
 list(record.selectedTargets,'native child export selectedTargets',{min:1,unique:true});
 const parent=validateParentPbi(record.parentPbi);
 if(parent.pbiId!==record.parentPbiId)fail('native child export Parent PBI identity does not match.');
 const evidence=records(record.evidenceReferences,'native child export evidenceReferences');
 uniqueBy(evidence,'evidenceId','native child export evidenceReferences');
 const evidenceMap=new Map();
 for(const item of evidence){
  id(item.evidenceId,'native child export evidenceId');text(item.repositoryKey,'native child export repositoryKey',{max:100});
  relativePath(item.relativePath,'native child export evidence path');sha(item.sha256,'native child export evidence sha256');
  oneOf(item.verificationStatus,['VERIFIED'],'native child export evidence status');evidenceMap.set(item.evidenceId,item);
 }
 const edges=records(record.dependencyGraph?.edges,'native child export dependency edges'),
  graph=validateDependencyGraph(children,{edges},{selectedTargets:record.selectedTargets});
 if(!graph.valid||canonicalJson(graph.implementationOrder)!==canonicalJson(record.dependencyGraph.implementationOrder))
  fail('native child export dependency graph is invalid or has an inconsistent implementation order.');
 const shared=records(record.sharedUiWork,'native child export sharedUiWork');
 for(const item of shared)if(item.childIds.some(childId=>!ids.includes(childId)))
  fail('native child export shared UI work refers to an unselected child.');
 validatePlanningChildSelection(children,{edges},shared,authorization.selectedChildIds);
 for(const child of children){
  versionedContract(child,SCHEMAS.plannedChild,'native export child',[2]);
  for(const ref of child.verifiedImplementationReferences||[]){
   const item=evidenceMap.get(ref.evidenceId);
   if(!item||item.repositoryKey!==ref.repositoryKey||item.relativePath!==ref.relativePath||item.sha256!==ref.sha256)
    fail('native export child evidence references do not match its verified evidence manifest.');
  }
 }
 const questions=records(record.clarificationQuestions,'native child export clarificationQuestions');
 for(const question of questions)if(question.blocking&&question.status!=='answered')
  fail('native child export cannot contain unresolved blocking questions.');
 const questionIds=new Set(questions.map(question=>id(question.questionId,'native child export questionId')));
 for(const child of children)validatePlanningChild(child,evidenceMap,questionIds,record.selectedTargets);
 if(record.handoffStatus!=='UNSUPPORTED_CHILD_HANDOFF_V1'||record.handoffReady!==false||record.implementationStarted!==false)
  fail('Builder-native child export must not claim SDD handoff or implementation execution.');
 sha(record.exportFingerprint,'native child export fingerprint');
 return record;
}
function validateFindingPlanningDetails(finding,evidence){
 if(finding.implementationTarget!==undefined&&
  !finding.evidenceRefs.some(ref=>evidence.get(ref)?.repositoryKey===finding.implementationTarget))
  fail('implementation target must be supported by evidence from its owning repository.');
 if(finding.sharedUiIdentity){
  const identity=finding.sharedUiIdentity;
  if(!finding.evidenceRefs.some(ref=>{const item=evidence.get(ref);return item?.repositoryKey==='ui'&&
   (item.symbol===identity.component||item.symbol===identity.service);}))
   fail('shared UI identity must match verified Angular source evidence.');
 }
 for(const field of ['existingFunctionalityToPreserve','expectedInteractions','validationRequirements','errorHandlingRequirements'])
  if(finding[field]?.length&&!finding.evidenceRefs.some(ref=>evidence.get(ref)?.verificationStatus==='VERIFIED'))
   fail('planning detail '+field+' requires verified finding evidence.');
 for(const criterion of finding.refinedAcceptanceCriteria||[]){
  if(criterion.evidenceRefs.some(ref=>!finding.evidenceRefs.includes(ref)))
   fail('refined child criteria may cite only evidence attached to their coverage finding.');
  ensureRefs(criterion.evidenceRefs,evidence,'refined child criterion');
  if(criterion.evidenceRefs.some(ref=>evidence.get(ref).verificationStatus!=='VERIFIED'))
   fail('refined child criteria require verified evidence.');
 }
 for(const dependency of finding.implementationDependencies||[]){
  ensureRefs(dependency.evidenceRefs,evidence,'implementation dependency');
  if(dependency.verified&&(!dependency.evidenceRefs.length||dependency.evidenceRefs.some(ref=>evidence.get(ref).verificationStatus!=='VERIFIED')))
   fail('verified implementation dependencies require verified evidence.');
 }
 return finding;
}
function validatePackageApproval(record){
 contract(record,SCHEMAS.approval,'package approval');
 id(record.packageId,'packageId');if(!Number.isInteger(record.packageRevision)||record.packageRevision<1)fail('approval packageRevision must be positive.');
 id(record.requestId,'requestId');text(record.requestedBy,'requestedBy');
 oneOf(record.decision,['APPROVED'],'approval decision');oneOf(record.status,['APPROVED'],'approval status');
 text(record.approvedBy,'approvedBy');text(record.approvedAt,'approvedAt');text(record.evidence,'approval evidence');sha(record.fingerprint,'approval fingerprint');
 return record;
}
function coverageRecommendation(record){
 validateCoverageFinding(record);
 if(record.status==='VERIFIED_EXISTING')return {label:'Already Covered — No Implementation Required',implementationTasks:[],blocked:false};
 if(record.status==='PARTIALLY_IMPLEMENTED'||record.status==='MISSING')return {label:'Implement verified gaps only',implementationTasks:[...record.implementationTasks],blocked:false};
 return {label:null,implementationTasks:[],blocked:true};
}

function validateEvidence(record,{sourceRootIds}={}){
 contract(record,SCHEMAS.evidence,'evidence');
 id(record.evidenceId,'evidenceId');id(record.requirementId,'requirementId');id(record.acceptanceCriterionId,'acceptanceCriterionId');
 text(record.repositoryKey,'repositoryKey',{max:100});id(record.sourceRootId,'sourceRootId');
 relativePath(record.relativePath,'relativePath');revision(record.sourceRevision,'sourceRevision');sha(record.sha256,'sha256');
 text(record.symbol,'symbol',{max:512});oneOf(record.category,EVIDENCE_CATEGORIES,'evidence category');
 text(record.verificationMethod,'verificationMethod');text(record.description,'description');
 text(record.executionContext,'executionContext');list(record.limitations,'limitations');
 oneOf(record.verificationStatus,EVIDENCE_VERIFICATION,'verificationStatus');
 const hasStart=record.lineStart!==undefined&&record.lineStart!==null,hasEnd=record.lineEnd!==undefined&&record.lineEnd!==null;
 if(hasStart!==hasEnd)fail('lineStart and lineEnd must be supplied together.');
 if(hasStart&&(!Number.isInteger(record.lineStart)||record.lineStart<1||!Number.isInteger(record.lineEnd)||record.lineEnd<record.lineStart))fail('line range is invalid.');
 if(sourceRootIds&&!sourceRootIds.has(record.sourceRootId))fail('evidence references an unregistered source root.');
 return record;
}

function validateCdmsPluginRule(record,evidence){
 contract(record,SCHEMAS.cdmsPluginRule,'CDMS plugin rule');
 id(record.businessRuleId,'businessRuleId');id(record.requirementId,'requirementId');id(record.acceptanceCriterionId,'acceptanceCriterionId');
 oneOf(record.pluginStatus,['FOUND','NOT_FOUND','UNVERIFIED'],'pluginStatus');
 const index=evidenceIndex(evidence||[]);
 refs(record.evidenceRefs,'evidenceRefs');ensureRefs(record.evidenceRefs,index,'CDMS rule');
 refs(record.sourceEvidenceRefs,'sourceEvidenceRefs');ensureRefs(record.sourceEvidenceRefs,index,'CDMS sourceEvidenceRefs');
 refs(record.registrationEvidenceRefs,'registrationEvidenceRefs');ensureRefs(record.registrationEvidenceRefs,index,'CDMS registrationEvidenceRefs');
 oneOf(record.registrationStatus,['VERIFIED','UNVERIFIED','NOT_APPLICABLE'],'registrationStatus');
 if(record.pluginStatus==='FOUND'){
  text(record.pluginProject,'pluginProject',{max:256});text(record.pluginClass,'pluginClass',{max:512});text(record.method,'method',{max:512});
  if(!record.sourceEvidenceRefs.length||record.sourceEvidenceRefs.some(ref=>index.get(ref).category!=='source-code'||index.get(ref).verificationStatus!=='VERIFIED'))fail('A found plugin requires verified source-code evidence.');
 }else if(record.pluginStatus==='NOT_FOUND'){
  object(record.investigation,'plugin investigation');
  list(record.investigation.searchedRepositories,'plugin investigation repositories',{min:1});
  list(record.investigation.searchMethods,'plugin investigation methods',{min:1});
  list(record.investigation.limitations,'plugin investigation limitations');
 }else text(record.verificationTask,'verificationTask');
 for(const field of ['crmMessage','targetEntity','pipelineStage'])if(record[field]!==null&&record[field]!==undefined)text(record[field],field,{max:256});
 for(const field of ['preconditions','validationConditions','dataDependencies','sideEffects','unresolvedQuestions'])list(record[field],field);
 const branches=records(record.decisionBranches,'decisionBranches');
 for(const branch of branches){id(branch.branchId,'branchId');text(branch.condition,'branch.condition');text(branch.outcome,'branch.outcome');if(branch.errorMessage!==null&&branch.errorMessage!==undefined)text(branch.errorMessage,'branch.errorMessage');}
 const related=records(record.relatedEntityFields,'relatedEntityFields');
 for(const ref of related){text(ref.entity,'related entity');text(ref.field,'related field');}
 oneOf(record.coverageStatus,COVERAGE_STATUSES,'coverageStatus');
 if(record.registrationStatus==='VERIFIED'&&!record.registrationEvidenceRefs.some(ref=>['registration','runtime'].includes(index.get(ref).category)&&index.get(ref).verificationStatus==='VERIFIED'))fail('Verified registration needs verified registration or runtime evidence.');
 if(record.registrationStatus==='NOT_APPLICABLE'&&record.registrationEvidenceRefs.length)fail('Not-applicable registration cannot contain registration evidence.');
 if(record.coverageStatus==='VERIFIED_EXISTING'&&!record.evidenceRefs.some(ref=>index.get(ref).verificationStatus==='VERIFIED'))fail('Covered CDMS behavior requires verified evidence.');
 if(record.coverageStatus==='MISSING'&&!record.investigation)fail('A missing CDMS rule requires a bounded investigation.');
 return record;
}

function validateDabTranslation(record,evidence){
 contract(record,SCHEMAS.dabTranslation,'CDMS-to-DAB translation');
 id(record.translationId,'translationId');id(record.requirementId,'requirementId');id(record.acceptanceCriterionId,'acceptanceCriterionId');
 oneOf(record.cdmsStatus,['FOUND','NOT_FOUND','UNVERIFIED'],'cdmsStatus');
 if(record.cdmsStatus==='FOUND')id(record.sourceCdmsBusinessRuleId,'sourceCdmsBusinessRuleId');
 else if(record.sourceCdmsBusinessRuleId!==null&&record.sourceCdmsBusinessRuleId!==undefined)id(record.sourceCdmsBusinessRuleId,'sourceCdmsBusinessRuleId');
 const index=evidenceIndex(evidence||[]);
 refs(record.cdmsEvidenceRefs,'cdmsEvidenceRefs');ensureRefs(record.cdmsEvidenceRefs,index,'DAB translation CDMS evidence');
 refs(record.dabEvidenceRefs,'dabEvidenceRefs');ensureRefs(record.dabEvidenceRefs,index,'DAB translation DAB evidence');
 if(record.cdmsStatus==='NOT_FOUND'){
  const search=object(record.cdmsInvestigation,'CDMS investigation');
  list(search.searchedRepositories,'CDMS investigation repositories',{min:1});
  list(search.searchMethods,'CDMS investigation methods',{min:1});
  list(search.limitations,'CDMS investigation limitations');
 }else if(record.cdmsStatus==='UNVERIFIED')text(record.cdmsVerificationTask,'cdmsVerificationTask');
 oneOf(record.dabCoverageStatus,COVERAGE_STATUSES,'dabCoverageStatus');
 const mappings=records(record.fieldMappings,'fieldMappings');
 for(const mapping of mappings){
  id(mapping.mappingId,'mappingId');oneOf(mapping.status,['VERIFIED','UNVERIFIED','CONFLICTING'],'field mapping status');
  if(mapping.legacyEntity!==null&&mapping.legacyEntity!==undefined)text(mapping.legacyEntity,'legacyEntity');
  if(mapping.legacyField!==null&&mapping.legacyField!==undefined)text(mapping.legacyField,'legacyField');
  if(mapping.dabModel!==null&&mapping.dabModel!==undefined)text(mapping.dabModel,'dabModel');
  if(mapping.dabField!==null&&mapping.dabField!==undefined)text(mapping.dabField,'dabField');
  refs(mapping.evidenceRefs,'field mapping evidenceRefs');ensureRefs(mapping.evidenceRefs,index,'DAB field mapping');
  if(mapping.status==='VERIFIED'&&(!mapping.legacyEntity||!mapping.legacyField||!mapping.dabModel||!mapping.dabField||!mapping.evidenceRefs.some(ref=>index.get(ref).verificationStatus==='VERIFIED')))fail('Verified DAB mappings require both sides and verified evidence.');
  if(mapping.status!=='VERIFIED')id(mapping.questionId,'field mapping questionId');
 }
 const missing=record.dabCoverageStatus==='MISSING'||record.dabCoverageStatus==='PARTIALLY_IMPLEMENTED';
 if(missing){
  text(record.missingDabBehavior,'missingDabBehavior');text(record.implementationBoundary,'implementationBoundary');
  list(record.implementationInstructions,'implementationInstructions',{min:1});list(record.testScenarios,'testScenarios',{min:1});
  if(/(?:create|implement|add|generate|register)\s+(?:a\s+)?(?:legacy\s+)?crm\s+plugin/i.test([record.implementationBoundary,...record.implementationInstructions].join('\n')))fail('DAB guidance must use DAB application architecture, not CRM plugin infrastructure.');
 }
 if(['VERIFIED_EXISTING','MISSING','PARTIALLY_IMPLEMENTED'].includes(record.dabCoverageStatus)&&!record.dabEvidenceRefs.some(ref=>index.get(ref).verificationStatus==='VERIFIED'))fail('Verified DAB behavior and investigated gaps require independent verified DAB evidence.');
 if(record.dabCoverageStatus==='UNVERIFIED')text(record.verificationTask,'verificationTask');
 if(record.dabCoverageStatus==='CONFLICTING'){text(record.conflictDescription,'conflictDescription');id(record.blockingQuestionId,'blockingQuestionId');}
 if(record.mappingConfidence!==null&&record.mappingConfidence!==undefined&&(!Number.isFinite(record.mappingConfidence)||record.mappingConfidence<0||record.mappingConfidence>1))fail('mappingConfidence must be between 0 and 1.');
 list(record.unresolvedQuestions,'unresolvedQuestions');
 return record;
}

function validateSqlRelationship(record,evidence){
 contract(record,SCHEMAS.sqlRelationship,'SQL relationship');
 id(record.relationshipId,'relationshipId');id(record.artifactId,'artifactId');sha(record.artifactSha256,'artifactSha256');
 id(record.sourceRootId,'sourceRootId');relativePath(record.relativePath,'relativePath');
 text(record.environment,'environment');revision(record.sourceRevision,'sourceRevision');
 oneOf(record.kind,['primary-key','foreign-key'],'relationship kind');
 const table=object(record.table,'table');text(table.name,'table.name');if(table.schema===undefined)fail('table.schema must be explicit or null.');if(table.schema!==null)text(table.schema,'table.schema');
 list(record.primaryKeyColumns,'primaryKeyColumns',{unique:true});
 if(record.kind==='primary-key'){
  if(!record.primaryKeyColumns.length)fail('Primary-key records require ordered key columns.');
  if(record.foreignKey!==null)fail('Primary-key records cannot contain foreign-key details.');
 }else{
  if(record.foreignKey===null||record.foreignKey===undefined)fail('Foreign-key records require constraint details.');
  const fk=object(record.foreignKey,'foreignKey');text(fk.constraintId,'foreignKey.constraintId');
  const target=object(fk.referencedTable,'foreignKey.referencedTable');text(target.name,'referenced table name');if(target.schema===undefined)fail('referenced table schema must be explicit or null.');if(target.schema!==null)text(target.schema,'referenced table schema');
  const columns=records(fk.columns,'foreignKey.columns',{min:1});
  for(const [i,column]of columns.entries()){
   if(record.columnOrderVerified===false){if(column.ordinal!==null)fail('foreign-key columns without verified ordering must use null ordinals.');}
   else if(column.ordinal!==i+1)fail('foreign-key columns must be ordered by contiguous ordinal.');
   text(column.localColumn,'localColumn');text(column.referencedColumn,'referencedColumn');
  }
  if(record.primaryKeyColumns.length)fail('Foreign-key records cannot contain primaryKeyColumns.');
 }
 oneOf(record.validationStatus,['VERIFIED','PARTIAL','AMBIGUOUS','CONFLICTING','UNRESOLVED','UNVERIFIED'],'validationStatus');
 if(typeof record.unresolvedSchemaQualification!=='boolean')fail('unresolvedSchemaQualification must be boolean.');
 if(typeof record.blocking!=='boolean')fail('SQL relationship blocking must be boolean.');
 if(record.unresolvedSchemaQualification&&record.validationStatus==='VERIFIED')fail('A relationship with unresolved schema qualification cannot be verified.');
 refs(record.conflictingEvidenceRefs,'conflictingEvidenceRefs');refs(record.evidenceRefs,'evidenceRefs');
 const index=evidenceIndex(evidence||[]);ensureRefs(record.conflictingEvidenceRefs,index,'SQL conflict');ensureRefs(record.evidenceRefs,index,'SQL relationship');
 list(record.unresolvedQuestions,'unresolvedQuestions');
 if(record.validationStatus==='CONFLICTING'&&(!record.conflictingEvidenceRefs.length||!record.unresolvedQuestions.length))fail('Conflicting SQL relationships require evidence and a resolution question.');
 if(['AMBIGUOUS','UNRESOLVED'].includes(record.validationStatus)&&!record.unresolvedQuestions.length)fail('Ambiguous or unresolved SQL relationships require a question.');
 if(record.validationStatus==='VERIFIED'&&!record.evidenceRefs.length)fail('Verified SQL relationships require evidence.');
 if(['AMBIGUOUS','CONFLICTING','UNRESOLVED'].includes(record.validationStatus)&&!record.blocking)fail('Ambiguous, conflicting or unresolved SQL relationships must remain blocking.');
 return record;
}
function validateSqlMetadata(record,roots){
 contract(record,SCHEMAS.sqlMetadata,'SQL metadata import');
 const sources=records(record.sources,'SQL metadata sources',{min:3}),seen=new Set(),rootMap=new Map(roots.map(root=>[root.rootId,root]));
 for(const source of sources){
  oneOf(source.dataset,['foreignKeys','primaryKeys','tables'],'SQL dataset');
  if(seen.has(source.dataset))fail('SQL metadata import contains duplicate '+source.dataset+' sources.');seen.add(source.dataset);
  id(source.sourceRootId,'SQL sourceRootId');const root=rootMap.get(source.sourceRootId);
  if(!root)fail('SQL metadata source has no matching source root.');
  text(source.sourceIdentity,'SQL sourceIdentity',{max:4096});if(source.path!==null&&source.path!==undefined)text(source.path,'SQL source path',{max:4096});
  text(source.originalFilename,'SQL originalFilename',{max:512});oneOf(source.sourceType,['sql-server-export'],'SQL sourceType');
  sha(source.sha256,'SQL source SHA-256');if(root.sha256!==source.sha256)fail('SQL source hash differs from its source-root snapshot.');
  text(source.importedAt,'SQL importedAt');text(source.environment,'SQL environment');
  if(source.extractedAt!==null&&source.extractedAt!==undefined)text(source.extractedAt,'SQL extractedAt');
  if(source.sourceRevision!==null&&source.sourceRevision!==undefined)text(source.sourceRevision,'SQL sourceRevision metadata');
  oneOf(source.format,['quoted-tab','tsv','csv'],'SQL source format');
  oneOf(source.validationStatus,['VALIDATED','PARTIAL','STALE','MISSING'],'SQL validation status');
  if(!Number.isInteger(source.recordCount)||source.recordCount<0||!Number.isInteger(source.duplicateCount)||source.duplicateCount<0)fail('SQL source record counts must be non-negative integers.');
 }
 if(seen.size!==3)fail('SQL metadata imports must describe all three datasets.');
 if(record.modelCounts!==undefined){
  const counts=object(record.modelCounts,'SQL modelCounts');
  for(const key of ['tables','columns','primaryKeys','foreignKeys'])if(!Number.isInteger(counts[key])||counts[key]<0)fail('SQL model count '+key+' must be a non-negative integer.');
 }
 text(record.comparisonPolicy,'SQL comparisonPolicy');
 return record;
}

function validateGraphqlMetadata(record,roots){
 contract(record,SCHEMAS.graphqlMetadata,'GraphQL metadata');
 sha(record.libraryManifestSha256,'GraphQL library manifest SHA-256');
 id(record.referenceRootId,'GraphQL referenceRootId');
 const rootMap=new Map(roots.map(root=>[root.rootId,root])),referenceRoot=rootMap.get(record.referenceRootId);
 if(!referenceRoot||referenceRoot.repositoryKey!=='pbi-builder-reference-library'||referenceRoot.sha256!==record.libraryManifestSha256)fail('GraphQL metadata must bind to its installed reference-library snapshot.');
 const schemas=records(record.schemaArtifacts,'GraphQL schemaArtifacts',{min:1});
 uniqueBy(schemas,'artifactId','GraphQL schemaArtifacts');
 const schemaMap=new Map();
 for(const artifact of schemas){
  id(artifact.artifactId,'GraphQL schema artifactId');relativePath(artifact.relativePath,'GraphQL schema relativePath');
  if(!artifact.relativePath.startsWith('playbook/pbi-builder/references/graphql/'))fail('GraphQL schema artifacts must use the installed reference library.');
  sha(artifact.sha256,'GraphQL schema SHA-256');id(artifact.sourceRootId,'GraphQL schema sourceRootId');
  if(!rootMap.has(artifact.sourceRootId))fail('GraphQL schema artifact has no source-root snapshot.');
  oneOf(artifact.validationStatus,['VALIDATED','STALE','INVALID','UNRESOLVED'],'GraphQL schema validationStatus');
  list(artifact.errors,'GraphQL schema errors');
  if(artifact.validationStatus==='VALIDATED'&&artifact.errors.length)fail('Validated GraphQL schemas cannot contain validation errors.');
  if(artifact.validationStatus!=='VALIDATED'&&!artifact.errors.length)fail('Non-validated GraphQL schemas require an explicit reason.');
  schemaMap.set(artifact.artifactId,artifact);
 }
 const operations=records(record.operationArtifacts,'GraphQL operationArtifacts');
 uniqueBy(operations,'operationId','GraphQL operationArtifacts');
 for(const operation of operations){
  id(operation.operationId,'GraphQL operationId');text(operation.operationName,'GraphQL operationName');
  relativePath(operation.relativePath,'GraphQL operation relativePath');sha(operation.sha256,'GraphQL operation SHA-256');
  id(operation.sourceRootId,'GraphQL operation sourceRootId');if(!rootMap.has(operation.sourceRootId))fail('GraphQL operation has no source-root snapshot.');
  id(operation.schemaArtifactId,'GraphQL operation schemaArtifactId');
  const schema=schemaMap.get(operation.schemaArtifactId);if(!schema)fail('GraphQL operation references an unknown schema artifact.');
  oneOf(operation.validationStatus,['VALIDATED','STALE','INVALID','UNRESOLVED'],'GraphQL operation validationStatus');
  list(operation.errors,'GraphQL operation errors');list(operation.selectedFieldPaths,'GraphQL selectedFieldPaths',{unique:true});
  if(operation.validationStatus==='VALIDATED'&&(operation.errors.length||schema.validationStatus!=='VALIDATED'))fail('Validated GraphQL operations require a current valid schema and no validation errors.');
  if(operation.validationStatus!=='VALIDATED'&&!operation.errors.length)fail('Non-validated GraphQL operations require an explicit reason.');
 }
 return record;
}

function validateGraphqlMapping(record,{evidence,relationships,metadata}){
 contract(record,SCHEMAS.graphqlMapping,'GraphQL mapping');
 id(record.mappingId,'GraphQL mappingId');id(record.requirementId,'GraphQL mapping requirementId');
 id(record.acceptanceCriterionId,'GraphQL mapping acceptanceCriterionId');id(record.sqlRelationshipId,'GraphQL sqlRelationshipId');
 id(record.schemaArtifactId,'GraphQL schemaArtifactId');id(record.operationId,'GraphQL operationId');
 text(record.graphqlType,'GraphQL graphqlType');text(record.graphqlFieldPath,'GraphQL graphqlFieldPath');
 oneOf(record.status,['VERIFIED','PARTIAL','CONFLICTING','UNRESOLVED'],'GraphQL mapping status');
 if(typeof record.blocking!=='boolean')fail('GraphQL mapping blocking must be boolean.');
 refs(record.evidenceRefs,'GraphQL mapping evidenceRefs');ensureRefs(record.evidenceRefs,evidence,'GraphQL mapping');
 list(record.unresolvedQuestions,'GraphQL mapping unresolvedQuestions');
 const relationship=relationships.find(item=>item.relationshipId===record.sqlRelationshipId);
 if(!relationship)fail('GraphQL mapping references an unknown SQL relationship.');
 const schema=metadata?.schemaArtifacts.find(item=>item.artifactId===record.schemaArtifactId);
 const operation=metadata?.operationArtifacts.find(item=>item.operationId===record.operationId);
 if(!schema||!operation||operation.schemaArtifactId!==schema.artifactId)fail('GraphQL mapping must bind to an explicitly assigned schema and operation.');
 const evidenceRows=record.evidenceRefs.map(ref=>evidence.get(ref));
 const sqlEvidence=relationship.evidenceRefs.map(ref=>evidence.get(ref)).filter(Boolean);
 const hasMatching=(rows,artifact,category)=>rows.some(item=>item&&item.category===category&&item.verificationStatus==='VERIFIED'&&
  item.sourceRootId===artifact.sourceRootId&&item.relativePath===artifact.relativePath&&item.sha256===artifact.sha256);
 if(record.status==='VERIFIED'){
  if(record.blocking||record.unresolvedQuestions.length)fail('Verified GraphQL mappings cannot remain blocking or unresolved.');
  if(relationship.validationStatus!=='VERIFIED'||schema.validationStatus!=='VALIDATED'||operation.validationStatus!=='VALIDATED')fail('Verified GraphQL mappings require current verified SQL, schema, and operation contracts.');
  if(!operation.selectedFieldPaths.includes(record.graphqlFieldPath))fail('Verified GraphQL mappings must name a field path selected by the validated operation.');
  if(!hasMatching(sqlEvidence,{...relationship,sha256:relationship.artifactSha256},'static-schema')||
   !hasMatching(evidenceRows,schema,'static-schema')||!hasMatching(evidenceRows,operation,'operation-client'))fail('Verified GraphQL mappings require exact-hash evidence for the SQL relationship, SDL field, and assigned operation.');
  if(evidenceRows.some(item=>item.requirementId!==record.requirementId||item.acceptanceCriterionId!==record.acceptanceCriterionId))fail('GraphQL mapping evidence must bind to the same requirement and acceptance criterion.');
 }else if(!record.blocking||!record.unresolvedQuestions.length)fail('Partial, conflicting, or unresolved GraphQL mappings must remain blocking and name a resolution question.');
 return record;
}

function validateUiMapping(record,evidence){
 contract(record,SCHEMAS.uiMapping,'UI mapping');
 id(record.mappingId,'mappingId');id(record.requirementId,'requirementId');id(record.acceptanceCriterionId,'acceptanceCriterionId');
 text(record.displayLabel,'displayLabel');oneOf(record.status,['VERIFIED','PARTIAL','CONFLICTING','UNRESOLVED'],'status');
 const index=evidenceIndex(evidence||[]),nodes=records(record.nodes,'nodes'),edges=records(record.edges,'edges');
 uniqueBy(nodes,'nodeId','UI mapping nodes');
 uniqueBy(edges,'edgeId','UI mapping edges');
 const kinds=new Set(['ui-label','angular-component','angular-template','binding','model','api-operation','backend-service','entity-field']);
 for(const node of nodes){id(node.nodeId,'nodeId');oneOf(node.kind,[...kinds],'UI node kind');text(node.repositoryKey,'node.repositoryKey',{max:100});relativePath(node.relativePath,'node.relativePath');text(node.symbol,'node.symbol',{max:512});}
 for(const edge of edges){
  id(edge.edgeId,'edgeId');id(edge.fromNodeId,'edge.fromNodeId');id(edge.toNodeId,'edge.toNodeId');
  if(!nodes.some(node=>node.nodeId===edge.fromNodeId)||!nodes.some(node=>node.nodeId===edge.toNodeId))fail('UI mapping edge refers to a missing node.');
  refs(edge.evidenceRefs,'edge.evidenceRefs');if(!edge.evidenceRefs.length)fail('Every UI mapping edge requires evidence.');
  ensureRefs(edge.evidenceRefs,index,'UI mapping edge');
 }
 list(record.unresolvedQuestions,'unresolvedQuestions');
 if(record.status==='VERIFIED'){
  const ordered=[...nodes].sort((a,b)=>a.order-b.order);
  if(ordered.some((node,i)=>!Number.isInteger(node.order)||node.order!==i))fail('Verified UI mapping nodes require unique, contiguous ordered positions.');
  const sequence=ordered.map(node=>node.kind),hasComponent=sequence.includes('angular-component')||sequence.includes('angular-template');
  const required=['ui-label','binding','model','api-operation','backend-service','entity-field'];
  let last=-1;for(const kind of required){const at=sequence.indexOf(kind,last+1);if(at<0)fail('Verified UI mappings require the complete label-to-entity chain.');last=at;}
  if(!hasComponent)fail('Verified UI mappings require component/template evidence.');
  if(edges.length!==ordered.length-1)fail('Verified UI mappings require exactly one edge for each consecutive node pair.');
  for(let i=0;i<ordered.length-1;i++)if(!edges.some(edge=>edge.fromNodeId===ordered[i].nodeId&&edge.toNodeId===ordered[i+1].nodeId))fail('Verified UI mappings require evidence for each consecutive edge.');
 }
 if(record.status==='CONFLICTING'){text(record.conflictDescription,'conflictDescription');if(!record.unresolvedQuestions.length)fail('Conflicting UI mappings require a question and conflict description.');}
 if(record.status==='UNRESOLVED'&&!record.unresolvedQuestions.length)fail('Unresolved UI mappings require a question.');
 if(typeof record.blocking!=='boolean')fail('UI mapping blocking must be boolean.');
 if(['CONFLICTING','UNRESOLVED'].includes(record.status)&&!record.blocking)fail('Conflicting or unresolved UI mappings must remain blocking.');
 return record;
}

function validateSpecialistTask(record){
 versionedContract(record,SCHEMAS.specialistTask,'specialist task',[1,2]);
 id(record.runId,'runId');id(record.taskId,'taskId');id(record.parentPackageId,'parentPackageId');
 oneOf(record.specialistType,SPECIALISTS,'specialistType');sha(record.canonicalStateRevision,'canonicalStateRevision');id(record.cancellationIdentity,'cancellationIdentity');
 const roots=validateSourceRoots(record.sourceSnapshots);if(!roots.length)fail('specialist tasks require source snapshots.');
 const scope=records(record.allowedScope,'allowedScope',{min:1});
 for(const item of scope){id(item.sourceRootId,'allowedScope.sourceRootId');if(record.schemaVersion===2&&item.relativePrefix==='*'){}else relativePath(item.relativePrefix,'allowedScope.relativePrefix');if(!roots.some(root=>root.rootId===item.sourceRootId))fail('allowed scope references a source root outside the task snapshot.');}
 const ops=list(record.allowedOperations,'allowedOperations',{min:1,unique:true});
 if(ops.some(op=>!READ_ONLY_OPERATIONS.includes(op)))fail('specialist tasks may authorize read-only operations only.');
 refs(record.inputEvidenceRefs,'inputEvidenceRefs');
 if(record.status!==undefined)oneOf(record.status,['PENDING','RUNNING','COMPLETED','CANCELLED'],'task status');
 if(record.schemaVersion===2){
  if(!Number.isInteger(record.taskRevision)||record.taskRevision<1)fail('taskRevision must be a positive integer.');
  id(record.requirementId,'requirementId');id(record.acceptanceCriterionId,'acceptanceCriterionId');
  text(record.requirementText,'requirementText');text(record.acceptanceCriterionText,'acceptanceCriterionText');text(record.objective,'objective');
  sha(record.parentCoordinatorRevision,'parentCoordinatorRevision');
  oneOf(record.lifecycleStatus,TASK_LIFECYCLE_STATUSES,'task lifecycleStatus');
  if(record.executionMode!=='MANUAL_EXPORT_IMPORT')fail('Phase 04 tasks must use the explicit manual export/import workflow.');
  if(record.readOnly!==true)fail('specialist tasks must be explicitly read-only.');
  text(record.preparedAt,'preparedAt');
 }
 return record;
}
function sameSnapshots(left,right){
 const order=rows=>validateSourceRoots(rows).map(row=>({rootId:row.rootId,repositoryKey:row.repositoryKey,revision:row.revision,sha256:row.sha256.toLowerCase()})).sort((a,b)=>a.rootId.localeCompare(b.rootId));
 return canonicalJson(order(left))===canonicalJson(order(right));
}
function validateSpecialistResult(result,task,current={}){
 versionedContract(result,SCHEMAS.specialistResult,'specialist result',[1,2]);validateSpecialistTask(task);
 if(result.taskId!==task.taskId||result.runId!==task.runId||result.parentPackageId!==task.parentPackageId)fail('specialist result identity does not match its task.');
 if(result.specialistType!==task.specialistType)fail('specialist result type does not match its task.');
 if(result.cancellationIdentity!==task.cancellationIdentity||current.cancellationIdentity&&current.cancellationIdentity!==task.cancellationIdentity)fail('specialist result cancellation identity is stale.');
 oneOf(result.status,['COMPLETED','PARTIAL','BLOCKED','FAILED'],'result status');
 if(task.status==='CANCELLED'||task.lifecycleStatus==='CANCELLED'||current.cancelledTaskIds?.includes(task.taskId)||result.cancelled===true)fail('cancelled specialist results cannot be merged.');
 sha(result.canonicalStateRevision,'result.canonicalStateRevision');
 if(result.canonicalStateRevision!==task.canonicalStateRevision||current.canonicalStateRevision&&current.canonicalStateRevision!==task.canonicalStateRevision)fail('specialist result is stale against canonical state.');
 const resultSnapshots=validateSourceRoots(result.sourceSnapshots);
 const now=current.sourceSnapshots||task.sourceSnapshots;
 if(!sameSnapshots(resultSnapshots,task.sourceSnapshots)||!sameSnapshots(now,task.sourceSnapshots))fail('specialist result source revision/hash is stale.');
 if(task.schemaVersion===2){
  if(result.schemaVersion!==2)fail('a Phase 04 task requires a version 2 specialist result.');
  if(result.taskRevision!==task.taskRevision||result.resultRevision!==task.taskRevision)fail('specialist result task revision is stale.');
  if(result.parentCoordinatorRevision!==task.parentCoordinatorRevision||current.parentCoordinatorRevision&&current.parentCoordinatorRevision!==task.parentCoordinatorRevision)fail('specialist result is stale against the coordinator revision.');
  oneOf(result.validationStatus,['SUBMITTED','VALIDATED'],'result validationStatus');
  text(result.submittedAt,'submittedAt');sha(result.resultDigest,'resultDigest');
  const taskRootIds=new Set(task.sourceSnapshots.map(root=>root.rootId));
  const evidence=records(result.evidence,'result.evidence');
  uniqueBy(evidence,'evidenceId','result evidence');
  for(const item of evidence){
   validateEvidence(item,{sourceRootIds:taskRootIds});
   if(!item.evidenceId.startsWith('E-SF-'+task.taskId+'-'))fail('specialist evidence IDs must be scoped to their task.');
   if(item.requirementId!==task.requirementId||item.acceptanceCriterionId!==task.acceptanceCriterionId)fail('result evidence is outside the task requirement or acceptance criterion.');
   if(!task.sourceSnapshots.some(root=>root.rootId===item.sourceRootId&&root.repositoryKey===item.repositoryKey&&root.revision===item.sourceRevision))fail('result evidence is outside the task source snapshots.');
   if(!task.allowedScope.some(scope=>scope.sourceRootId===item.sourceRootId&&(scope.relativePrefix==='*'||item.relativePath===scope.relativePrefix||item.relativePath.startsWith(scope.relativePrefix+'/'))))fail('result evidence is outside the authorized source path scope.');
  }
  const evidenceMap=evidenceIndex([...(current.evidence||[]),...evidence]);
  const taskEvidenceIds=new Set([...task.inputEvidenceRefs,...evidence.map(item=>item.evidenceId)]);
  const questions=records(result.questions,'result.questions');
  uniqueBy(questions,'questionId','result questions');
  for(const question of questions){
   validateQuestion(question);
   if(question.requirementId!==task.requirementId||question.acceptanceCriterionId!==task.acceptanceCriterionId)fail('result question is outside the task requirement or acceptance criterion.');
   if(question.status!=='pending')fail('specialists may submit unresolved questions only; decisions belong to the coordinator.');
   ensureRefs(question.evidenceRefs,evidenceMap,'result question');
   if(question.evidenceRefs.some(ref=>!taskEvidenceIds.has(ref)))fail('result question references evidence outside the task input or result.');
   if(!question.questionId.startsWith('Q-SF-'+task.taskId+'-'))fail('specialist question IDs must be scoped to their task.');
  }
  const coverage=records(result.coverageFindings,'result.coverageFindings');
  uniqueBy(coverage,'findingId','result coverageFindings');
  for(const finding of coverage){
   validateCoverageFinding(finding);
   if(finding.requirementId!==task.requirementId||finding.acceptanceCriterionId!==task.acceptanceCriterionId)fail('result coverage is outside the task requirement or acceptance criterion.');
   ensureRefs(finding.evidenceRefs,evidenceMap,'result coverage');
   if(finding.evidenceRefs.some(ref=>!taskEvidenceIds.has(ref)))fail('result coverage references evidence outside the task input or result.');
   if(finding.evidenceRefs.length&&!finding.evidenceRefs.some(ref=>evidenceMap.get(ref)?.repositoryKey===finding.repositoryKey&&
    evidenceMap.get(ref)?.sourceRevision===finding.sourceRevision))fail('result coverage revision is not supported by its cited evidence.');
   if(!finding.findingId.startsWith('SF-'+task.taskId+'-'))fail('specialist finding IDs must be scoped to their task.');
   if((finding.blockingQuestionIds||[]).some(questionId=>!questions.some(question=>question.questionId===questionId)))fail('result coverage references a missing specialist question.');
  }
  refs(result.evidenceRefs,'result.evidenceRefs');ensureRefs(result.evidenceRefs,evidenceMap,'specialist result');
  if(result.evidenceRefs.some(ref=>!taskEvidenceIds.has(ref)))fail('specialist result references evidence outside the task input or result.');
  for(const field of ['findings','unresolvedQuestions','conflicts','errors','operations'])list(result[field],field);
  if(result.operations.some(operation=>!task.allowedOperations.includes(operation)))fail('specialist attempted an unauthorized operation.');
  return result;
 }
 contract(result,SCHEMAS.specialistResult,'specialist result');
 refs(result.evidenceRefs,'result.evidenceRefs');
 for(const field of ['findings','unresolvedQuestions','conflicts','errors','operations'])list(result[field],field);
 if(result.operations.some(operation=>!task.allowedOperations.includes(operation)))fail('specialist attempted an unauthorized operation.');
 return result;
}
function authorizeSpecialistOperation(task,operation,sourceRootId,relative){
 validateSpecialistTask(task);
 if(!task.allowedOperations.includes(operation)||!READ_ONLY_OPERATIONS.includes(operation))fail('specialist operation is not authorized: '+String(operation));
 if(sourceRootId===undefined)fail('specialist operations require a scoped source path.');
 id(sourceRootId,'sourceRootId');relativePath(relative,'relativePath');
 if(!task.allowedScope.some(scope=>scope.sourceRootId===sourceRootId&&(scope.relativePrefix==='*'||relative===scope.relativePrefix||relative.startsWith(scope.relativePrefix+'/'))))fail('specialist path is outside its allowed scope.');
 return true;
}

function validateQuestion(record){
 contract(record,SCHEMAS.question,'question');
 id(record.questionId,'questionId');id(record.requirementId,'requirementId');id(record.acceptanceCriterionId,'acceptanceCriterionId');
 oneOf(record.type,QUESTION_TYPES,'question type');oneOf(record.status,QUESTION_STATUSES,'question status');
 text(record.prompt,'prompt');refs(record.evidenceRefs,'question.evidenceRefs');
 if(typeof record.allowCustom!=='boolean'||typeof record.blocking!=='boolean')fail('question allowCustom and blocking must be boolean.');
 oneOf(record.blockingScope,['requirement','acceptance-criterion','package'],'blockingScope');
 const options=records(record.options,'question.options');
 uniqueBy(options,'key','question options');
 for(const option of options){id(option.key,'option.key');text(option.label,'option.label');}
 if(record.type==='single-choice'||record.type==='multiple-choice'){
  if(options.length<2)fail('choice questions require at least two options.');
 }else if(options.length)fail('non-choice questions cannot contain options.');
 if(record.status==='answered'){
  const answer=object(record.answer,'answer');text(answer.source,'answer.source');text(answer.answeredAt,'answer.answeredAt');sha(answer.stateRevision,'answer.stateRevision');
  if(record.type==='single-choice'){
   if(typeof answer.value!=='string'||!answer.value.trim()&&answer.value!=='custom')fail('single-choice answers cannot be empty.');
   if(answer.value==='custom'){if(!record.allowCustom)fail('custom answers are not allowed.');text(answer.customText,'answer.customText');}
   else if(!options.some(option=>option.key===answer.value))fail('single-choice answer is not one of the recorded options.');
  }else if(record.type==='multiple-choice'){
   const selected=list(answer.value,'answer.value',{min:1,unique:true});if(selected.some(key=>!options.some(option=>option.key===key)))fail('multiple-choice answer contains an unknown option.');
  }else text(answer.value,'answer.value');
 }else if(record.answer!==null&&record.answer!==undefined)fail('pending, deferred or cancelled questions cannot contain an answer.');
 return record;
}
function validateDecision(record,evidence){
 versionedContract(record,SCHEMAS.decision,'decision',[1,2]);
 id(record.decisionId,'decisionId');id(record.questionId,'questionId');
 oneOf(record.status,['PROPOSED','APPROVED','SUPERSEDED','REJECTED'],'decision status');
 text(record.decision,'decision');text(record.decidedBy,'decidedBy');refs(record.evidenceRefs,'decision.evidenceRefs');
 ensureRefs(record.evidenceRefs,evidence instanceof Map?evidence:evidenceIndex(evidence||[]),'decision');
 if(record.schemaVersion===1&&record.status==='APPROVED'){if(!record.evidenceRefs.length)fail('approved decisions require evidence and an explicit timestamp.');text(record.decidedAt,'decidedAt');}
 if(record.schemaVersion===2){
  if(record.decisionSource!=='USER_ANSWER')fail('version 2 decisions must record an explicit user answer.');
  sha(record.answerSha256,'decision.answerSha256');text(record.decidedAt,'decidedAt');
 }
 return record;
}

function validatePackage(record,findings){
 contract(record,SCHEMAS.package,'analysis package');
 id(record.packageId,'packageId');id(record.parentPackageId,'parentPackageId');id(record.parentPbiId,'parentPbiId');
 if(!Number.isInteger(record.packageRevision)||record.packageRevision<1)fail('packageRevision must be a positive integer.');
 const children=records(record.children,'children');uniqueBy(children,'provisionalChildId','package children');
 const findingMap=new Map((findings||[]).map(row=>[row.findingId,row]));
 for(const child of children){
  id(child.provisionalChildId,'provisionalChildId');if(child.provisional!==true)fail('child PBI IDs must remain provisional.');
  text(child.targetRepository,'child.targetRepository',{max:100});text(child.responsibility,'child.responsibility');
  list(child.requirementIds,'child.requirementIds',{min:1,unique:true});list(child.acceptanceCriterionIds,'child.acceptanceCriterionIds',{min:1,unique:true});
  const refsFound=refs(child.coverageFindingIds,'child.coverageFindingIds');if(!refsFound.length)fail('child work requires coverage findings.');
  for(const ref of refsFound){const finding=findingMap.get(ref);if(!finding)fail('child refers to a missing coverage finding.');if(!['PARTIALLY_IMPLEMENTED','MISSING'].includes(finding.status))fail('child work is allowed only for confirmed implementation gaps.');}
  for(const ref of refsFound){const finding=findingMap.get(ref);if(!child.requirementIds.includes(finding.requirementId)||!child.acceptanceCriterionIds.includes(finding.acceptanceCriterionId))fail('child scope must include every referenced coverage requirement and acceptance criterion.');}
  list(child.dependencies,'child.dependencies',{unique:true});if(child.sharedUiWorkId!==null&&child.sharedUiWorkId!==undefined)id(child.sharedUiWorkId,'sharedUiWorkId');
 }
 const shared=records(record.sharedUiWork,'sharedUiWork');uniqueBy(shared,'workId','shared UI work');
 for(const item of shared){id(item.workId,'workId');text(item.responsibility,'shared UI responsibility');list(item.requirementIds,'shared UI requirementIds',{min:1,unique:true});list(item.acceptanceCriterionIds,'shared UI acceptanceCriterionIds',{min:1,unique:true});}
 list(record.blockingQuestionIds,'package.blockingQuestionIds',{unique:true});refs(record.evidenceRefs,'package.evidenceRefs');
 return record;
}
function validateParentPbi(record){
 object(record,'planning parent PBI');
 const fields=['pbiId','title','description','acceptanceCriteria','attachments'];
 if(Object.keys(record).sort().join('|')!==fields.sort().join('|'))fail('the user-facing Parent PBI must contain exactly five fields.');
 id(record.pbiId,'Parent PBI ID');text(record.title,'Parent PBI title',{max:240});text(record.description,'Parent PBI description',{max:20000,allowEmpty:true});
 text(record.acceptanceCriteria,'Parent PBI acceptance criteria',{max:20000,allowEmpty:true});
 const attachments=records(record.attachments,'Parent PBI attachments');uniqueBy(attachments,'attachmentId','Parent PBI attachments');
 for(const item of attachments){
  id(item.attachmentId,'attachmentId');text(item.name,'attachment name',{max:512});
  oneOf(item.kind,['FILE','REFERENCE','URL'],'Parent PBI attachment kind');
  text(item.location,'attachment location',{max:2048});
  if(item.kind==='FILE')relativePath(item.location,'attachment path');
  if(item.kind==='URL'&&!/^https?:\/\/\S+$/i.test(item.location))fail('Parent PBI URL references must use an HTTP or HTTPS URL.');
  if(item.sha256!==null&&item.sha256!==undefined)sha(item.sha256,'attachment sha256');
  if(typeof item.contentInspected!=='boolean')fail('attachment contentInspected must be explicit.');
  if(item.contentInspected!==false)fail('planning must not claim attachment content was inspected.');
 }
 return record;
}
function validateDependencyGraph(children,graph,{selectedTargets=[]}={}){
 const childRows=records(children,'dependency graph children'),edges=records(graph.edges,'dependency graph edges'),
  childMap=new Map(childRows.map(child=>[child.provisionalChildId,child])),errors=[],edgeKeys=new Set();
 uniqueBy(edges,'edgeId','dependency graph edges');
 for(const edge of edges){
  id(edge.edgeId,'dependency edgeId');id(edge.sourceChildId,'dependency sourceChildId');id(edge.targetChildId,'dependency targetChildId');
  oneOf(edge.dependencyType,['BACKEND_API_BEFORE_UI','GRAPHQL_CONTRACT_BEFORE_CLIENT','SHARED_MODEL_BEFORE_HANDLER',
   'BUSINESS_DECISION_BEFORE_IMPLEMENTATION','VALIDATION_BEFORE_UI'],'dependency type');
  text(edge.rationale,'dependency rationale');refs(edge.evidenceRefs,'dependency evidenceRefs');
  oneOf(edge.verificationStatus,['VERIFIED','UNVERIFIED'],'dependency verificationStatus');
  if(typeof edge.blocking!=='boolean')fail('dependency blocking must be boolean.');
  const key=edge.sourceChildId+'|'+edge.targetChildId+'|'+edge.dependencyType;
  if(edgeKeys.has(key))errors.push('Duplicate dependency: '+key+'.');else edgeKeys.add(key);
  const source=childMap.get(edge.sourceChildId),target=childMap.get(edge.targetChildId);
  if(!source)errors.push('Dependency source child is missing: '+edge.sourceChildId+'.');
  if(!target)errors.push('Dependency target child is missing: '+edge.targetChildId+'.');
  if(source&&target&&source.provisionalChildId===target.provisionalChildId)errors.push('Dependency self-reference: '+edge.sourceChildId+'.');
  if(source&&target&&source.targetRepository!==target.targetRepository&&
   !(source.targetRepository==='ui'&&['cdms','dab'].includes(target.targetRepository)&&
    ['BACKEND_API_BEFORE_UI','GRAPHQL_CONTRACT_BEFORE_CLIENT','VALIDATION_BEFORE_UI'].includes(edge.dependencyType)))
   errors.push('Cross-repository dependency is unsupported or unverified: '+key+'.');
  if(source&&selectedTargets.length&&!selectedTargets.includes(source.targetRepository))errors.push('Dependency source target is out of scope: '+source.targetRepository+'.');
  if(target&&selectedTargets.length&&!selectedTargets.includes(target.targetRepository))errors.push('Dependency target is out of scope: '+target.targetRepository+'.');
  if(edge.verificationStatus!=='VERIFIED'||edge.blocking)errors.push('Dependency is unverified or blocking: '+key+'.');
  if(!edge.evidenceRefs.length)errors.push('Dependency has no evidence: '+key+'.');
 }
 const indegree=new Map(childRows.map(child=>[child.provisionalChildId,0])),outgoing=new Map(childRows.map(child=>[child.provisionalChildId,[]]));
 for(const edge of edges)if(childMap.has(edge.sourceChildId)&&childMap.has(edge.targetChildId)&&edge.sourceChildId!==edge.targetChildId){
  outgoing.get(edge.targetChildId).push(edge.sourceChildId);indegree.set(edge.sourceChildId,indegree.get(edge.sourceChildId)+1);
 }
 const ready=[...indegree].filter(([,count])=>count===0).map(([childId])=>childId).sort(),order=[];
 while(ready.length){
  const current=ready.shift();order.push(current);
  for(const next of outgoing.get(current).sort()){
   indegree.set(next,indegree.get(next)-1);
   if(indegree.get(next)===0){ready.push(next);ready.sort();}
  }
 }
 if(order.length!==childRows.length)errors.push('Dependency graph contains a cycle.');
 const normalizedErrors=[...new Set(errors)].sort();
 return {valid:normalizedErrors.length===0,implementationOrder:normalizedErrors.length?[]:order,errors:normalizedErrors};
}
function validatePlanningChildSelection(children,dependencyGraph,sharedUiWork,selectedChildIds){
 const childRows=records(children,'selected planning children'),selected=list(selectedChildIds,'selected child IDs',{min:1,unique:true}),
  childMap=new Map(childRows.map(child=>[child.provisionalChildId,child])),missing=selected.filter(childId=>!childMap.has(childId)),
  allEdges=records(dependencyGraph.edges,'selected dependency graph edges');
 if(missing.length)fail('selected child IDs do not exist: '+missing.join(', ')+'.');
 const selectedSet=new Set(selected);
 for(const childId of selected){
  const child=childMap.get(childId);
  const graphDependencies=allEdges.filter(edge=>edge.sourceChildId===childId).map(edge=>edge.targetChildId).sort();
  if(canonicalJson([...(child.dependencies||[])].sort())!==canonicalJson(graphDependencies))
   fail('selected child dependencies do not match the dependency graph for '+childId+'.');
  for(const dependency of child.dependencies||[])if(!selectedSet.has(dependency))
   fail('selected child '+childId+' is missing required dependency '+dependency+'.');
 }
 for(const work of records(sharedUiWork,'selected shared UI work')){
  const linked=list(work.childIds,'shared UI child IDs',{min:2,unique:true}),included=linked.filter(childId=>selectedSet.has(childId));
  if(included.length&&included.length!==linked.length)
   fail('selected children must include the complete shared UI work group '+work.workId+'.');
 }
 const subset=childRows.filter(child=>selectedSet.has(child.provisionalChildId)),
  subsetEdges=records(dependencyGraph.edges,'selected dependency edges').filter(edge=>
   selectedSet.has(edge.sourceChildId)&&selectedSet.has(edge.targetChildId)),
  selectedTargets=[...new Set(subset.map(child=>child.targetRepository))].sort(),
  graph=validateDependencyGraph(subset,{edges:subsetEdges},{selectedTargets});
 if(!graph.valid)fail('selected child dependency graph is invalid: '+graph.errors.join(' '));
 return {children:subset,dependencyGraph:{...graph,edges:subsetEdges},selectedChildIds:selected,selectedTargets};
}
function validatePlanningChild(child,evidence,questions,selectedTargets){
 id(child.provisionalChildId,'provisionalChildId');
 if(child.provisional!==true||!child.provisionalChildId.startsWith('LOCAL-PBI-'))fail('generated child IDs must remain provisional LOCAL-PBI identities.');
 id(child.parentPbiId,'child parentPbiId');if(child.revision!==1&&(!Number.isInteger(child.revision)||child.revision<1))fail('child revision must be positive.');
 text(child.title,'child title',{max:240});oneOf(child.targetRepository,PLANNING_TARGETS,'child target repository');
 if(!selectedTargets.includes(child.targetRepository))fail('child target is outside the selected implementation scope.');
 text(child.businessContext,'child business context',{max:10000});text(child.implementationGap,'child implementation gap',{max:10000});
 list(child.existingFunctionalityToPreserve,'child existing functionality to preserve');
 list(child.requirementIds,'child requirementIds',{min:1,unique:true});list(child.acceptanceCriterionIds,'child acceptanceCriterionIds',{min:1,unique:true});
 const criteria=records(child.acceptanceCriteria,'child acceptance criteria');uniqueBy(criteria,'criterionId','child acceptance criteria');
 for(const criterion of criteria){id(criterion.criterionId,'child criterionId');text(criterion.text,'child criterion text',{max:5000});}
 if(child.refinedAcceptanceCriteria!==undefined){
  const refined=records(child.refinedAcceptanceCriteria,'refined child acceptance criteria');
  uniqueBy(refined,'criterionId','refined child acceptance criteria');
  for(const criterion of refined){
   id(criterion.criterionId,'refined criterionId');id(criterion.parentAcceptanceCriterionId,'refined parent criterionId');
   id(criterion.requirementId,'refined requirementId');oneOf(criterion.targetRepository,PLANNING_TARGETS,'refined criterion targetRepository');
   if(criterion.targetRepository!==child.targetRepository||!child.acceptanceCriterionIds.includes(criterion.parentAcceptanceCriterionId)||
    !child.requirementIds.includes(criterion.requirementId))fail('refined child criteria must trace to the child, Parent criterion, and owner.');
   text(criterion.statement,'refined criterion statement',{max:2000});text(criterion.expectedOutcome,'refined criterion expectedOutcome',{max:2000});
   list(criterion.testScenarios,'refined criterion testScenarios',{min:1});
   list(criterion.scenarioTypes,'refined criterion scenarioTypes',{min:1,unique:true});
   for(const type of criterion.scenarioTypes)oneOf(type,['positive','negative','boundary','permission','integration','regression'],'refined scenario type');
   refs(criterion.evidenceRefs,'refined criterion evidenceRefs');
   if(!criterion.evidenceRefs.length)fail('refined child criteria require evidence references.');
   ensureRefs(criterion.evidenceRefs,evidence,'refined child criterion');
   if(criterion.evidenceRefs.some(ref=>evidence.get(ref).verificationStatus!=='VERIFIED'))
    fail('refined child criteria require verified evidence.');
  }
 }
 list(child.requiredBusinessRules,'child requiredBusinessRules');
 const references=records(child.verifiedImplementationReferences,'child verified implementation references');
 uniqueBy(references,'evidenceId','child verified implementation references');
 for(const ref of references){id(ref.evidenceId,'child evidenceId');const item=evidence.get(ref.evidenceId);
  if(!item||item.verificationStatus!=='VERIFIED')fail('child implementation references must cite verified evidence.');
  if(ref.repositoryKey!==item.repositoryKey||ref.relativePath!==item.relativePath||ref.sha256!==item.sha256)fail('child evidence reference must match its canonical source evidence.');
 }
 list(child.expectedInteractions,'child expectedInteractions');list(child.validationRequirements,'child validationRequirements');
 list(child.errorHandlingRequirements,'child errorHandlingRequirements');list(child.testingRequirements,'child testingRequirements');
 list(child.definitionOfDone,'child definitionOfDone',{min:1});list(child.dependencies,'child dependencies',{unique:true});
 list(child.blockingQuestionIds,'child blockingQuestionIds',{unique:true});
 for(const questionId of child.blockingQuestionIds)if(!questions.has(questionId))fail('child refers to an unknown blocking question.');
 if(child.schema!==undefined||child.schemaVersion!==undefined){
  versionedContract(child,SCHEMAS.plannedChild,'planned child PBI',[2]);
  list(child.implementationScope,'child implementationScope',{min:1,unique:true});
  const businessRules=records(child.businessRuleTraceability,'child businessRuleTraceability');
  uniqueBy(businessRules,'requirementId','child businessRuleTraceability');
  for(const rule of businessRules){
   id(rule.requirementId,'child business rule requirementId');text(rule.ruleText,'child business rule text',{max:5000});
   refs(rule.evidenceRefs,'child business rule evidenceRefs');
   if(!child.requirementIds.includes(rule.requirementId)||!rule.evidenceRefs.length)
    fail('child business rules must map to a requirement and verified evidence.');
   ensureRefs(rule.evidenceRefs,evidence,'child business rule');
   if(rule.evidenceRefs.some(ref=>evidence.get(ref).verificationStatus!=='VERIFIED'))
    fail('child business rule traceability requires verified evidence.');
  }
  if(child.requirementIds.some(requirementId=>!businessRules.some(rule=>rule.requirementId===requirementId)))
   fail('every child requirement must map to an evidence-backed business rule.');
  const contracts=records(child.requiredIntegrationContracts,'child requiredIntegrationContracts');
  uniqueBy(contracts,'contractId','child requiredIntegrationContracts');
  for(const integration of contracts){
   id(integration.contractId,'child integration contractId');text(integration.boundary,'child integration boundary',{max:512});
   text(integration.expectedInteraction,'child expected integration interaction',{max:2000});
   list(integration.requirementIds,'child integration requirementIds',{min:1,unique:true});
   if(integration.requirementIds.some(requirementId=>!child.requirementIds.includes(requirementId)))
    fail('child integration requirements must belong to the child.');
   refs(integration.evidenceRefs,'child integration evidenceRefs');
   if(!integration.evidenceRefs.length)fail('child integration contracts require evidence.');
   ensureRefs(integration.evidenceRefs,evidence,'child integration contract');
   if(integration.evidenceRefs.some(ref=>evidence.get(ref).verificationStatus!=='VERIFIED'))
    fail('child integration contracts require verified evidence.');
  }
 }
 if(child.sharedUiIdentity!==null&&child.sharedUiIdentity!==undefined){
  const identity=object(child.sharedUiIdentity,'child shared UI identity');
  for(const field of ['angularProject','component','feature'])text(identity[field],'shared UI '+field,{max:256});
  for(const field of ['service','apiBoundary'])if(identity[field]!==null&&identity[field]!==undefined)text(identity[field],'shared UI '+field,{max:256});
  if(child.targetRepository!=='ui')fail('shared UI identity may appear only on a UI child.');
 }
 return child;
}
function validatePlanningRecord(record,{extension,analysisPackage}={}){
 versionedContract(record,SCHEMAS.planning,'planning record',[1]);
 if(record.refinementQualityVersion!==undefined&&record.refinementQualityVersion!==1)
  fail('planning refinementQualityVersion is unsupported.');
 validateParentPbi(record.parentPbi);sha(record.analysisRevision,'planning analysisRevision');sha(record.analysisInputFingerprint,'planning analysisInputFingerprint');
 const selected=list(record.selectedTargets,'planning selectedTargets',{unique:true});
 for(const target of selected)oneOf(target,PLANNING_TARGETS,'planning target');
 oneOf(record.status,['DRAFT','READY_FOR_APPROVAL','NO_IMPLEMENTATION_REQUIRED','BLOCKED','STALE'],'planning status');
 const traceability=records(record.traceability,'planning traceability');uniqueBy(traceability,'criterionId','planning traceability');
 for(const row of traceability){
  id(row.criterionId,'traceability criterionId');text(row.originalText,'traceability original text',{max:5000});
  oneOf(row.coverageStatus,COVERAGE_STATUSES,'traceability coverage status');refs(row.evidenceRefs,'traceability evidenceRefs');
  list(row.childIds,'traceability childIds',{unique:true});list(row.targetRepositories,'traceability targetRepositories',{unique:true});
  list(row.questionIds,'traceability questionIds',{unique:true});list(row.plannedVerification,'traceability plannedVerification');
  oneOf(row.disposition,PLANNING_DISPOSITIONS,'traceability disposition');
  if(row.scopeDecisionId!==null&&row.scopeDecisionId!==undefined)id(row.scopeDecisionId,'traceability scopeDecisionId');
  if(row.disposition==='COVERED_EXISTING'&&!row.evidenceRefs.length)fail('existing coverage requires evidence.');
  if(row.disposition==='ASSIGNED_TO_CHILD'&&!row.childIds.length)fail('assigned coverage requires a child PBI.');
  if(row.disposition==='EXCLUDED_BY_SCOPE_DECISION'&&!row.scopeDecisionId)fail('scope exclusion requires an explicit decision ID.');
  if(['BLOCKED_BY_EVIDENCE','BLOCKED_BY_SCOPE','BLOCKED_BY_CONFLICT'].includes(row.disposition)&&!row.questionIds.length)
   fail('blocked traceability rows require a blocking question.');
  for(const target of row.targetRepositories)oneOf(target,PLANNING_TARGETS,'traceability target repository');
 }
 const sourceFreshness=records(record.sourceFreshness,'planning sourceFreshness');uniqueBy(sourceFreshness,'sourceRootId','planning sourceFreshness');
 for(const item of sourceFreshness){
  id(item.sourceRootId,'planning sourceRootId');revision(item.revision,'planning source revision');
  oneOf(item.status,['CURRENT','STALE','UNAVAILABLE'],'planning source freshness');
  list(item.reasons,'planning source freshness reasons');
 }
 const graph=object(record.dependencyGraph,'planning dependencyGraph'),graphResult=validateDependencyGraph(
  analysisPackage?.children||[],graph,{selectedTargets:selected});
 if(typeof graph.valid!=='boolean'||graph.valid!==graphResult.valid||!Array.isArray(graph.errors)||
  canonicalJson(graph.errors)!==canonicalJson(graphResult.errors)||canonicalJson(graph.implementationOrder)!==canonicalJson(graphResult.implementationOrder))
  fail('dependency graph validation result is inconsistent.');
 for(const child of analysisPackage?.children||[]){
  const graphDependencies=graph.edges.filter(edge=>edge.sourceChildId===child.provisionalChildId).map(edge=>edge.targetChildId).sort();
  if(canonicalJson(child.dependencies)!==canonicalJson(graphDependencies))fail('child dependencies must match the validated dependency graph.');
 }
 const shared=records(record.sharedUiWork,'planning sharedUiWork');uniqueBy(shared,'workId','planning sharedUiWork');
 for(const item of shared){id(item.workId,'shared UI workId');text(item.angularProject,'shared UI angularProject',{max:256});
  text(item.component,'shared UI component',{max:256});text(item.feature,'shared UI feature',{max:256});
  list(item.childIds,'shared UI childIds',{min:2,unique:true});list(item.acceptanceCriterionIds,'shared UI acceptanceCriterionIds',{min:1,unique:true});
  refs(item.evidenceRefs,'shared UI evidenceRefs');if(!item.evidenceRefs.length)fail('shared UI work requires verified evidence.');
 }
 list(record.questionIds,'planning questionIds',{unique:true});list(record.decisionIds,'planning decisionIds',{unique:true});
 list(record.blockingReasons,'planning blockingReasons');
 if(extension){
  const evidence=new Map(extension.evidence.map(item=>[item.evidenceId,item])),questions=new Set(extension.questions.map(item=>item.questionId)),
   decisions=new Set(extension.decisions.map(item=>item.decisionId)),children=analysisPackage?.children||[];
  const childIds=new Set(children.map(item=>item.provisionalChildId));
  for(const ref of record.traceability.flatMap(row=>row.evidenceRefs))ensureRefs([ref],evidence,'planning traceability');
  for(const edge of graph.edges){
   ensureRefs(edge.evidenceRefs,evidence,'planning dependency');
   if(edge.verificationStatus==='VERIFIED'&&edge.evidenceRefs.some(ref=>evidence.get(ref).verificationStatus!=='VERIFIED'))
    fail('verified dependencies require verified evidence.');
  }
  for(const item of shared){
   ensureRefs(item.evidenceRefs,evidence,'planning shared UI work');
   if(item.evidenceRefs.some(ref=>evidence.get(ref).verificationStatus!=='VERIFIED'))
    fail('shared UI work requires verified evidence.');
  }
  for(const child of children)validatePlanningChild(child,evidence,questions,selected);
  for(const ref of record.traceability.flatMap(row=>row.childIds))if(!childIds.has(ref))fail('traceability refers to a missing child PBI.');
  for(const ref of record.questionIds)if(!questions.has(ref))fail('planning refers to an unknown question.');
  for(const ref of record.decisionIds)if(!decisions.has(ref))fail('planning refers to an unknown decision.');
  for(const row of record.traceability)for(const ref of row.questionIds)if(!questions.has(ref))fail('traceability refers to an unknown question.');
 }
 const manifest=object(record.packageManifest,'planning packageManifest');
 if(manifest.schema!=='akzo-parent-child-planning-package'||manifest.schemaVersion!==1)fail('planning package manifest has an unsupported schema.');
 text(manifest.builderVersion,'planning manifest Builder version',{max:40});
 id(manifest.packageId,'planning manifest packageId');id(manifest.parentPbiId,'planning manifest parentPbiId');
 if(!Number.isInteger(manifest.packageRevision)||manifest.packageRevision<1)fail('planning manifest packageRevision must be positive.');
 if(analysisPackage&&manifest.packageId!==analysisPackage.packageId)fail('planning manifest packageId does not match its analysis package.');
 const referenceIdentities=records(manifest.referenceIdentities,'planning reference identities');uniqueBy(referenceIdentities,'key','planning reference identities');
 for(const identity of referenceIdentities){text(identity.key,'planning reference identity key',{max:256});sha(identity.sha256,'planning reference identity hash');}
 if(extension){
  const expected=[
   ...(extension.sqlMetadata?.sources||[]).map(item=>({key:'sql:'+item.dataset,sha256:item.sha256})),
   ...(extension.graphqlMetadata?[{key:'graphql:manifest',sha256:extension.graphqlMetadata.libraryManifestSha256}]:[])
  ].sort((a,b)=>a.key.localeCompare(b.key));
  if(canonicalJson(referenceIdentities)!==canonicalJson(expected))
   fail('planning reference identities must match the linked SQL and GraphQL snapshots.');
 }
 sha(manifest.fingerprint,'planning package fingerprint');text(manifest.generatedAt,'planning generatedAt');
 oneOf(manifest.status,['DRAFT','READY_FOR_APPROVAL','NO_IMPLEMENTATION_REQUIRED','BLOCKED','STALE'],'planning manifest status');
 if(manifest.status!==record.status)fail('planning manifest status must match the planning record.');
 if(manifest.parentPbiId!==record.parentPbi.pbiId)fail('planning manifest Parent PBI ID does not match.');
 if(analysisPackage&&manifest.packageRevision!==analysisPackage.packageRevision)fail('planning manifest packageRevision does not match its analysis package.');
 if(manifest.handoffStatus!=='UNSUPPORTED_CHILD_HANDOFF_V1'||manifest.handoffReady!==false)
  fail('child-specific handoff must remain disabled for handoff v1.');
 if(record.status==='READY_FOR_APPROVAL'&&(!traceability.length||
  traceability.some(row=>!['COVERED_EXISTING','ASSIGNED_TO_CHILD','EXCLUDED_BY_SCOPE_DECISION'].includes(row.disposition))))
  fail('a ready planning package must account for every acceptance criterion.');
 if(record.status==='READY_FOR_APPROVAL'&&(record.blockingReasons.length||!graph.valid||
  traceability.some(row=>row.disposition.startsWith('BLOCKED_'))||sourceFreshness.some(item=>item.status!=='CURRENT')))
  fail('a ready planning package cannot contain blockers or stale evidence.');
 if(record.status==='NO_IMPLEMENTATION_REQUIRED'&&(analysisPackage?.children?.length||
  traceability.some(row=>row.disposition!=='COVERED_EXISTING')||sourceFreshness.some(item=>item.status!=='CURRENT')))
  fail('NO_IMPLEMENTATION_REQUIRED requires verified existing coverage and no children.');
 return record;
}
const REFINEMENT_QUALITY_DIMENSIONS=[
 ['businessRequirementClarity',15],['acceptanceCriteriaTestability',25],['businessRuleCompleteness',20],
 ['implementationReuse',15],['technicalAccuracyDependencies',15],['testCoverageExpectations',10]
];
function validateRefinementQuality(record,{extension}={}){
 contract(record,SCHEMAS.refinementQuality,'refinement quality report');
 if(record.schemaVersion!==1)fail('refinement quality report has an unsupported schema version.');
 text(record.modelVersion,'refinement quality modelVersion');
 if(!Number.isInteger(record.packageRevision)||record.packageRevision<1)fail('refinement quality packageRevision must be positive.');
 oneOf(record.status,['CURRENT','STALE'],'refinement quality status');
 sha(record.planningFingerprint,'refinement quality planningFingerprint');sha(record.inputFingerprint,'refinement quality inputFingerprint');
 if(!Number.isInteger(record.score)||record.score<0||record.score>100)fail('refinement quality score must be an integer from 0 to 100.');
 oneOf(record.readiness,['QUALITY_READY_CANDIDATE','NEEDS_REVIEW','INCOMPLETE'],'refinement quality readiness');
 if(typeof record.packageReadyForApproval!=='boolean'||record.developmentReady!==false)
  fail('refinement quality must explicitly deny development readiness.');
 oneOf(record.packageApprovalStatus,['CURRENT','STALE','NOT_RECORDED'],'refinement package approval status');
 const dimensions=records(record.dimensions,'refinement quality dimensions');
 if(dimensions.length!==REFINEMENT_QUALITY_DIMENSIONS.length)fail('refinement quality must include all six dimensions.');
 uniqueBy(dimensions,'id','refinement quality dimensions');
 let weighted=0;
 for(const [index,[dimensionId,weight]] of REFINEMENT_QUALITY_DIMENSIONS.entries()){
  const dimension=dimensions.find(item=>item.id===dimensionId);
  if(!dimension)fail('refinement quality dimension is missing: '+dimensionId+'.');
  if(dimension.weight!==weight||!Number.isInteger(dimension.score)||dimension.score<0||dimension.score>100)
   fail('refinement quality dimension has an invalid weight or score: '+dimensionId+'.');
  if(dimension.points!==Math.round(weight*dimension.score)/100)fail('refinement quality weighted points are inconsistent.');
  weighted+=dimension.points;
  refs(dimension.evidence,'refinement quality evidence');list(dimension.missingInformation,'refinement missing information');
  records(dimension.findings,'refinement dimension findings');list(dimension.recommendations,'refinement recommendations');
 }
 if(record.score!==Math.round(weighted))fail('refinement quality score does not match the weighted dimensions.');
 const blockers=records(record.blockers,'refinement quality blockers');
 for(const blocker of blockers){text(blocker.code,'quality blocker code');text(blocker.message,'quality blocker message');oneOf(blocker.severity,['BLOCKER'],'quality blocker severity');}
 if(record.packageReadyForApproval!==(record.readiness==='QUALITY_READY_CANDIDATE'&&blockers.length===0))
  fail('refinement approval readiness must agree with the score and blockers.');
 if(blockers.length&&record.readiness!=='INCOMPLETE')fail('hard blockers must force refinement readiness to INCOMPLETE.');
 records(record.parentAcceptanceCriteriaCoverage,'Parent acceptance-criteria coverage');
 records(record.businessRuleTraceability,'business-rule traceability');
 records(record.scenarioCompleteness,'scenario completeness');
 records(record.children,'refinement child reports');
 records(record.clarificationQuestions,'refinement clarification questions');
 list(record.recommendations,'refinement recommendations');
 if(extension&&record.status==='CURRENT'){
  if(record.packageRevision!==extension.packageRevision)fail('current refinement quality report is bound to a different package revision.');
  if(record.planningFingerprint!==extension.planning?.packageManifest?.fingerprint)
   fail('current refinement quality report is bound to a different planning fingerprint.');
 }
 return record;
}
function packageApprovalBlockers(extension){
 validateAnalysisExtension(extension);
 const blockers=[];
 if(extension.planning){
  if(!['READY_FOR_APPROVAL','NO_IMPLEMENTATION_REQUIRED'].includes(extension.planning.status))
   blockers.push('Planning package is '+extension.planning.status+'.');
  if(extension.planning.blockingReasons.length)blockers.push(...extension.planning.blockingReasons.map(reason=>'Planning: '+reason));
  for(const row of extension.planning.traceability)if(row.disposition.startsWith('BLOCKED_'))
   blockers.push('Acceptance criterion '+row.criterionId+' is blocked by '+row.disposition+'.');
  if(!extension.planning.dependencyGraph.valid)blockers.push('Planning dependency graph is invalid.');
  if(extension.planning.status==='NO_IMPLEMENTATION_REQUIRED'&&extension.analysisPackage.children.length)
   blockers.push('NO_IMPLEMENTATION_REQUIRED packages cannot contain implementation children.');
  if(extension.planning.refinementQualityVersion===1){
   const quality=extension.refinementQuality;
   if(!quality||quality.status!=='CURRENT'||quality.packageRevision!==extension.packageRevision||
    quality.planningFingerprint!==extension.planning.packageManifest.fingerprint||
    quality.readiness!=='QUALITY_READY_CANDIDATE'||!quality.packageReadyForApproval||quality.blockers.length)
    blockers.push('A current quality-ready refinement report is required for this package.');
  }
 }
 const resolvedConflictScopes=new Set((extension.coordinator?.report?.coverage||[]).filter(row=>!['CONFLICTING','UNVERIFIED'].includes(row.status)&&row.decisionIds?.length)
  .map(row=>row.requirementId+'::'+row.acceptanceCriterionId));
 const currentTasks=extension.specialistTasks.filter(task=>task.schemaVersion===2&&task.parentCoordinatorRevision===extension.coordinator?.inputRevision);
 for(const task of currentTasks)if(task.lifecycleStatus!=='COMPLETE')
  blockers.push('Specialist task '+task.taskId+' is '+task.lifecycleStatus+'.');
 if(extension.specialistTasks.some(task=>task.schemaVersion===2)&&(!extension.coordinator?.report||
  extension.coordinator.report.analysisRevision!==extension.coordinator.inputRevision))blockers.push('Specialist analysis has not been consolidated for the current coordinator revision.');
 if(extension.coordinator?.report?.questionCount>0)blockers.push('The consolidated analysis has unresolved blocking questions.');
 for(const row of extension.coordinator?.report?.coverage||[])if(['CONFLICTING','UNVERIFIED'].includes(row.status))
  blockers.push('Acceptance criterion '+row.acceptanceCriterionId+' is '+row.status+'.');
 for(const finding of extension.coverageFindings)if(['CONFLICTING','UNVERIFIED'].includes(finding.status)&&
  !(finding.status==='CONFLICTING'&&resolvedConflictScopes.has(finding.requirementId+'::'+finding.acceptanceCriterionId)))
  blockers.push('Coverage '+finding.findingId+' is '+finding.status+'.');
 for(const plugin of extension.cdmsPluginRules)if(plugin.pluginStatus==='UNVERIFIED'||['CONFLICTING','UNVERIFIED'].includes(plugin.coverageStatus))blockers.push('CDMS rule '+plugin.businessRuleId+' is unverified or conflicting.');
 for(const question of extension.questions)if(question.blocking&&question.status!=='answered')blockers.push('Question '+question.questionId+' is '+question.status+'.');
 for(const mapping of extension.uiMappings)if(mapping.blocking&&mapping.status!=='VERIFIED')blockers.push('UI mapping '+mapping.mappingId+' is '+mapping.status+'.');
 for(const relationship of extension.sqlRelationships)if(relationship.blocking&&relationship.validationStatus!=='VERIFIED')blockers.push('SQL relationship '+relationship.relationshipId+' is '+relationship.validationStatus+'.');
 if(extension.graphqlMetadata){
  const mappedSchemas=new Set((extension.graphqlMappings||[]).map(mapping=>mapping.schemaArtifactId));
  for(const schema of extension.graphqlMetadata.schemaArtifacts)if(['INVALID','UNRESOLVED'].includes(schema.validationStatus)||
   (schema.validationStatus==='STALE'&&mappedSchemas.has(schema.artifactId)))blockers.push('GraphQL schema '+schema.artifactId+' is '+schema.validationStatus+'.');
  for(const operation of extension.graphqlMetadata.operationArtifacts)if(operation.validationStatus!=='VALIDATED')blockers.push('GraphQL operation '+operation.operationId+' is '+operation.validationStatus+'.');
 }
 for(const mapping of extension.graphqlMappings||[])if(mapping.blocking&&mapping.status!=='VERIFIED')blockers.push('GraphQL mapping '+mapping.mappingId+' is '+mapping.status+'.');
 for(const translation of extension.dabTranslations)if(['CONFLICTING','UNVERIFIED'].includes(translation.dabCoverageStatus))blockers.push('DAB translation '+translation.translationId+' is '+translation.dabCoverageStatus+'.');
 for(const idRef of extension.analysisPackage.blockingQuestionIds)if(!extension.questions.some(question=>question.questionId===idRef&&question.status==='answered'))blockers.push('Package question '+idRef+' is unanswered.');
 return [...new Set(blockers)].sort();
}

function validateApprovalRequest(record){
 contract(record,SCHEMAS.approvalRequest,'package approval request');
 id(record.requestId,'requestId');id(record.packageId,'packageId');
 if(!Number.isInteger(record.packageRevision)||record.packageRevision<1)fail('approval packageRevision must be positive.');
 sha(record.fingerprint,'approval fingerprint');oneOf(record.status,['PENDING'],'approval request status');text(record.requestedBy,'requestedBy');
 return record;
}
function validateCoordinator(record){
 versionedContract(record,SCHEMAS.coordinator,'analysis coordinator',[1]);
 sha(record.inputRevision,'coordinator.inputRevision');
 const events=records(record.events,'coordinator.events');uniqueBy(events,'eventId','coordinator.events');
 const eventTypes=['TASK_PREPARED','TASK_ASSIGNED','TASK_EXECUTING','TASK_CANCELLED','RESULT_SUBMITTED','RESULT_VALIDATED','RESULT_REJECTED','TASK_COMPLETED','ANALYSIS_CONSOLIDATED','QUESTION_ANSWERED','QUESTION_CREATED','QUESTION_DEFERRED','QUESTION_CANCELLED','SOURCE_ROOT_REGISTERED'];
 for(const event of events){
  id(event.eventId,'coordinator eventId');oneOf(event.eventType,eventTypes,'coordinator eventType');text(event.recordedAt,'coordinator event recordedAt');
  if(event.taskId!==null&&event.taskId!==undefined)id(event.taskId,'coordinator event taskId');
  if(event.taskRevision!==null&&event.taskRevision!==undefined&&(!Number.isInteger(event.taskRevision)||event.taskRevision<1))fail('coordinator event taskRevision must be positive.');
  if(event.resultDigest!==null&&event.resultDigest!==undefined)sha(event.resultDigest,'coordinator event resultDigest');
  if(event.detail!==null&&event.detail!==undefined)text(event.detail,'coordinator event detail',{max:512});
 }
 if(record.report!==null&&record.report!==undefined){
  const report=object(record.report,'coordinator report');
  if(report.schema!=='akzo-analysis-report'||report.schemaVersion!==1)fail('coordinator report has an unsupported schema.');
  sha(report.analysisRevision,'report.analysisRevision');sha(report.sha256,'report.sha256');text(report.content,'report.content',{max:100000});
  if(!Number.isInteger(report.taskCount)||report.taskCount<0||!Number.isInteger(report.questionCount)||report.questionCount<0)fail('coordinator report counts must be non-negative integers.');
  text(report.createdAt,'report.createdAt');
   const coverage=records(report.coverage,'coordinator report coverage');
   uniqueBy(coverage,'scopeId','coordinator report coverage');
   for(const row of coverage){
    id(row.scopeId,'report scopeId');id(row.requirementId,'report requirementId');id(row.acceptanceCriterionId,'report acceptanceCriterionId');
    oneOf(row.status,COVERAGE_STATUSES,'report coverage status');refs(row.evidenceRefs,'report evidenceRefs');
    list(row.questionIds,'report questionIds',{unique:true});list(row.missingSpecialists,'report missingSpecialists',{unique:true});
    list(row.decisionIds,'report decisionIds',{unique:true});
   }
 }
 return record;
}
function validateAnalysisExtension(extension,{parentPbiId}={}){
 contract(extension,SCHEMAS.analysisExtension,'analysis extension');
 id(extension.parentPbiId,'parentPbiId');if(parentPbiId&&extension.parentPbiId!==parentPbiId)fail('analysis extension belongs to a different PBI.');
 sha(extension.parentStateRevision,'parentStateRevision');
 if(!Number.isInteger(extension.packageRevision)||extension.packageRevision<1)fail('packageRevision must be a positive integer.');
 const roots=validateSourceRoots(extension.sourceRoots),rootIds=new Set(roots.map(root=>root.rootId));
 const evidence=records(extension.evidence,'evidence').map(row=>validateEvidence(row,{sourceRootIds:rootIds}));uniqueBy(evidence,'evidenceId','evidence');
 const rootMap=new Map(roots.map(root=>[root.rootId,root]));
 for(const item of evidence){const source=rootMap.get(item.sourceRootId);if(item.repositoryKey!==source.repositoryKey||item.sourceRevision!==source.revision)fail('evidence repository or revision does not match its source snapshot.');}
 const index=evidenceIndex(evidence);
 const coverage=records(extension.coverageFindings,'coverageFindings').map(validateCoverageFinding);uniqueBy(coverage,'findingId','coverageFindings');
 for(const finding of coverage){
  ensureRefs(finding.evidenceRefs,index,'coverage finding');
  if(['VERIFIED_EXISTING','MISSING','PARTIALLY_IMPLEMENTED'].includes(finding.status)&&!finding.evidenceRefs.some(ref=>index.get(ref).verificationStatus==='VERIFIED'))fail('verified coverage and investigated gaps require verified evidence.');
  validateFindingPlanningDetails(finding,index);
 }
 const plugins=records(extension.cdmsPluginRules,'cdmsPluginRules').map(row=>validateCdmsPluginRule(row,evidence));uniqueBy(plugins,'businessRuleId','cdmsPluginRules');
 const translations=records(extension.dabTranslations,'dabTranslations').map(row=>validateDabTranslation(row,evidence));uniqueBy(translations,'translationId','dabTranslations');
 const pluginMap=new Map(plugins.map(plugin=>[plugin.businessRuleId,plugin]));
 for(const translation of translations){
  if(translation.cdmsStatus==='FOUND'&&(!pluginMap.has(translation.sourceCdmsBusinessRuleId)||pluginMap.get(translation.sourceCdmsBusinessRuleId).pluginStatus!=='FOUND'))fail('DAB translation references an unknown CDMS plugin rule.');
  if(translation.cdmsStatus==='FOUND'&&!translation.cdmsEvidenceRefs.some(ref=>index.get(ref).verificationStatus==='VERIFIED'))fail('DAB translation requires verified CDMS reference evidence.');
 }
 const relationships=records(extension.sqlRelationships,'sqlRelationships').map(row=>validateSqlRelationship(row,evidence));uniqueBy(relationships,'relationshipId','sqlRelationships');
 for(const relationship of relationships){
  const source=rootMap.get(relationship.sourceRootId);
  if(!source)fail('SQL relationship references an unregistered source root.');
  if(relationship.sourceRevision!==source.revision)fail('SQL relationship revision does not match its source snapshot.');
  if(relationship.validationStatus==='VERIFIED'&&!relationship.evidenceRefs.some(ref=>{
   const item=index.get(ref);return item.category==='static-schema'&&item.sourceRootId===relationship.sourceRootId&&item.relativePath===relationship.relativePath&&item.sourceRevision===relationship.sourceRevision&&item.sha256===relationship.artifactSha256;
  }))fail('Verified SQL relationship evidence must identify the exact source artifact and hash.');
 }
 const mappings=records(extension.uiMappings,'uiMappings').map(row=>validateUiMapping(row,evidence));uniqueBy(mappings,'mappingId','uiMappings');
 if(extension.coordinator!==undefined)validateCoordinator(extension.coordinator);
 const tasks=records(extension.specialistTasks,'specialistTasks').map(validateSpecialistTask);uniqueBy(tasks,'taskId','specialistTasks');
 const taskMap=new Map(tasks.map(task=>[task.taskId,task]));
 const results=records(extension.specialistResults,'specialistResults');uniqueBy(results,'taskId','specialistResults');
 for(const result of results){const task=taskMap.get(result.taskId);if(!task)fail('specialist result has no matching task.');validateSpecialistResult(result,task,{evidence});ensureRefs(result.evidenceRefs,index,'specialist result');
  for(const finding of result.coverageFindings||[])validateFindingPlanningDetails(finding,index);
  if(result.schemaVersion===2){
   if(result.validationStatus!=='VALIDATED')fail('only coordinator-validated specialist results may be persisted.');
   for(const item of result.evidence)if(!index.has(item.evidenceId)||canonicalJson(index.get(item.evidenceId))!==canonicalJson(item))fail('specialist result evidence differs from its canonical extension evidence.');
  }}
 const resultMap=new Map(results.map(result=>[result.taskId,result]));
 for(const task of tasks){
  ensureRefs(task.inputEvidenceRefs,index,'specialist task');
  if(task.canonicalStateRevision!==extension.parentStateRevision)fail('specialist task is bound to a different canonical state revision.');
  const taskRootIds=new Set(task.sourceSnapshots.map(root=>root.rootId));
  if(task.schemaVersion===1&&!sameSnapshots(task.sourceSnapshots,roots.filter(root=>taskRootIds.has(root.rootId))))fail('specialist task source snapshots are not current in the extension.');
  if(task.schemaVersion===2&&extension.coordinator&&task.lifecycleStatus!=='STALE'&&task.lifecycleStatus!=='CANCELLED'&&task.parentCoordinatorRevision!==extension.coordinator.inputRevision)
   fail('specialist task is bound to a different coordinator revision.');
  if(task.schemaVersion===2&&['RESULT_VALIDATED','COMPLETE'].includes(task.lifecycleStatus)&&!resultMap.has(task.taskId))fail('validated or completed specialist tasks require a persisted result.');
  if(task.schemaVersion===2&&task.lifecycleStatus==='COMPLETE'&&resultMap.get(task.taskId)?.validationStatus!=='VALIDATED')fail('completed specialist tasks require a validated result.');
 }
 const questions=records(extension.questions,'questions').map(validateQuestion);uniqueBy(questions,'questionId','questions');
 for(const question of questions)ensureRefs(question.evidenceRefs,index,'question');
 for(const question of questions)if(question.status==='answered'&&question.answer.stateRevision!==extension.parentStateRevision)fail('question answer is stale against canonical PBI state.');
 const questionMap=new Map(questions.map(question=>[question.questionId,question]));
 for(const translation of translations){
  if(translation.blockingQuestionId&&!questionMap.get(translation.blockingQuestionId)?.blocking)fail('DAB translation refers to an unknown blocking question.');
  for(const mapping of translation.fieldMappings)if(mapping.status!=='VERIFIED'&&!questionMap.has(mapping.questionId))fail('DAB mapping refers to an unknown question.');
 }
 const decisions=records(extension.decisions,'decisions').map(row=>validateDecision(row,index));uniqueBy(decisions,'decisionId','decisions');
 for(const decision of decisions){
  const question=questions.find(item=>item.questionId===decision.questionId);
  if(!question)fail('decision references an unknown question.');
  if(decision.status==='APPROVED'&&question.status!=='answered')fail('approved decisions require an answered question.');
 }
 for(const finding of coverage)for(const questionId of finding.blockingQuestionIds||[])if(!questions.some(question=>question.questionId===questionId&&question.blocking))fail('coverage finding references an unknown blocking question.');
 const packageFindings=[...coverage,...results.filter(result=>result.validationStatus==='VALIDATED')
  .flatMap(result=>result.coverageFindings||[])];
 const pkg=validatePackage(extension.analysisPackage,packageFindings);
 if(pkg.parentPbiId!==extension.parentPbiId||pkg.packageRevision!==extension.packageRevision)fail('analysis package identity or revision does not match its extension.');
 if(extension.planning!==undefined)validatePlanningRecord(extension.planning,{extension,analysisPackage:pkg});
 if(extension.refinementQuality!==undefined)validateRefinementQuality(extension.refinementQuality,{extension});
 if(extension.packageApproval!==undefined)validatePackageApproval(extension.packageApproval);
 if(extension.implementationAuthorization!==undefined){
  const authorization=validateImplementationAuthorization(extension.implementationAuthorization);
  if(!extension.planning||!extension.packageApproval||authorization.packageId!==extension.analysisPackage.packageId||
   authorization.packageRevision!==extension.packageRevision||
   authorization.packageFingerprint!==extension.planning.packageManifest.fingerprint||
   authorization.approvalFingerprint!==extension.packageApproval.fingerprint)
   fail('implementation authorization must bind to the current approved planning package.');
 }
 if(extension.sqlMetadata!==undefined)validateSqlMetadata(extension.sqlMetadata,roots);
 let graphqlMetadata=null;
 if(extension.graphqlMetadata!==undefined)graphqlMetadata=validateGraphqlMetadata(extension.graphqlMetadata,roots);
 const graphqlMappings=records(extension.graphqlMappings||[],'graphqlMappings').map(row=>validateGraphqlMapping(row,{evidence:index,relationships,metadata:graphqlMetadata}));
 uniqueBy(graphqlMappings,'mappingId','graphqlMappings');
 for(const ref of pkg.evidenceRefs)ensureRefs([ref],index,'analysis package');
 for(const idRef of pkg.blockingQuestionIds)if(!questions.some(question=>question.questionId===idRef&&question.blocking))fail('analysis package refers to an unknown blocking question.');
 return extension;
}

function canonicalize(value,seen=new WeakSet()){
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isFinite(value))fail('canonical JSON cannot contain non-finite numbers.');return value;}
 if(Array.isArray(value)){if(seen.has(value))fail('canonical JSON cannot contain cycles.');seen.add(value);const out=value.map(item=>canonicalize(item,seen));seen.delete(value);return out;}
 if(typeof value!=='object')fail('canonical JSON supports only JSON values.');
 object(value,'canonical value');
 if(seen.has(value))fail('canonical JSON cannot contain cycles.');
 seen.add(value);
 const out={};for(const key of Object.keys(value).sort()){if(value[key]===undefined)fail('canonical JSON cannot contain undefined values.');out[key]=canonicalize(value[key],seen);}
 seen.delete(value);return out;
}
function canonicalJson(value){return JSON.stringify(canonicalize(value));}
async function sha256Text(value){
 const cryptoApi=global.crypto;if(!cryptoApi?.subtle)fail('WebCrypto SHA-256 is unavailable.');
 const digest=await cryptoApi.subtle.digest('SHA-256',utf8.encode(value));
 return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function stateRevision(state){object(state,'canonical PBI state');if(state.schemaVersion!==2||typeof state.pbi!=='string')fail('state revision requires a legacy schemaVersion 2 PBI state.');return sha256Text(canonicalJson(state));}
function sortRows(rows,key){return [...rows].sort((a,b)=>String(a[key]).localeCompare(String(b[key])));}
function removeVolatile(value){
 if(Array.isArray(value))return value.map(removeVolatile);
 if(value&&typeof value==='object'){
  const out={};for(const key of Object.keys(value))if(!VOLATILE_KEYS.has(key))out[key]=removeVolatile(value[key]);
  return out;
 }
 return value;
}
function sortSetArrays(value,key=''){
 if(Array.isArray(value)){
  const rows=value.map(item=>sortSetArrays(item));
  if(SET_ARRAY_KEYS.has(key)&&rows.every(item=>typeof item==='string'))return rows.sort();
  if(key==='sourceSnapshots'&&rows.every(item=>item&&typeof item.rootId==='string'))return rows.sort((a,b)=>a.rootId.localeCompare(b.rootId));
  return rows;
 }
 if(value&&typeof value==='object'){const out={};for(const name of Object.keys(value))out[name]=sortSetArrays(value[name],name);return out;}
 return value;
}
function approvalPayload(extension){
 const cleaned=removeVolatile(extension);
 return {
  schema:cleaned.schema,schemaVersion:cleaned.schemaVersion,parentPbiId:cleaned.parentPbiId,
  parentStateRevision:cleaned.parentStateRevision,packageRevision:cleaned.packageRevision,
  sourceRoots:sortRows(cleaned.sourceRoots,'rootId'),
  evidence:sortRows(cleaned.evidence,'evidenceId'),
  coverageFindings:sortRows(cleaned.coverageFindings,'findingId'),
  cdmsPluginRules:sortRows(cleaned.cdmsPluginRules,'businessRuleId'),
  dabTranslations:sortRows(cleaned.dabTranslations,'translationId'),
  sqlRelationships:sortRows(cleaned.sqlRelationships,'relationshipId'),
  uiMappings:sortRows(cleaned.uiMappings,'mappingId'),
  specialistTasks:sortRows(cleaned.specialistTasks,'taskId'),
  specialistResults:sortRows(cleaned.specialistResults,'taskId'),
  ...(cleaned.coordinator&&cleaned.specialistTasks.some(task=>task.schemaVersion===2)?{coordinator:cleaned.coordinator}:{}),
  questions:sortRows(cleaned.questions,'questionId'),
  decisions:sortRows(cleaned.decisions,'decisionId'),
  analysisPackage:{...cleaned.analysisPackage,children:sortRows(cleaned.analysisPackage.children,'provisionalChildId'),sharedUiWork:sortRows(cleaned.analysisPackage.sharedUiWork,'workId')},
  ...(cleaned.planning?{planning:cleaned.planning}:{}),
  ...(cleaned.refinementQuality?{refinementQuality:cleaned.refinementQuality}:{}),
  ...(cleaned.sqlMetadata?{sqlMetadata:cleaned.sqlMetadata}:{}),
  ...(cleaned.graphqlMetadata?{graphqlMetadata:cleaned.graphqlMetadata,graphqlMappings:sortRows(cleaned.graphqlMappings||[],'mappingId')}:{})
 };
}
async function packageApprovalFingerprint(extension){
 validateAnalysisExtension(extension);
 canonicalJson(extension);
 return sha256Text(canonicalJson(sortSetArrays(approvalPayload(extension))));
}
async function planningPackageFingerprint(planning){
 const payload=JSON.parse(canonicalJson(planning));
 if(payload.packageManifest)delete payload.packageManifest.fingerprint;
 return sha256Text(canonicalJson(sortSetArrays(removeVolatile(payload))));
}
async function planningAnalysisFingerprint(extension){
 const payload={
  parentPbiId:extension.parentPbiId,parentStateRevision:extension.parentStateRevision,sourceRoots:extension.sourceRoots,
  evidence:extension.evidence,coverageFindings:extension.coverageFindings,cdmsPluginRules:extension.cdmsPluginRules,
  dabTranslations:extension.dabTranslations,sqlRelationships:extension.sqlRelationships,uiMappings:extension.uiMappings,
  specialistTasks:extension.specialistTasks,specialistResults:extension.specialistResults,coordinator:extension.coordinator,
  questions:extension.questions,decisions:extension.decisions,sqlMetadata:extension.sqlMetadata||null,
  graphqlMetadata:extension.graphqlMetadata||null,graphqlMappings:extension.graphqlMappings||[]
 };
 return sha256Text(canonicalJson(sortSetArrays(removeVolatile(payload))));
}
async function refinementQualityInputFingerprint(extension){
 validateAnalysisExtension(extension);
 const payload={schemaVersion:1,parentPbiId:extension.parentPbiId,parentStateRevision:extension.parentStateRevision,
  modelVersion:REFINEMENT_QUALITY_MODEL_VERSION,packageRevision:extension.packageRevision,planning:extension.planning||null,
  analysisPackage:extension.analysisPackage,
  sourceRoots:extension.sourceRoots,evidence:extension.evidence,coverageFindings:extension.coverageFindings,
  cdmsPluginRules:extension.cdmsPluginRules,dabTranslations:extension.dabTranslations,sqlRelationships:extension.sqlRelationships,
  uiMappings:extension.uiMappings,specialistTasks:extension.specialistTasks,specialistResults:extension.specialistResults,
  coordinator:extension.coordinator,questions:extension.questions,decisions:extension.decisions,
  graphqlMetadata:extension.graphqlMetadata||null,graphqlMappings:extension.graphqlMappings||[],
  sqlMetadata:extension.sqlMetadata||null};
 return sha256Text(canonicalJson(sortSetArrays(removeVolatile(payload))));
}
async function refinementQualityIsCurrent(extension){
 const report=extension.refinementQuality;
 return !!report&&report.modelVersion===REFINEMENT_QUALITY_MODEL_VERSION&&report.status==='CURRENT'&&report.packageRevision===extension.packageRevision&&
  report.planningFingerprint===extension.planning?.packageManifest?.fingerprint&&
  report.inputFingerprint===await refinementQualityInputFingerprint(extension);
}
async function createPackageApprovalRequest(extension,{requestedBy}={}){
 validateAnalysisExtension(extension);
 const blockers=packageApprovalBlockers(extension);if(blockers.length)fail('package approval blocked: '+blockers.join(' '));
 if(extension.planning&&extension.planning.analysisInputFingerprint!==await planningAnalysisFingerprint(extension))
  fail('package approval blocked: planning analysis inputs changed; regenerate the planning package.');
 if(extension.planning?.refinementQualityVersion===1&&!await refinementQualityIsCurrent(extension))
  fail('package approval blocked: refinement quality is stale; revalidate the quality report.');
 const fingerprint=await packageApprovalFingerprint(extension);
 return {schema:SCHEMAS.approvalRequest,schemaVersion:1,requestId:'APR-'+fingerprint.slice(0,32),
  packageId:extension.analysisPackage.packageId,packageRevision:extension.packageRevision,status:'PENDING',
  requestedBy:text(requestedBy,'requestedBy'),fingerprint};
}
async function recordPackageApproval(extension,request,{approvedBy,approvedAt,evidence}={}){
 validateAnalysisExtension(extension);validateApprovalRequest(request);
 if(request.packageId!==extension.analysisPackage.packageId||request.packageRevision!==extension.packageRevision)fail('approval request is for a different package revision.');
 if(request.fingerprint!==await packageApprovalFingerprint(extension))fail('approval request is stale; review the current package again.');
 const blockers=packageApprovalBlockers(extension);if(blockers.length)fail('package approval blocked: '+blockers.join(' '));
 if(extension.planning&&extension.planning.analysisInputFingerprint!==await planningAnalysisFingerprint(extension))
  fail('package approval blocked: planning analysis inputs changed; regenerate the planning package.');
 if(extension.planning?.refinementQualityVersion===1&&!await refinementQualityIsCurrent(extension))
  fail('package approval blocked: refinement quality is stale; revalidate the quality report.');
 text(approvedBy,'approvedBy');text(approvedAt,'approvedAt');text(evidence,'approval evidence');
 return {schema:SCHEMAS.approval,schemaVersion:1,packageId:request.packageId,packageRevision:request.packageRevision,
  requestId:request.requestId,requestedBy:request.requestedBy,decision:'APPROVED',status:'APPROVED',
  approvedBy,approvedAt,evidence,fingerprint:request.fingerprint};
}
async function isPackageApprovalCurrent(approval,extension){
 validatePackageApproval(approval);
 validateAnalysisExtension(extension);
 if(approval.status!=='APPROVED'||approval.packageId!==extension.analysisPackage.packageId||approval.packageRevision!==extension.packageRevision)return false;
 if(packageApprovalBlockers(extension).length)return false;
 if(extension.planning&&extension.planning.analysisInputFingerprint!==await planningAnalysisFingerprint(extension))return false;
 if(extension.planning?.refinementQualityVersion===1&&!await refinementQualityIsCurrent(extension))return false;
 return approval.fingerprint===await packageApprovalFingerprint(extension);
}
async function implementationAuthorizationFingerprint(authorization){
 const payload=JSON.parse(canonicalJson(authorization));delete payload.fingerprint;
 return sha256Text(canonicalJson(payload));
}
async function isImplementationAuthorizationCurrent(authorization,extension){
 if(!authorization||!extension.implementationAuthorization||
  canonicalJson(authorization)!==canonicalJson(extension.implementationAuthorization))return false;
 validateImplementationAuthorization(authorization);
 if(!extension.planning||!extension.packageApproval||authorization.packageId!==extension.analysisPackage.packageId||
  authorization.packageRevision!==extension.packageRevision||
  authorization.packageFingerprint!==extension.planning.packageManifest.fingerprint||
  authorization.approvalFingerprint!==extension.packageApproval.fingerprint||
  extension.planning.status!=='READY_FOR_APPROVAL'||extension.planning.blockingReasons.length||
  !extension.refinementQuality?.packageReadyForApproval||extension.refinementQuality.developmentReady!==false||
  !await refinementQualityIsCurrent(extension)||!await isPackageApprovalCurrent(extension.packageApproval,extension))return false;
 if(extension.questions.some(question=>question.blocking&&question.status!=='answered'))return false;
 const selection=validatePlanningChildSelection(extension.analysisPackage.children,extension.planning.dependencyGraph,
  extension.planning.sharedUiWork,authorization.selectedChildIds);
 if(selection.children.some(child=>!child.schemaVersion||child.schemaVersion<2||
  !(child.refinedAcceptanceCriteria||[]).length||child.blockingQuestionIds.some(questionId=>
   extension.questions.some(question=>question.questionId===questionId&&question.blocking&&question.status!=='answered'))))return false;
 const qualityChildren=new Map((extension.refinementQuality.children||[]).map(child=>[child.childId,child]));
 if(selection.children.some(child=>qualityChildren.get(child.provisionalChildId)?.readiness!=='QUALITY_READY_CANDIDATE'))return false;
 return authorization.fingerprint===await implementationAuthorizationFingerprint(authorization);
}
async function nativeChildExportFingerprint(record){
 const payload=JSON.parse(canonicalJson(record));delete payload.exportFingerprint;
 return sha256Text(canonicalJson(payload));
}
function createAnalysisExtension({parentPbiId,parentStateRevision,packageId,packageRevision=1}={}){
 const extension={schema:SCHEMAS.analysisExtension,schemaVersion:1,parentPbiId,parentStateRevision,packageRevision,sourceRoots:[],evidence:[],
  coverageFindings:[],cdmsPluginRules:[],dabTranslations:[],sqlRelationships:[],uiMappings:[],specialistTasks:[],specialistResults:[],
  coordinator:{schema:SCHEMAS.coordinator,schemaVersion:1,inputRevision:parentStateRevision,events:[],report:null},
  questions:[],decisions:[],graphqlMappings:[],analysisPackage:{schema:SCHEMAS.package,schemaVersion:1,packageId,parentPackageId:packageId,parentPbiId,
   packageRevision,children:[],sharedUiWork:[],blockingQuestionIds:[],evidenceRefs:[]}};
 return validateAnalysisExtension(extension,{parentPbiId});
}

const api={
 SCHEMAS,COVERAGE_STATUSES,REFINEMENT_QUALITY_MODEL_VERSION,PLANNING_TARGETS,PLANNING_DISPOSITIONS,INTERNAL_STATUSES,EVIDENCE_CATEGORIES,EVIDENCE_VERIFICATION,SPECIALISTS,READ_ONLY_OPERATIONS,
 QUESTION_TYPES,QUESTION_STATUSES,normalizeCoverageStatus,normalizeCoverageFinding,validateCoverageFinding,coverageRecommendation,
 validateEvidence,validateCdmsPluginRule,validateDabTranslation,validateSqlRelationship,validateUiMapping,validateSpecialistTask,
 validateGraphqlMetadata,validateGraphqlMapping,
 validateSpecialistResult,authorizeSpecialistOperation,validateQuestion,validateDecision,validatePackage,validateParentPbi,validateDependencyGraph,
 validatePlanningRecord,validatePlanningChild,validatePlanningChildSelection,validateRefinementQuality,packageApprovalBlockers,validateAnalysisExtension,validateSourceRoots,sameSnapshots,validatePackageApproval,validateImplementationAuthorization,validateNativeChildExport,validateSqlMetadata,
 canonicalJson,sha256Text,stateRevision,packageApprovalFingerprint,planningPackageFingerprint,planningAnalysisFingerprint,refinementQualityInputFingerprint,
 refinementQualityIsCurrent,createPackageApprovalRequest,implementationAuthorizationFingerprint,nativeChildExportFingerprint,
 recordPackageApproval,isPackageApprovalCurrent,isImplementationAuthorizationCurrent,createAnalysisExtension
};
global.PBIPhase01Contracts=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
