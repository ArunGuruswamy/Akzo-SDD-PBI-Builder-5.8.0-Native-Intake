# PBI Builder 5.7.0 - interactive verification

## Follow-up: the selected AN.ColorDMS.Customizations VS Code agent

**LIVE UI NOT VERIFIED in this follow-up. The selected installed copy has not
been repaired or upgraded.** The application repository was inspected read-only.
No new prompt instructions, runtime UI implementation, release or installation
was added in this follow-up: the current generated startup correction already
exists, but the selected application installation does not contain it.

### Confirmed installed root cause

The actual registered file is
`C:\Users\RGA\source\repos\AN.ColorDMS.Customizations\.github\agents\akzo-sdd-pbi-builder-vscode.agent.md`.
Its name exactly matches the reported selected agent. Its frontmatter already
allows `vscode/askQuestions`; selecting a different agent is not the fix.

Its router loads `playbook/pbi-builder/skills/stage-intake.md` on Start, but the
**installed** module still says "asked together in one message" and "Otherwise
ask once, in one message". The installed
`.github/prompts/akzo-pbi-new.prompt.md` likewise says "Start PBI. In one message,
ask only for what is missing". These statements directly explain the observed
plain-text questionnaire. The exact user-entered command is reported as Start
PBI; no retained host log was available to independently establish whether that
particular run used Start PBI or the `/akzo-pbi-new` prompt alias. Both installed
paths contain the same defect.

All three installed startup files match their installed ownership hashes, but
**none matches the current generated development source**. Both installations
call themselves 5.7.0; version equality is not content equality. This is a stale,
intact installation, not evidence that the updated native flow ran and failed.
[Read-only hash comparison and host findings](docs/interactive-verification/selected-vscode-agent.json)
record the exact SHA-256 values.

### Identified executable UI mechanism

The exact local executable is
`C:\Users\RGA\AppData\Local\Programs\Microsoft VS Code\Code.exe`, version 1.145.2.
The installed host's bundled `out/vs/workbench/workbench.desktop.main.js`
registers the executable `vscode_askQuestions` tool as `askQuestions` and accepts
the `vscode/askQuestions` reference already permitted by the selected agent.
Its implementation converts tool arguments into the **native chat question
carousel**, then converts the user's answer to `selected`, `freeText`, `skipped`.
This is a supported native inline question UI, not a separate modal window:

- No options -> text input.
- Options with `multiSelect: false` -> single-choice control.
- Options with `multiSelect: true` -> multiple-selection control.
- Free text defaults to enabled unless explicitly disabled.
- `recommended` options become defaults, so the existing corrected intake
  arguments omit them for source and targets.
- Autopilot or `chat.autoReply` can return an automatic "user unavailable"
  response instead of waiting for input. The user's exact session setting was
  not accessible and is **not** asserted to be the cause.

The registered custom-agent Markdown is not an executable VS Code command
handler. The Copilot model must actually invoke this built-in tool; displaying
the allowed tool in frontmatter does not itself call it. The inspected installed
startup tells that model to print text instead. No terminal exception or blocked
PowerShell helper is necessary to explain that routing.

The existing Windows Forms implementation in
`maintainer/installer/PBI-Builder-Setup.ps1` provides **installation/setup**
controls, not a PBI-details/source/target intake window. The installer's folder
picker and `Read-Host` prompts likewise are not the missing intake UI. Wiring
them as a new intake application would not be a minimal reuse of a working
approved intake dialog. The existing browser form remains the implemented
alternative when native questions are unavailable.

### Correction and focused regression

The correction is already present in the working source: all startup aliases
route to the interactive intake module, which invokes the actual question tool,
uses fixed single/multi-select arguments, preserves canonical saved intake and
discloses a fallback rather than pretending text is a popup. Updating only this
checkout cannot change an older installed agent in another repository.
**No extra prompt wording was added as a substitute for updating that copy.**

This follow-up adds one focused executable regression to
`maintainer/test-interactive.cjs`: an intact, same-version old agent/module/prompt
must produce reviewed `update` rows through the existing installer engine;
unapproved updates are refused; an explicit approved update replaces them while
preserving PBI state; user-edited installed files remain conflicts. This validates
the existing repair path without modifying the application or bypassing release
hash checks.

