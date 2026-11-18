# Interactive integration and quality upgrade - verification

## 1. Baseline and changed files

Baseline commit: **NOT VERIFIED / unavailable**. The Builder directory has no
Git metadata; no commit, branch or clean-worktree claim is made. The frozen
pre-change core remains byte-identical in the gated extension:

`vscode-pbi-builder/builder-core/core.js`

SHA-256: `7c116d3374c9548d6d099737ec279a6ca82e2618f771f89a0ef18576e04d8f85`.

Current maintainer source core SHA-256:
`1a27d6b84e2d43261d2d6c8cda4917ed30599a1df69b5137671b819532caef8f`.

Changed in this request, not the cumulative earlier diagnostic work:

| File | Change |
| --- | --- |
| [core.js](../maintainer/src/core.js) | Confirmed decision writes and decision invalidations invoke the existing synchronization routine and return its state/readiness. Explicit error if a saved decision cannot be mirrored. |
| [test-targeted.cjs](../maintainer/test-targeted.cjs) | Two regression cases: automatic synchronization and injected mirror failure after decision persistence. |
| [test-core.cjs](../maintainer/test-core.cjs) | Updated directly affected expectation: working drafts synchronize, but original intake and earlier handoff exports remain untouched. |
| [build.cjs](../maintainer/build.cjs) | Extracted the existing standalone renderer as `renderHtml()`, usable without writing into the gated extension. |
| [test-ui.cjs](../maintainer/test-ui.cjs) | Runs current standalone source in memory, retaining embedded source/assets assertions and DOM-handler checks. Does not certify frozen distribution artifacts. |
| [maintainer README](../maintainer/README.md) | Documents source-only synchronization, failure recovery and rendering/test boundaries. |
| This report | Results, evidence, limitations and remaining gates. |

No generated package, installed extension, application repository, separate SDD
Agent, SQL/GraphQL reference input or historical PBI session was changed.
No install, push, publication, deployment or release was performed.

## 2. Actual Copilot QuickPick invocation

**BLOCKED.** The current Copilot session does not expose
`akzo_pbi_native_selection_poc` / `akzoPbiNativeSelectionPoc` as a callable tool.
A tool-discovery request for those exact names returned other capabilities, not
the diagnostic. Its separate isolated Extension Host registration does not
make it available automatically in this conversation.

| Required observation in this conversation | Status |
| --- | --- |
| Copilot discovers the diagnostic tool | BLOCKED |
| Copilot invokes the diagnostic | BLOCKED |
| Agent invocation opens native QuickPick | BLOCKED |
| User selects DAB API | NOT VERIFIED |
| Actual tool response returns the selection to this conversation | NOT VERIFIED |
| Answer persists from that actual agent invocation | NOT VERIFIED |
| Same agent automatically advances without another prompt/command | NOT VERIFIED |
| Actual invocation/conversation evidence captured | BLOCKED |

No popup was opened, no answer was fabricated, no typed-selection fallback was
used and no command-handler test was relabelled as Copilot integration.
Diagnostic storage timestamps remained at the earlier run:
`state.json` at local 22:40:46; `results.json` at local 22:51:41.

The existing diagnostic asks mode first, targets second; its target label is
`DAB (synthetic)`, ID `dab`. It ends after targets, so the exact requested
"DAB API, then another question" sequence is not implemented by that diagnostic.
That is distinct from the current host tool-exposure blocker.

Earlier real registration, manual command-level selections and completed-run
process restoration remain historical evidence only. Exact remaining manual
Copilot steps and artifact paths are in the
[previous integration report](COPILOT-INTEGRATION-VERIFICATION-2026-11-13.md).
Computer Use was not retried.

## 3. Interactive intake and recovery

Production native integration: **BLOCKED** by the real-agent acceptance gate.
The existing production intake, Webview, canonical controller and clipboard
continuation remain unchanged. No replacement was installed or activated.

