# Akzo SDD PBI Builder 5.8.0 — maintainer notes

Chat-first PBI workflow, optional offline HTML utility and Windows PowerShell
installer. End users need no Node.js or npm runtime. The maintainer build uses the
approved GraphQL.js 16.11.0 development dependency to validate and bundle the
offline reference intelligence. End users use the installed Copilot agent for
intake, refinement, review and approval; the installer performs the readiness-bound
final generation. The HTML remains available for setup and browser workflows.
Node 20+, npm and Python 3 are only needed to rebuild and test.

## Files
- `src/core.js`: the single source of generation. Agent and guide text, templates with
  `{{PBI:TOKEN}}` placeholders, `bundle()` (the generation contract for PowerShell),
  intake/refinement, comparison, readiness rules, evidence fingerprints, SHA-256
  ownership, plan/apply/rollback, ZIP writer.
  Its decision-writing API synchronizes working mirrors and returns readiness
  after a confirmed answer or decision invalidation. If mirror synchronization
  fails after the decision was saved, the error explicitly says not to resubmit:
  inspect the saved files and resume synchronization. Original intake and final
  approved documents are not rewritten; superseded rule references still block
  readiness until explicitly reconciled.
- `src/phase01-contracts.js`: versioned Phase 01 analysis contracts and validators.
  Their optional `PBI-ANALYSIS-EXTENSION.json` sidecar is coordinator-written and
  bound to the legacy PBI state revision. Legacy state v2, handoff v1, and the
  existing approval fingerprint remain unchanged; the sidecar is excluded from
  the legacy development package. Extension-dependent operations reject missing,
  unsupported, malformed, stale, or changed data rather than falling back. Phase
  05 Parent/Child planning uses an exact five-field Parent PBI, deterministic
  evidence-backed provisional children and the existing durable package approval;
  5.8 refinement quality is persisted and fingerprinted in the same versioned
  extension, with six weighted dimensions and evidence-derived child criteria. A
  current quality-ready report is required for new 5.8 package approvals; it does not
  change handoff v1. A separate fingerprint-bound authorization enables only a
  validated Builder-native child export; it creates no work items, invokes no SDD
  agent, and does not execute implementation.
- `src/refinement-quality.js`: deterministic six-dimension scoring, business-rule and
  CDMS/DAB/Angular/GraphQL/SQL traceability, blocking findings and clarification prompts.
- `test-phase05-planning.cjs`: focused Parent/Child planner, quality persistence,
  evidence/requirement/relationship/question/child invalidation, dependency closure,
  explicit authorization, native-export validation and handoff-isolation tests.
- `src/sql-metadata.js`: strict local SQL export parser, deterministic
  quoted-tab, TSV (including quoted fields) and CSV parsing, schema-qualified
  table/column/PK/FK model, indexed read-only lookups, provenance/evidence
  references, registry validation and freshness checks. It never connects to
  SQL Server.
- `src/graphql-intelligence.js`: offline SDL validation, explicitly assigned
  operation validation and selected-field paths; it does not infer schema
  ownership or cross-system mappings.
- `reference-fingerprints.json` and `build.cjs`: the six user-staged files in
  `../references/cdms/` and `../references/graphql/` are authoritative inputs.
  The build verifies their recorded SHA-256 fingerprints and GraphQL.js
  provenance, then packages them with the runtime license and offline bundle.
  `renderHtml()` renders the same standalone source in memory. The DOM harness uses this path;
  passing it does not validate frozen distribution artifacts or an installed UI.
- `test-assets.cjs`: verified package assets for installer tests. Tests that
  exercise the current installer must use this loader rather than raw
  `src/assets.json`.
- `src/ui.js`, `src/shell.html`: browser controls and layout (inline CSP, no network).
- `src/visualization.js`: optional, read-only HTML views over saved PBI metadata and
  evidence; it does not scan source repositories or participate in approval.