Command: `node --test maintainer\test-interactive.cjs maintainer\test-modules.cjs`.
Result: **12 passed, 0 failed, 0 skipped**. CRLF-aware `git diff --check` passed.
This follow-up changed only this report,
`docs/interactive-verification/selected-vscode-agent.json` and
`maintainer/test-interactive.cjs`. No runtime source, generated agent or installed
application artifact was changed in this follow-up. Earlier implementation and
regression results below remain separately identified.

### Actual live attempt and limitations

The exact Code executable was launched against the existing isolated fixture.
The real agent selector exposed both generated profiles; the VS Code fixture
agent was selected through its native toggle control, and the chat input's
accessible name confirmed that selection.

However, foreground activation failed the safety check, and the native
ValuePattern setter did **not** retain `Start PBI` in the chat input. The Send
button remained disabled. No keyboard input was injected into an unverified
foreground window. Therefore **Start PBI was not actually submitted in this
follow-up**, and details/source/multi-select/Cancel/returned state are all
**NOT VERIFIED**. The latest Code diagnostic directory had no log files; no
absence of exceptions or native-tool invocation is inferred from that.

The earlier partial native tests below are historical evidence, not a substitute
for this requested complete live test. The follow-up evidence JSON records the
failure to submit, not a successful popup.

### Precise manual acceptance steps

1. Use this same Code executable, signed into Copilot, with Interactive mode
   and `chat.autoReply` disabled for the acceptance run. Do not change global
   settings merely to test. Record the version and permission setting.
2. Keep the application repository read-only. In the existing isolated
   Interactive Acceptance Fixture, verify that installed agent/module/prompt
   hashes match the corrected source. For the actual application-selected
   agent to change, a separately authorized per-repository update from a
   checksum-valid package is required. Do **not** use the modified checkout's
   stale manifest or overwrite installed files by hand.
3. Open a **new chat**, select the fixture's **VS Code** PBI Builder agent and
   type exactly `Start PBI`. Record the selected agent file and tool invocation.
4. Confirm a native inline input card appears. Enter a unique synthetic number
   and title, a short description, and either criteria or "Not available yet".
   Choose no attachments, then separately test the host attachment button
   with a synthetic file. A native question is not an attachment picker.
5. Confirm the next source card contains four actual fixed choices. Select
   **Legacy ColorDMS**. No free-text number such as `1,2` should be needed.
6. Confirm the target card initially has no selected targets. Select **DAB**
   and **Shared Angular UI**, leaving CDMS unselected. Submit and verify the
   summary contains exactly those two targets.
7. Choose correction, change only the title, and verify other answers remain.
   At confirmation choose **Cancel**. Verify there is no analysis continuation,
   approval, handoff or ready-for-analysis state. Any saved draft remains draft.
8. Start again with a fresh identifier, repeat the selections and explicitly
   choose Start. Inspect saved `pbi.json`: canonical `number`, selected
   `legacy.key`, `application: "dab"` (DAB + UI), optional criteria mode and
   `wizard` object. Resume must not repeat captured fields.
9. Record screenshots of actual cards, tool results, canonical saved state and
   cancellation. If a tool is absent, capture that fact and verify an explicitly
   labelled browser alternative; do not score a text list as native UI.

The exact selected application installation remains unchanged under the explicit
"do not modify application repositories" constraint. Its correction cannot be
claimed applied without authorizing that update. Release readiness remains
**NOT READY**.

## Release decision

**NOT READY for an interactive-workflow release.**

Actual native questions were exercised in both VS Code and Visual Studio 2026.
This is not a claim that the complete required workflow passed. Visual Studio
displayed a radio-only target question and wrote non-canonical intake metadata
before the final capability/schema guards. VS Code's native session ended before
source, targets and confirmation were completed. The final guards have automated
coverage, but have not completed a fresh, end-to-end live acceptance run in either
IDE. Production installations were not upgraded.

The existing browser form was also exercised as a **real rendered local page**,
not only through a simulated DOM. Its independent checkboxes, correction and
actual downloaded intake ZIP were verified. This is a supported browser
alternative, **not an IDE popup**.

Status definitions: PASS = observed live; FAIL = observed broken;
BLOCKED = required host unavailable; NOT VERIFIED = no completed actual live test.
Both IDEs were available; incomplete tests are not described as host-unavailable.

## Root cause and invocation trace

