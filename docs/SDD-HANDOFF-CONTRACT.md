# PBI Builder → Akzo Master SDD agent: development handoff contract (5.8.0)

For the maintainers of the Akzo Master SDD agent. It describes what PBI Builder 5.8.0 hands over, how to verify it, what
SDD 4.2.7 does with it, and the consumer changes still needed for the separate legacy handoff-v1 path. It implements the Builder side of
SDD-TWO-AGENT-AUDIT-2026-11-07 (P0-5, P0-6, P0-7, P0-10 and P1-5). Observations about SDD 4.2.5 come from running its
unmodified helper (`copilot/modules/investigate/scripts/akzo.ps1`) in `maintainer/test-570.cjs`; no IDE session was run.

## What the Builder produces
Approve & Generate writes, in one transaction with the approval and in Chat (PowerShell) and the form (browser) alike, into
`playbook/pbis/<folder>/`:

| File | Content |
| --- | --- |
| `Refined-PBI-<CDMS\|DAB\|UI>.md/.json/.docx` | One Refined PBI per selected implementation target; `REFINED-PBI.*` without a target |
| `business-rules.json` | schemaVersion 2 (below) |
| `BRANCH-COVERAGE-MATRIX.md` | The same branches as a table |
| `HANDOFF-MANIFEST.json` | Binds the files above to the approval |

Both engines write `business-rules.json`, `BRANCH-COVERAGE-MATRIX.md`, `HANDOFF-MANIFEST.json` and every `Refined-PBI-*.json`
byte for byte alike for the same state; only the `.md` and `.docx` renderings differ between Chat and the form.

The ZIP (`<folder>-final-pbis.zip`) keeps the 5.x layout: the files above at the root, attachments under `attachments/`,
working records (`pbi.json`, `pbi-state.json`, `REQUEST.md`, `DRAFT-PBI.md`, …) under `supporting/`.

## business-rules.json schemaVersion 2
Everything in schemaVersion 1 is kept unchanged; added:
- `rules[].evidence[].repository` and `rules[].branches[].evidence[].repository`: the `pbi.json` repository key the source belongs to.
- `decisions[].decision`: the decision text.
- `acceptanceCriteria[]`: every criterion with `id`, `rev`, `type`, `rules`, `criterion`.
- `questions[]`: `id`, `status` (`open`, `answered`, `deferred`, …), `blocking`, `decisionRef`. **`answered` is an answer**:
  the Builder never writes `resolved` for an answered question.
- `technicalRevalidation[]`: the IDs of the evidence the rules cite (historical evidence excluded): re-check these against
  today's code instead of investigating the business rules again.

## HANDOFF-MANIFEST.json (schema `akzo-pbi-handoff`, version 1)
| Field | Meaning |
| --- | --- |
| `schema`, `schemaVersion` | Contract name and version |
| `producer` | `name` (`Akzo SDD PBI Builder`), `version` |
| `disposition`, `status` | Always `DEVELOPMENT_READY` and `Development-Ready` in a written manifest (none is written otherwise) |
| `pbi` | `id` (folder name), `number`, `title`, `folder` (where it was generated; informational, the PBI may move between `playbook/pbis` and `Source/playbook/pbis`), `stateSchema` |
| `approval` | `by`, `at`, `evidence`, `reviewedContent` (64-hex reviewed-content fingerprint), `fingerprint` (16-hex approval basis) |
| `readiness` | `computedStatus`, `finalAllowed`, `issues`, `warnings` at generation |
| `target` | `key` (e.g. `dab`), `label` (e.g. `DAB + UI`), `implement` and `reference` repository keys; `null` without a target |
| `repositories[]` | `key`, `area`, `use` (`implement` or `reference`), `path` as configured |
| `documents[]` | Per implementation target: `area`, `md`, `json`, `docx`, `repository` (its path) |
| `requirements[]`, `acceptanceCriteria[]` | Rule `id`/`rev`/`kind`; criterion IDs |
| `decisions[]`, `questions[]` | IDs and statuses (`questions[]` also `blocking`, `decisionRef`) |
| `evidence[]` | `id`, `repository`, `system`, `level`, `kind`, `source`, `location`, `revision`, `sha256`, `verification` |
| `files[]` | `path` (relative, `/`), `role` (`refined-pbi`, `business-rules`, `branch-coverage-matrix`), `target`, `bytes`, `sha256` |
| `attachments[]` | `path` (`attachments/<name>`), `bytes`, `sha256` of the PBI folder copy |