- `src/assets.json`: historical reference documents and the PBI template.
- `installer/`: `Install-PBIBuilder.ps1` (all actions), `PBI-Builder-Setup.ps1` (setup window and
  `-NoGui` batch mode over the installer; opened by double-clicking the .cmd), `Uninstall-PBIBuilder.ps1`
  (wrapper) and `.cmd` launchers. Pure ASCII so Windows PowerShell 5.1 reads them
  without a BOM.
- `fixtures/baseline-v2.0.0-core.cjs`, `baseline-v2.1.0-core.cjs`, `baseline-v3.0.0-core.cjs`:
  the exact prior generators, used only by tests and `compare-versions.cjs`;
  `baseline-v3.1.0-core.cjs`; `baseline-v2.1.0-template.md`, `baseline-v3.0.0-template.md`,
  `baseline-v3.1.0-template.md`: their templates.
- `fixtures/readiness-cases.cjs`: shared readiness scenarios for JS and PowerShell.
  `load(core)` records approvals with the basis the code under test prints.
- `fixtures/workspace.cjs`: configurable multi-repository workspace (Legacy, CDMS, DAB, shared UI
  folder names and the feature are parameters) and the `pbi-state.json` an agent would record for it;
  used by `test-e2e.cjs` and `benchmark-530.cjs`.
- `fixtures/baseline-v5.2.2-core.cjs`: the exact 5.2.2 generator, the reproducible baseline for
  `benchmark-530.cjs`.
- `fixtures/baseline-v5.3.0-agents.json`: the rendered single-file 5.3.0 agents (both IDEs) before the
  stage-module split. `test-modules.cjs` requires every sentence of it to remain in the agent file or a
  `skills/stage-*.md` module; regenerate it only when an instruction is removed on purpose.
- `fixtures/pbi-309446-shape.cjs`: a disposable DAB + UI PBI shaped like the reported PBI 309446 (six mandatory questions,
  CDMS as a read-only reference, DAB code still to be built); its real content was not available.
- `fixtures/baseline-v5.3.0-core.cjs`: the exact 5.3.0 generator, used by `test-chat-flow.cjs` to prove that an approval
  recorded with 5.3.0 stays valid under 5.4.
- Agent text: `AGENT_TEMPLATE` keeps the always-on rules and the Workflow router; the `SKILL_STAGE_*` constants
  are the stage modules it routes to. A new module must be added to `templates()` and named in the router.
- `fixtures/gap-cases.cjs`: the four reported 3.0.0 gaps as a 3.0.0 agent records them.
- `fixtures/fs-handles.cjs`: File System Access handles backed by real files.