1. The installed custom agent routes `Start PBI`, `Create PBI`, `New PBI` and the
   generated new-PBI prompt into the intake stage.
2. Those generated surfaces disagreed: the stage, prompt and generated README
   explicitly requested all intake answers together in one text message.
   Frontmatter advertising a question tool did not cause an invocation.
3. The Visual Studio agent allowlist omitted the host's actual `ask_question`
   tool and requested unavailable `code_search` / `find_references` tools.
   This produced a **real missing-tools banner**:
   [original Visual Studio failure](docs/interactive-verification/visualstudio-startup.png).
4. After correcting that profile in a valid isolated package, Visual Studio
   invoked its native question control. Its live target question said
   "Select at least one" but displayed radio buttons. Multiple-choice and
   multi-select are not interchangeable.
5. The native Visual Studio agent also saved `pbiNumber`, `source`,
   `developmentTargets` and `wizardStage`, which the existing browser draft
   loader does not consume. Merely capturing a result was therefore insufficient
   to establish compatible persistence or Resume.
6. User feedback reported repeated source questions after free-text `1.2` and
   `1,2`. Inspection of the actual VS Code 1.145.2 bundled question schema
   confirmed that `allowFreeformInput` defaults to true and omitted `options`
   produces free text. The intake module now supplies explicit source/target
   argument examples, fixed options, `allowFreeformInput: false`, correct
   `multiSelect` values and canonical result mapping. Ambiguous text is never
   interpreted as a repository. One retry is allowed before reporting the
   limitation and offering the browser form; it must not loop indefinitely.

No PowerShell desktop popup is used as an IDE-native substitute. No new desktop
application, extension, analysis engine or approval mechanism was introduced.

## Implemented interaction

- **Details:** short native free-text questions for missing number, title and
  description; optional criteria and attachments. A question tool is not a file
  picker: use the actual chat attachment control or existing form file input.
  Vague captured criteria remain refinement inputs, not approved requirements.
- **Source:** one of Legacy ColorDMS, CDMS, DAB or Shared Angular UI, mapped to
  configured keys/paths. The form starts with no source selected, disables
  unconfigured options and does not remember a previous PBI's source.
- **Targets:** independently select CDMS, DAB and/or UI, with no default.
  VS Code argument examples use `multiSelect: true` and no recommended/default
  option. Visual Studio must disclose its observed single-choice limitation and
  offer the existing browser checkboxes, or explicit separate Yes/No questions
  if the browser form cannot be used. The latter is not called multi-select.
- **Confirmation:** concise summary; Start, correction, Save draft and Cancel.
  Analysis must not start on correction, cancellation, skip or an automatic
  "user unavailable" response.
- **Persistence:** existing `pbi.json` field names and `wizard` object are
  documented in the stage, including the backward-compatible target keys.
  `cdms` and `dab` historically include UI; backend-only choices are
  `cdms-only` and `dab-only`. The browser continues to use the existing typed-by-
  validation `newPbi` serializer, not a second metadata writer.
- **Resume fallback:** `PBI-Builder.html#draft=<URL-encoded PBI folder>` restores
  an exact discovered draft after the user selects the installed project root.
  It rejects folders absent from that root's discovered PBIs. It does not read
  arbitrary paths or silently select another PBI. Existing draft status checks
  prevent editing an intake already sent to analysis.
- **Form behavior:** optional criteria become proposed criteria; Review is
  required before saving for analysis or exporting a ready intake. Back retains
  answers. Cancel clears unsaved entries without deleting a saved draft. A
  corrected target selection clears stale validation errors.

Modern source selection does not relabel the configured Legacy repository.
Legacy-first investigation and existing target/reference roles remain intact.

## Live IDE evidence

