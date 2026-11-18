'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const SQL=require('./src/sql-metadata.js'),C=require('./src/phase01-contracts.js'),P=require('./src/core.js');
const {DirectoryHandle}=require('./fixtures/fs-handles.cjs');
const bytes=text=>new TextEncoder().encode(text),line=(values,delimiter='\t',wrapped=true)=>wrapped?'"'+values.join(delimiter).replace(/"/g,'""')+'"':values.join(delimiter);
const tables=[
 ['dbo','Parent','ParentId','int','','NO'],
 ['dbo','Parent','ChildId','int','','NO'],
 ['dbo','Child','ChildId','int','','NO'],
 ['dbo','Child','ParentId','int','','YES'],
 ['sales','Parent','ParentId','int','','NO'],
 ['dbo','BadChild','ChildId','int','','NO']
];
function sample(overrides={}){
 const fk=[['FK_Child_Parent','dbo.Child','ParentId','dbo.Parent','ParentId']];
 const pk=[['dbo.Parent','ParentId'],['dbo.Child','ChildId']];
 return {
  foreignKeys:bytes([['ForeignKeyName','ParentTable','ParentColumn','ReferencedTable','ReferencedColumn'],...(overrides.foreignKeys||fk)].map(row=>line(row)).join('\r\n')+'\r\n'),
  primaryKeys:bytes([['TABLE_NAME','PRIMARY_KEY_COLUMN'],...(overrides.primaryKeys||pk)].map(row=>line(row)).join('\r\n')+'\r\n'),
  tables:bytes([['TABLE_SCHEMA','TABLE_NAME','COLUMN_NAME','DATA_TYPE','CHARACTER_MAXIMUM_LENGTH','IS_NULLABLE'],...(overrides.tables||tables)].map(row=>line(row)).join('\r\n')+'\r\n')
 };
}
async function analyze(inputs=sample(),paths={}){
 const provenance={};for(const dataset of Object.keys(SQL.SOURCES))provenance[dataset]={
  path:paths[dataset]||'C:\\Users\\RGA\\Downloads\\'+dataset+'.csv',
  sourceIdentity:paths[dataset]||'C:\\Users\\RGA\\Downloads\\'+dataset+'.csv',
  originalFilename:(paths[dataset]||dataset+'.csv').split(/[\\/]/).pop(),environment:'UNKNOWN',
  sourceRevision:null,extractedAt:null
 };
 return SQL.analyze(inputs,provenance);
}
async function main(){
 const quoted=SQL.parseDataset(bytes('"ForeignKeyName\tParentTable\tParentColumn\tReferencedTable\tReferencedColumn"\r\n"FK\t dbo.Child\tParentId\tdbo.Parent\tParentId"\r\n'),'foreignKeys');
 assert.equal(quoted.format,'quoted-tab');
 assert.equal(quoted.records[0].row.ForeignKeyName,'FK');
 assert.equal(quoted.records[0].row.ParentTable,' dbo.Child');
 assert.equal(SQL.parseDataset(bytes('TABLE_NAME\tPRIMARY_KEY_COLUMN\nParent\tId\n'),'primaryKeys').format,'tsv');
 assert.equal(SQL.parseDataset(bytes('"TABLE_NAME"\t"PRIMARY_KEY_COLUMN"\r\n"Parent"\t"Id"\r\n'),'primaryKeys').format,'tsv');
 assert.equal(SQL.parseDataset(bytes('TABLE_NAME,PRIMARY_KEY_COLUMN\r\n"Parent, Archive",Id\r\n'),'primaryKeys').format,'csv');
 assert.equal(SQL.parseDataset(bytes('\ufeffTABLE_NAME\tPRIMARY_KEY_COLUMN\r\nParent\tId\r\n'),'primaryKeys').records[0].row.TABLE_NAME,'Parent');
 assert.equal(SQL.parseDataset(bytes('"TABLE_NAME\tPRIMARY_KEY_COLUMN"\n"dbo.Table\tId"\n'),'primaryKeys').records[0].row.TABLE_NAME,'dbo.Table');
 assert.equal(SQL.parseDataset(bytes('TABLE_NAME,PRIMARY_KEY_COLUMN\r\n"Parent, Archive","Id ""quoted"""\r\n'),'primaryKeys').records[0].row.PRIMARY_KEY_COLUMN,'Id "quoted"');
 assert.throws(()=>SQL.parseDataset(bytes('"TABLE_NAME\tPRIMARY_KEY_COLUMN\n"dbo.Table\tId"\n'),'primaryKeys'),/quoted-tab record must be enclosed/);
 assert.throws(()=>SQL.parseDataset(bytes('TABLE_NAME,PRIMARY_KEY_COLUMN\n"unterminated,Id\n'),'primaryKeys'),/unterminated quoted field/);
 assert.throws(()=>SQL.parseDataset(bytes('TABLE_NAME\tTABLE_NAME\nParent\tId\n'),'primaryKeys'),/duplicate header/);
 assert.throws(()=>SQL.parseDataset(bytes('TABLE_NAME\tWRONG\nParent\tId\n'),'primaryKeys'),/missing required headers.*unexpected headers/);
 assert.throws(()=>SQL.parseDataset(bytes('TABLE_NAME\tPRIMARY_KEY_COLUMN\nParent\n'),'primaryKeys'),/expected 2 fields but found 1/);
 assert.throws(()=>SQL.parseDataset(bytes('TABLE_NAME\tPRIMARY_KEY_COLUMN\n\tId\n'),'primaryKeys'),/field TABLE_NAME: required value is empty/);
 assert.throws(()=>SQL.parseDataset(new Uint8Array([0xc3,0x28]),'primaryKeys'),/not valid UTF-8/);
 assert.throws(()=>SQL.parseDataset(new Uint8Array(SQL.MAX_FILE_BYTES+1),'primaryKeys'),/safety limit/);
 const repeated=SQL.parseDataset(bytes('TABLE_NAME\tPRIMARY_KEY_COLUMN\nParent\tId\nParent\tId\n'),'primaryKeys');
 assert.equal(repeated.recordCount,1);assert.equal(repeated.duplicateCount,1);

 const modelAnalysis=await analyze(),model=modelAnalysis.model;
 assert.equal(SQL.findTable(model,'dbo.Child').status,'VERIFIED');
 assert.equal(SQL.findTable(model,'Parent').status,'AMBIGUOUS');
 assert.deepEqual(SQL.findTable(model,'Parent').candidates,['dbo.Parent','sales.Parent']);
 assert.equal(SQL.findTable(model,'MissingTable').status,'UNRESOLVED');
 assert.deepEqual(SQL.listColumns(model,'dbo.Child').columns.map(column=>column.name),['ChildId','ParentId']);
 assert.ok(SQL.listColumns(model,'dbo.Child').columns.every(column=>column.evidenceRefs.length===1));
 assert.equal(SQL.findPrimaryKey(model,'dbo.Parent').status,'VERIFIED');
 assert.equal(SQL.outgoingForeignKeys(model,'dbo.Child').status,'VERIFIED');
 assert.equal(SQL.outgoingForeignKeys(model,'dbo.Child').foreignKeys[0].status,'VERIFIED');
 assert.equal(SQL.incomingForeignKeys(model,'dbo.Parent').foreignKeys[0].status,'VERIFIED');
 assert.equal(SQL.resolveForeignKey(model,'FK_Child_Parent').status,'VERIFIED');
 assert.equal(SQL.relationshipsBetween(model,'dbo.Child','dbo.Parent').relationships.length,1);
 assert.equal(SQL.relationshipsBetween(model,'dbo.Child','dbo.BadChild').status,'UNRESOLVED');
 assert.equal(model.foreignKeys.length,1,'same-named columns do not create relationship records');
 assert.equal(model.foreignKeys[0].referencedKeyUniqueness,'PRIMARY_KEY');
 assert.equal(model.foreignKeys[0].columnOrderVerified,true);
 assert.ok(model.foreignKeys[0].evidenceRefs.length>=3);
 assert.equal(SQL.sourceEvidence(modelAnalysis,'foreignKeys',2).evidenceRef,model.foreignKeys[0].evidenceRefs.find(ref=>ref.includes('-2')));
 assert.equal(SQL.sourceEvidence(modelAnalysis,'foreignKeys',999).status,'UNRESOLVED');

 const uniqueTarget=await analyze(sample({tables:[...tables,['dbo','Parent','AlternateId','int','','NO']],
  foreignKeys:[['FK_Unique','dbo.Child','ParentId','dbo.Parent','AlternateId']]}));
 assert.equal(uniqueTarget.model.foreignKeys[0].status,'VERIFIED');
 assert.equal(uniqueTarget.model.foreignKeys[0].referencedKeyUniqueness,'UNVERIFIED','FKs may reference unique keys absent from the PK export');
 const nullableLength=await analyze(sample({tables:[...tables,['dbo','Parent','NonText','bigint','NULL','NO']]}));
 assert.equal(nullableLength.model.tables.find(table=>table.identity==='dbo.Parent').columns.find(column=>column.name==='NonText').characterMaximumLength,null);
 assert.equal(nullableLength.diagnostics.some(item=>item.code==='INVALID_CHARACTER_LENGTH'),false);
 const conflictingColumns=await analyze(sample({tables:[...tables,['dbo','Child','ParentId','nvarchar','20','NO']]}));
 assert.equal(SQL.findTable(conflictingColumns.model,'dbo.Child').status,'CONFLICTING');
 assert.equal(conflictingColumns.model.primaryKeys.find(item=>item.tableReference==='dbo.Child').status,'CONFLICTING');
 assert.equal(conflictingColumns.model.foreignKeys[0].status,'CONFLICTING');
 assert.equal(SQL.findPrimaryKey(conflictingColumns.model,'dbo.Child').status,'CONFLICTING');
 assert.equal(SQL.outgoingForeignKeys(conflictingColumns.model,'dbo.Child').status,'CONFLICTING');

 const aliasAndConflict=await analyze(sample({foreignKeys:[
  ['FK_Alias','dbo.Child','ChildId','dbo.BadChild','ChildId'],['FK_Alias','Child','ChildId','dbo.BadChild','ChildId'],
  ['FK_Conflict','dbo.Child','ParentId','dbo.Parent','ParentId'],['FK_Conflict','dbo.Child','ChildId','dbo.BadChild','ChildId']
 ]}));
 const aliasFk=aliasAndConflict.model.foreignKeys.find(item=>item.constraintName==='FK_Alias');
 assert.equal(aliasFk.parentTable,'dbo.Child');assert.deepEqual(aliasFk.parentReferences,['Child','dbo.Child']);
 assert.equal(aliasAndConflict.model.foreignKeys.find(item=>item.constraintName==='FK_Conflict').status,'CONFLICTING');

 const composite=await analyze(sample({primaryKeys:[['dbo.Parent','ParentId'],['dbo.Parent','ChildId']],
  foreignKeys:[['SameName','dbo.Child','ChildId','dbo.Parent','ParentId'],['SameName','dbo.Child','ParentId','dbo.Parent','ChildId'],
   ['SameName','dbo.BadChild','ChildId','dbo.Parent','ParentId'],['FK_Ambiguous','Parent','ParentId','dbo.Child','ParentId'],
   ['FK_MissingColumn','dbo.BadChild','MissingId','dbo.Parent','ParentId']]}));
 assert.ok(composite.model.primaryKeys.some(item=>item.columns.length===2&&item.status==='PARTIAL'&&!item.columnOrderVerified));
 const compositeFk=composite.model.foreignKeys.find(item=>item.constraintName==='SameName'&&item.parentReference==='dbo.Child');
 assert.equal(compositeFk.status,'PARTIAL');assert.equal(compositeFk.columnOrderVerified,false);
 assert.ok(compositeFk.columnPairs.every(pair=>pair.ordinal===null));
 assert.equal(SQL.resolveForeignKey(composite.model,'SameName').status,'AMBIGUOUS','constraint names may repeat across parent tables');
 assert.equal(composite.model.foreignKeys.find(item=>item.constraintName==='FK_Ambiguous').status,'AMBIGUOUS');
 assert.equal(composite.model.foreignKeys.find(item=>item.constraintName==='FK_MissingColumn').status,'CONFLICTING');
 assert.equal(composite.model.foreignKeys.find(item=>item.constraintName==='SameName'&&item.parentReference==='dbo.Child').referencedKeyUniqueness,'PRIMARY_KEY');
 const ambiguousExtension=SQL.toPhase01(C.createAnalysisExtension({parentPbiId:'pbi-ambiguous',
  parentStateRevision:await C.stateRevision({schemaVersion:2,pbi:'pbi-ambiguous'}),packageId:'pkg-ambiguous'}),composite);
 assert.ok(ambiguousExtension.sqlRelationships.some(item=>item.validationStatus==='AMBIGUOUS'&&item.blocking&&item.unresolvedQuestions.length));
 const extended=SQL.toPhase01(C.createAnalysisExtension({parentPbiId:'pbi-sql',parentStateRevision:await C.stateRevision({schemaVersion:2,pbi:'pbi-sql'}),packageId:'pkg-sql'}),modelAnalysis);
 assert.equal(C.validateAnalysisExtension(extended),extended);
 assert.equal(extended.sqlRelationships.length,3,'PK and FK metadata is linked to Phase 01 contracts');
 assert.ok(extended.sqlRelationships.every(item=>item.evidenceRefs.length));
 assert.ok(extended.evidence.every(item=>item.datasetType&&item.sourceRow>0));
 assert.equal(extended.sqlMetadata.sources.length,3);
 const registry=SQL.createSourceRegistry(modelAnalysis);assert.equal(SQL.checkAnalysisAgainstRegistry(modelAnalysis,registry).status,'CURRENT');
 const editedRegistry=structuredClone(registry);editedRegistry.sources[0].sha256='f'.repeat(64);
 assert.equal(SQL.checkAnalysisAgainstRegistry(modelAnalysis,editedRegistry).status,'STALE');
 const missingRegistry=structuredClone(registry);missingRegistry.sources[0].validationStatus='MISSING';
 assert.equal(SQL.checkAnalysisAgainstRegistry(modelAnalysis,missingRegistry).status,'STALE');
 assert.equal(SQL.checkFreshness(extended,missingRegistry).status,'STALE');
 const missingExtension=structuredClone(extended);missingExtension.sqlMetadata.sources[0].validationStatus='MISSING';
 assert.equal(SQL.checkFreshness(missingExtension,registry).status,'STALE','a source stays stale after it is marked missing until relinked');
 assert.throws(()=>SQL.validateSourceRegistry({...registry,sources:registry.sources.map((source,index)=>index?source:{...source,sourceIdentity:'../escape.csv',path:'../escape.csv'})}),/absolute local path/);
 assert.throws(()=>SQL.validateSourceRegistry({...registry,schemaVersion:2}),/schemaVersion 1/);

 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'akzo-sql-metadata-'));
 try{
  const root=new DirectoryHandle(temp),folder='playbook/pbis/pbi-sql',state={schemaVersion:2,pbi:'pbi-sql',status:'Draft',rules:[]};
  await P.write(root,folder+'/pbi-state.json',JSON.stringify(state));
  const initial=C.createAnalysisExtension({parentPbiId:state.pbi,parentStateRevision:await C.stateRevision(state),packageId:'pkg-sql'}),
   savedExtension=await P.saveAnalysisExtension(root,folder,initial,{actorRole:'coordinator',expectedSha256:null});
  const savedRegistry=await P.saveSqlSourceRegistry(root,registry,{actorRole:'coordinator',expectedSha256:null});
  const link=await P.saveSqlAnalysisExtension(root,folder,modelAnalysis,{actorRole:'coordinator',expectedSha256:savedExtension.sha256});
  assert.equal(link.extension.sqlRelationships.length,3);
  assert.equal(link.extension.packageRevision,2);
  const identicalLink=await P.saveSqlAnalysisExtension(root,folder,modelAnalysis,{actorRole:'coordinator',expectedSha256:link.sha256});
  assert.equal(identicalLink.unchanged,true);assert.equal(identicalLink.extension.packageRevision,2);
  const request=await C.createPackageApprovalRequest(link.extension,{requestedBy:'coordinator'});
  const approved=await P.savePackageApproval(root,folder,request,{approvedBy:'reviewer',approvedAt:'2026-01-01T00:00:00Z',evidence:'SQL analysis reviewed.'},
   {actorRole:'coordinator',expectedSha256:link.sha256});
  const afterEdit=await P.loadAnalysisExtension(root,folder);
  assert.deepEqual(afterEdit.extension.packageApproval,approved.approval);
  const unrelatedFolder='playbook/pbis/pbi-unrelated',unrelatedState={schemaVersion:2,pbi:'pbi-unrelated',status:'Draft',rules:[]};
  await P.write(root,unrelatedFolder+'/pbi-state.json',JSON.stringify(unrelatedState));
  const unrelatedExtension=C.createAnalysisExtension({parentPbiId:unrelatedState.pbi,parentStateRevision:await C.stateRevision(unrelatedState),packageId:'pkg-unrelated'}),
   unrelatedSaved=await P.saveAnalysisExtension(root,unrelatedFolder,unrelatedExtension,{actorRole:'coordinator',expectedSha256:null}),
   unrelatedRequest=await C.createPackageApprovalRequest(unrelatedSaved.extension,{requestedBy:'coordinator'}),
   unrelatedApproval=await P.savePackageApproval(root,unrelatedFolder,unrelatedRequest,{approvedBy:'reviewer',approvedAt:'2026-01-01T00:00:00Z',evidence:'Unrelated package reviewed.'},
    {actorRole:'coordinator',expectedSha256:unrelatedSaved.sha256});
  const newFolder='playbook/pbis/pbi-sql-new',newState={schemaVersion:2,pbi:'pbi-sql-new',status:'Draft',rules:[]};
  await P.write(root,newFolder+'/pbi-state.json',JSON.stringify(newState));
  const newLink=await P.saveSqlAnalysisExtension(root,newFolder,modelAnalysis,{actorRole:'coordinator',expectedSha256:null});
  assert.equal(newLink.created,true);assert.equal(newLink.extension.packageRevision,1);
  const changed=await analyze(sample({foreignKeys:[['FK_Child_Parent','dbo.Child','ParentId','sales.Parent','ParentId']]}));
  const changedRegistry=SQL.createSourceRegistry(changed);
  await P.saveSqlSourceRegistry(root,changedRegistry,{actorRole:'coordinator',expectedSha256:savedRegistry.sha256});
  await assert.rejects(()=>P.loadAnalysisExtension(root,folder),/ANALYSIS_EXTENSION_SQL_STALE/);
  assert.deepEqual((await P.loadAnalysisExtension(root,unrelatedFolder)).extension.packageApproval,unrelatedApproval.approval,
   'a PBI with no SQL dependency retains its unrelated approval');
  const changedLink=await P.saveSqlAnalysisExtension(root,folder,changed,{actorRole:'coordinator',expectedSha256:afterEdit.sha256});
  assert.equal(changedLink.approvalInvalidated,true);
  assert.equal(changedLink.extension.packageRevision,3);
  assert.equal(changedLink.extension.packageApproval,undefined);
  const changedRelationship=changedLink.extension.sqlRelationships.find(item=>item.kind==='foreign-key');
  assert.equal(changedRelationship.foreignKey.referencedTable.schema,'sales','changed relationship mapping is persisted');
  assert.ok(changedLink.extension.evidence.some(item=>item.datasetType==='foreignKeys'&&item.verificationStatus==='STALE'));
  assert.equal(await P.read(root,folder+'/pbi-state.json'),JSON.stringify(state),'SQL revalidation does not rewrite legacy state v2');
  assert.ok(await P.loadSqlSourceRegistry(root));
  await assert.rejects(()=>P.saveSqlSourceRegistry(root,registry,{actorRole:'coordinator',expectedSha256:savedRegistry.sha256}),/SQL_SOURCE_REGISTRY_CHANGED/);
  const currentApprovalRequest=await C.createPackageApprovalRequest(changedLink.extension,{requestedBy:'coordinator'}),
   currentApproval=await P.savePackageApproval(root,folder,currentApprovalRequest,{approvedBy:'reviewer',approvedAt:'2026-01-02T00:00:00Z',evidence:'Revalidated SQL metadata reviewed.'},
    {actorRole:'coordinator',expectedSha256:changedLink.sha256}),
   currentRegistry=await P.loadSqlSourceRegistry(root);
  const missing=await P.markSqlSourcesUnavailable(root,['tables'],{actorRole:'coordinator',expectedRegistrySha256:currentRegistry.sha256});
  assert.equal(missing.invalidated.find(item=>item.folder===folder).approvalInvalidated,true);
  assert.ok(missing.invalidated.some(item=>item.folder===newFolder));
  await assert.rejects(()=>P.loadAnalysisExtension(root,folder),/ANALYSIS_EXTENSION_SQL_STALE/);
  const unavailable=await P.loadAnalysisExtension(root,folder,{allowStaleSqlSources:true,allowStaleApproval:true});
  assert.equal(unavailable.extension.packageApproval,undefined);
  assert.equal(unavailable.extension.sqlMetadata.sources.find(source=>source.dataset==='tables').validationStatus,'MISSING');
  assert.ok(unavailable.extension.evidence.filter(item=>item.datasetType==='tables').every(item=>item.verificationStatus==='STALE'));
  assert.ok(unavailable.extension.sqlRelationships.every(item=>item.validationStatus==='UNRESOLVED'&&item.blocking),
   JSON.stringify(unavailable.extension.sqlRelationships.map(item=>({dataset:item.sqlImportDataset,status:item.validationStatus,refs:item.evidenceRefs}))));
  assert.deepEqual((await P.loadAnalysisExtension(root,unrelatedFolder)).extension.packageApproval,unrelatedApproval.approval);
  assert.notDeepEqual(currentApproval.approval,unrelatedApproval.approval);
 }finally{await fs.rm(temp,{recursive:true,force:true});}

 const downloads=path.join(process.env.USERPROFILE||'C:\\Users\\RGA','Downloads');
 const actualPaths={foreignKeys:path.join(downloads,'fk-relationships(in).csv'),primaryKeys:path.join(downloads,'primary-keys(in).csv'),tables:path.join(downloads,'sql-schema-tables(in).csv')};
 try{
  const before=process.memoryUsage().rss,input={};for(const [dataset,file]of Object.entries(actualPaths))input[dataset]=await fs.readFile(file);
  try{const duplicate=await fs.readFile(path.join(downloads,'sql-schema-tables(in) (1).csv'));
   assert.equal(await SQL.sha256(input.tables),await SQL.sha256(duplicate),'duplicate schema export is byte-identical');}
  catch(error){if(error.code!=='ENOENT')throw error;console.log('Duplicate schema export is not present; its byte identity could not be rechecked.');}
  const provenance={};for(const [dataset,file]of Object.entries(actualPaths))provenance[dataset]={path:file,sourceIdentity:file,originalFilename:path.basename(file),environment:'UNKNOWN'};
  const parseStart=performance.now(),parsed={};
  for(const [dataset,content]of Object.entries(input))parsed[dataset]=await SQL.parseSource(content,dataset,provenance[dataset]);
  const parseEnd=performance.now(),rssAfterParse=process.memoryUsage().rss,modelStart=performance.now(),
   real=SQL.analyzeParsed(parsed),modelEnd=performance.now(),rssAfterModel=process.memoryUsage().rss,
   rawRows=Object.fromEntries(Object.entries(parsed).map(([name,value])=>[name,value.recordCount+value.duplicateCount])),
   diagnosticCounts=real.diagnostics.reduce((counts,item)=>{const key=item.severity+':'+item.code;counts[key]=(counts[key]||0)+1;return counts;},{});
  console.log('REAL SQL EXPORTS '+JSON.stringify({sources:Object.fromEntries(Object.entries(parsed).map(([name,value])=>[name,{path:actualPaths[name],format:value.format,sha256:value.sha256,rawRows:rawRows[name],uniqueRecords:value.recordCount,duplicates:value.duplicateCount}])),
   baseline:{foreignKeys:1482,primaryKeys:953,tables:66616},model:real.counts,
   resolvedPrimaryKeys:real.model.primaryKeys.filter(item=>['VERIFIED','PARTIAL'].includes(item.status)).length,
   primaryKeyStatus:{verified:real.counts.verifiedPrimaryKeys,partial:real.counts.partialPrimaryKeys},
   referencedKeyUniqueness:{primaryKey:real.model.foreignKeys.filter(item=>item.referencedKeyUniqueness==='PRIMARY_KEY').length,
    unverified:real.model.foreignKeys.filter(item=>item.referencedKeyUniqueness==='UNVERIFIED').length},
   diagnostics:real.diagnostics.length,diagnosticCounts,diagnosticSamples:real.diagnostics.slice(0,8),parseMilliseconds:Math.round(parseEnd-parseStart),modelMilliseconds:Math.round(modelEnd-modelStart),
   rssBytes:{before,afterParse:rssAfterParse,afterModel:rssAfterModel,parseDelta:rssAfterParse-before,modelDelta:rssAfterModel-rssAfterParse},
   maxRssNativeUnits:process.resourceUsage?.().maxRSS??null}));
 }catch(error){if(error.code!=='ENOENT')throw error;console.log('REAL SQL EXPORTS skipped: one or more local Downloads exports are unavailable.');}
 console.log('Phase 02 SQL parser, relational model, Phase 01 integration and freshness tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
