# Builder baseline and controlled QuickPick diagnostic - 2026-11-13

**Latest verification:** [Copilot gate, real restart results, recovery fix and
manual steps](COPILOT-INTEGRATION-VERIFICATION-2026-11-13.md).
The original host described below has exited; its process/open-window statements
are historical, not current host status.

## Outcome and boundaries

**Command-level native selection, real tool dispatch, response handling,
disk persistence and automatic next-question progression PASS. Actual Copilot
agent integration remains BLOCKED. Production intake is unchanged.**

No Computer Use mouse/keyboard interaction was used in this controlled attempt.
The earlier UI automation attempts were stopped after interference detection;
their failures do not establish an API limitation.

No extension was installed or replaced. No application repository, separate SDD
Agent, existing PBI session, business logic, source-analysis engine, SQL/GraphQL
mapping, approval gate or Phase 06 handoff was modified. No package, release,
deployment, publication or push was created.

## Phase 00 baseline and architecture freeze

The 5.8.0 source directory has no Git repository metadata: `git status --short`
reports "not a git repository". Branch, commit and a trustworthy Git working-tree
diff are therefore unavailable. Existing unrelated files were not reset,
removed or regenerated. The changed-file inventory below records this work;
it is not a claim that the rest of the directory was originally clean.

| Active component | Inspected responsibility |
| --- | --- |
| `maintainer/src/core.js` | Shared offline Builder engine, generated editor profiles, source registration, workflow routing, PBI refinement, questions and approval checks. |
| `maintainer/src/ui.js`, generated HTML | Existing optional browser workflow. Not replaced or rebuilt. |
| `vscode-pbi-builder/extension.js` | Production commands, Builder-location resolution, Webview and `akzo_pbi_intake` registration. `open` returns before confirmation; manual continuation copies a prompt. |
| `vscode-pbi-builder/controller.js` | Revisioned canonical intake state; required-field validation, Back, edit, save, confirmation and stale/duplicate rejection. |
| `vscode-pbi-builder/builder-workflow.cjs` | Confirmed-only idempotent import, attachment processing, canonical decision persistence. |
| `maintainer/src/phase01-contracts.js` | Schema/provenance/fingerprint bindings and planning/authorization contracts. |
| `maintainer/src/sql-metadata.js` | SQL export parsing, relational evidence and source freshness. |
| `maintainer/src/graphql-intelligence.js` | Explicit operation-to-SDL assignment and validation. Reference artifact hashes are recorded in `maintainer/reference-fingerprints.json`. |
| `maintainer/src/refinement-quality.js` | Existing completeness dimensions, evidence/blocker checks and planning readiness. Its weighted scores are not empirical technical-correctness percentages. No scoring rules changed. |
| `maintainer/src/phase06-handoff.js` | Separate v2 authorization/export/result contracts, selected-child identities, dependency and fingerprint validation. |

The existing intake contract remains:

`PBI_NUMBER -> TITLE -> DESCRIPTION -> ACCEPTANCE_CRITERIA -> ATTACHMENTS ->
REVIEW -> CONFIRMED`

Its terminal confirmation is explicit. Missing or cancelled input is not consent.
Targets and source questions are currently outside those five canonical intake
answers; no new production schema or target defaults were introduced.

Earlier 5.7.0 code supplied native `vscode/askQuestions` argument examples for
single-select sources and multiselect targets, with persistence/navigation
instructions. It was not a QuickPick extension. The historical parent
`vscode-chat-poc` uses a deprecated participant and an undocumented command to
prepare an unsent prompt; it is not the replacement intake mechanism.

### Frozen production fingerprints

SHA-256 recorded during this work; these files were not edited:

| File | SHA-256 |
| --- | --- |
| `vscode-pbi-builder/extension.js` | `2b5b8bc8049b374f3cd1242221fc3cd628121ff15d9288f5822958e6e2d5b4b7` |
| `vscode-pbi-builder/controller.js` | `13b5a131e527458beafed39aced9cbd505d203932d6be900be0d7c8eeb5fc9ab` |
| `vscode-pbi-builder/builder-workflow.cjs` | `a590646a75691aeb78bc40a250086610310926721506fea7feac0fe5b142233d` |
| `maintainer/src/core.js` | `7c116d3374c9548d6d099737ec279a6ca82e2618f771f89a0ef18576e04d8f85` |
| `maintainer/src/phase01-contracts.js` | `5f0c3afd25ac016e30bf54dfbc55a84fbe53da46665fd17a3abb0dfe27394e06` |
| `maintainer/src/phase06-handoff.js` | `188baabea7327c21f2284a9a4e450b632e125d4502fe4450a695ce4a6ddf713f` |

## Controlled host and actual evidence

The host was launched using supported development/test command-line switches:
isolated `--user-data-dir`, empty isolated `--extensions-dir`,
`--extensionDevelopmentPath` and `--extensionTestsPath`. The workspace was only
the diagnostic source folder, not an application repository. Updates were
disabled in the isolated settings only; no trust/security setting was disabled.