## Build, test, release
```
npm ci --ignore-scripts --no-audit --no-fund
python update-fixture.py     # only when shell.html ids/options change
node update-fixture.cjs      # the same without Python (regenerates dom-fixture.json identically)
python build.py              # writes Akzo-SDD-PBI-Builder.html
node build.cjs               # equivalent standalone build when Python is unavailable
node --check src/core.js && node --check src/phase01-contracts.js && node --check src/refinement-quality.js && node --check src/ui.js
node test-graphql-intelligence.cjs # offline GraphQL schemas, evidence-bound mappings, persistence and invalidation
node test-core.cjs           # 59 workflow checks on real temp files
node test-ui.cjs             # built HTML scripts and handlers, simulated DOM (not a rendered browser)
node test-phase01-contracts.cjs # Phase 01 validation, approval, freshness and sidecar persistence/rollback
node test-phase04-coordinator.cjs # Phase 04 tasks, evidence verification, lifecycle, persistence and approval blockers
node test-phase05-planning.cjs # Phase 05/05.1 traceability, child criteria, quality scoring, blockers, approval and invalidation
node test-sql-metadata.cjs   # SQL parser/model, Phase 01 linkage, stale/missing sources and local Downloads exports
node --test test-interactive.cjs # startup routing, host tools, explicit source/targets, optional criteria and saved intake
node --test test-visualization.cjs # optional report data, escaping, offline export and read-only behavior
node --test test-521.cjs test-530.cjs   # approval, evidence policy, analysis plan, incremental discovery, metrics
node --test test-targeted.cjs         # persistent continuation, conditional drafts, mirror/freshness parity, host profiles
node --test test-561.cjs             # Visual Studio, VS Code and both: same files as the browser engine, one agent per editor, persisted selection, per-editor status, blocked editor, -Editor repair/upgrade, setup window checkboxes
node --test test-560.cjs             # CDMS, DAB and UI as independent targets: all seven selections, no artifact for an unselected area, scope question, SetTargets, saved targets
node --test test-550.cjs             # Refined PBI names for every target, blocker questions, canRefine/phase, COMPLETE only with verified files, 5.4 names
node --test test-541.cjs             # mandatory question gate, RecordAnswer/DeferQuestion, repository checker, DAB + UI final PBIs, resume fast path, setup window (WindowTest)
node --test test-chat-flow.cjs        # chat flow end to end: recommended/custom/Decide later answers, pending decision, review, PowerShell approval, refined PBIs
node --test test-modules.cjs          # always-on agent + stage modules: nothing lost vs fixtures/baseline-v5.3.0-agents.json, routing, upgrade/uninstall
node --test test-verification.cjs     # 306618 five-rule automatic verification, root layouts, answer continuation and proof guards
node --test test-570.cjs             # development handoff: same-state generation (JS and PowerShell), tamper/draft/conditional refusal, rollback, pre-5.7 approvals, ZIP read back by Expand-Archive, and the Akzo Master SDD agent's own akzo.ps1 pick when its folder is found (AKZO_SDD_AGENT)
node benchmark-570.cjs [runs]        # 5.6.2 (git) versus current: approval, handoff, package and Start Development times, counts and sizes (docs/PERFORMANCE-5.7.0.md)
node make-golden-package.cjs         # rewrites fixtures/golden/pbi-309446-final-pbis.zip (the consumer contract fixture); run on every release, test-570 enforces it
powershell -STA -File test-gui.ps1 -Package <package> -OldPackage <5.6.0 package> -Out <folder>   # the real setup window and folder picker (interactive desktop; moves the mouse twice, then puts it back)
node test-e2e.cjs            # install -> discover -> decisions -> resume -> approve -> generate, real files and installer
node benchmark-530.cjs       # 5.2.2 versus current counts and times (docs/PERFORMANCE-5.3.0.md)
node test-ps.cjs             # Windows PowerShell: byte equivalence with core.js, installer actions
node compare-versions.cjs    # deterministic v2.1 / 3.0.0 / 3.1.0 / current evidence (MEASUREMENTS.md)
node diagnose.cjs [runs]      # per-profile instruction sizes, in-process stage metrics, PowerShell CheckPbi/SyncPbi median and p95 (JSON)
node diagnose.cjs --instructions   # agent, guide and stage-module sizes; per-workflow loaded characters vs the pre-split baseline
node benchmark.cjs           # 3.1.0/current operations and 5.1.0 listing before/after (docs/PERFORMANCE.md)
node demo-v4.cjs             # deterministic Create PBI -> questions -> validate transcript (docs/V4-DEMO.md)
node release.cjs             # package root files + ../releases/Akzo-SDD-PBI-Builder-<version>/, verified
```
`release.cjs` overwrites the root package files and the ZIP of the current version in `releases/`;
it omits the historical `Akzo-Pbi-Builder_old/` checkout and `node_modules/`. Set
`PBI_RELEASE_OUTPUT_DIR` to an isolated directory to verify packaging without overwriting an
existing release ZIP. Run it without that override only to publish the version; never `require` it.
Older releases stay untouched for rollback.

