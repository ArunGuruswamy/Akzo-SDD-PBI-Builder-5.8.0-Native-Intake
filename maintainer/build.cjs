'use strict';
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),P=require('./src/core.js');
const source=name=>fs.readFileSync(path.join(__dirname,'src',name),'utf8');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function loadReferenceLibrary(){
 const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'reference-fingerprints.json'),'utf8'));
 if(expected.schemaVersion!==1||!expected.files||Object.keys(expected.files).length!==6)throw Error('Reference fingerprints must list the six approved Phase 02/03 inputs.');
 const root=path.resolve(__dirname,'..','references'),files=[];
 for(const [relativePath,expectedSha256] of Object.entries(expected.files)){
  const file=path.resolve(root,relativePath);
  if(!file.startsWith(root+path.sep))throw Error('Unsafe reference input path: '+relativePath);
  if(!fs.existsSync(file))throw Error('Required reference input is missing: '+file);
  const bytes=fs.readFileSync(file),actual=sha256(bytes);
  if(actual!==expectedSha256)throw Error('Reference fingerprint mismatch for '+file+': expected '+expectedSha256+', found '+actual+'.');
  files.push({path:relativePath,content:bytes.toString('utf8'),sha256:actual,byteLength:bytes.length});
 }
 const graphqlEntry=require.resolve('graphql'),graphqlRoot=path.dirname(graphqlEntry),packageJson=JSON.parse(fs.readFileSync(path.join(graphqlRoot,'package.json'),'utf8'));
 if(packageJson.version!=='16.11.0'||packageJson.license!=='MIT')throw Error('GraphQL.js package version or license differs from the approved dependency.');
 const lock=JSON.parse(fs.readFileSync(path.join(__dirname,'package-lock.json'),'utf8')),lockEntry=lock.packages?.['node_modules/graphql'];
 if(lockEntry?.version!=='16.11.0'||lockEntry.license!=='MIT'||!lockEntry.integrity)throw Error('GraphQL.js lockfile provenance is incomplete.');
 const license=fs.readFileSync(path.join(graphqlRoot,'LICENSE'),'utf8');
 files.push({path:'graphql/GRAPHQL-JS-LICENSE.txt',content:license,sha256:sha256(Buffer.from(license,'utf8')),byteLength:Buffer.byteLength(license)});
 const manifest={schema:'akzo-pbi-reference-library',schemaVersion:1,packageVersion:P.VERSION,
  graphqlRuntime:{name:packageJson.name,version:packageJson.version,license:packageJson.license,integrity:lockEntry.integrity},
  artifacts:files.map(({path:artifactPath,sha256:hash,byteLength})=>({path:artifactPath,sha256:hash,byteLength,
   kind:artifactPath.startsWith('cdms/')?'sql-reference':artifactPath.endsWith('.graphql')?'graphql-schema':'license'}))};
 return {manifest,files};
}
function loadAssets(){
 const assets=JSON.parse(source('assets.json'));
 assets.createPbiIntake=JSON.parse(source('intake-contract-v1.json'));
 assets.referenceLibrary=loadReferenceLibrary();
 assets.installer=fs.readFileSync(path.join(__dirname,'installer','Install-PBIBuilder.ps1'),'utf8');
 return assets;
}
function packageRoot(){
 const entry=require.resolve('graphql'),root=path.dirname(entry);
 if(!fs.existsSync(path.join(root,'package.json')))throw Error('Could not locate the installed GraphQL.js package root.');
 return root;
}
function buildGraphqlBundle(){
 const root=packageRoot(),entry=require.resolve('graphql'),modules=new Map();
 function resolveModule(from,specifier){
  if(!specifier.startsWith('.'))throw Error('GraphQL.js bundle has an external dependency: '+specifier);
  const base=path.resolve(path.dirname(from),specifier),candidates=[base,base+'.js',base+'.json',path.join(base,'index.js')];
  const file=candidates.find(item=>fs.existsSync(item)&&fs.statSync(item).isFile());
  if(!file)throw Error('Cannot resolve GraphQL.js module '+specifier+' from '+from);
  return file;
 }
 function visit(file){
  file=path.resolve(file);if(modules.has(file))return;
  const original=fs.readFileSync(file,'utf8'),dependencies=[];
  for(const match of original.matchAll(/\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g))dependencies.push({specifier:match[2],file:resolveModule(file,match[2])});
  if(/\brequire\s*\(/.test(original.replace(/\brequire\s*\(\s*(['"])[^'"]+\1\s*\)/g,'')))throw Error('GraphQL.js bundle contains a dynamic require in '+file);
  modules.set(file,{original,dependencies});for(const dependency of dependencies)visit(dependency.file);
 }
 visit(entry);
 const moduleId=file=>path.relative(root,file).split(path.sep).join('/');
 const declarations=[];
 for(const [file,{original,dependencies}] of modules){
  const replacements=new Map(dependencies.map(item=>[item.specifier,moduleId(item.file)]));
  const compiled=original.replace(/\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g,(_match,_quote,specifier)=>{
   if(!replacements.has(specifier))throw Error('GraphQL.js dependency was not resolved: '+specifier);
   return '__require('+JSON.stringify(replacements.get(specifier))+')';
  });
  if(path.extname(file)==='.json')declarations.push(JSON.stringify(moduleId(file))+':function(module){module.exports='+compiled.trim().replace(/;?$/,';')+'}');
  else declarations.push(JSON.stringify(moduleId(file))+':function(module,exports,__require){\n'+compiled+'\n}');
 }
 const license=fs.readFileSync(path.join(root,'LICENSE'),'utf8').replace(/\*\//g,'* /');
 return '/* GraphQL.js 16.11.0 MIT License. Full license: playbook/pbi-builder/references/graphql/GRAPHQL-JS-LICENSE.txt. */\n'+
  '(function(global){\"use strict\";const modules={'+declarations.join(',\n')+'};const cache=Object.create(null);'+
  'function __require(id){if(cache[id])return cache[id].exports;const factory=modules[id];if(!factory)throw Error(\"Unknown GraphQL.js module: \"+id);'+
  'const module={exports:{}};cache[id]=module;factory(module,module.exports,__require);return module.exports;}'+
  'global.PBIGraphQL=__require('+JSON.stringify(moduleId(entry))+');})(globalThis);\n/*\n'+license+'\n*/';
}
function renderHtml(assets=loadAssets()){
 const encoded=JSON.stringify(assets).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
 const html=source('shell.html').replace('__ASSETS__',()=>encoded).replace('__CONTRACTS__',()=>source('phase01-contracts.js')).replace('__SQL__',()=>source('sql-metadata.js'))
  .replace('__GRAPHQL_RUNTIME__',()=>buildGraphqlBundle()).replace('__GRAPHQL__',()=>source('graphql-intelligence.js'))
  .replace('__REFINEMENT_QUALITY__',()=>source('refinement-quality.js')).replace('__CORE__',()=>source('core.js'))
  .replace('__PHASE06__',()=>source('phase06-handoff.js'))
  .replace('__UI__',()=>source('ui.js')).replace('__VISUALIZATION__',()=>source('visualization.js'));
 return html.replace(/\r\n/g,'\n');
}
function build(){
 const assets=loadAssets(),html=renderHtml(assets);
 fs.writeFileSync(path.join(__dirname,'Akzo-SDD-PBI-Builder.html'),html);
 console.log('Built standalone HTML ('+Buffer.byteLength(html)+' bytes; '+assets.referenceLibrary.files.length+' verified reference files).');
 return html;
}
if(require.main===module)build();
module.exports={build,renderHtml,loadAssets,loadReferenceLibrary,buildGraphqlBundle};