| Recovery/navigation condition | Automated evidence | Live host status |
| --- | --- | --- |
| QuickPick cancellation | PASS: explicit cancellation and saved answers | BLOCKED for actual Copilot |
| InputBox cancellation | NOT VERIFIED: current diagnostic has no InputBox | BLOCKED |
| Restart during intake | PASS: controller persistence tests | NOT VERIFIED in actual Copilot |
| Resume after process restart | PASS: earlier completed diagnostic restart; fresh-state disk recovery tests | PASS only for the historical command-level completed run |
| Back and Next | PASS: controller/Webview tests | NOT VERIFIED for a native replacement |
| Edit earlier answer | PASS: controller/question-engine tests | NOT VERIFIED for actual Copilot |
| Duplicate submission prevention | PASS: overlapping calls and revisioned callbacks | NOT VERIFIED for agent replay; explicit diagnostic Start creates a new run |
| Stale callback protection | PASS: controller revisions and concurrent-write tests | NOT VERIFIED for actual Copilot |
| Corrupt session handling | PASS: malformed canonical state and diagnostic snapshot tests | NOT VERIFIED live |
| Interrupted tool invocation | PASS: mocked cancellation/late-answer handling | NOT VERIFIED live |
| Historical confirmed session readability | PASS: read-only actual controller resume and unchanged hashes | PASS, no workflow dispatch performed |

## 4. PBI 287502 regression

**BLOCKED: original chat-export fixture is not available in the supplied
attachment or located workspace fixture.** The current attachment is the
engineering instruction, not that export.
[PBI-intake-chat-export.md](../PBI-intake-chat-export.md) describes the separate
DAB adaptation intake, not PBI 287502. It was not substituted.

The following remain historical statements from the user's summary, not newly
approved or independently established business requirements:

- CDMS target; Legacy CRM/CMS evidence; Shared Angular UI/CMS dependencies.
- BYK-mac i, AM6i and DataColor linking scope.
- Non-COIL same-instrument overwrite, COIL prior-measurement inactivation and
  blocking when the corresponding MCI has no measurement.
- Four historical decisions, stale rule/criteria artifacts and no final
  approved Refined PBI or verified handoff.

No artificial "real PBI" fixture, reconstructed approval, historical-session
edit, final specification or handoff was produced. Full replay requires the
original export and its actual decision/artifact content.

Supplemental CMS source evidence is recorded in
[PBI-287502-CMS-SOURCE-VERIFICATION.md](./PBI-287502-CMS-SOURCE-VERIFICATION.md).
It updates the source-availability finding below but does not replace the missing
canonical PBI or authorize edits to protected requirements or handoff artifacts.

## 5. Requirement synchronization improvement

**PASS, maintainer source only.** Two new tests failed before implementation:
the answer API returned no synchronized readiness, and an injected mirror-write
failure was never reached. Both now pass.

After a confirmed answer, the JavaScript API now uses the existing
`synchronizePbi()` contract, like the existing PowerShell answer path:

1. Save canonical state and decision log with existing history/rollback checks.
2. Synchronize canonical working sections and derived status.
3. Return synchronized state, changed files and readiness to the caller.

The existing working sections cover rules, criteria, dependencies, evidence,
decision history, questions and technical verification tasks. Immutable intake,
approved final documents and earlier handoff exports are not rewritten.

If synchronization fails after the decision commit, the error names the saved
decision IDs and explicitly says **Do not resubmit**. The new failure-injection
test verifies the answer is still saved exactly once. It is not reported as
an entirely rolled-back transaction or a successful synchronized operation.

**PASS, scoped stale-reference protection:** a rule still pointing to a
superseded decision continues to raise `DECISION_PENDING`; no replacement
business rule is guessed from natural-language answers.

**NOT VERIFIED:** general semantic contradiction detection or automatic
BYK-only-to-three-instrument requirement reconciliation. The original decision
content and explicit canonical edits are required. No NLP heuristic or silent
rewrite was added. The packaged extension still contains its frozen core;
this source improvement has not been installed there.

## 6. Source-analysis accuracy and PBI document quality

Source-analysis engine behavior was **not changed**. Read-only targeted
investigation produced the following bounded evidence, not a complete PBI
287502 source assessment.

### Availability and provenance