### Publishing a release (Publish-Release.ps1)
Every version is published to the one permanent repository https://github.com/ArunGuruswamy/PBI (branch `main`) as tag
`v<version>` with a GitHub release: v5.7.0, v5.7.1, v5.8.0, ... Never create a repository per version. Commit the source
for the version (with its CHANGELOG section and `node make-golden-package.cjs`), then:
```
.\maintainer\Publish-Release.ps1 -DryRun                      # verify, run every test, build and check the artifacts; commits nothing
$env:GITHUB_TOKEN = '<token with write access>'; .\maintainer\Publish-Release.ps1
```
It refuses a dirty tree, another branch, a missing CHANGELOG section, a remote `main` that HEAD does not contain (merge it
first) and a tag already used for another commit. It runs every `test-*.cjs`, runs `release.cjs`, rechecks the ZIP and
SHA256SUMS.txt checksums, commits `release: Akzo SDD PBI Builder v<version>` with an annotated tag, pushes without force,
creates the GitHub release with the CHANGELOG section as notes, uploads the ZIP and its .sha256, and verifies the remote
branch, the tag and a download of each asset. Rerun it after a failure: a tag already on HEAD resumes at the push.
`git push` uses your git credentials; only the release API needs `GITHUB_TOKEN` (or `GH_TOKEN`).

### Interactive source verification

Generated agents use the concise YAML `name` values `AKZO PBI Builder [VS Code]`
and `AKZO PBI Builder [Visual Studio]`, including single-editor installations.
Project identity and version remain in the description/body and configuration.
Paths are unchanged, so an approved update replaces the owned registration
instead of creating a second filename. Both hosts can discover workspace
`.github/agents` files; the suffix is not a discovery filter. Each profile keeps
its own tools and refuses the other host before starting work. No unsupported
host-target YAML or silent cleanup of user registrations is used.

`advanceWorkflow` prioritizes `AUTO_VERIFY` for unverified application coverage
when the configured source is accessible. `verifyAccessibleRules(root, folder,
investigate)` drives up to eight read-only host investigations and persists each
result with history and concurrency checks. The host adapter receives the next
rule/application and returns `{record, evidence}` from source it actually read;
the generator does not pretend to understand Angular by matching component names.
Local evidence hashes are checked before saving; existing evidence IDs cannot be
silently replaced. Use a new ID when a source observation changes.

`recordRuleVerification` validates the six supported classifications and checked
implementation/template/service/contract/validation/test facets. Missing/partial
behavior needs implementation and test tasks; source/runtime limits need actionable
verification tasks. Records live only in `analysis.ruleVerifications` in the
canonical PBI state, with external tasks in `analysis.gaps`; no SQL PBI workflow is
created. `verifyRule` saves one finding and returns the next workflow action.
Working draft, evidence, validation matrix, questions and decision mirrors remain
synchronized. Browser answer submission also runs the next step automatically.

`resolveWorkspace` caches configured sources and the confirmed `playbook/pbis`
and `Source/playbook/pbis` roots, including failed probes, for the current handle.
Configuration writes/removal and newly created roots invalidate that cache;
explicit `{refresh:true}` handles an external layout change. `resolvePbiLocation`
requires an explicit root-qualified choice when more than one candidate matches.
It never merges versions or reads another PBI's decisions as evidence.

### Phase 01 analysis extension
The sidecar stores typed coverage/evidence, CDMS plugin and registration findings,
DAB translations, SQL relationships, UI trace mappings, specialist task/results,
questions, decisions, and package approval inputs. Coverage normalization preserves
the original legacy status and keeps business-decision blockers distinct. Specialist
tasks authorize read/search/symbol/hash/list only within recorded source roots and
paths; results are rejected when their cancellation identity, canonical state, or
source revision/hash is stale. Package approval uses a separate deterministic
fingerprint and does not alter the legacy user-approval basis.

Coordinator persistence requires an expected current file hash, validates the
legacy PBI state schema/revision, and uses the existing optimistic `plan`/`apply`
backup and rollback mechanism. The extension is not added to the v1 handoff package
or the installer ownership manifest. Existing PBIs can omit it; any new operation
that requires Phase 01 analysis must explicitly require and validate it.

