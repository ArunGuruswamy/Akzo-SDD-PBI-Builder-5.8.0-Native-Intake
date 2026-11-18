(function (global) {
'use strict';
const GRAPHQL=global.PBIGraphQL||(typeof module!=='undefined'&&typeof require==='function'?require('graphql'):null);
if(!GRAPHQL)throw Error('The offline GraphQL.js runtime must load before GraphQL intelligence.');

function fail(message){throw Error('GraphQL intelligence: '+message);}
function text(value,name){if(typeof value!=='string'||!value.trim())fail(name+' must be a non-empty string.');return value;}
function parseSchema(schemaArtifactId,source){
 text(schemaArtifactId,'schemaArtifactId');text(source,'schema source');
 let schema;
 try{schema=GRAPHQL.buildSchema(source);}catch(error){if(!(error instanceof Error))throw error;return {schemaArtifactId,status:'INVALID',errors:[error.message],typeCount:0};}
 const errors=GRAPHQL.validateSchema(schema).map(error=>error.message);
 return {schemaArtifactId,status:errors.length?'INVALID':'VALIDATED',errors,typeCount:Object.keys(schema.getTypeMap()).length,
  queryType:schema.getQueryType()?.name||null,mutationType:schema.getMutationType()?.name||null,subscriptionType:schema.getSubscriptionType()?.name||null};
}
function validateSchemas(entries){
 if(!Array.isArray(entries)||!entries.length)fail('at least one named schema source is required.');
 const seen=new Set(),schemas=new Map(),results=[];
 for(const entry of entries){
  if(!entry||typeof entry!=='object')fail('each schema source must be an object.');
  const schemaArtifactId=text(entry.schemaArtifactId,'schemaArtifactId');
  if(seen.has(schemaArtifactId))fail('duplicate schema artifact '+schemaArtifactId+'.');
  seen.add(schemaArtifactId);
  const result=parseSchema(schemaArtifactId,entry.source);results.push(result);
  if(result.status==='VALIDATED')schemas.set(schemaArtifactId,GRAPHQL.buildSchema(entry.source));
 }
 return {schemas,results};
}
function validateOperation({schemaArtifactId,operationName,source},schemas){
 text(schemaArtifactId,'schemaArtifactId');text(operationName,'operationName');text(source,'operation source');
 if(!(schemas instanceof Map)||!schemas.has(schemaArtifactId))return {status:'UNRESOLVED',schemaArtifactId,operationName,
  errors:['The operation must be explicitly assigned to a validated schema artifact.']};
 let document;
 try{document=GRAPHQL.parse(source);}catch(error){if(!(error instanceof Error))throw error;return {status:'INVALID',schemaArtifactId,operationName,errors:[error.message]};}
 const operations=document.definitions.filter(item=>item.kind===GRAPHQL.Kind.OPERATION_DEFINITION);
 if(!operations.some(item=>item.name?.value===operationName))return {status:'UNRESOLVED',schemaArtifactId,operationName,
  errors:['No operation named '+operationName+' exists in the supplied document.']};
 const errors=GRAPHQL.validate(schemas.get(schemaArtifactId),document).map(error=>error.message);
 return {status:errors.length?'INVALID':'VALIDATED',schemaArtifactId,operationName,operationType:
  operations.find(item=>item.name?.value===operationName).operation,errors};
}
function selectedFieldPaths(source,operationName){
 text(operationName,'operationName');const document=GRAPHQL.parse(text(source,'operation source'));
 const operation=document.definitions.find(item=>item.kind===GRAPHQL.Kind.OPERATION_DEFINITION&&item.name?.value===operationName);
 if(!operation)fail('operation '+operationName+' was not found.');
 const paths=[];
 function visit(selectionSet,prefix){
  for(const selection of selectionSet.selections){
   if(selection.kind!==GRAPHQL.Kind.FIELD)continue;
   const path=[...prefix,selection.name.value];paths.push(path.join('.'));
   if(selection.selectionSet)visit(selection.selectionSet,path);
  }
 }
 visit(operation.selectionSet,[]);
 return [...new Set(paths)].sort();
}

const api={parseSchema,validateSchemas,validateOperation,selectedFieldPaths};
global.PBIGraphqlIntelligence=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