| Repository | Availability / revision |
| --- | --- |
| CDMS, `C:\src\ColorDMS` | PASS: readable; HEAD `f02adbcac6e32e4cf033e82e50174b297ffed35b` |
| DAB, supplied path | PASS: directory exists; no unrelated DAB source analysis performed for this CDMS case |
| Shared Angular UI, supplied path | PASS: readable; enclosing repository HEAD `3d8f2b766d95c5801dd9769440dab01ce95bd839` |
| Legacy CRM, supplied Source path | PASS: readable; Git revision unavailable from that path |
| CMS, newly supplied `C:\Users\RGA\source\repos\AN.CCICMeasurementService\AN.CCICMeasurementService\Source` | PASS: readable; HEAD `ab69a64ded29081b3f9c42e33c6efad62c8778e5`; detailed static findings in the supplemental CMS report |

These are working-tree observations with HEAD recorded where available, not
assertions that the repositories are clean or deployed at those revisions.

### Material static findings

CDMS file paths below are relative to:
`src/AN.ColorAppsAzure.ColorDMS.Formula/`.

| Finding | File, symbol and location | Limits |
| --- | --- | --- |
| A color-measurement read Function dispatches a typed query | `AN.ColorAppsAzure.ColorDMS.Formula.Function/Functions/MeasurementFunctions.Get.cs`, `GetMeasurementsByColorIdAsync`, lines 57-67 | Static dispatch only; no runtime request made. |
| Its handler requests measurement payloads by identifier | `AN.ColorAppsAzure.ColorDMS.Formula.Application/Measurement/Queries/GetMeasurementsByColorId/GetMeasurementsByColorIdHandler.cs`, `Handle`, lines 37-54 | Does not establish uploaded-measurement search or link ownership. |
| Query service delegates by-ID retrieval to the resolver | `AN.ColorAppsAzure.ColorDMS.Formula.Data/XRMService/Measurement/Queries/MeasurementQueryService.cs`, `GetMeasurementDataByIdAsync`, lines 126-130 | Static client-side chain, not a deployed end-to-end guarantee. |
| Resolver constructs a CMS by-ID HTTP request | Same Data directory, `MarketColorMeasurementResolverService.cs`, `GetMeasurementDataByIdAsync`, lines 37-48; `_config.ColorMeasurementService` plus `/api/v1/measurement/GetMeasurementDataById/{measurementId}` | CMS server source, configuration value, deployed endpoint and search capability remain unverified. No network request was issued. |
| Resolver is registered for DI | `AN.ColorAppsAzure.ColorDMS.Formula.Function/ServiceRegistration.Data.cs`, `AddDataAndMapperServices`, line 25; configuration property is in Common `Utility/EnvConfig.cs`, line 29 | Source registration is not runtime execution proof. |

Resolver SHA-256:
`216ebafd37e2987e92556386a0db76a29c45b0135bd839266656679dcc10e347`.

Legacy evidence, relative to the supplied Legacy CRM Source root:
`PDM/ANAAC.DDC.ColorApps.Formula.Workflows/LinkMeasurementValidationsBase.cs`.
`GetTargetMeasurement` reads and deserializes uploaded-measurement data around
lines 117-124; `GetMeasurementForColor` has null-return guards around lines
128-177. `GetMeasurementByInstrumentType`, lines 193-226, filters two numeric
instrument codes under an AM6i/BYK comment. Those comments/codes do not
independently prove the current three-instrument requirement or its runtime
registration. SHA-256:
`8b369b860e176efb67d204447bf40d7844dd327fc11c44c74f2b103d1174cd52`.

Shared UI evidence, relative to the supplied UI root:
`projects/shared-external-libs/src/lib/components/formula-measurement/formula-measurement-service.ts`,
`FormulaMeasurementService`, lines 6-80, manages measurement loading/state.
It does not establish a linking API or CMS search contract. SHA-256:
`b3dfcf33a5fae6aff6634a5e8ccbc2e958023e9c1dbf2718f661b97768c2b2d6`.

**BLOCKED / NOT VERIFIED for actual PBI 287502:** complete business objective,
existing/expected behavior, authoritative requirements, acceptance criteria,
scope/ownership, architecture, API/data contracts, validation/errors,
dependencies, security, compatibility, positive/negative/boundary tests,
open decisions and implementation-time verification tasks. No final technical
PBI is claimed from the partial evidence above.

