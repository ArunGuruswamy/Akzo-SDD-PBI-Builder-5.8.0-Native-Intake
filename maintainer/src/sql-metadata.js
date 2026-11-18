(function (global) {
'use strict';

const SCHEMA='akzo-sql-metadata-model',REGISTRY_SCHEMA='akzo-sql-source-registry';
const SOURCES=Object.freeze({
 foreignKeys:Object.freeze({label:'foreign keys',headers:['ForeignKeyName','ParentTable','ParentColumn','ReferencedTable','ReferencedColumn']}),
 primaryKeys:Object.freeze({label:'primary keys',headers:['TABLE_NAME','PRIMARY_KEY_COLUMN']}),
 tables:Object.freeze({label:'table/column schema',headers:['TABLE_SCHEMA','TABLE_NAME','COLUMN_NAME','DATA_TYPE','CHARACTER_MAXIMUM_LENGTH','IS_NULLABLE']})
});
const MAX_FILE_BYTES=32*1024*1024,MAX_ROWS=500000;

function fail(message){throw new Error('SQL metadata: '+message);}
function asBytes(value,name){
 if(value instanceof Uint8Array)return value;
 if(value instanceof ArrayBuffer)return new Uint8Array(value);
 fail(name+' must be supplied as UTF-8 bytes.');
}
function sourceEvidence(analysis,dataset,row){
 const descriptor=SOURCES[dataset];if(!descriptor)return {status:'UNRESOLVED',dataset,row,reason:'Unknown SQL dataset.'};
 if(!analysis?.datasets?.[dataset]||!Number.isInteger(row)||row<1)return {status:'UNRESOLVED',dataset,row,reason:'A parsed dataset and positive source row are required.'};
 const parsed=analysis.datasets[dataset],record=parsed.records.find(item=>item.sourceRow===row),
  duplicate=parsed.duplicates.find(item=>item.line===row),item=record?.row||duplicate?.record;
 if(!item)return {status:'UNRESOLVED',dataset,row,reason:'No parsed or duplicate source record exists at this row.'};
 return {status:'VERIFIED',dataset,sourceRow:row,evidenceRef:evidenceId(dataset,parsed.sha256,row),
  source:{sourceType:'sql-server-export',sourceIdentity:parsed.provenance?.sourceIdentity||parsed.provenance?.path||null,
   path:parsed.provenance?.path||null,originalFilename:parsed.provenance?.originalFilename||null,
   sha256:parsed.sha256,format:parsed.format,environment:parsed.provenance?.environment||'UNKNOWN',
   extractedAt:parsed.provenance?.extractedAt||null,sourceRevision:parsed.provenance?.sourceRevision||null},
  record:item,duplicate:!record,limitations:['Exported metadata is not proof of live database contents or application behavior.']};
}
function decodeUtf8(value,name){
 let text;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(value);}catch(e){if(e instanceof TypeError)fail(name+' is not valid UTF-8.');throw e;}
 return text.charCodeAt(0)===0xfeff?text.slice(1):text;
}
function isAbsoluteSourcePath(value){return typeof value==='string'&&(/^[A-Za-z]:[\\/]/.test(value)||/^\\\\[^\\]/.test(value)||value.startsWith('/'));}
function splitLines(text){
 const rows=[];let start=0,line=1;
 for(let i=0;i<text.length;i++)if(text[i]==='\r'||text[i]==='\n'){
  const end=i;
  if(text[i]==='\r'&&text[i+1]==='\n')i++;
  else if(text[i]==='\r')fail('bare CR line ending at line '+line+'.');
  rows.push({text:text.slice(start,end),line});start=i+1;line++;
 }
 if(start<text.length)rows.push({text:text.slice(start),line});
 return rows;
}
function parseWrappedTab(text,name){
 const physical=splitLines(text),rows=[];
 for(const {text:line,line:number} of physical){
  if(!line.length)continue;
  if(line.length<2||line[0]!=='"'||line[line.length-1]!=='"')fail(name+' line '+number+': quoted-tab record must be enclosed in double quotes.');
  const body=line.slice(1,-1),fields=[];let field='';
  for(let i=0;i<body.length;i++){
   const ch=body[i];
   if(ch==='\t'){fields.push(field);field='';continue;}
   if(ch==='"'){
    if(body[i+1]!=='"')fail(name+' line '+number+': malformed quote in quoted-tab field '+(fields.length+1)+'.');
    field+='"';i++;continue;
   }
   field+=ch;
  }
  fields.push(field);rows.push({fields,line:number});
 }
 return rows;
}
function parseDelimited(text,delimiter,name){
 const rows=[];let fields=[],field='',quoted=false,afterQuote=false,atFieldStart=true,line=1,rowLine=1;
 const pushRow=()=>{fields.push(field);rows.push({fields,line:rowLine});fields=[];field='';afterQuote=false;atFieldStart=true;rowLine=line;};
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){
   if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;afterQuote=true;}}
   else{field+=ch;if(ch==='\n')line++;else if(ch==='\r'){if(text[i+1]==='\n'){field+='\n';i++;}line++;}}
   continue;
  }
  if(afterQuote){
   if(ch===delimiter){fields.push(field);field='';afterQuote=false;atFieldStart=true;continue;}
   if(ch==='\r'||ch==='\n'){
    if(ch==='\r'&&text[i+1]==='\n')i++;
    line++;pushRow();rowLine=line;continue;
   }
   fail(name+' line '+line+': unexpected character after a closing quote in field '+(fields.length+1)+'.');
  }
  if(ch==='"'){
   if(!atFieldStart)fail(name+' line '+line+': quote in an unquoted field '+(fields.length+1)+'.');
   quoted=true;atFieldStart=false;continue;
  }
  if(ch===delimiter){fields.push(field);field='';atFieldStart=true;continue;}
  if(ch==='\r'||ch==='\n'){
   if(ch==='\r'&&text[i+1]==='\n')i++;
   line++;pushRow();rowLine=line;continue;
  }
  field+=ch;atFieldStart=false;
 }
 if(quoted)fail(name+' line '+rowLine+': unterminated quoted field '+(fields.length+1)+'.');
 if(fields.length||field.length||afterQuote)pushRow();
 return rows.filter(row=>row.fields.some(value=>value.length));
}
function detectFormat(text,name){
 const first=splitLines(text).find(row=>row.text.length)?.text;
 if(first===undefined)fail(name+' is empty.');
 if(first[0]==='"'&&first.includes('\t')){
  if(first[first.length-1]!=='"')return 'quoted-tab';
  const tsvHeader=parseDelimited(first,'\t',name)[0];
  if(tsvHeader?.fields.length>1)return 'tsv';
  return 'quoted-tab';
 }
 if(first.includes('\t'))return 'tsv';
 if(first.includes(','))return 'csv';
 fail(name+' format is not recognized. Expected quoted-tab, TSV, or CSV records.');
}
function validateHeaders(rows,descriptor,name){
 const first=rows[0];if(!first)fail(name+' has no header row.');
 const headers=first.fields;
 const seen=new Set(),duplicates=[];
 for(const header of headers){if(seen.has(header))duplicates.push(header);seen.add(header);}
 if(duplicates.length)fail(name+' line '+first.line+': duplicate header(s): '+duplicates.join(', ')+'.');
 const missing=descriptor.headers.filter(header=>!seen.has(header)),unexpected=headers.filter(header=>!descriptor.headers.includes(header));
 if(missing.length||unexpected.length){
  const detail=[];if(missing.length)detail.push('missing required headers '+missing.join(', '));if(unexpected.length)detail.push('unexpected headers '+unexpected.join(', '));
  fail(name+' line '+first.line+': '+detail.join('; ')+'. Header compatibility is exact and case-sensitive.');
 }
 return headers.map((header,index)=>({header,index}));
}
function parseDataset(input,name){
 const descriptor=SOURCES[name];if(!descriptor)fail('unknown dataset '+String(name)+'.');
 const bytes=asBytes(input,name);
 if(bytes.byteLength>MAX_FILE_BYTES)fail(name+' exceeds the '+MAX_FILE_BYTES+' byte safety limit.');
 const text=decodeUtf8(bytes,name),format=detectFormat(text,name);
 const rows=format==='quoted-tab'?parseWrappedTab(text,name):parseDelimited(text,format==='tsv'?'\t':',',name);
 if(!rows.length)fail(name+' has no records.');
 if(rows.length-1>MAX_ROWS)fail(name+' exceeds the '+MAX_ROWS+' row safety limit.');
 const columns=validateHeaders(rows,descriptor,name),records=[],duplicates=[],seen=new Set();
 for(const row of rows.slice(1)){
  if(row.fields.length!==columns.length)fail(name+' line '+row.line+': expected '+columns.length+' fields but found '+row.fields.length+'.');
  const record={};for(const {header,index} of columns)record[header]=row.fields[index];
  for(const header of descriptor.headers){
   if(header==='CHARACTER_MAXIMUM_LENGTH')continue;
   if(typeof record[header]!=='string'||!record[header].trim())fail(name+' line '+row.line+' field '+header+': required value is empty.');
  }
  const signature=JSON.stringify(descriptor.headers.map(header=>record[header]));
  if(seen.has(signature)){duplicates.push({line:row.line,record});continue;}
  seen.add(signature);records.push({row:record,sourceRow:row.line});
  if(records.length>MAX_ROWS)fail(name+' exceeds the '+MAX_ROWS+' row safety limit.');
 }
 return {dataset:name,label:descriptor.label,format,sha256:null,recordCount:records.length,
  duplicateCount:duplicates.length,duplicates,records,headers:columns.map(column=>column.header)};
}
async function sha256(bytes){
 const cryptoApi=global.crypto;if(!cryptoApi?.subtle)fail('WebCrypto SHA-256 is unavailable.');
 const digest=await cryptoApi.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function parseSource(value,name,provenance={}){
 const bytes=asBytes(value,name),parsed=parseDataset(bytes,name);
 parsed.sha256=await sha256(bytes);
 parsed.provenance={sourceType:'sql-server-export',sourceIdentity:provenance.sourceIdentity||null,
  originalFilename:provenance.originalFilename||null,path:provenance.path||null,
  importedAt:provenance.importedAt||new Date().toISOString(),
  environment:provenance.environment||'UNKNOWN',extractedAt:provenance.extractedAt||null,
  sourceRevision:provenance.sourceRevision||null,format:parsed.format,sha256:parsed.sha256,
  validationStatus:parsed.duplicateCount?'PARTIAL':'VALIDATED'};
 return parsed;
}

function splitIdentifier(value){
 const text=String(value),parts=[];let token='',bracket=false,quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(bracket){if(ch===']'&&text[i+1]===']'){token+=']';i++;}else if(ch===']')bracket=false;else token+=ch;continue;}
  if(quoted){if(ch==='"'&&text[i+1]==='"'){token+='"';i++;}else if(ch==='"')quoted=false;else token+=ch;continue;}
  if(ch==='['&&token.length===0){bracket=true;continue;}
  if(ch==='"'&&token.length===0){quoted=true;continue;}
  if(ch==='.'){if(!token.length)return null;parts.push(token);token='';continue;}
  token+=ch;
 }
 if(bracket||quoted||!token.length)return null;parts.push(token);return parts;
}
function quoteIdentifier(value){return '['+String(value).replace(/]/g,']]')+']';}
function tableId(schema,name){
 const needsQuoting=value=>!/^[$A-Z_a-z][$0-9A-Z_a-z#@]*$/.test(String(value));
 return (needsQuoting(schema)?quoteIdentifier(schema):String(schema))+'.'+(needsQuoting(name)?quoteIdentifier(name):String(name));
}
function evidenceId(dataset,sha,row){return 'SQL-EV-'+dataset+'-'+String(sha||'')+'-'+row;}
function evidenceRefs(datasets,dataset,rows){
 const sha=datasets?.[dataset]?.sha256;
 return sha?[...new Set(rows)].sort((a,b)=>a-b).map(row=>evidenceId(dataset,sha,row)):[];
}
function resolveTable(raw,tables,byName){
 const parts=splitIdentifier(raw);if(!parts||parts.length>2)return {status:'UNRESOLVED',table:null,candidates:[],reason:'Table reference is not a supported one- or two-part SQL identifier.'};
 if(parts.length===2){const id=tableId(parts[0],parts[1]),table=tables.get(id);return table?
  {status:table.status==='CONFLICTING'?'CONFLICTING':'VERIFIED',table,candidates:[id],
   reason:table.status==='CONFLICTING'?'Conflicting column metadata was exported for '+id+'.':null}:
  {status:'UNRESOLVED',table:null,candidates:[],reason:'No exact schema-qualified table matches '+raw+'.'};}
 const candidates=byName.get(parts[0])||[];
 if(candidates.length===1){const table=candidates[0];return {status:table.status==='CONFLICTING'?'CONFLICTING':'VERIFIED',table,candidates:[table.identity],
  reason:table.status==='CONFLICTING'?'Conflicting column metadata was exported for '+table.identity+'.':null};}
 if(candidates.length>1)return {status:'AMBIGUOUS',table:null,candidates:candidates.map(item=>item.identity).sort(),reason:'Unqualified table name matches more than one schema.'};
 return {status:'UNRESOLVED',table:null,candidates:[],reason:'No exact table name matches '+raw+'.'};
}
function aggregateRelationshipStatus(records){
 if(records.some(item=>item.status==='CONFLICTING'))return 'CONFLICTING';
 if(records.some(item=>item.status==='AMBIGUOUS'))return 'AMBIGUOUS';
 if(records.some(item=>item.status==='UNRESOLVED'))return 'UNRESOLVED';
 if(records.some(item=>item.status==='PARTIAL'))return 'PARTIAL';
 return records.length?'VERIFIED':'UNRESOLVED';
}
function buildModel(datasets){
 for(const name of Object.keys(SOURCES))if(!datasets?.[name]?.records)fail('all three parsed datasets are required to build the model; missing '+name+'.');
 const diagnostics=[],tables=new Map(),byName=new Map();
 const addDiagnostic=(severity,code,message,sourceRows=[])=>diagnostics.push({severity,code,message,sourceRows});
 for(const item of datasets.tables.records){
  const row=item.row,identity=tableId(row.TABLE_SCHEMA,row.TABLE_NAME);
  let table=tables.get(identity);
  if(!table){table={identity,schema:row.TABLE_SCHEMA,name:row.TABLE_NAME,columns:[],columnByName:new Map(),sourceRows:[]};tables.set(identity,table);
   if(!byName.has(table.name))byName.set(table.name,[]);byName.get(table.name).push(table);}
  table.sourceRows.push(item.sourceRow);
  let maxLength=null;if(row.CHARACTER_MAXIMUM_LENGTH!==''&&row.CHARACTER_MAXIMUM_LENGTH!=='NULL'){
   if(!/^-?\d+$/.test(row.CHARACTER_MAXIMUM_LENGTH))addDiagnostic('error','INVALID_CHARACTER_LENGTH','Invalid CHARACTER_MAXIMUM_LENGTH at table-schema row '+item.sourceRow+'.',[{dataset:'tables',row:item.sourceRow}]);
   else maxLength=Number(row.CHARACTER_MAXIMUM_LENGTH);
  }
  if(!['YES','NO'].includes(row.IS_NULLABLE))addDiagnostic('error','INVALID_NULLABILITY','IS_NULLABLE must be YES or NO at table-schema row '+item.sourceRow+'.',[{dataset:'tables',row:item.sourceRow}]);
  const column={schema:row.TABLE_SCHEMA,table:row.TABLE_NAME,name:row.COLUMN_NAME,dataType:row.DATA_TYPE,
   characterMaximumLength:maxLength,isNullable:row.IS_NULLABLE,sourceRow:item.sourceRow,sourceDataset:'tables',
   evidenceRefs:evidenceRefs(datasets,'tables',[item.sourceRow])};
  const prior=table.columnByName.get(column.name);
  if(prior){
   const same=prior.dataType===column.dataType&&prior.characterMaximumLength===column.characterMaximumLength&&prior.isNullable===column.isNullable;
   addDiagnostic(same?'warning':'error',same?'DUPLICATE_COLUMN':'CONFLICTING_COLUMN',
    (same?'Duplicate':'Conflicting')+' column metadata for '+identity+'.'+column.name+'.',[{dataset:'tables',row:prior.sourceRow},{dataset:'tables',row:item.sourceRow}]);
   if(!same)table.status='CONFLICTING';
   continue;
  }
  table.columns.push(column);table.columnByName.set(column.name,column);
 }
 for(const table of tables.values())table.columns.sort((a,b)=>a.name.localeCompare(b.name));
 const primaryKeys=[];
 const pkGroups=new Map();
 for(const item of datasets.primaryKeys.records){const row=item.row,key=row.TABLE_NAME;if(!pkGroups.has(key))pkGroups.set(key,[]);pkGroups.get(key).push(item);}
 for(const [rawTable,items] of [...pkGroups].sort(([a],[b])=>a.localeCompare(b))){
  const resolution=resolveTable(rawTable,tables,byName),columns=[...new Set(items.map(item=>item.row.PRIMARY_KEY_COLUMN))].sort();
  let status=resolution.status,missing=[],schemaRows=[];
  if(resolution.table){missing=columns.filter(name=>!resolution.table.columnByName.has(name));schemaRows=columns.filter(name=>resolution.table.columnByName.has(name)).map(name=>resolution.table.columnByName.get(name).sourceRow);if(missing.length||resolution.status==='CONFLICTING')status='CONFLICTING';else if(columns.length>1)status='PARTIAL';}
  const pk={identity:'PK:'+rawTable,tableReference:rawTable,table:resolution.table?.identity||null,candidates:resolution.candidates,
   columns:columns.map(name=>({name,sourceRows:items.filter(item=>item.row.PRIMARY_KEY_COLUMN===name).map(item=>item.sourceRow)})),
   columnOrderVerified:columns.length===1,status,reason:missing.length?'Primary-key column(s) are absent from the schema export: '+missing.join(', '):resolution.reason,
   sourceRows:items.map(item=>item.sourceRow),schemaRows,sourceDataset:'primaryKeys',
   evidenceRefs:[...evidenceRefs(datasets,'primaryKeys',items.map(item=>item.sourceRow)),...evidenceRefs(datasets,'tables',schemaRows)].sort()};
  if(items.length>columns.length)addDiagnostic('warning','DUPLICATE_PRIMARY_KEY_ROW','Duplicate primary-key rows were ignored for '+rawTable+'.',items.map(item=>({dataset:'primaryKeys',row:item.sourceRow})));
  if(columns.length>1)addDiagnostic('warning','PRIMARY_KEY_ORDER_UNKNOWN','Primary-key export has no key ordinals for '+rawTable+'.',items.map(item=>({dataset:'primaryKeys',row:item.sourceRow})));
  if(missing.length)addDiagnostic('error','MISSING_PRIMARY_KEY_COLUMN',pk.reason,items.map(item=>({dataset:'primaryKeys',row:item.sourceRow})));
  if(status==='AMBIGUOUS')addDiagnostic('warning','AMBIGUOUS_PRIMARY_KEY_TABLE',pk.reason,items.map(item=>({dataset:'primaryKeys',row:item.sourceRow})));
  if(status==='UNRESOLVED')addDiagnostic('warning','UNRESOLVED_PRIMARY_KEY_TABLE',pk.reason,items.map(item=>({dataset:'primaryKeys',row:item.sourceRow})));
  primaryKeys.push(pk);
 }
 const fkGroups=new Map();
 for(const item of datasets.foreignKeys.records){
  const row=item.row,parent=resolveTable(row.ParentTable,tables,byName),parentIdentity=parent.table?.identity||
   (parent.status==='AMBIGUOUS'?'AMBIGUOUS:'+parent.candidates.join('|'):'UNRESOLVED:'+row.ParentTable),
   key=JSON.stringify([row.ForeignKeyName,parentIdentity]);
  if(!fkGroups.has(key))fkGroups.set(key,[]);fkGroups.get(key).push(item);
 }
 const foreignKeys=[];
 for(const items of fkGroups.values()){
  const first=items[0].row,parentReferences=[...new Set(items.map(item=>item.row.ParentTable))].sort(),
   parentResolution=resolveTable(first.ParentTable,tables,byName),targets=[...new Set(items.map(item=>item.row.ReferencedTable))].sort(),
   targetResolutions=targets.map(target=>resolveTable(target,tables,byName)),
   targetIdentities=new Set(targetResolutions.map((target,index)=>target.table?.identity||
    (target.status==='AMBIGUOUS'?'AMBIGUOUS:'+target.candidates.join('|'):'UNRESOLVED:'+targets[index]))),
   pairs=[...new Map(items.map(item=>{const target=resolveTable(item.row.ReferencedTable,tables,byName),
    identity=target.table?.identity||(target.status==='AMBIGUOUS'?'AMBIGUOUS:'+target.candidates.join('|'):'UNRESOLVED:'+item.row.ReferencedTable);
    return [JSON.stringify([item.row.ParentColumn,identity,item.row.ReferencedColumn]),item];})).values()]
   .sort((a,b)=>a.row.ParentColumn.localeCompare(b.row.ParentColumn)||a.row.ReferencedTable.localeCompare(b.row.ReferencedTable)||a.row.ReferencedColumn.localeCompare(b.row.ReferencedColumn));
  const duplicateCount=items.length-pairs.length;
  let status='VERIFIED',reason=null;
  if(targetIdentities.size>1){status='CONFLICTING';reason='The same FK name and parent table refer to multiple target tables.';}
  else if(parentResolution.status!=='VERIFIED'){status=parentResolution.status;reason='Parent table: '+parentResolution.reason;}
  else if(targetResolutions.some(target=>target.status!=='VERIFIED')){status=targetResolutions.some(target=>target.status==='AMBIGUOUS')?'AMBIGUOUS':'UNRESOLVED';
   reason='Referenced table: '+targetResolutions.find(target=>target.status!=='VERIFIED').reason;}
  const missing=[];
  for(const pair of pairs){if(parentResolution.table&&!parentResolution.table.columnByName.has(pair.row.ParentColumn))missing.push('parent '+pair.row.ParentColumn);
   const target=resolveTable(pair.row.ReferencedTable,tables,byName).table;if(target&&!target.columnByName.has(pair.row.ReferencedColumn))missing.push('referenced '+pair.row.ReferencedColumn);}
  if(missing.length){status='CONFLICTING';reason='FK column(s) are absent from the schema export: '+[...new Set(missing)].join(', ')+'.';}
  if(status==='VERIFIED'&&pairs.length>1){status='PARTIAL';reason='Composite FK membership is present but the export has no FK column ordinals.';}
  const schemaRows=[];
  for(const pair of pairs){const parentColumn=parentResolution.table?.columnByName.get(pair.row.ParentColumn),
   targetColumn=resolveTable(pair.row.ReferencedTable,tables,byName).table?.columnByName.get(pair.row.ReferencedColumn);
   if(parentColumn)schemaRows.push(parentColumn.sourceRow);if(targetColumn)schemaRows.push(targetColumn.sourceRow);}
  const fk={identity:'FK:'+first.ForeignKeyName+':'+(parentResolution.table?.identity||first.ParentTable),constraintName:first.ForeignKeyName,
   parentReference:first.ParentTable,parentReferences,parentTable:parentResolution.table?.identity||null,parentCandidates:parentResolution.candidates,
   referencedReference:targets[0],referencedReferences:targets,referencedTable:targetResolutions[0]?.table?.identity||null,
   referencedCandidates:targetResolutions[0]?.candidates||[],columnPairs:pairs.map(item=>({parentColumn:item.row.ParentColumn,
    referencedColumn:item.row.ReferencedColumn,ordinal:pairs.length===1?1:null,sourceRow:item.sourceRow})),
   columnOrderVerified:pairs.length===1,status,reason,sourceRows:items.map(item=>item.sourceRow),schemaRows:[...new Set(schemaRows)].sort((a,b)=>a-b),sourceDataset:'foreignKeys',
   evidenceRefs:[...evidenceRefs(datasets,'foreignKeys',items.map(item=>item.sourceRow)),...evidenceRefs(datasets,'tables',schemaRows)].sort(),
   referencedKeyUniqueness:'UNVERIFIED',referencedUniqueConstraintMetadataAvailable:false};
  if(parentResolution.table&&targetResolutions[0]?.table&&!missing.length){
   const targetColumns=new Set(fk.columnPairs.map(pair=>pair.referencedColumn));
   const pk=primaryKeys.find(key=>key.table===targetResolutions[0].table.identity&&key.status!=='CONFLICTING'&&key.columns.length===targetColumns.size&&key.columns.every(column=>targetColumns.has(column.name)));
   if(pk){fk.referencedKeyUniqueness='PRIMARY_KEY';fk.referencedUniqueConstraintMetadataAvailable=true;}
  }
  if(duplicateCount)addDiagnostic('warning','DUPLICATE_FOREIGN_KEY_ROW','Duplicate FK column rows were ignored for '+fk.identity+'.',items.map(item=>({dataset:'foreignKeys',row:item.sourceRow})));
  if(pairs.length>1)addDiagnostic('warning','FOREIGN_KEY_ORDER_UNKNOWN','Composite FK column order is unknown for '+fk.identity+'.',items.map(item=>({dataset:'foreignKeys',row:item.sourceRow})));
  if(status==='CONFLICTING')addDiagnostic('error','CONFLICTING_FOREIGN_KEY',reason,items.map(item=>({dataset:'foreignKeys',row:item.sourceRow})));
  if(status==='AMBIGUOUS')addDiagnostic('warning','AMBIGUOUS_FOREIGN_KEY_TABLE',reason,items.map(item=>({dataset:'foreignKeys',row:item.sourceRow})));
  if(status==='UNRESOLVED')addDiagnostic('warning','UNRESOLVED_FOREIGN_KEY_TABLE',reason,items.map(item=>({dataset:'foreignKeys',row:item.sourceRow})));
  foreignKeys.push(fk);
 }
 foreignKeys.sort((a,b)=>a.identity.localeCompare(b.identity));
 const incoming=new Map(),outgoing=new Map();
 for(const fk of foreignKeys){if(fk.parentTable){if(!outgoing.has(fk.parentTable))outgoing.set(fk.parentTable,[]);outgoing.get(fk.parentTable).push(fk);}
  if(fk.referencedTable){if(!incoming.has(fk.referencedTable))incoming.set(fk.referencedTable,[]);incoming.get(fk.referencedTable).push(fk);}}
 const result={schema:SCHEMA,schemaVersion:1,comparisonPolicy:'Exact, case-sensitive identifier equality; no database collation was supplied.',
  sources:Object.keys(SOURCES).map(dataset=>{const parsed=datasets[dataset],p=parsed.provenance||{};return {
   dataset,sourceType:'sql-server-export',sourceIdentity:p.sourceIdentity||p.path||p.originalFilename||null,path:p.path||null,
   originalFilename:p.originalFilename||null,sha256:parsed.sha256||null,format:parsed.format||null,
   validationStatus:parsed.duplicateCount?'PARTIAL':'VALIDATED',recordCount:parsed.recordCount,duplicateCount:parsed.duplicateCount,
   environment:p.environment||'UNKNOWN',extractedAt:p.extractedAt||null,sourceRevision:p.sourceRevision||null
  };}),
  tables:[...tables.values()].sort((a,b)=>a.identity.localeCompare(b.identity)).map(table=>{const {columnByName,...plain}=table;return {...plain,sourceRows:table.sourceRows.sort((a,b)=>a-b),evidenceRefs:evidenceRefs(datasets,'tables',table.sourceRows)};}),
  primaryKeys,foreignKeys,diagnostics:diagnostics.sort((a,b)=>a.code.localeCompare(b.code)||a.message.localeCompare(b.message)),
  counts:{tables:tables.size,columns:[...tables.values()].reduce((sum,table)=>sum+table.columns.length,0),
   primaryKeys:primaryKeys.length,verifiedPrimaryKeys:primaryKeys.filter(item=>item.status==='VERIFIED').length,
   partialPrimaryKeys:primaryKeys.filter(item=>item.status==='PARTIAL').length,foreignKeys:foreignKeys.length,verifiedForeignKeys:foreignKeys.filter(item=>item.status==='VERIFIED').length,
   partialForeignKeys:foreignKeys.filter(item=>item.status==='PARTIAL').length,ambiguousForeignKeys:foreignKeys.filter(item=>item.status==='AMBIGUOUS').length,
   unresolvedForeignKeys:foreignKeys.filter(item=>item.status==='UNRESOLVED').length,conflictingForeignKeys:foreignKeys.filter(item=>item.status==='CONFLICTING').length,
   ambiguousPrimaryKeys:primaryKeys.filter(item=>item.status==='AMBIGUOUS').length,unresolvedPrimaryKeys:primaryKeys.filter(item=>item.status==='UNRESOLVED').length,
   conflictingPrimaryKeys:primaryKeys.filter(item=>item.status==='CONFLICTING').length,
   compositePrimaryKeyCandidates:primaryKeys.filter(item=>item.columns.length>1).length,
   compositeForeignKeyCandidates:foreignKeys.filter(item=>item.columnPairs.length>1).length,
   duplicateForeignKeyRows:datasets.foreignKeys.duplicateCount,duplicatePrimaryKeyRows:datasets.primaryKeys.duplicateCount,
   duplicateTableSchemaRows:datasets.tables.duplicateCount}};
 return result;
}
function indexModel(model){
 if(!model||model.schema!==SCHEMA||model.schemaVersion!==1)fail('unsupported relational model.');
 const tables=new Map(model.tables.map(table=>[table.identity,table])),byName=new Map();
 for(const table of model.tables){if(!byName.has(table.name))byName.set(table.name,[]);byName.get(table.name).push(table);}
 return {tables,byName};
}
function findTable(model,name){
 const {tables,byName}=indexModel(model),parts=splitIdentifier(name);
 if(!parts||parts.length>2)return {status:'UNRESOLVED',query:name,candidates:[],table:null,reason:'Table lookup needs a one- or two-part identifier.'};
 if(parts.length===2){const found=tables.get(tableId(parts[0],parts[1]));return found?
  {status:found.status==='CONFLICTING'?'CONFLICTING':'VERIFIED',query:name,candidates:[found.identity],table:found,
   reason:found.status==='CONFLICTING'?'Conflicting column metadata was exported for '+found.identity+'.':null}:
  {status:'UNRESOLVED',query:name,candidates:[],table:null,reason:'No exact table identity matches.'};}
 const matches=byName.get(parts[0])||[];
 if(matches.length===1)return {status:matches[0].status==='CONFLICTING'?'CONFLICTING':'VERIFIED',query:name,candidates:[matches[0].identity],table:matches[0],
  reason:matches[0].status==='CONFLICTING'?'Conflicting column metadata was exported for '+matches[0].identity+'.':null};
 if(matches.length>1)return {status:'AMBIGUOUS',query:name,candidates:matches.map(table=>table.identity).sort(),table:null,reason:'Unqualified name is present in multiple schemas.'};
 return {status:'UNRESOLVED',query:name,candidates:[],table:null,reason:'No table with this exact name was exported.'};
}
function listColumns(model,name){
 const result=findTable(model,name);return {...result,columns:result.table?result.table.columns:[]};
}
function findPrimaryKey(model,name){
 const table=findTable(model,name);if(!table.table)return {...table,primaryKeys:[]};
 const primaryKeys=model.primaryKeys.filter(key=>key.table===table.table.identity);
 return {status:table.status==='CONFLICTING'?'CONFLICTING':aggregateRelationshipStatus(primaryKeys),
  table:table.table.identity,primaryKeys,reason:primaryKeys[0]?.reason||(!primaryKeys.length?'No primary-key metadata was exported for this table.':null)};
}
function outgoingForeignKeys(model,name){
 const table=findTable(model,name);if(!table.table)return {...table,foreignKeys:[]};
 const foreignKeys=model.foreignKeys.filter(key=>key.parentTable===table.table.identity);
 return {status:table.status==='CONFLICTING'?'CONFLICTING':aggregateRelationshipStatus(foreignKeys),table:table.table.identity,foreignKeys,
  reason:foreignKeys.length?null:'No outgoing FK rows were exported; this does not prove that no database relationship exists.'};
}
function incomingForeignKeys(model,name){
 const table=findTable(model,name);if(!table.table)return {...table,foreignKeys:[]};
 const foreignKeys=model.foreignKeys.filter(key=>key.referencedTable===table.table.identity);
 return {status:table.status==='CONFLICTING'?'CONFLICTING':aggregateRelationshipStatus(foreignKeys),table:table.table.identity,foreignKeys,
  reason:foreignKeys.length?null:'No incoming FK rows were exported; this does not prove that no database relationship exists.'};
}
function resolveForeignKey(model,name){
 const foreignKeys=model.foreignKeys.filter(key=>key.constraintName===name);
 if(foreignKeys.length===1)return {status:foreignKeys[0].status,foreignKeys,candidates:foreignKeys.map(key=>key.identity)};
 if(foreignKeys.length>1)return {status:'AMBIGUOUS',foreignKeys,candidates:foreignKeys.map(key=>key.identity).sort(),reason:'Constraint name is repeated across parent tables.'};
 return {status:'UNRESOLVED',foreignKeys:[],candidates:[],reason:'No FK constraint with this exact name was exported.'};
}
function relationshipsBetween(model,from,to){
 const source=findTable(model,from),target=findTable(model,to);
 if(!source.table||!target.table)return {status:source.status!=='VERIFIED'?source.status:target.status,relationships:[],source,target};
 const relationships=model.foreignKeys.filter(key=>key.parentTable===source.table.identity&&key.referencedTable===target.table.identity||
  key.parentTable===target.table.identity&&key.referencedTable===source.table.identity);
 return {status:source.status==='CONFLICTING'||target.status==='CONFLICTING'?'CONFLICTING':relationships.length?aggregateRelationshipStatus(relationships):'UNRESOLVED',
  relationships,source,target,reason:relationships.length?null:'No relationship rows were exported; absence is not evidence that no relationship exists.'};
}
function unresolvedReferences(model){
 return [...model.primaryKeys.filter(item=>['UNRESOLVED','AMBIGUOUS','CONFLICTING'].includes(item.status)),
  ...model.foreignKeys.filter(item=>['UNRESOLVED','AMBIGUOUS','CONFLICTING'].includes(item.status))];
}
function toPhase01(extension,analysis){
 if(!extension||!analysis||analysis.schema!==SCHEMA||analysis.schemaVersion!==1)fail('a Phase 01 extension and validated SQL analysis are required.');
 const contracts=global.PBIPhase01Contracts;if(!contracts)fail('Phase 01 contracts must be loaded before SQL evidence can be linked.');
 contracts.validateAnalysisExtension(extension);
 const sources=Object.keys(SOURCES).map((dataset,index)=>{
  const parsed=analysis.datasets[dataset],provenance=parsed.provenance||{},sha=parsed.sha256;
  if(!/^[a-f0-9]{64}$/.test(sha||''))fail(dataset+' source has no SHA-256 digest.');
  const path=provenance.path||provenance.originalFilename||dataset+'.csv';
  const filename=String(provenance.originalFilename||path.split(/[\\/]/).pop()||dataset+'.csv');
  if(!filename||filename==='.'||filename==='..'||/[\\/:<>:"|?*\x00-\x1f]/.test(filename)||/[. ]$/.test(filename))fail(dataset+' original filename is not a safe relative artifact name.');
  const sourceRootId='sql-'+dataset+'-'+sha,sourceRevision='sha256:'+sha,
   root={rootId:sourceRootId,repositoryKey:'sql-reference',revision:sourceRevision,sha256:sha};
  return {dataset,parsed,provenance,filename,sourceRootId,sourceRevision,root,index};
 });
 const roots=[...extension.sourceRoots],evidence=[...extension.evidence],relationships=[...extension.sqlRelationships],
  evidenceBySourceRow=new Map(),rootByDataset=new Map(sources.map(source=>[source.dataset,source]));
 const previousSources=new Map((extension.sqlMetadata?.sources||[]).map(source=>[source.dataset,source]));
 for(const item of evidence)if(item.datasetType&&previousSources.has(item.datasetType)){
  const prior=previousSources.get(item.datasetType),current=rootByDataset.get(item.datasetType);
  if(prior.sha256!==current.parsed.sha256||prior.sourceIdentity!==(current.provenance.sourceIdentity||current.provenance.path||current.filename))item.verificationStatus='STALE';
 }
 const ensureRoot=source=>{if(!roots.some(root=>root.rootId===source.sourceRootId))roots.push(source.root);};
 const evidenceFor=(source,row,symbol)=>{
  ensureRoot(source);const key=source.dataset+':'+row;if(evidenceBySourceRow.has(key))return evidenceBySourceRow.get(key);
  const id=evidenceId(source.dataset,source.parsed.sha256,row);
  const p=source.provenance,limited=[];
  if(!p.environment||p.environment==='UNKNOWN')limited.push('Source environment is unknown.');
  if(!p.extractedAt)limited.push('Export extraction time is unknown.');
  if(!p.sourceRevision)limited.push('Database/export revision is unknown; the SHA-256 identifies only these bytes.');
  limited.push('This is exported schema metadata, not proof of live database contents or application behavior.');
  const record={schema:contracts.SCHEMAS.evidence,schemaVersion:1,evidenceId:id,requirementId:'SQL-SCHEMA',
   acceptanceCriterionId:'SQL-SCHEMA',repositoryKey:'sql-reference',sourceRootId:source.sourceRootId,
   relativePath:source.filename,sourceRevision:source.sourceRevision,sha256:source.parsed.sha256,
   symbol:String(symbol||'SQL metadata row '+row),category:'static-schema',verificationMethod:'strict local SQL export parser',
   description:'Parsed '+source.dataset+' metadata from source row '+row+'.',
   executionContext:'Read-only local export; no SQL Server connection was made.',limitations:limited,
   verificationStatus:'VERIFIED',lineStart:row,lineEnd:row,sourceIdentity:p.sourceIdentity||p.path||source.filename,
   datasetType:source.dataset,sourceRow:row,sourceFormat:source.parsed.format,sourceEnvironment:p.environment||'UNKNOWN',
   extractedAt:p.extractedAt||null,sourceRevisionMetadata:p.sourceRevision||null};
  evidenceBySourceRow.set(key,id);const oldIndex=evidence.findIndex(item=>item.evidenceId===id);
  if(oldIndex<0)evidence.push(record);else evidence[oldIndex]=record;return id;
 };
 const evidenceRefs=(source,rows,symbol)=>[...new Set(rows.map(row=>evidenceFor(source,row,symbol)))].sort();
 const relationId=(source,prefix,index)=>prefix+'-'+source.parsed.sha256+'-'+(index+1);
 const makeQuestion=(source,prefix,index)=>'SQL-Q-'+prefix+'-'+source.parsed.sha256+'-'+(index+1);
 const tableParts=(raw,resolved)=>{
  const parts=splitIdentifier(resolved||raw)||[String(resolved||raw)];
  return {schema:parts.length===2?parts[0]:null,name:parts[parts.length-1]};
 };
 const base=(source,kind,index,rawTable,validationStatus,reason,refs)=>{
  const unresolved=['AMBIGUOUS','UNRESOLVED','CONFLICTING'].includes(validationStatus),question=unresolved?makeQuestion(source,kind,index):null;
  const table=tableParts(rawTable,null);
  return {schema:contracts.SCHEMAS.sqlRelationship,schemaVersion:1,relationshipId:relationId(source,kind,index),
   artifactId:'SQL-'+source.dataset+'-'+source.parsed.sha256,artifactSha256:source.parsed.sha256,
   sourceRootId:source.sourceRootId,relativePath:source.filename,environment:source.provenance.environment||'UNKNOWN',
   sourceRevision:source.sourceRevision,kind,table,primaryKeyColumns:[],foreignKey:null,validationStatus,
   unresolvedSchemaQualification:!rawTable.includes('.')&&validationStatus!=='VERIFIED',blocking:unresolved,
   conflictingEvidenceRefs:validationStatus==='CONFLICTING'?refs:[],evidenceRefs:refs,
   unresolvedQuestions:question?[question]:[],sqlImportDataset:source.dataset,rawTableReference:rawTable,
   validationReason:reason||null,columnOrderVerified:true,
   environmentProvenance:source.provenance.environment?'USER_PROVIDED':'UNKNOWN'};
 };
 const nextRelationships=relationships.filter(row=>!row.sqlImportDataset);
 for(const [index,pk]of analysis.model.primaryKeys.entries()){
  const source=rootByDataset.get('primaryKeys'),status=pk.status,
   refs=evidenceRefs(source,pk.sourceRows,pk.table||pk.tableReference).concat(evidenceRefs(rootByDataset.get('tables'),pk.schemaRows,pk.table||pk.tableReference)).filter((id,i,all)=>all.indexOf(id)===i).sort(),
   row=base(source,'primary-key',index,pk.tableReference,status,pk.reason,refs);
  row.relationshipId=relationId(source,'SQL-PK',index);row.kind='primary-key';
  row.table=tableParts(pk.tableReference,pk.table);
  row.primaryKeyColumns=pk.columns.map(column=>column.name);row.columnOrderVerified=pk.columnOrderVerified;
  row.sourceRows=pk.sourceRows;row.schemaSourceRows=pk.schemaRows;row.candidateTables=pk.candidates;
  if(status==='CONFLICTING')row.conflictingEvidenceRefs=refs;
  nextRelationships.push(row);
 }
 for(const [index,fk]of analysis.model.foreignKeys.entries()){
  const source=rootByDataset.get('foreignKeys'),status=fk.status,
   refs=evidenceRefs(source,fk.sourceRows,fk.identity).concat(evidenceRefs(rootByDataset.get('tables'),fk.schemaRows,fk.identity)).filter((id,i,all)=>all.indexOf(id)===i).sort(),
   row=base(source,'foreign-key',index,fk.parentReference,status,fk.reason,refs);
  row.relationshipId=relationId(source,'SQL-FK',index);row.kind='foreign-key';
  row.table=tableParts(fk.parentReference,fk.parentTable);
  row.unresolvedSchemaQualification=!fk.parentTable||!fk.referencedTable;
  const target=tableParts(fk.referencedReference,fk.referencedTable);
  row.foreignKey={constraintId:fk.constraintName,referencedTable:target,columns:fk.columnPairs.map(pair=>({
   ordinal:pair.ordinal,localColumn:pair.parentColumn,referencedColumn:pair.referencedColumn}))};
  row.columnOrderVerified=fk.columnOrderVerified;row.sourceRows=fk.sourceRows;row.schemaSourceRows=fk.schemaRows;
  row.candidateParentTables=fk.parentCandidates;row.candidateReferencedTables=fk.referencedCandidates;
  row.rawReferencedTable=fk.referencedReference;row.referencedKeyUniqueness=fk.referencedKeyUniqueness;
  if(status==='CONFLICTING')row.conflictingEvidenceRefs=refs;
  nextRelationships.push(row);
 }
 const nextSources=sources.map(source=>{const identity=source.provenance.sourceIdentity||source.provenance.path||source.filename,
  previous=previousSources.get(source.dataset),importedAt=previous&&previous.sha256===source.parsed.sha256&&previous.sourceIdentity===identity?
   previous.importedAt:source.provenance.importedAt||new Date().toISOString();
  return {dataset:source.dataset,sourceRootId:source.sourceRootId,
  sourceIdentity:identity,path:source.provenance.path||null,
  originalFilename:source.filename,sourceType:'sql-server-export',sha256:source.parsed.sha256,
  importedAt,environment:source.provenance.environment||'UNKNOWN',
  extractedAt:source.provenance.extractedAt||null,sourceRevision:source.provenance.sourceRevision||null,
  format:source.parsed.format,validationStatus:source.parsed.duplicateCount?'PARTIAL':'VALIDATED',
  recordCount:source.parsed.recordCount,duplicateCount:source.parsed.duplicateCount};});
 const next={...extension,sourceRoots:roots,evidence,sqlRelationships:nextRelationships,
  sqlMetadata:{schema:'akzo-pbi-sql-metadata',schemaVersion:1,sources:nextSources,
   modelCounts:analysis.counts,comparisonPolicy:analysis.model.comparisonPolicy}};
 const validated=contracts.validateAnalysisExtension(next);
 return validated;
}
function analyzeParsed(datasets){
 const model=buildModel(datasets);
 return {schema:SCHEMA,schemaVersion:1,datasets,model,diagnostics:model.diagnostics,counts:model.counts};
}
async function analyze(inputs,provenance={}){
 const parsed={};
 for(const name of Object.keys(SOURCES)){
  if(inputs?.[name]===undefined)fail('missing input for '+name+'.');
  parsed[name]=await parseSource(inputs[name],name,provenance[name]||{});
 }
 return analyzeParsed(parsed);
}
function createSourceRegistry(analysis){
 if(!analysis||analysis.schema!==SCHEMA||analysis.schemaVersion!==1)fail('a parsed SQL analysis is required to register source provenance.');
 const sources=Object.keys(SOURCES).map(dataset=>{
  const parsed=analysis.datasets[dataset],p=parsed.provenance||{};
  if(!parsed.sha256||!/^[a-f0-9]{64}$/.test(parsed.sha256))fail(dataset+' source has no SHA-256 digest.');
  return {dataset,sourceType:'sql-server-export',sourceIdentity:p.sourceIdentity||p.path||p.originalFilename||dataset+'.csv',
   path:p.path||null,originalFilename:p.originalFilename||p.path?.split(/[\\/]/).pop()||dataset+'.csv',
   sha256:parsed.sha256,importedAt:p.importedAt||new Date().toISOString(),
   environment:p.environment||'UNKNOWN',extractedAt:p.extractedAt||null,sourceRevision:p.sourceRevision||null,
   format:parsed.format,validationStatus:parsed.duplicateCount?'PARTIAL':'VALIDATED',
   recordCount:parsed.recordCount,duplicateCount:parsed.duplicateCount};
 });
 return validateSourceRegistry({schema:REGISTRY_SCHEMA,schemaVersion:1,sources});
}
function validateSourceRegistry(registry){
 if(!registry||typeof registry!=='object'||Array.isArray(registry)||registry.schema!==REGISTRY_SCHEMA||registry.schemaVersion!==1)fail('source registry must use '+REGISTRY_SCHEMA+' schemaVersion 1.');
 if(!Array.isArray(registry.sources)||registry.sources.length!==3)fail('source registry must include exactly three SQL datasets.');
 const seen=new Set();
 for(const source of registry.sources){
  if(!source||typeof source!=='object'||!Object.prototype.hasOwnProperty.call(SOURCES,source.dataset)||seen.has(source.dataset))fail('source registry dataset is unknown or duplicated.');
  seen.add(source.dataset);
  if(source.sourceType!=='sql-server-export'||typeof source.sourceIdentity!=='string'||!isAbsoluteSourcePath(source.sourceIdentity))fail('SQL source identity must be an absolute local path.');
  if(source.path!==null&&source.path!==undefined&&typeof source.path!=='string')fail(source.dataset+' source path must be a string or null.');
  if(source.path!==null&&source.path!==undefined&&!isAbsoluteSourcePath(source.path))fail(source.dataset+' source path must be absolute.');
  if(typeof source.originalFilename!=='string'||!source.originalFilename.trim()||!/^[a-f0-9]{64}$/.test(source.sha256||''))fail(source.dataset+' filename or SHA-256 is invalid.');
  if(typeof source.importedAt!=='string'||typeof source.environment!=='string'||!source.environment.trim())fail(source.dataset+' import provenance is incomplete.');
  if(source.extractedAt!==null&&source.extractedAt!==undefined&&typeof source.extractedAt!=='string')fail(source.dataset+' extraction time must be text or null.');
  if(source.sourceRevision!==null&&source.sourceRevision!==undefined&&typeof source.sourceRevision!=='string')fail(source.dataset+' source revision must be text or null.');
  if(!['quoted-tab','tsv','csv'].includes(source.format)||!['VALIDATED','PARTIAL','STALE','MISSING'].includes(source.validationStatus))fail(source.dataset+' format or validation status is unsupported.');
  if(!Number.isInteger(source.recordCount)||source.recordCount<0||!Number.isInteger(source.duplicateCount)||source.duplicateCount<0)fail(source.dataset+' record counts are invalid.');
 }
 return registry;
}
function checkFreshness(extension,registry){
 if(!extension?.sqlMetadata)return {status:'NOT_REGISTERED',stale:[]};
 validateSourceRegistry(registry);
 const imported=new Map(extension.sqlMetadata.sources.map(source=>[source.dataset,source])),current=new Map(registry.sources.map(source=>[source.dataset,source])),stale=[];
 for(const dataset of Object.keys(SOURCES)){
  const prior=imported.get(dataset),now=current.get(dataset);
  if(!prior||!now||prior.sourceIdentity!==now.sourceIdentity||prior.sha256!==now.sha256||
   ['STALE','MISSING'].includes(prior.validationStatus)||['STALE','MISSING'].includes(now.validationStatus)){
   stale.push({dataset,previousSha256:prior?.sha256||null,currentSha256:now?.sha256||null,
    previousIdentity:prior?.sourceIdentity||null,currentIdentity:now?.sourceIdentity||null,
    status:!now?'MISSING':now.validationStatus==='MISSING'?'MISSING':now.validationStatus==='STALE'?'STALE':'CHANGED'});
  }
 }
 return {status:stale.length?'STALE':'CURRENT',stale};
}
function checkAnalysisAgainstRegistry(analysis,registry){
 const expected=createSourceRegistry(analysis),current=validateSourceRegistry(registry),
  currentByDataset=new Map(current.sources.map(source=>[source.dataset,source])),stale=[];
 for(const source of expected.sources){
  const registered=currentByDataset.get(source.dataset);
  if(!registered||registered.sha256!==source.sha256||registered.sourceIdentity!==source.sourceIdentity||registered.validationStatus==='STALE'||registered.validationStatus==='MISSING'){
   stale.push({dataset:source.dataset,expectedSha256:source.sha256,currentSha256:registered?.sha256||null,
    expectedIdentity:source.sourceIdentity,currentIdentity:registered?.sourceIdentity||null});
  }
 }
 return {status:stale.length?'STALE':'CURRENT',stale};
}
const api={SCHEMA,SOURCES,MAX_FILE_BYTES,MAX_ROWS,parseDataset,parseSource,analyzeParsed,analyze,buildModel,toPhase01,
 findTable,listColumns,findPrimaryKey,outgoingForeignKeys,incomingForeignKeys,resolveForeignKey,relationshipsBetween,unresolvedReferences,sourceEvidence,
 REGISTRY_SCHEMA,createSourceRegistry,validateSourceRegistry,checkFreshness};
api.checkAnalysisAgainstRegistry=checkAnalysisAgainstRegistry;
 global.PBISqlMetadata=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