An approved analysis package is persisted as the optional `packageApproval` record
in the versioned extension. It binds the package ID, package revision, approval
fingerprint, explicit decision, requester, approver, timestamp, and evidence.
Approval-only writes preserve the package revision; edits to approval-relevant
content increment it, clear stale approval, and report `approvalInvalidated`.
Unsupported or stale persisted approvals fail closed on load. This record approves
the analysis package only: it is excluded from handoff v1 and does not authorize or
start SDD implementation, which continues to require the existing legacy user
approval and verified handoff.

### Phase 04 specialist coordinator
The Phase 04 panel prepares six versioned, read-only specialist task sets from
the canonical PBI requirements and linked acceptance criteria. Execution is
explicitly manual: export each task JSON, assign and execute it outside the
Builder, then import the structured result. The Builder does not invoke agents,
run tests in application repositories, or make implementation changes. Register
the Git repository root (with a readable `.git/HEAD`); task paths are further
restricted by specialist role. Browser folder handles are session-only, so
reselect roots after reload before asking the coordinator to verify imported
source hashes.

Imports bind to the canonical state revision, coordinator revision, task
revision, cancellation identity, repository snapshots, task scope and result
schema. A source hash can verify static file evidence only; it does not establish
registration, runtime or test behavior. If the matching source root is not
available during import, claimed verification is downgraded to `UNVERIFIED`.
Conflicting coverage creates a blocking clarification; only an explicit
coordinator answer supported by verified cited evidence can select a coverage
classification. That answer cannot promote unverified evidence. Pending,
deferred, cancelled, unresolved, stale or unverified work remains an analysis
approval blocker. The consolidated report is persisted in the versioned
analysis extension, not in the legacy state or handoff v1, and never authorizes
SDD implementation.

`test-ps.cjs` removes the inherited process-scope execution policy override so the
installer runs under the user's real policy. It never adds a bypass.

## Chat approval and final generation
The generated agent treats Copilot Chat as the normal interface and asks for explicit
approval only after presenting the reviewed PBI. In VS Code it uses the configured
`execute` tool to call `Install-PBIBuilder.ps1 -RepoPath <repository-root> -Action ApproveAndGenerate`
with the PBI folder, user-provided approver name and current 64-character reviewed-content
fingerprint. The installer recomputes readiness and the fingerprint, refuses
blockers, stale content or sensitive material, records approval only after those
checks, generates and reads back the Markdown/JSON/DOCX artifacts, then rolls back
on failure. An IDE without command execution receives the equivalent command to run.
This keeps final generation in the existing installer and adds no runtime dependency.

## Development handoff (5.7.0)
`approveAndGenerate` / `Invoke-ApproveAndGenerate` write business-rules.json, BRANCH-COVERAGE-MATRIX.md and
HANDOFF-MANIFEST.json after the post-generation readiness check passes, inside the same prior/written/rollback
transaction. `handoff()` + `branchMatrix()` are ported as `Get-Handoff` + `Get-BranchMatrix`; `handoffOutputs()` as
`Get-HandoffOutputs`; `verifyHandoff()` as `Test-Handoff`; `startDevelopment()` as `Invoke-StartDevelopment`.
`ConvertTo-JsJson` reproduces `JSON.stringify(value, null, 2)`, so business-rules.json, the manifest and the Refined PBI JSON
(`Get-ChatFinalDocuments`, same fields and order as `finalDocuments()`) are byte-identical between engines; only the .md and
.docx renderings differ. Verification compares them byte for byte. The manifest is written only for DEVELOPMENT_READY and lists every package file except
itself. A PBI approved before 5.7 gets its manifest on the first Start Development, from the still-current approval.
`handoffDisposition()` / `Get-HandoffDisposition` derive DEVELOPMENT_READY, CONDITIONAL, DRAFT and STALE from the readiness
report, the recorded approval and `analysis.conditionalPbiGenerated`. The consumer contract is in docs/SDD-HANDOFF-CONTRACT.md.
Windows PowerShell 5.1 pitfall met here: `@($list)` over a `List[object]` does not compile ("Argument types do not match");
use `.ToArray()`.