| Item | VS Code | Visual Studio 2026 |
|---|---|---|
| IDE | 1.145.2; bundled Copilot 0.73.0 | Professional, product version 18.10.12224.181 |
| Installed Builder | 5.7.0 isolated synthetic fixture, not production | 5.7.0 isolated synthetic fixture, not production |
| Agent | Akzo SDD PBI Builder - Interactive Acceptance Fixture (VS Code) | Akzo SDD PBI Builder - Interactive Acceptance Fixture (Visual Studio) |
| Exact startup | `Start PBI` | `Start PBI` |
| Initial native control | PASS: actual number/title/description/optional-criteria question widgets | PASS after profile correction: actual native details question |
| Details result | Submitted `LIVE-INTAKE-1`, synthetic title/description, then unavailable criteria/no attachments | Submitted `VS-LIVE-1`, synthetic title/description, unavailable criteria |
| Source | NOT VERIFIED | PASS: Legacy ColorDMS selected in native single-choice control |
| Target multi-select | NOT VERIFIED | FAIL in observed run: radio buttons, not checkboxes |
| Explicit target result | NOT VERIFIED | Custom Other text explicitly supplied DAB + UI; summary excluded CDMS. This was **not** a multi-select pass |
| Confirmation summary | NOT VERIFIED | PASS: actual native Start/correction/draft choices and correct DAB + UI summary |
| Correction | NOT VERIFIED | NOT VERIFIED: an automation attempt to select Correct details was followed by analysis; the returned correction result was not proven. The run was stopped |
| Saved compatible intake | NOT VERIFIED | FAIL in observed run: non-canonical fields; final schema guidance added afterward |
| Workflow continuation | Native details continued; complete refinement continuation NOT VERIFIED | Source-analysis documents were created; this does not prove a correctly confirmed workflow |
| Cancel and Resume | NOT VERIFIED live | NOT VERIFIED live |
| Complete final-package acceptance | **NOT VERIFIED** | **NOT VERIFIED** |

The native tests used real Windows UI Automation against only the synthetic
windows. Later foreground activation was unreliable; controls with native
Value/Invoke patterns were used without typing into other windows. VS Code's
original synthetic window then became unavailable. Reopening its fixture did
not reproduce the previous registered-agent session. Neither that interruption
nor a green helper test is counted as a pass.

Observable evidence:

- [actual VS Code number question](docs/interactive-verification/vscode-details.png)
- [actual VS native summary read through UI Automation](docs/interactive-verification/visualstudio-native-observation.json)
- [actual VS saved metadata showing the compatibility failure](docs/interactive-verification/visualstudio-observed-intake.json)

Screenshots that only showed an idle chat panel were discarded rather than
mislabelled as proof of displayed questions.

## Live local-browser alternative

The real standalone page was opened locally with `#new`, and the synthetic
installed configuration was imported using its actual file input (ZIP-only mode).
The following actions were performed through the rendered controls:

1. Entered `BROWSER-LIVE-1`, title and description; left criteria absent.
2. Selected the non-sensitive synthetic `Rule.cs` through the real attachment
   input.
3. Observed an initially empty single source select with all four choices;
   selected CDMS.
4. Observed **all three target checkboxes unchecked**. Attempting Next with
   none selected stayed on the target step.
5. Explicitly checked DAB and UI, reviewed the summary, went Back to correct
   only the title, and retained source, description, attachment and targets.
6. Downloaded the actual `PBI-BROWSER-LIVE-1-intake.zip`. The integrated browser
   did not expose a Playwright download event, but the file was independently
   found in Downloads and extracted with Windows PowerShell `Expand-Archive`.
7. Verified exported `application: "dab"`, `legacy.key: "cdms"`,
   implementation repositories exactly DAB/UI, empty criteria with mode draft,
   corrected title, attachment reference and ready-for-analysis wizard state.
   No decision, approval or handoff artifact was in this intake ZIP.

[Metadata extracted from the real browser download](docs/interactive-verification/browser-exported-intake.json)
is retained as equivalent observable evidence. No confidential application
source was used. Browser draft-link Resume, native folder selection, final
Copilot continuation and live Cancel remain NOT VERIFIED; their automated
coverage is not substituted for live acceptance.

## Automated verification

The following commands were run from the product root:

```powershell
node --test maintainer\test-interactive.cjs maintainer\test-modules.cjs
node maintainer\test-ui.cjs
node maintainer\test-core.cjs
node maintainer\test-e2e.cjs
node maintainer\test-ps.cjs
node --test maintainer\test-521.cjs maintainer\test-530.cjs maintainer\test-541.cjs maintainer\test-550.cjs maintainer\test-560.cjs maintainer\test-561.cjs maintainer\test-targeted.cjs maintainer\test-verification.cjs maintainer\test-chat-flow.cjs maintainer\test-570.cjs maintainer\test-modules.cjs maintainer\test-visualization.cjs maintainer\test-interactive.cjs
```

