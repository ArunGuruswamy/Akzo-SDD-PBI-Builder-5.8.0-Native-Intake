(function(global){
'use strict';
const SCHEMA='akzo-pbi-refinement-quality',SCHEMA_VERSION=1,MODEL_VERSION='1.0.0';
const DIMENSIONS=[
 {id:'businessRequirementClarity',label:'Business requirement clarity',weight:15},
 {id:'acceptanceCriteriaTestability',label:'Acceptance-criteria testability',weight:25},
 {id:'businessRuleCompleteness',label:'Business-rule completeness',weight:20},
 {id:'implementationReuse',label:'Existing implementation reuse',weight:15},
 {id:'technicalAccuracyDependencies',label:'Technical accuracy and dependencies',weight:15},
 {id:'testCoverageExpectations',label:'Test coverage expectations',weight:10}
];

function unique(values){return [...new Set(values.filter(Boolean))].sort();}
function text(value){return typeof value==='string'?value.trim():'';}
function present(value){return typeof value==='string'?!!value.trim():Array.isArray(value)?value.length>0:
 value!==null&&value!==undefined&&typeof value==='object'?Object.keys(value).length>0:!!value;}
function check(id,passed,evidence,missing,recommendation){
 return {id,passed:!!passed,evidence:text(evidence)||null,missingInformation:passed?null:text(missing)||null,
  recommendation:passed?null:text(recommendation)||null};
}
function makeDimension(definition,checks){
 const passed=checks.filter(item=>item.passed).length,score=checks.length?Math.round(100*passed/checks.length):100;
 return {id:definition.id,label:definition.label,weight:definition.weight,score,
  points:Math.round(definition.weight*score)/100,
  evidence:unique(checks.filter(item=>item.passed).map(item=>item.evidence)),
  missingInformation:unique(checks.filter(item=>!item.passed).map(item=>item.missingInformation)),
  findings:checks.filter(item=>!item.passed).map(item=>({checkId:item.id,message:item.missingInformation})),
  recommendations:unique(checks.filter(item=>!item.passed).map(item=>item.recommendation))};
}
function aggregateDimension(definition,reports){
 const rows=reports.map(report=>report.dimensions.find(item=>item.id===definition.id)).filter(Boolean),
  score=rows.length?Math.round(rows.reduce((sum,item)=>sum+item.score,0)/rows.length):100;
 return {id:definition.id,label:definition.label,weight:definition.weight,score,
  points:Math.round(definition.weight*score)/100,evidence:unique(rows.flatMap(item=>item.evidence)),
  missingInformation:unique(rows.flatMap(item=>item.missingInformation)),
  findings:rows.flatMap((item,index)=>item.findings.map(finding=>({childId:reports[index].childId,...finding}))),
  recommendations:unique(rows.flatMap(item=>item.recommendations))};
}
function findingsFor(extension){
 const rows=[],seen=new Set();
 for(const finding of extension.coverageFindings||[])if(!seen.has(finding.findingId)){seen.add(finding.findingId);rows.push(finding);}
 for(const result of extension.specialistResults||[])if(result.validationStatus==='VALIDATED')
  for(const finding of result.coverageFindings||[])if(!seen.has(finding.findingId)){seen.add(finding.findingId);rows.push(finding);}
 return rows;
}
function criterionScenarios(criteria){return unique(criteria.flatMap(item=>item.scenarioTypes||[]));}
function normalizeText(value){return text(value).toLocaleLowerCase('en-US').replace(/\s+/g,' ');}
function readinessFor(score,hasHardBlocker=false){
 return hasHardBlocker||score<75?'INCOMPLETE':score<90?'NEEDS_REVIEW':'QUALITY_READY_CANDIDATE';
}
function acceptedCoverage(extension,state){
 const rules=new Map((state.rules||[]).map(item=>[item.id,item])),findings=findingsFor(extension),
  children=extension.analysisPackage.children||[],planning=extension.planning,rows=[];
 for(const rule of [...(state.rules||[])].sort((a,b)=>a.id.localeCompare(b.id))){
  const criteria=(state.acceptanceCriteria||[]).filter(item=>(item.rules||[]).includes(rule.id)),
   criterionIds=criteria.map(item=>item.id).sort(),related=findings.filter(item=>item.requirementId===rule.id&&criterionIds.includes(item.acceptanceCriterionId)),
   trace=(planning?.traceability||[]).filter(item=>criterionIds.includes(item.criterionId)),
   evidenceRefs=unique(related.flatMap(item=>item.evidenceRefs||[])),
   child=children.find(item=>item.requirementIds.includes(rule.id)),
   statuses=unique(related.map(item=>item.status)),excluded=trace.length>0&&trace.every(item=>item.disposition==='EXCLUDED_BY_SCOPE_DECISION'&&item.scopeDecisionId),
   disposition=excluded?'EXCLUDED_BY_SCOPE_DECISION':
    related.length&&statuses.every(status=>status==='VERIFIED_EXISTING')?'VERIFIED_EXISTING':
    child&&related.some(item=>['MISSING','PARTIALLY_IMPLEMENTED'].includes(item.status))?'ASSIGNED_TO_CHILD':
    'BLOCKED';
  const evidence=evidenceRefs.map(id=>(extension.evidence||[]).find(item=>item.evidenceId===id)).filter(Boolean),
   gap=related.find(item=>['MISSING','PARTIALLY_IMPLEMENTED'].includes(item.status)),missingInformation=[];
  if(!criterionIds.length)missingInformation.push('No Parent acceptance criterion is linked to this rule.');
  if(!evidenceRefs.length)missingInformation.push('No source evidence is linked to this rule.');
  if(!present(rule.preconditions))missingInformation.push('Rule preconditions are not recorded.');
  if(!present(rule.validationLogic))missingInformation.push('Validation logic is not recorded.');
  if(!present(rule.successBehavior))missingInformation.push('Success behavior is not recorded.');
  if(!present(rule.failureBehavior))missingInformation.push('Failure behavior is not recorded.');
  rows.push({ruleId:rule.id,businessPurpose:rule.rule,preconditions:rule.preconditions||null,
   applicability:rule.applicability||rule.context||null,validationLogic:rule.validationLogic||null,
   successBehavior:rule.successBehavior||null,failureBehavior:rule.failureBehavior||null,errorMessage:rule.errorMessage||null,
   decisionBranches:rule.decisionBranches||[],testCoverage:rule.coverage||[],
   acceptanceCriterionIds:criterionIds,repository:child?.targetRepository||gap?.implementationTarget||related[0]?.repositoryKey||null,
   existingImplementationEvidence:evidence.filter(item=>related.some(finding=>finding.status==='VERIFIED_EXISTING'&&
    finding.evidenceRefs.includes(item.evidenceId))).map(item=>item.evidenceId).sort(),
   requiredBehavior:rule.requiredBehavior||rule.rule,missingBehavior:gap?.missingBehavior||null,
   childId:child?.provisionalChildId||null,validationScenarios:unique(related.flatMap(item=>item.testScenarios||[])),
   evidenceRefs,confidence:evidenceRefs.length&&evidence.every(item=>item.verificationStatus==='VERIFIED')?'VERIFIED':'UNVERIFIED',
   cdmsPluginRules:(extension.cdmsPluginRules||[]).filter(item=>item.requirementId===rule.id&&criterionIds.includes(item.acceptanceCriterionId)),
   dabTranslations:(extension.dabTranslations||[]).filter(item=>item.requirementId===rule.id&&criterionIds.includes(item.acceptanceCriterionId)),
   angularMappings:(extension.uiMappings||[]).filter(item=>item.requirementId===rule.id&&criterionIds.includes(item.acceptanceCriterionId)),
   graphqlMappings:(extension.graphqlMappings||[]).filter(item=>item.requirementId===rule.id&&criterionIds.includes(item.acceptanceCriterionId)),
   sqlRelationships:(extension.sqlRelationships||[]).filter(item=>item.requirementId===rule.id&&criterionIds.includes(item.acceptanceCriterionId)),
   disposition,openQuestions:unique((extension.questions||[]).filter(question=>question.blocking&&question.status!=='answered'&&
    criterionIds.includes(question.acceptanceCriterionId)).map(question=>question.questionId)),missingInformation});
 }
 return {rules,rows};
}
async function inputFingerprint(extension,contracts){
 return contracts.refinementQualityInputFingerprint(extension);
}
async function evaluate({extension,state,sourceFreshness={status:'CURRENT',errors:[]},contracts}={}){
 if(!extension?.planning)throw Error('Refinement quality requires a generated Phase 05 planning record.');
 if(!state||!Array.isArray(state.rules)||!Array.isArray(state.acceptanceCriteria))
  throw Error('Refinement quality requires canonical business rules and Parent acceptance criteria.');
 if(!contracts)throw Error('Refinement quality requires the Phase 01 contracts module.');
 const evidenceMap=new Map((extension.evidence||[]).map(item=>[item.evidenceId,item])),
  ruleData=acceptedCoverage(extension,state),findings=findingsFor(extension),children=extension.analysisPackage.children||[],
  blockers=[],recommendations=[],childReports=[],clarificationQuestions=[],duplicateCriteria=new Map();
 const addBlocker=(code,message,childId=null)=>blockers.push({code,message,childId,severity:'BLOCKER'});
 if(!['READY_FOR_APPROVAL','NO_IMPLEMENTATION_REQUIRED'].includes(extension.planning.status))
  addBlocker('PLANNING_NOT_READY','Phase 05 planning is '+extension.planning.status+'.');
 if(extension.planning.status==='STALE'||sourceFreshness.status!=='CURRENT'||(sourceFreshness.errors||[]).length)
  addBlocker('STALE_EVIDENCE','Planning or source evidence is stale; refresh and regenerate before approval.');
 if(!extension.planning.dependencyGraph?.valid)addBlocker('INVALID_DEPENDENCIES','The dependency graph is invalid.');
 for(const row of extension.planning.traceability||[])if(row.disposition.startsWith('BLOCKED_'))
  addBlocker('AC_COVERAGE_BLOCKED','Parent criterion '+row.criterionId+' is '+row.disposition+'.');
 for(const question of extension.questions||[])if(question.blocking&&question.status!=='answered')
  addBlocker('OPEN_QUESTION','Blocking clarification '+question.questionId+' is '+question.status+'.');
 if(extension.packageApproval&&!await contracts.isPackageApprovalCurrent(extension.packageApproval,extension))
  addBlocker('PACKAGE_APPROVAL_STALE','The existing package approval is stale.');
 for(const row of ruleData.rows){
  if(row.disposition==='BLOCKED')addBlocker('BUSINESS_RULE_UNRESOLVED','Business rule '+row.ruleId+' has no complete evidence-backed disposition.');
  if(row.missingInformation.length)addBlocker('BUSINESS_RULE_INCOMPLETE','Business rule '+row.ruleId+' is incomplete: '+row.missingInformation.join(' '));
 }

 for(const child of [...children].sort((a,b)=>a.provisionalChildId.localeCompare(b.provisionalChildId))){
  const childFindings=findings.filter(item=>(child.coverageFindingIds||[]).includes(item.findingId)),
   childEvidence=(child.verifiedImplementationReferences||[]).map(ref=>evidenceMap.get(ref.evidenceId)).filter(Boolean),
   criteria=child.refinedAcceptanceCriteria||[],childRules=ruleData.rows.filter(item=>child.requirementIds.includes(item.ruleId)),
   linkedTrace=(extension.planning.traceability||[]).filter(item=>child.acceptanceCriterionIds.includes(item.criterionId)),
   relevantMappings=[
    ...(extension.uiMappings||[]).filter(item=>child.requirementIds.includes(item.requirementId)&&child.acceptanceCriterionIds.includes(item.acceptanceCriterionId)),
    ...(extension.graphqlMappings||[]).filter(item=>child.requirementIds.includes(item.requirementId)&&child.acceptanceCriterionIds.includes(item.acceptanceCriterionId))
   ],missing=[];
  if(!child.targetRepository||!(extension.planning.selectedTargets||[]).includes(child.targetRepository)){
   const message='Child '+child.provisionalChildId+' has no selected repository owner.';
   addBlocker('MISSING_REPOSITORY_OWNER',message,child.provisionalChildId);missing.push(message);
  }
  if(!childEvidence.length||childEvidence.some(item=>item.verificationStatus!=='VERIFIED')){
   const message='Child '+child.provisionalChildId+' lacks verified implementation evidence.';
   addBlocker('MISSING_IMPLEMENTATION_EVIDENCE',message,child.provisionalChildId);missing.push(message);
  }
  if(!childEvidence.some(item=>item.repositoryKey===child.targetRepository)){
   const message='Child '+child.provisionalChildId+' has no evidence from its owning repository.';
   addBlocker('OWNER_EVIDENCE_REQUIRED',message,child.provisionalChildId);missing.push(message);
  }
  if(!criteria.length){
   const message='Child '+child.provisionalChildId+' has no derived, independently testable child acceptance criteria.';
   addBlocker('CHILD_ACCEPTANCE_CRITERIA_REQUIRED',message,child.provisionalChildId);missing.push(message);
   const parentCriterionId=child.acceptanceCriterionIds[0]||null,
    questionId='Q-REFINE-'+(await contracts.sha256Text(child.provisionalChildId+'|'+String(parentCriterionId)+'|acceptance-outcome')).slice(0,20);
   const priorQuestion=(extension.questions||[]).find(question=>question.questionId===questionId);
   clarificationQuestions.push({questionId,childId:child.provisionalChildId,parentCriterionId,
    prompt:'Specify the observable expected outcome and test scenario for this child criterion using verified business evidence. Do not infer the result from the implementation gap.',
    status:priorQuestion?.status||'pending',blocking:true});
  }
  for(const criterion of criteria){
   if(!child.acceptanceCriterionIds.includes(criterion.parentAcceptanceCriterionId)||
    !child.requirementIds.includes(criterion.requirementId)||criterion.targetRepository!==child.targetRepository){
    const message='Child criterion '+criterion.criterionId+' is not traceable to this child, Parent criterion, and repository.';
    addBlocker('CHILD_CRITERION_TRACEABILITY',message,child.provisionalChildId);missing.push(message);
   }
   if(!text(criterion.statement)||!text(criterion.expectedOutcome)||!criterion.testScenarios?.length||
    !criterion.scenarioTypes?.length||!(criterion.evidenceRefs||[]).length){
    const message='Child criterion '+criterion.criterionId+' lacks an observable expected outcome, test scenario, or evidence.';
    addBlocker('CHILD_CRITERION_NOT_TESTABLE',message,child.provisionalChildId);missing.push(message);
   }
   if((criterion.evidenceRefs||[]).some(ref=>evidenceMap.get(ref)?.verificationStatus!=='VERIFIED')){
    const message='Child criterion '+criterion.criterionId+' cites unverified evidence.';
    addBlocker('CHILD_CRITERION_EVIDENCE_UNVERIFIED',message,child.provisionalChildId);missing.push(message);
   }
   const key=normalizeText(criterion.parentAcceptanceCriterionId+'|'+criterion.statement+'|'+criterion.expectedOutcome),
    prior=duplicateCriteria.get(key);
   if(prior&&prior.childId!==child.provisionalChildId){
    const message='Child criteria '+prior.criterionId+' and '+criterion.criterionId+' duplicate behavior across repositories.';
    addBlocker('DUPLICATE_CHILD_CRITERION',message,child.provisionalChildId);missing.push(message);
   }else duplicateCriteria.set(key,{criterionId:criterion.criterionId,childId:child.provisionalChildId});
  }
  if(criteria.length){
   const missingParentCriteria=child.acceptanceCriterionIds.filter(id=>!criteria.some(item=>item.parentAcceptanceCriterionId===id)),
    missingRequirements=child.requirementIds.filter(id=>!criteria.some(item=>item.requirementId===id));
   if(missingParentCriteria.length||missingRequirements.length){
    const message='Child '+child.provisionalChildId+' does not define refined acceptance criteria for every linked Parent criterion and business rule.';
    addBlocker('CHILD_CRITERIA_COVERAGE_INCOMPLETE',message,child.provisionalChildId);missing.push(message);
    const parentCriterionId=missingParentCriteria[0]||child.acceptanceCriterionIds[0]||null,
     questionId='Q-REFINE-'+(await contracts.sha256Text(child.provisionalChildId+'|'+String(parentCriterionId)+'|coverage')).slice(0,20),
     priorQuestion=(extension.questions||[]).find(question=>question.questionId===questionId);
    clarificationQuestions.push({questionId,childId:child.provisionalChildId,parentCriterionId,
     prompt:'Provide evidence-backed refined child criteria for every missing Parent criterion and business rule.',
     status:priorQuestion?.status||'pending',blocking:true});
   }
  }
  for(const mapping of relevantMappings)if(mapping.status!=='VERIFIED'||mapping.blocking){
   const message='Required mapping '+(mapping.mappingId||mapping.graphqlMappingId||'unknown')+' is not verified.';
   addBlocker('MAPPING_UNVERIFIED',message,child.provisionalChildId);missing.push(message);
  }
  for(const finding of childFindings)for(const dependency of finding.implementationDependencies||[])if(!dependency.verified){
   const message='Implementation dependency on '+dependency.targetRepository+' is unverified.';
   addBlocker('DEPENDENCY_UNVERIFIED',message,child.provisionalChildId);missing.push(message);
  }
  for(const row of childRules)if(row.disposition==='BLOCKED'){
   const message='Business rule '+row.ruleId+' is unresolved for child '+child.provisionalChildId+'.';
   addBlocker('BUSINESS_RULE_UNRESOLVED',message,child.provisionalChildId);missing.push(message);
  }
  const requiredScenarioTypes=unique(childRules.flatMap(row=>ruleData.rules.get(row.ruleId)?.coverage||[])),
   actualScenarioTypes=criterionScenarios(criteria),
   missingScenarioTypes=requiredScenarioTypes.filter(type=>!actualScenarioTypes.includes(type));
  if(missingScenarioTypes.length){
   const message='Child '+child.provisionalChildId+' is missing scenarios: '+missingScenarioTypes.join(', ')+'.';
   addBlocker('SCENARIOS_INCOMPLETE',message,child.provisionalChildId);missing.push(message);
  }
  for(const question of extension.questions||[])if(question.blocking&&question.status!=='answered'&&
   (child.acceptanceCriterionIds.includes(question.acceptanceCriterionId)||child.requirementIds.includes(question.requirementId)))
   missing.push('Blocking question '+question.questionId+' remains '+question.status+'.');
  const clarity=[
   check('responsibility',text(child.responsibility).length>20,'Evidence-backed child responsibility is recorded.','Child responsibility is missing or too vague.','Describe only the verified repository-owned gap.'),
   check('businessContext',!!text(child.businessContext),'Parent business context is retained.','Parent business context is missing.','Link the child to the original Parent requirement.'),
   check('implementationGap',!!text(child.implementationGap),'Confirmed implementation gap is recorded.','Confirmed gap is not explicit.','State the verified missing behavior without adding assumptions.'),
   check('parentTraceability',linkedTrace.length>0,'Parent criteria map to this child.','No Parent criterion trace points to this child.','Link every child to its originating Parent criterion.')
  ];
  const criteriaChecks=[
   check('childCriteriaPresent',criteria.length>0,'Child-specific criteria are recorded.','Child-specific criteria are absent.','Derive criteria from validated findings; ask a question when outcomes are unknown.'),
   check('criteriaObservable',criteria.length>0&&criteria.every(item=>text(item.expectedOutcome)&&text(item.statement)),
    'Each child criterion has a statement and expected outcome.','One or more child criteria lack an observable outcome.','Record measurable expected behavior from evidence.'),
   check('criteriaEvidence',criteria.length>0&&criteria.every(item=>(item.evidenceRefs||[]).length&&
    item.evidenceRefs.every(ref=>evidenceMap.get(ref)?.verificationStatus==='VERIFIED')),
    'Each child criterion cites verified evidence.','Child criteria are not fully evidence-backed.','Link the criterion to validated specialist evidence.')
  ];
  const businessChecks=[
   check('rulesLinked',childRules.length===child.requirementIds.length,'All child requirements resolve to business-rule rows.','Some child requirements do not resolve to a business rule.','Resolve rule identities before approval.'),
   check('rulesDisposition',childRules.length>0&&childRules.every(item=>item.disposition!=='BLOCKED'),
    'Each child business rule has an evidence-backed disposition.','One or more child business rules remain unresolved.','Resolve, assign, or explicitly exclude every required rule.')
  ];
  const reuseChecks=[
   check('ownerEvidence',childEvidence.some(item=>item.repositoryKey===child.targetRepository),
    'Existing implementation in the owning repository was inspected.','No verified evidence from the owning repository is attached.','Inspect the target repository before asserting a development gap.'),
   check('preservation',child.existingFunctionalityToPreserve?.length>0||childFindings.some(item=>item.reuseAssessment==='NO_REUSE_FOUND'),
    'Existing behavior to preserve or a no-reuse finding is recorded.','Reuse assessment is missing.','Identify reuse opportunities or record an evidence-backed no-reuse conclusion.')
  ];
  const technicalChecks=[
   check('repositoryOwner',!!child.targetRepository&&(extension.planning.selectedTargets||[]).includes(child.targetRepository),
    'Child is assigned to a selected implementation repository.','Repository ownership is missing or out of scope.','Resolve repository ownership.'),
   check('evidenceFreshness',sourceFreshness.status==='CURRENT'&&childEvidence.every(item=>item.verificationStatus==='VERIFIED'),
    'Evidence is currently verified.','Evidence freshness is unavailable or stale.','Re-select source roots and revalidate evidence.'),
   check('dependencyGraph',extension.planning.dependencyGraph?.valid===true,'Dependency graph is valid.','Dependency graph is invalid.','Resolve or remove unsupported dependency edges.'),
   check('mappingStatus',relevantMappings.every(item=>item.status==='VERIFIED'&&!item.blocking),
    'Relevant API and entity mappings are verified.','A relevant mapping is unresolved or blocking.','Verify the full source-to-contract mapping or keep it blocked.')
  ];
  const testChecks=[
   check('testScenarios',criteria.length>0&&criteria.every(item=>item.testScenarios?.length>0),
    'Each child criterion has at least one test scenario.','A criterion has no test scenario.','Add a positive, negative, boundary, or integration scenario as applicable.'),
   check('scenarioCoverage',missingScenarioTypes.length===0,'Required scenario types are covered.','Required test scenario types are missing.','Add only scenarios justified by linked rules and verified contracts.'),
   check('regressionCoverage',criteria.some(item=>(item.scenarioTypes||[]).includes('regression'))||child.existingFunctionalityToPreserve?.length===0,
    'Regression risk is covered or no existing behavior is identified for preservation.','Regression coverage is not explicit.','Add a regression scenario for verified behavior that must be preserved.')
  ];
  const dimensions=[makeDimension(DIMENSIONS[0],clarity),makeDimension(DIMENSIONS[1],criteriaChecks),
   makeDimension(DIMENSIONS[2],businessChecks),makeDimension(DIMENSIONS[3],reuseChecks),
   makeDimension(DIMENSIONS[4],technicalChecks),makeDimension(DIMENSIONS[5],testChecks)],
   score=Math.round(dimensions.reduce((sum,item)=>sum+item.points,0)),
   readiness=readinessFor(score,missing.length>0);
  if(readiness==='NEEDS_REVIEW')recommendations.push('Review the child quality findings before package approval: '+child.provisionalChildId+'.');
  childReports.push({childId:child.provisionalChildId,repository:child.targetRepository,score,readiness,
   parentAcceptanceCriterionCoverage:unique(linkedTrace.map(item=>item.criterionId)),
   refinedAcceptanceCriteria:criteria,ruleTraceability:childRules,existingImplementationEvidence:childEvidence.map(item=>({
    evidenceId:item.evidenceId,repositoryKey:item.repositoryKey,relativePath:item.relativePath,symbol:item.symbol,sha256:item.sha256,
    verificationStatus:item.verificationStatus})),missingImplementationScope:child.implementationGap,
   domainTraceability:childRules.map(row=>({ruleId:row.ruleId,cdms:row.cdmsPluginRules,dab:row.dabTranslations,
    angular:row.angularMappings,graphql:row.graphqlMappings,sql:row.sqlRelationships})),
   scenarioCompleteness:{required:requiredScenarioTypes,covered:actualScenarioTypes,missing:missingScenarioTypes},
   dependencyValidation:{valid:extension.planning.dependencyGraph?.valid===true,
    dependencies:child.dependencies||[],errors:extension.planning.dependencyGraph?.errors||[]},
   unresolvedQuestions:unique((extension.questions||[]).filter(question=>question.blocking&&question.status!=='answered'&&
    (child.acceptanceCriterionIds.includes(question.acceptanceCriterionId)||child.requirementIds.includes(question.requirementId)))
    .map(question=>question.questionId)),
   blockers:unique(missing),dimensions,recommendations:unique(dimensions.flatMap(item=>item.recommendations))});
 }
 const parentCriteria=(state.acceptanceCriteria||[]).map(criterion=>{
  const trace=(extension.planning.traceability||[]).find(item=>item.criterionId===criterion.id),
   derived=childReports.flatMap(report=>report.refinedAcceptanceCriteria).filter(item=>item.parentAcceptanceCriterionId===criterion.id);
  return {criterionId:criterion.id,originalText:criterion.criterion,disposition:trace?.disposition||'BLOCKED_BY_EVIDENCE',
   childIds:trace?.childIds||[],refinedCriterionIds:derived.map(item=>item.criterionId).sort(),
   evidenceRefs:trace?.evidenceRefs||[],questions:trace?.questionIds||[]};
 });
 if(parentCriteria.length!==extension.planning.traceability.length)
  addBlocker('PARENT_CRITERIA_MISMATCH','Planning traceability does not account for every canonical Parent criterion.');
 const dimensions=childReports.length?DIMENSIONS.map(definition=>aggregateDimension(definition,childReports)):
  DIMENSIONS.map(definition=>makeDimension(definition,[check('parentCoverage',
   (extension.planning.traceability||[]).length>0&&(extension.planning.traceability||[]).every(row=>
    ['COVERED_EXISTING','EXCLUDED_BY_SCOPE_DECISION'].includes(row.disposition)),
   'No implementation children are required; all Parent criteria have an explicit covered or approved-exclusion disposition.',
   'Parent criteria do not all have verified existing coverage or approved exclusions.',
   'Resolve every Parent criterion before package approval.')]));
 const score=Math.round(dimensions.reduce((sum,item)=>sum+item.points,0)),
  blockerMap=new Map(blockers.map(item=>[item.code+'|'+item.message,item])),
  hardBlockers=[...blockerMap.values()].sort((a,b)=>(a.childId||'').localeCompare(b.childId||'')||a.code.localeCompare(b.code)||a.message.localeCompare(b.message)),
  readiness=readinessFor(score,hardBlockers.length>0),
  packageReadyForApproval=readiness==='QUALITY_READY_CANDIDATE'&&hardBlockers.length===0,
  packageApprovalStatus=extension.packageApproval?
   (await contracts.isPackageApprovalCurrent(extension.packageApproval,extension)?'CURRENT':'STALE'):'NOT_RECORDED';
 if(readiness==='NEEDS_REVIEW')recommendations.push('Review quality dimensions scoring below 90 before package approval.');
 if(!packageReadyForApproval)recommendations.push('Resolve all hard blockers and quality findings; a score never authorizes development.');
 return {schema:SCHEMA,schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,status:'CURRENT',
  packageRevision:extension.packageRevision,planningFingerprint:extension.planning.packageManifest.fingerprint,
  inputFingerprint:await inputFingerprint(extension,contracts),generatedAt:new Date().toISOString(),score,readiness,
  packageReadyForApproval,developmentReady:false,packageApprovalStatus,dimensions,
  parentAcceptanceCriteriaCoverage:parentCriteria,businessRuleTraceability:ruleData.rows,
  scenarioCompleteness:childReports.map(report=>({childId:report.childId,...report.scenarioCompleteness})),
  children:childReports,clarificationQuestions,blockers:hardBlockers,recommendations:unique(recommendations)};
}

global.PBIRefinementQuality={SCHEMA,SCHEMA_VERSION,MODEL_VERSION,DIMENSIONS,readinessFor,inputFingerprint,evaluate};
if(typeof module!=='undefined'&&module.exports)module.exports=global.PBIRefinementQuality;
})(typeof globalThis!=='undefined'?globalThis:this);