## Generation contract
`bundle()` returns `schemaVersion: 1`, the ordered `setup` entries (rendered
`template`, literal `text`, or `source: "html"`), the allowed `tokens`, IDE profiles,
precomputed analysis-document blocks, legacy file names, comparison baselines and the
readiness rule data. Both installers render tokens in one pass; an unknown token or
schema stops before any write. The PowerShell side computes only the per-config
values (`New-Config`, `ConvertTo-ConfigJson`, `ConvertTo-JsEscaped`), which
`test-ps.cjs` proves byte-identical for both IDE profiles, references on/off,
Unicode, quotes and backslashes. Bump `schemaVersion` on any incompatible change.
`PBI-Builder.html` is the browser's serialized page in the form and the package file
in PowerShell; those bytes differ, everything else is identical.

## Update contract
Installed files are tracked in `playbook/pbi-builder/installed-files.json`
(schemaVersion 1, not self-hashed). Missing target: create. Identical: unchanged.
Differing with a matching recorded hash: update (needs opt-in). Otherwise: conflict,
which blocks every write. Paths in the old manifest (or the known 2.x names) that the
new version no longer installs: `retire` when unchanged (backed up, removed after all
writes verify) or `retire-conflict` when edited/unowned (kept, reported, not
blocking). All targets are re-read before writing. Failures restore every touched
file. This is not a filesystem transaction.