- Final focused intake/module checks: **11 passed**.
- Expanded simulated-DOM UI handlers: **PASS**, including optional criteria,
  no source/target default, corrections, Cancel, saved-draft link restore,
  rejected out-of-root link and no handoff creation.
- Core workflow: **59 passed**; real-file end-to-end: **14 passed**;
  real Windows PowerShell parity/installer checks: **15 passed**.
- Versioned combined regression rerun: **114 tests, 113 passed, 0 failed,
  1 skipped** (the separate Akzo Master SDD agent's own import-helper test:
  that agent folder was unavailable). Final native-schema/canonical-draft
  instruction additions were subsequently covered by the focused 11 checks.
- JavaScript syntax, rebuilt standalone parity and CRLF-aware whitespace checks
  were also performed. Existing mixed line endings in pre-existing test edits
  were not reformatted.

Directly obsolete tests enforcing the old questionnaire wording were updated;
historical module-preservation tests retain exact intentional sentence mappings
instead of weakening preservation of unrelated instructions.

## Release integrity and boundaries

Testing used an isolated session package and synthetic workspace containing
only four tiny fixture source directories and an empty solution. The normal
`maintainer\build.cjs` and `maintainer\release.cjs` process built the test ZIP,
expanded it with the independent Windows ZIP reader and checked every SHA-256.
The existing installer validated that package before installing/updating **only
the fixture**, with its installer profile redirected into session storage.

The development checkout's release checksums were deliberately not refreshed.
Do not install this modified checkout with its old package manifest. A future
approved release must run the normal packaging process and complete the live
acceptance checklist first. Installer "ready" messages describe generated files,
not verified interactive IDE behavior.

No application repository, production installation, installer policy,
`HANDOFF-MANIFEST.json`, handoff contract, approval engine or mandatory artifact
hash algorithm was modified. Existing approval/evidence/handoff regression
coverage passed. No commit, push, deployment, global installation or publication
was performed. Prior visualization changes and unrelated pre-existing test
changes were preserved.

## Changed-file inventory for this fix

| File | Purpose |
|---|---|
| `maintainer/src/core.js` | Actual VS question-tool allowlist; unified startup routing; explicit native schemas and fallback; canonical draft fields; configured source mapping |
| `maintainer/src/ui.js` | Four-source selector, no remembered source, optional criteria, confirmation, Cancel, draft-link restore, accurate modern-source roles and validation feedback |
| `maintainer/src/shell.html` | Optional criteria and accurate native/browser interaction descriptions |
| `maintainer/dom-fixture.json` | Regenerated directly related form fixture |
| `Akzo-SDD-PBI-Builder.html` | Rebuilt standalone product; maintainer build copy regenerated too |
| `maintainer/test-interactive.cjs` | Focused routing, schemas, mapping, target persistence and canonical draft tests |
| `maintainer/test-ui.cjs` | Related browser handler behavior, correction, draft restore and escape rejection |
| `maintainer/test-core.cjs`, `maintainer/test-targeted.cjs`, `maintainer/test-modules.cjs` | Related host-profile and historical instruction assertions |
| `docs/USER-GUIDE.md`, `maintainer/README.md` | Corrected startup/criteria/source guidance and focused test command |
| `docs/interactive-verification/` | Synthetic observed UI/download evidence, including failures |
| `PBI-BUILDER-INTERACTIVE-VERIFICATION.md` | This verification and release decision |

This is not a list of unrelated pre-existing worktree changes or the earlier
visualization implementation.

## Remaining acceptance gate

Using a fresh valid isolated package in **each IDE**, complete:
details and attachment handling -> fixed single source -> explicit multi-target
selection (or the disclosed supported alternative) -> correction -> explicit
Start -> compatible saved metadata -> source investigation -> Cancel and Resume
without repeated captured questions. Verify the final VS Code fixed-option
arguments eliminate the reported free-text loop, and the final Visual Studio
guard chooses the disclosed checkbox fallback rather than radio targets.
Capture the actual returned values and saved state, not just displayed labels.

If agent instructions still cannot reliably invoke the required host controls,
an approved host-specific extension/adapter would need evaluation. None was
silently introduced here. Until that acceptance work passes, the release
decision remains **NOT READY**.
