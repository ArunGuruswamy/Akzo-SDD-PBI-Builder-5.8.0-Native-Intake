'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const P=require('./src/core.js');
const assets=require('./test-assets.cjs');
const contract=assets.createPbiIntake;
const config=P.normalizeConfig({projectName:'Intake contract fixture',ide:'both',role:'other'});
const files=P.setupFiles(config,assets,'<html></html>').files;
const intake=files[P.BASE+'/skills/stage-intake.md'];
const generated=files[P.BASE+'/create-pbi-intake-contract-v1.json'];
const agent=files[P.AGENT],vscode=files[P.AGENT_VSCODE];

test('INTAKE_CONTRACT_LOCK: versioned contract puts PBI number first and preserves exact order',()=>{
 assert.equal(contract.id,'AKZO-PBI-CREATE-INTAKE');
 assert.equal(contract.schemaVersion,1);
 assert.deepEqual(contract.stages.map(s=>s.id),['PBI_NUMBER','TITLE','DESCRIPTION','ACCEPTANCE_CRITERIA','ATTACHMENTS','REVIEW','CONFIRMED']);
 assert.equal(contract.stages[0].question,'Enter PBI number or choose Not assigned yet.');
 assert.equal(contract.stages[5].approval,true);
 assert.equal(contract.confirmation,'Confirm and start analysis');
 assert.deepEqual(JSON.parse(generated),contract);
 assert.match(intake,/exactly: "Enter PBI number or choose Not assigned yet\."/);
});

test('INTAKE_CONTRACT_LOCK: only missing fields are asked; labeled multi-field input and resume preserve answers',()=>{
 assert.equal(contract.policy.captureLabeledFieldsTogether,true);
 assert.equal(contract.policy.repeatCompletedQuestions,false);
 assert.match(intake,/If the user supplies multiple\s+clearly labeled fields, validate and save each valid field and ask only the\s+earliest missing field/);
 assert.match(intake,/Resume only\s+the session id explicitly supplied or recovered from the current conversation/);
 assert.match(intake,/never select the latest unrelated draft/);
 assert.match(intake,/preserves all other answers/);
});

test('INTAKE_CONTRACT_LOCK: empty, cancellation and unavailable outcomes retain stage and wait',()=>{
 for(const outcome of contract.outcomes)assert.ok(['SUPPORTED','UNAVAILABLE','USER_UNAVAILABLE','CANCELLED','EMPTY_RESPONSE','VALID_RESPONSE','ERROR'].includes(outcome));
 assert.equal(contract.waitingState,'WAITING_FOR_USER_INPUT');
 assert.equal(contract.policy.autoRetryUnavailableQuestion,false);
 assert.equal(contract.policy.unavailableRequiresExplicitContinuation,true);
 assert.match(intake,/Empty, skipped, timed out, cancelled,\s+unavailable, USER_UNAVAILABLE and failed question delivery preserve stage and\s+answers/);
 assert.match(intake,/do not auto-retry, analyze, scan PBIs/);
});

test('INTAKE_CONTRACT_LOCK: USER_UNAVAILABLE never replays an intake stage',()=>{
 assert.ok(contract.outcomes.includes('USER_UNAVAILABLE'));
 assert.match(intake,/USER_UNAVAILABLE is not an answer/);
 assert.match(intake,/Never automatically retry or replay the same question/);
 assert.match(intake,/CANCELLED, EMPTY_RESPONSE and USER_UNAVAILABLE leave the question pending/);
 assert.match(intake,/instead of saying the user gave no input when answers already exist/);
 assert.match(vscode,/Ask only the exact pending field in chat/);
});

test('INTAKE_CONTRACT_LOCK: Native intake starts fresh and only resumes an identified draft',()=>{
 assert.match(intake,/Every explicit Start PBI, Create PBI or New PBI starts a fresh intake with a\s+unique session ID/);
 assert.match(intake,/Explicit Resume or\s+Continue restores only the identified saved intake/);
 assert.doesNotMatch(vscode,/readConfirmed|akzo_pbi_intake/);
 assert.match(intake,/Do not\s+restore a previous intake file, pending question, decision, target or approval/);
 assert.match(intake,/Do not repeat completed fields/);
 assert.match(intake,/In Visual Studio, preserve the existing staged/);
});

test('INTAKE_CONTRACT_LOCK: analysis and PBI discovery are gated by explicit confirmation',()=>{
 assert.equal(contract.policy.analysisBeforeConfirmation,false);
 assert.equal(contract.policy.scanPbisBeforeConfirmation,false);
 assert.match(intake,/Only that explicit answer transitions to CONFIRMED and permits analysis/);
 assert.match(intake,/Before confirmation, do not enumerate PBI directories/);
 assert.match(intake,/Only after explicit confirmation may you look for a PBI with the same number/);
 assert.match(intake,/bounded exact-number lookup, not an enumeration of all PBIs/);
 assert.match(intake,/Do not modify approved Parent PBI packages during intake/);
 assert.match(intake,/filesystem\s+sandbox/);
});

test('INTAKE_CONTRACT_LOCK: native tools are host-specific and fallback does not claim a popup',()=>{
 assert.ok((/^tools: .*"ask_question"/m.exec(agent)||[])[0]);
 assert.equal((/^tools: .*"vscode\/askQuestions"/m.exec(agent)||[]).length,0);
 assert.ok((/^tools: .*"vscode\/askQuestions"/m.exec(vscode)||[])[0]);
 assert.equal((/^tools: .*"ask_question"/m.exec(vscode)||[]).length,0);
 for(const outcome of contract.outcomes)assert.ok(intake.includes(outcome),outcome);
 assert.match(intake,/Never fabricate a tool\/API/);
 assert.match(intake,/Never call chat text a native popup/);
 assert.match(intake,/exact pending field in chat/);
});

test('INTAKE_CONTRACT_LOCK: browser form allows Not assigned yet without changing existing PBI schema',()=>{
 const shell=fs.readFileSync(path.join(__dirname,'src','shell.html'),'utf8');
 assert.match(shell,/PBI number or Not assigned yet/);
 assert.match(files[P.AGENT],/Continue PBI/);
 assert.doesNotMatch(files[P.AGENT],/Continue PBI[\s\S]{0,100}new intake/);
 const made=P.newPbi(config,{number:'Not assigned yet',title:'Unnumbered fixture',description:'The request remains user-provided.',application:'unsure',draft:true});
 const record=JSON.parse(made.files[made.folder+'/pbi.json']);
 assert.equal(record.number,'');
 assert.equal(record.title,'Unnumbered fixture');
 assert.ok(made.files[made.folder+'/REQUEST.md']);
});

test('INTAKE_CONTRACT_LOCK: existing final approval protections remain present',()=>{
 const workflow=files[P.BASE+'/skills/stage-intake.md']+files[P.BASE+'/skills/stage-approval.md']+agent+vscode;
 assert.match(workflow,/one final user approval/);
 assert.match(workflow,/approved/i);
});