## 7. Readiness, reference integrity and quality gates

| Mandatory condition | Status |
| --- | --- |
| Required decisions cannot be inferred from silence or recommendations | PASS: question-gate and real-file workflow tests |
| Superseded canonical rule reference blocks readiness | PASS: new focused regression |
| Current documents mirror canonical state | PASS: automatic synchronization and existing consistency tests |
| Arbitrary contradictory natural-language requirements detected | NOT VERIFIED |
| Business decisions and technical evidence gaps remain distinct | PASS: existing workflow classification tests |
| Conditional draft cannot impersonate final approved implementation readiness | PASS: targeted/core/PowerShell flow tests |
| All PBI 287502 deferrals are safely classified, assigned and testable | BLOCKED: CMS evidence is now available in the supplemental report; original fixture and canonical requirement/decision records remain unavailable |
| Dependency cycles, unverified owners, stale source evidence block approval | PASS: planning/coordinator contracts |
| Staged SQL/GraphQL reference fingerprints | PASS: six approved input hashes and offline GraphQL.js provenance verified |
| Explicit operation-to-SDL ownership and invalid mappings | PASS: GraphQL reference/mapping tests; no name-based cross-system inference added |
| Actual installed CDMS reference manifest | NOT VERIFIED: `C:\src\ColorDMS\playbook\pbi-builder\references\reference-library.json` absent |
| Actual PBI 287502 readiness/refinement | BLOCKED |

SQL model validation read the authorized staged exports: 2,122 tables,
66,616 columns and 1,482 foreign keys. Ninety primary-key ordinal warnings
remain explicit; they were not relabelled as fully verified key order.
The optional duplicate schema export was absent, so duplicate byte identity
was not rechecked.

## 8. SDD compatibility

**PASS, local contracts:** Phase 06/v2 authorization/export validation and G4
paths exercised by the planning tests; Phase 01 compatibility, freshness,
dependency ordering and unauthorized/stale package rejection remain intact.
`phase01-contracts.js` and `phase06-handoff.js` hashes match the frozen baseline.

**BLOCKED, actual SDD consumption:** the real-agent integration branch
explicitly reported `SKIP real Agent integration: set AKZO_SDD_AGENT to the
authorized Agent source root.` No SDD Agent was invoked or modified. No
implementation authorization was granted and no actual PBI 287502 handoff
was prepared or imported.

## 9. Lightweight classification and removals

| Component | Classification | Action |
| --- | --- | --- |
| Canonical intake controller and historical storage | KEEP | Unchanged; validated read-only. |
| G4/v2, quality and evidence/reference validators | KEEP | Unchanged, tested. |
| Decision persistence followed by manual mirror synchronization | IMPROVE | Source API now composes existing synchronization automatically. |
| Standalone rendering coupled to extension-output writes | CONSOLIDATE | Shared renderer extracted for in-memory source tests; default build still uses it. No build was run. |
| Webview and clipboard continuation | KEEP pending replacement proof | Neither obsolete nor safe to remove before live acceptance. |
| Source scans, reference loading and caches | KEEP pending measured bottleneck | No broad rescan, new dependency or risky cache introduced. |
| Redundant files/commands/workflows | REMOVE only after proof | None removed. |

## 10. Performance comparison

Equivalent synthetic workload: save one answer and fully synchronize working
mirrors/readiness. The baseline uses the frozen pre-change core and an explicit
follow-up synchronization; current source does it inside the answer API.
Three alternating local runs used disposable files and the same fixed answer.
This is not a real-agent or full PBI latency benchmark.

| Measurement | Baseline | Current |
| --- | --- | --- |
| Answer plus synchronization, ms | 388, 364, 313 | 346, 327, 309 |
| Median, ms | 364 | 327 |
| File opens per equivalent operation | 130 | 130 |
| Bytes read per operation | 170,102 | 170,102 |
| Writes / bytes written | 20 / 54,631 | 20 / 54,631 |
| Warm unchanged synchronization, ms | 128, 123, 120 | 125, 125, 110 |
| Warm unchanged writes | 0 | 0 |