The manifest does not list or hash itself. A matching hash shows a file is unchanged since generation; it does not prove who
produced it.

## Golden package
`maintainer/fixtures/golden/pbi-309446-final-pbis.zip` is a real Download Complete Package from this Builder (309446-shaped
DAB + UI PBI, six answered questions, Legacy and CDMS as references, one attachment), regenerated with
`node maintainer/make-golden-package.cjs` on every release. `test-570.cjs` fails when it is from another Builder version or
when a freshly generated package has other file names, schemas, roles or status values. Copy it into the SDD agent's test
fixtures and import it there; delete its HANDOFF-MANIFEST.json for the "no manifest" case, or edit a file for the "tampered" case.

## Verifying a package
Accept a handoff only when all hold (the Builder's own `StartDevelopment` checks the same and more):
1. `schema` is `akzo-pbi-handoff`, `schemaVersion` is 1, `disposition` is `DEVELOPMENT_READY`.
2. Every `files[].path` is relative, has no `..`, is not `HANDOFF-MANIFEST.json` and not under `history/`, and its SHA-256
   matches. In a ZIP the same paths are at the root.
3. `approval.by`, `approval.at` and `approval.reviewedContent` equal `approvals.user` (and its `basis.reviewedContent`) in
   `pbi-state.json`.
Never treat `business-rules.json` without such a manifest as approved: Export developer handoff writes it for working drafts.

## Importing with SDD 4.2.5 today
Builder Start Development prints one command per implementation target:

    & "$env:USERPROFILE\.akzo-agent\modules\investigate\scripts\akzo.ps1" pick -Source '<repository>\playbook\pbis\<folder>' -File 'Refined-PBI-DAB.md'

With `-File`, SDD 4.2.5 imports the right document from the folder and from the ZIP (verified for DAB and UI of the 309446
shape): `refined-pbi.md` is the target's Refined PBI, `suggestedId` is the PBI number, the handoff files, records and the
attachment are supporting documents, and no attachment is reported missing.

## Builder-native Phase 05 child export (not an SDD handoff)
Builder 5.8.0 can separately export
`akzo-builder-native-child-implementation-package` schemaVersion 1 after a current package approval
and a separate durable implementation authorization bound to the exact selected child IDs. The
export includes evidence hashes, child-to-requirement/business-rule traceability, shared UI work,
dependency edges and implementation order. It is intentionally not an `akzo-pbi-handoff` v1
package: `handoffReady` and `implementationStarted` are false, it creates no Azure DevOps work
items, and it does not invoke or authorize the installed SDD agent. SDD 4.2.5 has no child-package
import contract, so consumers must not pass this file to `akzo.ps1 pick` or treat it as an approved
SDD handoff. The deterministic fingerprints are content bindings, not digital signatures.

## SDD Agent 4.2.7 child handoff v2

The child protocol is a separate, single-file JSON exchange. It does not replace or extend the approved PBI handoff v1
contract above. Do not pass `PBI-SDD-Child-Handoff-v2.json` to `pick`, `continue`, or the v1 ZIP/folder importer. The v2
path does not accept archives and does not extract package contents.

The Builder exports protocol `AKZO-SDD-BUILDER-AGENT` version 2 in
`PBI-SDD-Child-Handoff-v2.json`. Its outer envelope uses schema `akzo-sdd-child-handoff`, version 2, a canonical payload
and a SHA-256 fingerprint. The payload binds the Builder 5.8.0 package/revision, planning fingerprint, Parent PBI,
selected child identities/revisions, repository scopes, evidence hashes, acceptance criteria, traceability, dependency
graph, readiness report, planning approval, native child-selection authorization, and a distinct handoff authorization.
That authorization is an explicit Builder coordinator action bound to the exact selected children and current package.
The SHA-256 value detects content changes; it is not a digital signature and does not authenticate the named approver.

The Agent commands and safe sequence are:

1. `buildercapabilities` returns protocol/capability negotiation for the installed Agent. v2 requires Agent source version
   4.2.7 or later within the 4.2.x series and declares child import, plan-only, scope/dependency validation, and structured results.
2. After the user explicitly confirms import, run
   `builderimport -Source "<absolute path to the v2 JSON>" -Confirmed`. The package's Builder approvals do not imply
   user consent to import. `HANDOFF_ACCEPTED` saves a validated copy under Agent-owned state and returns a correlation
   identity and child list; `ALREADY_IMPORTED` means the same package identity, revision and fingerprint were previously
   imported. Changed content reusing an existing identity/revision is rejected.
3. Ask the user to select one child and use its registered repository scope:
   `builderplan -Source "<Agent-owned handoff-v2.json>" -Id "<child id>" -Repo <registered repository id>`.
   The command revalidates in-scope evidence hashes, rejects repository mismatches and invalid scope/path/dependency data,
   and requires verified `COMPLETED` results for every predecessor. It writes only a child-specific plan under Agent
   state and reports `CHILD_PLAN_READY` or `CHILD_PLAN_BLOCKED`; it does not edit application source.
4. Continue through the normal Agent workflow. Import, child selection, and plan generation are not permission to edit.
   The existing G4 implementation-plan approval remains mandatory before source writes.
5. After authorized work, create a structured result JSON containing `executionStatus` (`COMPLETED`, `FAILED`, or
   `BLOCKED`), `changedFiles`, `testsExecuted`, `testsPassed`, `testsFailed`, `testsNotRun`, `blockers`, and
   `evidenceReferences` arrays. Export with
   `builderresult -Source "<Agent-owned handoff-v2.json>" -Id "<child id>" -Repo <registered repository id> -Report "<result.json>"`.
   A completed result is rejected for export unless the current normal G4 approval is present, and cannot claim blockers,
   failed tests, or not-run tests. The result is bound to the package, correlation, child revision and repository scope.
6. Import the emitted `result-<child id>.json` through the Builder's separate result-import action. Results are stored in
   `PBI-SDD-INTEGRATION-RESULTS.json`, not in the approved planning extension. Identical repeats are idempotent; a
   conflicting result for the same child revision is rejected.

The Agent treats package contents as untrusted data, requires an actual explicit import confirmation, maps only registered
`cdms`, `dab`, and `ui` scopes, checks repository/evidence paths for traversal and reparse points, and stores handoff
state only in its secured local state directory. A `BLOCKED` result is a valid report of non-completion; it is not
evidence that tests ran or that implementation was authorized. The protocol is a local handoff, not an Azure DevOps work
item, a release, a deployment, or a digital signature.

## Original v1 consumer audit (historical)

This checklist records issues observed against SDD 4.2.5 and Builder 5.7.0. It is retained as v1 compatibility history,
not as a v2 implementation checklist; verify the current Agent source before treating any item below as outstanding.
The child protocol described above does not change this legacy contract.
1. **Know the 5.5+ document names (P0-1).** `$BuilderDocs` in `akzo.ps1` lists only `REFINED-PBI.md`, `PBI-CDMS/DAB/UI.md`,
   `CDMS-/DAB-REFINED-PBI.md`. Add `Refined-PBI-CDMS.md` (cdms), `Refined-PBI-DAB.md` (dab) and `Refined-PBI-UI.md` (ui).
   Today, without `-File` (including Start-Development.cmd → Browse), SDD 4.2.5 imports **DRAFT-PBI.md** from any 5.5+
   package, the multi-document choice never appears, and each `Refined-PBI-*.json/.docx` is flagged "second primary PBI".
2. **Treat `answered` as answered (P0-2).** `openQuestions` keeps every status but `resolved`; the Builder writes
   `answered` (and `deferred`). Read `questions[]` from business-rules.json or the manifest.
3. **Verify HANDOFF-MANIFEST.json before import (P0-3)** as above; refuse, or warn and ask, on a mismatch. Use `documents[]`
   for the per-target choice and recommend the one whose `repository` is the open workspace.
4. **Map evidence with `evidence[].repository` (P0-9).** Sources are relative to the Builder repository (`DAB Repo/...`);
   strip the matching `repositories[].path` before looking the file up in a registered repository.
5. **Keep `use: reference` repositories read-only (P1-1)** (Legacy and CDMS for DAB + UI), and treat other targets' Refined
   PBIs as related references, not as a second primary PBI.
6. **Reuse the approved business content (P0-4):** Builder BR and AC IDs, decisions and `technicalRevalidation[]`, instead of
   re-extracting requirements or re-asking PO/BA questions; a business change goes back to the Builder.
7. **Keep explicit PBI selection and implementation approval.** The Builder never starts the SDD agent and never approves
   implementation; queuing a PBI is not consent to implement it.
8. **Test with the golden package (P0-10)** instead of hand-written fixtures with pre-5.5 names.