## Readiness and knowledge
`readiness()` and `Get-Readiness` implement the same rules over `pbi-state.json`
(schemaVersion 2; 1 is read and reported as outdated), the PBI documents,
DECISION-LOG.md and the hashes of repo-file evidence; issue order, messages and the
`review` block are part of the contract. Approval fingerprints are the first 16 hex
characters of SHA-256 over canonical JSON (sorted keys, ordinal; whitespace runs in
strings collapsed; `canon()` / `ConvertTo-Canon`). Scopes are in `READINESS.scopes`.
PowerShell pitfalls met here: variable names are case-insensitive (`$l` overwrites
`$L`) and scoping is dynamic (a local `$sha` hides the script's `$Sha` from callees).
They check completeness and consistency only.

`synchronizePbi()` and installer `-Action SyncPbi -Pbi <folder>` repair the
workflow-owned rule, acceptance, dependency, evidence, decision and question
sections from canonical state, preserving other narrative and all original intake
fields. Changed files are backed up to `history/`; concurrent changes stop writes
and failed writes roll back. The canonical checker runs after synchronization,
and computed status and `READINESS.json` are saved without approving anything.
Read-only `CheckPbi` remains read-only. The browser readiness action synchronizes
and computes the next action automatically.

`advanceWorkflow()` reads saved state first, refreshes cached evidence, synchronizes,
and resumes the next action from `analysis.workflow`. Repeated unchanged automatic
actions become interactive choices; automatic budgets are limited to eight steps
and transition history to 32 entries. Operational progress is excluded from the
review snapshot in both checkers; requirements, evidence and documents are not.
`generateConditionalPbi()` requires defined business requirements, not a saved
consent choice or completed technical evidence. Once genuine business questions
are resolved, technical evidence, registration, runtime, implementation and
external gaps are recorded as dependencies and the conditional draft, acceptance
criteria, test plan and readiness result are synchronized automatically. It never
waits for dependency owners, creates final artifacts, approves decisions, or
clears security blockers.

Host profiles are rendered separately from the same generator. VS Code retains
native `vscode/askQuestions` and Custom Response. Visual Studio uses chat choices
with Custom Response unless a question tool is actually exposed at runtime; a tool
declaration is not evidence that the tool is callable. Live IDE invocation checks
must be reported as NOT VERIFIED when unavailable.

New final-approval snapshots also hash the working documents, attachments, state
and distinct repository-relative evidence sources. Each check revalidates the
snapshot to detect concurrent edits; source deletion or content changes make
snapshot-bound approval stale. Document line endings and metadata JSON layout
are normalized, but source and attachment contents are byte-sensitive. Older
approvals without a reviewed-content snapshot retain their per-record
compatibility checks; a new approval binds the complete snapshot. External
evidence is bound to its recorded revision, but its current source cannot be
independently checked by the selected-repository form.

## Decision engine
`questionProgress`, `answerQuestion`, `skipQuestion`, `recordAnswer`, `recordSkip` (core.js)
serve the form's question panel. Writes back up pbi-state.json and DECISION-LOG.md to
history/, refuse when pbi-state.json changed since it was read, and supersede on edit. The
agent applies the same rules in chat (guided-pbi-creation.md); that part is instructions only. `refreshEvidence()` and `-Action RefreshEvidence`
hash raw bytes of repo-relative paths; external paths are skipped (agent records the
revision instead). The question panel validates referenced local files and any
recorded hashes before displaying a recommendation, sharing one read per source
across the displayed questions. External revision freshness is explicitly unverified.

The existing panel is now a native modal (inline fallback when dialog support
is unavailable). Select an existing PBI or return focus to the page after analysis;
Load questions opens it explicitly. Radio options include Custom Answer and Decide
Later. Save Answers writes the selected decisions as one backed-up state/log update;
Save Draft preserves selections without approval; Cancel writes nothing. Only
locally verified references can preselect a recommendation. Supporting evidence
bases reopen materially changed answers, and local source changes during the popup
reject saving. The chat host does not render this modal or select directories.
Working analysis documents still need targeted agent refinement after decisions;
the form does not invent business-rule changes from a choice.

## Evidence policy, repository intelligence and metrics (5.3.0)
- Minimum Sufficient Evidence lives in `readiness()` / `Get-Readiness` (identical by shared cases):
  an unresolved `gaps[]` entry blocks (EVIDENCE_GAP) unless its `impact` is exactly WARNING or
  INFORMATIONAL, in which case it becomes `warnings[]` (`GAP_OPEN`). Evidence whose `verification`
  is present and not VERIFIED is not counted as code, registration, reach or branch proof
  (`EVIDENCE_NOT_VERIFIED` warning); an invalid value is EVIDENCE_INCOMPLETE. `warnings` is part of the
  report contract, after `issues`; `READINESS.verification`, `gapImpact` and `warningMessages` carry the data.
- `discoverSources` keeps the previous map in memory: solutions and projects whose size and modified
  time match are reused, the derived Markdown and the file index are skipped when unchanged (index by
  recorded sha256 and size). It still lists every non-excluded directory entry; a browser cannot know
  which folders changed without listing them. `planAnalysis` is pure and tested without files.
- `refreshEvidence` / `-Action RefreshEvidence`: `dependsOn` paths are hashed into `dependencyHashes`; a
  difference sets `stale` with `staleReason: dependency-changed`; `reusable` lists unchanged entries.
- `PBI.measure(fn)` wraps `file()`, `read()`, `write()` and friends with a meter that exists only inside
  the call (nested calls are counted separately). Bytes are counted where a body is read. `benchmark-530.cjs`
  instruments the file handles instead, so both versions are measured by the same code.
- Real-browser check (used for 5.3.0, recorded in VALIDATION.txt): serve the built HTML from
  `http://127.0.0.1`, override `window.showDirectoryPicker` with `navigator.storage.getDirectory()` (the
  origin private file system) and drive the real page with Playwright. The native folder picker is
  the one thing this cannot exercise.

## Boundaries
The browser cannot silently select directories, learn absolute paths, authenticate
Copilot or select an agent. The installed agent may read source and write only PBI
documents and knowledge notes; instructions are not an OS sandbox. No model name is
hardcoded. No telemetry, network calls or new dependencies.

## Machine verification still required
Native Edge/Chrome folder dialogs and rendering; Visual Studio/VS Code agent
discovery and tool availability; live Copilot quality, time and usage.

Sources checked 24 September 2026:
https://learn.microsoft.com/en-us/visualstudio/ide/copilot-specialized-agents?view=visualstudio
https://code.visualstudio.com/docs/copilot/customization/custom-agents
https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