No speedup guarantee is inferred from this small sample. The verified benefit
is automatic correctness with unchanged I/O for the equivalent workload, not
removal of essential checks. Actual UI/agent latency remains NOT VERIFIED.

## 11. Automated and live evidence

Final non-overlapping validation batches:

| Batch | Node runner results | Scope |
| --- | --- | --- |
| Native diagnostic, historical participant, production interaction, intake lock, interactive/module contracts | 62 PASS, 0 FAIL | Mocked/native API contracts and real temporary-file controller/workflow checks |
| Core and current-source standalone DOM harness | 2 PASS, 0 FAIL | Core reports 59 internal checks; DOM is simulated, not rendered/native UI |
| Targeted, chat-flow, file-based E2E and 5.4.1 parity | 37 PASS, 0 FAIL | Includes two new regressions, stale/concurrent callbacks, JavaScript/PowerShell parity; E2E reports 14 internal checks |
| Phase 01, coordinator, planning, GraphQL and SQL | 5 PASS, 0 FAIL | Local quality/evidence/handoff contracts and actual staged reference inputs |

Total: **106 final runner entries PASS, 0 FAIL**. Do not add internal check
counts again. Initial red tests and the two intermediate dependent-suite
failures were fixed and rerun, not excluded. Intermediate failures were an old
assertion that drafts never change and the DOM harness reading a frozen build
instead of current source.

The final contract runner reports zero outer skips, but its internal real-SDD
branch was explicitly skipped as described above. No full release suite or
actual installed/generated-distribution certification is claimed. No live
Copilot, native InputBox, rendered-browser or application test/build was run.
Temporary fixture setup never installed/replaced a real user extension.

Read-only normal-profile validation:

- `intake-aa8fdd55f1b9bf48222f76e3c589b91f`: CONFIRMED, revision 6;
  SHA-256 `7056829c4248eef3b4e6837e8280fe0c6fa1e1bd5a619bec375cbd23f706469d`.
- `intake-389645d7db6d23fc3f37aa355562ef26`: WAITING_FOR_USER_INPUT,
  revision 5; SHA-256
  `56270df6b166b3ac39bec0617e54208c36ea052860f0b407b3d6078a3bd3630d`.

Both passed the unchanged controller's read-only `resume()` and byte comparison.
No `dispatch`, import, migration write or user-resume workflow was called.
Gated extension/controller/workflow and bundled pre-change core hashes remain
unchanged.

## 12. Remaining blockers and exact remediation

1. **BLOCKED - actual tool exposure:** use an actual Copilot conversation in
   the host where the diagnostic is registered; verify its available-tools
   picker and follow the prior report's single-request manual procedure.
   Do not substitute command dispatch or install anything without approval.
2. **BLOCKED - live recovery/native navigation:** requires actual supported
   controls and human interaction after the host gate passes. No typed-answer
   fallback is authorized.
3. **BLOCKED - real PBI fixture:** supply the original PBI 287502 chat export
   and canonical artifact versions; reconcile explicit confirmed decisions,
   not an inferred reconstruction.
4. **BLOCKED - mandatory CMS evidence:** restore authorized access to the
   supplied CMS source or provide a verified source snapshot/API contract.
   Verify uploaded-measurement search separately from the demonstrated by-ID
   client path. Do not downgrade this uncertainty to a runtime-only task.
5. **BLOCKED - actual installed references/SDD consumption:** verify the
   intended installed Builder location and obtain explicit authority for the
   real SDD consumer test. Local contract success is not that test.
6. **BLOCKED - native production integration/distribution:** the real-agent
   prerequisite is unmet. No production integration approval is inferred.

## 13. Production-readiness assessment

**BLOCKED / NOT PRODUCTION-READY.** The independently authorized maintainer
synchronization fix is implemented and validated. Production native interaction,
continuous actual-agent analysis, real PBI 287502 refinement and validated SDD
consumption have not passed their required acceptance tests.

Stop at these genuine host, source-fixture, evidence and approval gates.
Production implementation, installation and release remain unauthorized.
