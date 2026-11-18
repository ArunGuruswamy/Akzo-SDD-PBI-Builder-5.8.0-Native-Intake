'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const build=require('./build.cjs'),C=require('./src/phase01-contracts.js'),G=require('./src/graphql-intelligence.js'),P=require('./src/core.js');
const {DirectoryHandle}=require('./fixtures/fs-handles.cjs');
const assets=build.loadAssets(),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),hash=char=>char.repeat(64);

async function main(){
 const runtime=build.buildGraphqlBundle(),context={};vm.createContext(context);vm.runInContext(runtime,context);
 assert.equal(typeof context.PBIGraphQL.buildSchema,'function');
 const schemaFiles=assets.referenceLibrary.files.filter(file=>file.path.endsWith('.graphql')),
  schemaInputs=schemaFiles.map(file=>({schemaArtifactId:'graphql-reference-'+path.basename(file.path,'.graphql'),source:file.content})),
  parsed=G.validateSchemas(schemaInputs);
 assert.equal(parsed.results.length,3);assert.ok(parsed.results.every(item=>item.status==='VALIDATED'));
 assert.deepEqual(parsed.results.map(item=>item.typeCount),[1247,1727,607]);
 const valid=G.validateOperation({schemaArtifactId:'graphql-reference-formula-schema',operationName:'ReferenceIntrospection',
  source:'query ReferenceIntrospection { __typename }'},parsed.schemas);
 assert.equal(valid.status,'VALIDATED');assert.deepEqual(G.selectedFieldPaths('query ReferenceIntrospection { __typename }','ReferenceIntrospection'),['__typename']);
 assert.equal(G.validateOperation({schemaArtifactId:'not-assigned',operationName:'ReferenceIntrospection',
  source:'query ReferenceIntrospection { __typename }'},parsed.schemas).status,'UNRESOLVED');
 assert.equal(G.validateOperation({schemaArtifactId:'graphql-reference-formula-schema',operationName:'BadOperation',
  source:'query BadOperation { fieldThatCannotExist }'},parsed.schemas).status,'INVALID');

 const rootHash=hash('a'),sqlHash=hash('d'),schemaHash=hash('b'),operationHash=hash('c'),
  extension=C.createAnalysisExtension({parentPbiId:'pbi-graphql',parentStateRevision:hash('e'),packageId:'pkg-graphql'}),
  roots=[
   {rootId:'graphql-library-root',repositoryKey:'pbi-builder-reference-library',revision:rootHash,sha256:rootHash},
   {rootId:'sql-root',repositoryKey:'cdms',revision:'sql-rev',sha256:sqlHash},
   {rootId:'dab-root',repositoryKey:'dab',revision:'dab-rev',sha256:operationHash}
  ];
 extension.sourceRoots=roots;
 extension.evidence=[
  {schema:C.SCHEMAS.evidence,schemaVersion:1,evidenceId:'ev-sql',requirementId:'REQ-1',acceptanceCriterionId:'AC-1',
   repositoryKey:'cdms',sourceRootId:'sql-root',relativePath:'playbook/pbi-builder/references/cdms/sql-schema-tables.csv',sourceRevision:'sql-rev',
   sha256:sqlHash,symbol:'dbo.Parent.ParentId',category:'static-schema',verificationMethod:'export-row inspection',
   description:'The SQL export contains the parent key.',executionContext:'Offline Builder test',limitations:[],verificationStatus:'VERIFIED'},
  {schema:C.SCHEMAS.evidence,schemaVersion:1,evidenceId:'ev-schema',requirementId:'REQ-1',acceptanceCriterionId:'AC-1',
   repositoryKey:'pbi-builder-reference-library',sourceRootId:'graphql-library-root',
   relativePath:'playbook/pbi-builder/references/graphql/formula-schema.graphql',sourceRevision:rootHash,sha256:schemaHash,
   symbol:'Query',category:'static-schema',verificationMethod:'GraphQL.js schema validation',
   description:'The assigned SDL defines a valid schema.',executionContext:'Offline Builder test',limitations:[],verificationStatus:'VERIFIED'},
  {schema:C.SCHEMAS.evidence,schemaVersion:1,evidenceId:'ev-operation',requirementId:'REQ-1',acceptanceCriterionId:'AC-1',
   repositoryKey:'dab',sourceRootId:'dab-root',relativePath:'src/ReferenceIntrospection.graphql',sourceRevision:'dab-rev',
   sha256:operationHash,symbol:'ReferenceIntrospection',category:'operation-client',verificationMethod:'GraphQL.js operation validation',
   description:'The named operation validates against the explicitly assigned SDL.',executionContext:'Offline Builder test',limitations:[],verificationStatus:'VERIFIED'}
 ];
 extension.sqlRelationships=[{schema:C.SCHEMAS.sqlRelationship,schemaVersion:1,relationshipId:'sql-parent-key',artifactId:'sql-artifact',
  artifactSha256:sqlHash,sourceRootId:'sql-root',relativePath:'playbook/pbi-builder/references/cdms/sql-schema-tables.csv',
  environment:'TEST',sourceRevision:'sql-rev',kind:'primary-key',table:{schema:'dbo',name:'Parent'},primaryKeyColumns:['ParentId'],
  foreignKey:null,validationStatus:'VERIFIED',unresolvedSchemaQualification:false,blocking:false,conflictingEvidenceRefs:[],
  evidenceRefs:['ev-sql'],unresolvedQuestions:[]}];
 extension.graphqlMetadata={schema:C.SCHEMAS.graphqlMetadata,schemaVersion:1,libraryManifestSha256:rootHash,
  referenceRootId:'graphql-library-root',
  schemaArtifacts:[{artifactId:'formula-schema',relativePath:'playbook/pbi-builder/references/graphql/formula-schema.graphql',
   sha256:schemaHash,sourceRootId:'graphql-library-root',validationStatus:'VALIDATED',errors:[]}],
  operationArtifacts:[{operationId:'op-reference-introspection',operationName:'ReferenceIntrospection',
   relativePath:'src/ReferenceIntrospection.graphql',sha256:operationHash,sourceRootId:'dab-root',schemaArtifactId:'formula-schema',
   validationStatus:'VALIDATED',errors:[],selectedFieldPaths:['__typename']}]};
 extension.graphqlMappings=[{schema:C.SCHEMAS.graphqlMapping,schemaVersion:1,mappingId:'map-parent-query',
  requirementId:'REQ-1',acceptanceCriterionId:'AC-1',sqlRelationshipId:'sql-parent-key',schemaArtifactId:'formula-schema',
  operationId:'op-reference-introspection',graphqlType:'Query',graphqlFieldPath:'__typename',
  evidenceRefs:['ev-sql','ev-schema','ev-operation'],status:'VERIFIED',blocking:false,unresolvedQuestions:[]}];
 assert.equal(C.validateAnalysisExtension(extension),extension);
 assert.deepEqual(C.packageApprovalBlockers(extension),[]);
 const falseMapping=structuredClone(extension);falseMapping.graphqlMappings[0].graphqlFieldPath='unselectedField';
 assert.throws(()=>C.validateAnalysisExtension(falseMapping),/field path selected by the validated operation/);
 const unaudited=structuredClone(extension);unaudited.graphqlMappings[0].evidenceRefs=['ev-sql','ev-schema'];
 assert.throws(()=>C.validateAnalysisExtension(unaudited),/exact-hash evidence/);
 const unresolved=structuredClone(extension);unresolved.graphqlMappings[0].status='UNRESOLVED';
 unresolved.graphqlMappings[0].blocking=true;unresolved.graphqlMappings[0].unresolvedQuestions=['GRAPHQL-Q-1'];
 assert.ok(C.packageApprovalBlockers(unresolved).some(item=>item.includes('GraphQL mapping map-parent-query is UNRESOLVED')));
 await assert.rejects(()=>C.createPackageApprovalRequest(unresolved,{requestedBy:'test'}),/package approval blocked/);

 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'akzo-graphql-intelligence-'));
 try{
  const root=new DirectoryHandle(temp),folder='playbook/pbis/pbi-graphql',state={schemaVersion:2,pbi:'pbi-graphql',status:'Draft',rules:[]},
   config={projectName:'GraphQL test',role:'other',ide:'vscode',sources:{legacy:'',dab:'',cdms:'',ui:''},others:[],includeReferences:false};
  await P.write(root,folder+'/pbi-state.json',JSON.stringify(state));
  const setup=P.setupFiles(config,assets,'test html');
  await P.apply(root,await P.plan(root,setup.files,true));
  const linked=await P.saveGraphqlAnalysisExtension(root,folder,{actorRole:'coordinator',expectedSha256:null});
  assert.equal(linked.created,true);assert.equal(linked.schemaCount,3);
  assert.equal(linked.extension.graphqlMetadata.schemaArtifacts.length,3);
  assert.equal((await P.loadAnalysisExtension(root,folder)).extension.graphqlMetadata.libraryManifestSha256,linked.extension.graphqlMetadata.libraryManifestSha256);
  const request=await C.createPackageApprovalRequest(linked.extension,{requestedBy:'test'}),
   approval=await P.savePackageApproval(root,folder,request,{approvedBy:'reviewer',approvedAt:'2026-01-01T00:00:00Z',evidence:'Reviewed offline reference set.'},
    {actorRole:'coordinator',expectedSha256:linked.sha256});
  assert.equal((await P.loadAnalysisExtension(root,folder)).extension.packageApproval.fingerprint,approval.approval.fingerprint);
  const updatedAssets=structuredClone(assets),updatedFile=updatedAssets.referenceLibrary.files.find(file=>file.path==='graphql/formula-schema.graphql');
  updatedFile.content+='\n# isolated fixture refresh\n';
  const updatedBytes=Buffer.from(updatedFile.content,'utf8');updatedFile.byteLength=updatedBytes.length;updatedFile.sha256=sha(updatedBytes);
  const updatedArtifact=updatedAssets.referenceLibrary.manifest.artifacts.find(file=>file.path===updatedFile.path);
  updatedArtifact.byteLength=updatedFile.byteLength;updatedArtifact.sha256=updatedFile.sha256;
  const updatedSetup=P.setupFiles(config,updatedAssets,'test html');
  await P.apply(root,await P.plan(root,updatedSetup.files,true),true);
  await assert.rejects(()=>P.loadAnalysisExtension(root,folder),/ANALYSIS_EXTENSION_GRAPHQL_STALE/);
  const relinked=await P.saveGraphqlAnalysisExtension(root,folder,{actorRole:'coordinator',expectedSha256:approval.sha256});
  assert.equal(relinked.approvalInvalidated,true);assert.equal(relinked.extension.packageRevision,linked.extension.packageRevision+1);
  assert.equal(relinked.extension.packageApproval,undefined);
  assert.equal((await P.loadAnalysisExtension(root,folder)).extension.graphqlMetadata.libraryManifestSha256,await P.hash(updatedSetup.files[P.REFERENCE_LIBRARY_FILE]));
 }finally{await fs.rm(temp,{recursive:true,force:true});}
 console.log('PASS offline GraphQL.js bundle, authoritative schema validation, explicit operation assignment, evidence-bound SQL-to-GraphQL mappings, blocking approval rules, persistent extension loading, and reference-change approval invalidation.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