All run artifacts are under this session artifact root:

```text
C:\Users\RGA\.copilot\session-state\31598d29-0620-4cab-ad80-62cb8c06e677\files
```

Evidence relative to that root:

| Evidence | Path |
| --- | --- |
| Activation/registry checks | `quickpick-results-20261113-2234\bootstrap.json` |
| Returned completion | `quickpick-results-20261113-2234\manual-command.json` |
| Machine-readable evidence summary | `quickpick-results-20261113-2234\evidence-summary.json` |
| Current synthetic state | `quickpick-host-20261113-2234\User\globalStorage\akzo-pbi-poc.akzo-pbi-native-selection-poc\state.json` |
| Structured trace | Same storage directory, `results.json` |
| Extension Host activation log | `quickpick-host-20261113-2234\logs\20261113T223855\window1\exthost\exthost.log` |
| Immutable diagnostic log | Same `exthost` directory, `akzo-pbi-poc.akzo-pbi-native-selection-poc\AKZO Native Selection Diagnostic.log` |
| Copilot model availability messages | `quickpick-host-20261113-2234\logs\20261113T223855\window1\renderer.log` |

The actual Extension Host PID was **25628**, in isolated Code main process
**31196**, VS Code **1.146.0**. Process command-line inspection confirmed the
isolated directories and development/test entry points. The launcher completed,
but the isolated GUI host was separately verified still running.

### Live stage results

| Stage | Status | Actual evidence |
| --- | --- | --- |
| Launch isolated Extension Development Host | PASS | Process command line, bootstrap, real Extension Host log. |
| Activate diagnostic extension | PASS | Activation at `2026-11-13T17:09:03.047Z`; Extension Host activation entry. |
| Register/list native tool | PASS | `bootstrap.json`: `toolRegistration: PASS`, `toolListed: true`. |
| Command invokes the same registered implementation | PASS | Command uses real `vscode.lm.invokeTool`; `tool_invoked` start/resume trace entries. No mock in the live host. |
| Manual native selection | PASS | Actual result: mode `quick`; targets `cdms`, `dab`, `ui`. No automated mouse/keyboard input was sent. |
| Tool response reaches command handler | PASS | Two `command_response_handler_received` log entries, each with `persistedStateVerified: true`. This is not a Copilot response handler. |
| Automatic next-question progression | PASS - command harness only | First handler at `17:10:32.584Z`; automatic resume at `.640Z`; next picker requested at `.755Z`, without a second command. |
| State persisted to disk | PASS | Command reread `state.json`; final disk state has the same run ID, mode and targets as the returned result. |
| Live cancellation and recovery | BLOCKED | No Escape/cancelled result yet captured; manual test requested. Automated cancellation/reactivation tests pass separately. |
| Live process-restart recovery | BLOCKED | Disk persistence is verified, but a manual close/relaunch/resume has not yet been performed. |
| Capture completion/cancellation flags | PASS for completion; BLOCKED for live cancellation | Actual result has `completed: true`, `cancelled: false`, `nextQuestion: null`, `analysisStarted: false`. |
| Record logs and diagnostic results | PASS | Paths above; no application or production-session storage used. |
| Actual Copilot discovery/invocation | BLOCKED | No actual chat invocation captured. Isolated bootstrap reports `copilot: null`; renderer reports `no-model-at-toolbar-build` for `agent-host-copilotcli`. |

Run ID: `99a194f0-56c1-449f-87d6-f134bc0480bf`.
Completion was captured at `2026-11-13T17:10:46.142Z`.

The native QuickPick and Language Model Tools registration/invocation APIs
worked in this host. The remaining agent boundary is not established by that:
no authenticated actual Copilot invocation/result/automatic next call exists
in the captured evidence. No unsupported-API conclusion is inferred from an
absent extension or initial model-availability message. Nothing was installed
to force a different outcome.

During evidence review, a diagnostic-only reference-aliasing bug was found:
earlier entries in `results.json` could acquire later answer values. The native
log-channel lines were already serialized and preserve the correct timeline.
The recorder now snapshots entries immutably, with an automated regression.
Use the immutable log and returned completion for this first live run's temporal
evidence; do not treat its earlier JSON snapshots as independent historical
states. The host had loaded the pre-fix recorder; its next reload will use the
fix. No live result for that recorder reload is claimed.

## Automated results and historical failures

Initial earlier inspection: historical participant suite had two failures
(`vscode` and `both` chat-open paths). Root cause: it accepted only the old
`AKZO PBI Builder [VS Code]` name, while current generated VS Code profiles use
`AKZO PBI Builder`. The historical experiment now accepts exactly the current
or earlier VS Code name and uses that validated installed name. Visual Studio
and unrelated names remain rejected. It still does not auto-submit chat or
establish current participant support.

Reproducible combined baseline command from the source root:

```powershell
node --test ".\vscode-chat-poc\native-selection\test.cjs" ".\vscode-chat-poc\test.cjs" ".\vscode-pbi-builder\test-controller.cjs" ".\vscode-pbi-builder\test-extension.cjs" ".\vscode-pbi-builder\test-webview.cjs" ".\vscode-pbi-builder\test-workflow.cjs" ".\maintainer\test-intake-contract-lock.cjs" ".\maintainer\test-phase01-contracts.cjs" ".\maintainer\test-phase04-coordinator.cjs" ".\maintainer\test-phase05-planning.cjs" ".\maintainer\test-graphql-intelligence.cjs" ".\maintainer\test-sql-metadata.cjs" ".\maintainer\test-interactive.cjs" ".\maintainer\test-modules.cjs"
```

Result: **65 runner entries passed, 0 failed**, approximately **21.3 seconds**.
Some legacy files contain their own assertion runners; this number is not a
count of individual assertions. The planning script explicitly printed
**SKIP real Agent integration** because `AKZO_SDD_AGENT` was not set. Node's
outer skipped counter does not represent that internal conditional skip.
The SQL script also reported the optional duplicate schema export absent.
Neither unavailable check is concealed as a pass.

After the diagnostic immutable-snapshot correction, the 19 diagnostic and
historical participant tests passed again. Production code did not change.
No dependencies were installed.

The baseline validates existing schema/provenance, SQL/GraphQL mapping,
coordinator, planning, approval and fixture persistence behaviors. It does not
prove semantic correctness of an actual application's PBI or a real SDD Agent
handoff. Existing v2/G4 documentation and Builder-side code were inspected;
the separate Agent was not run or modified.

## Compatibility, scope and release gates

Both existing intake JSON files in the normal profile were read using the
unchanged production controller in the earlier check. Their fingerprints were
rechecked in this follow-up and remain:

| Session | SHA-256 |
| --- | --- |
| `intake-aa8fdd55f1b9bf48222f76e3c589b91f` | `7056829c4248eef3b4e6837e8280fe0c6fa1e1bd5a619bec375cbd23f706469d` |
| `intake-389645d7db6d23fc3f37aa355562ef26` | `56270df6b166b3ac39bec0617e54208c36ea052860f0b407b3d6078a3bd3630d` |

The following requested master-engineering outcomes are intentionally not
claimed delivered by this diagnostic:

- Restored production intake, Back/Next/Edit and automatic Deep Analysis:
  **BLOCKED** on actual agent live integration and separate production approval.
- Requirements, source-intelligence, decomposition and new quality-gate changes:
  **NOT IMPLEMENTED**; baseline components/tests recorded, no concrete PBI
  requirement supplied for application-specific investigation.
- Phase 06 v2/G4: **PRESERVED**, Builder-side baseline regressions pass;
  real consumer/authorization round trip remains **BLOCKED**, not verified.
- Redundant functionality: historical participant and clipboard continuation
  are candidates only. **Nothing removed** before replacement/migration passes.
- Performance: regression timing recorded, **no before/after improvement claimed**.
  Human wait time is not UI execution time or source-analysis performance.
- Complete live journey, technical PBI, full handoff and release readiness:
  **BLOCKED / NOT PRODUCTION-READY**.

## Exact source changes

- `vscode-chat-poc/native-selection/package.json`: diagnostic tool and commands.
- `vscode-chat-poc/native-selection/extension.js`: shared tool/command native
  selection, synthetic persistence, response tracing and immutable evidence.
- `vscode-chat-poc/native-selection/test.cjs`: focused automated diagnostics.
- `vscode-chat-poc/native-selection/host-test.cjs`: real Extension Host bootstrap
  and manual test runner; no UI automation.
- `vscode-chat-poc/native-selection/README.md`: current procedure and API evaluation.
- `vscode-chat-poc/extension.js`: historical name-compatibility correction only.
- `vscode-chat-poc/test.cjs`: current-name expectations and legacy-name rejection checks.
- `vscode-chat-poc/README.md`: historical limitation and diagnostic link updates.
- `docs/QUICKPICK-DIAGNOSTIC-2026-11-13.md`: this baseline/evidence report.

Isolated profile settings, logs and synthetic results live in the session
artifact directory, not in production profile/application data.

## Next approval boundary

Finish manual cancellation/recovery and actual Copilot discovery/invocation
without installing anything or changing the production agent. The user must
perform native selection/chat actions; no Computer Use retry is planned.

Only after that integration gate passes, request separate approval for a
minimal production adapter: reuse the existing controller and confirmed import,
keep the active tool call pending until explicit confirmation, return saved
canonical answers to the calling agent, and resume the existing analysis router.
Do not replace the analysis engine, decision rules, reference mapping, approvals
or handoff. This is a conditional proposal, not an implemented or authorized change.

The production decision was requested after diagnostics; the user was unavailable.
No production approval was inferred. The isolated host remains open for manual
cancellation/recovery tests; it is not an agent promise to continue background
engineering or monitor results after this response.
