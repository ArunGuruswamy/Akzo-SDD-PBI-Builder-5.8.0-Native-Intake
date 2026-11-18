# Akzo SDD PBI Builder 5.8.0: user guide

You do not need to know the templates, the code or terms such as plugins or workflows. Describe
what you need in Copilot Chat; the agent investigates configured source and asks only for business
decisions. The HTML form is optional for setup, evidence inspection, dashboards and downloads.

The workflow is: **Configure repositories → Describe the PBI in Chat → Analyze existing flow →
Answer business questions in Chat → Review and approve in Chat → Generate.** The form's journey
bar is optional and reads saved files.

## Start a PBI
**In Copilot Chat.** Select **AKZO PBI Builder** in VS Code or
**AKZO PBI Builder [Visual Studio]**, matching your editor, and type
`Start PBI` (or Create PBI or New PBI). The agent uses supported native questions for
missing details and intake confirmation, then source selection and independent
development targets. Each explicit Create PBI starts with fresh intake state.
Resume PBI restores only the identified draft.
It does not ask for everything in one text questionnaire. Already captured answers are retained;
Back or correction changes only the selected step. Analysis starts only after confirmation.
It then investigates accessible configured repositories without asking
permission to inspect files. It reports source access, verified behavior, differences and only
material unresolved business decisions.

Native controls depend on the host. The Builder uses `vscode/askQuestions` or
Visual Studio's `ask_question` only when available. If the VS Code tool is absent
or fails, the agent reports why and asks only the pending question in chat.
Dismissing the control leaves that field pending and retains any captured answers.
The tested Visual Studio 18.10 control is single-choice, not a
multi-select. For independent targets the agent must report that limitation and offer the existing
browser form's checkboxes (or explicit separate Yes/No questions if the form is unavailable).
Fixed source/target questions in VS Code disable free-text input. Answers such as `1,2` are not
a primary source selection; the agent must not guess or repeat the same failed control indefinitely.
A chat attachment button or the form's file picker handles attachments; a question tool is not a
file picker. Text lists and the browser form are not native IDE popups.
See [live verification](../PBI-BUILDER-INTERACTIVE-VERIFICATION.md) for tested versions and incomplete
acceptance checks; the complete IDE flow is not release-verified.

**Optional form.** Open `playbook/pbi-builder/PBI-Builder.html`, or the package's
`Akzo-SDD-PBI-Builder.html`, choose the repository folder and open the **New PBI** tab. It has
four steps:

1. **Requirements**: PBI number (an Azure DevOps number or your own identifier such as
   `LOCAL-12`), title and description are required; acceptance criteria and attachments are
   optional. Entered criteria are kept exactly; absent criteria are proposed for review, not
   treated as approved requirements. Missing required fields are marked
   where they are, with the reason.
2. **Legacy repository** (the existing step label): select Legacy ColorDMS, CDMS, DAB or
   Shared Angular UI as the source. Unconfigured choices are disabled. The choice starts empty
   each time and never selects a development target. **Validate** lets you browse to the folder to check its name and
   Git root. **Add or remove repositories** takes you to setup; removing a repository there only
   changes the configuration, never the folder.
3. **Development target**: "Which project are you developing the PBI for?" Tick one or more of
   three independent boxes. The UI is always optional: ticking CDMS or DAB never ticks the UI, and
   ticking the UI never ticks a backend. Each ticked target gets exactly one Refined PBI:

   | Ticked | Implemented in | Read only (reference) | Refined PBI |
   | --- | --- | --- | --- |
   | CDMS | CDMS | Legacy | Refined-PBI-CDMS.md |
   | DAB | DAB | Legacy, **CDMS** | Refined-PBI-DAB.md (with CDMS references) |
   | Shared Angular UI | Shared Angular UI | Legacy, CDMS and DAB contracts when no backend is ticked | Refined-PBI-UI.md, once |

   Any combination works (seven in all); each ticked target's documents are generated on their own.
   An unticked area never gets a document. When the analysis finds UI changes but the UI is not
   ticked, the agent records them as a dependency and asks whether to add the UI; if you say yes it
   changes the target for you (no file editing) and the UI gets its own Refined PBI.

   The form lists each repository's role and path; **Correct repository paths** fixes a missing
   one. DAB always reads CDMS to reuse what CDMS already implements, and never changes it. CDMS
   and DAB share one Angular application, so UI work is planned once.
4. **Review & start**: the analysis mode (Quick, **Deep** by default, or Comprehensive), optional
   extra references, optional details, and a summary. **Start analysis** saves the intake and
   gives you the prompt for Copilot. **Save draft** keeps unfinished work. **Back** allows correction;
   **Cancel** clears unsaved entries without deleting a saved draft. A
   `PBI-Builder.html#draft=<URL-encoded PBI folder>` link restores that exact discovered draft after
   you choose the project folder; it does not read arbitrary paths or ask for captured details again.

If the PBI number already exists, you choose **Resume**, **Review** or **Start New Version** (a new
folder). Nothing is overwritten.

The agent then investigates on its own: it reads relevant accessible code (never only file names
or older analysis documents), reports inaccessible sources, distinguishes verified behavior from
inferences and unavailable evidence, and reports progress at milestones.

## Answer business questions
After investigating, the agent asks only what the request and the code cannot settle, **one
question at a time**, the earliest unanswered first. Moving between questions, skipping or Decide
later answers nothing: the Refined PBI waits until every mandatory question has your explicit answer.
An open blocker (missing evidence, development work, a runtime check or an owner decision) is also
asked about, one at a time, so refinement never stops at the draft. The progress line names the
stage: Intake, Source Analysis, Questions, Refinement Review, Approval, Refined PBI, COMPLETE. A rule your request already states is recorded as a decision
without a question. Each question shows:
- what happens today, what the requirement expects and what is missing;
- an evidence-backed recommendation and why, or **NO RECOMMENDATION** when support is insufficient;
- choices A–D where appropriate, plus Custom answer and Decide later;
- business and technical impacts and the supporting references.

The form checks cited local files and any recorded content hashes before displaying a
recommendation. It shows when a local hash is absent or an external source's current freshness
cannot be checked. Multiple questions sharing a local source use one read per question screen.

Conflicting acceptance criteria are always asked about, never resolved silently.

| Where | How you answer |
| --- | --- |
| Copilot Chat | Use the native question control when available; otherwise reply with a numbered choice, a custom answer, or `Decide Later` |
| The optional form, Continue tab, **Answer business questions** | Load questions, pick an answer or write a custom one, enter your name, Submit. Edit previous answer and Decide later are there too |

Confirmed answers are recorded with their decision history; a recommendation is never silently
approved. Decide Later keeps a material question open. Answered questions are not asked again unless
the supporting evidence or requirement changes. The agent saves drafts and its history copies as it
works; routine internal file operations do not require your approval.

## Other commands
| Command | What it does |
| --- | --- |
| `Resume PBI 305915` | Continues a draft or the next open question |
| `Review PBI 305915` | Summarizes status, decisions and open questions |
| `Edit PBI 305915` | Changes details or an earlier answer |
| `Show Decisions 305915` | Lists decisions with who, when and what they replaced |
| `Analyze Legacy 305915` | Explains how the legacy CRM process works, with file and line evidence |
| `Show Technical Flow 305915` | The traced call chain |
| `Extract Plugin Rules 305915 FormulaPlugin` | Writes PLUGIN-RULES.md: each validation and business rule with its condition, exact error message, data needed, whether DAB must implement it, and test cases |
| `Analyze Workflows 305915 Create Paint System` | Writes PLUGIN-WORKFLOW-COVERAGE.md for the classic workflows and custom workflow activities on that operation |
| `Generate Acceptance Criteria 305915` | Proposed Given/When/Then criteria for review |
| `Export PBI 305915` | Prepares the refined draft in Chat; final artifacts require explicit approval |
| `Validate PBI 305915` | Runs the available readiness check and explains the result in Chat |

These are phrases for the agent, not editor commands. The number can also be a title or folder.

## Attachments: what to expect
- The agent reads what its tools can open: text, Markdown, source files and usually images
  attached in chat.
- If it cannot open a file (for example some PDF or Word files), it says so and asks for text or
  an export. It never guesses a file's content.
- Nothing in an attachment counts as an approved requirement just because it is written there.

## Review, approve once and generate
When the analysis is complete the agent sets the draft to Ready for Review, runs the readiness
check, and summarizes the PBI, source findings, implementation differences, confirmed decisions,
blockers and material warnings in Chat. It offers **Approve & Generate**, **Request Changes** and
**Save Draft / Decide Later**. Use an explicit reply; silence and recommendations are not approval.
In VS Code, approval calls the installed PowerShell `ApproveAndGenerate` action; the agent supplies
the current review fingerprint and the approver name you provide. In an IDE that cannot execute
commands, it gives you the equivalent installer command to run. The installer rechecks readiness
and reviewed content before recording approval. When PowerShell scripts are blocked, the optional
form can still perform its browser-based workflow.
When the native question control is unavailable, the agent uses numbered choices in Chat. The
review covers the same information as the optional form's **Continue** tab, **Review selected PBI**.
That screen shows seven cards: the
PBI, requirements and acceptance criteria, repository analysis, implementation approach (CDMS,
DAB and shared UI), business decisions, untrusted content and sensitive data, and technical
readiness with any blockers. When something does not block the PBI (a gap graded WARNING or
INFORMATIONAL, or evidence the agent could only assume or could not read) an eighth card,
**Warnings (these do not block approval)**, lists it, and the collapsed **Detailed evidence,
analysis plan and warnings** panel shows the full evidence list. The same warnings appear under
"Open issues and assumptions" in every generated Markdown, JSON and DOCX.

- **Approve & Generate** (needs your name): records your final approval, bound to a fingerprint
  of exactly what you reviewed, sets the PBI to Development-Ready and generates the final PBIs
  for the target, each as Markdown, Word (DOCX) and JSON. Every file is read back and checked;
  if anything fails, the earlier files are restored and nothing is approved. It is disabled
  in the optional form while a blocker remains; chat will not generate when readiness has blockers.
- **Request Changes**: saves your change request as a refinement brief and gives you the prompt
  for the agent. Nothing is approved.
- **Save Draft / Decide Later**: keeps the current draft and unresolved questions without
  approval.

After generation the final Markdown, JSON and DOCX artifacts are written and verified by the
existing installer action (Chat) or browser generator (form). For the Both target, shared UI work
appears once in Refined-PBI-UI.md. PBIs generated before 5.5 keep their PBI-CDMS/DAB/UI files; the
next approval writes the Refined-PBI names and moves the earlier files to history/.
The optional form offers a download dialog and ZIP; Chat remains the normal path and does not
require navigating to HTML. In the form, the download dialog provides DOCX, Markdown, JSON,
preview and **Download Complete Package — ZIP** with every PBI and supporting documents.
Downloads are read from the generated files and refused if a file changed since. Where the browser
supports it you choose where to save. Browsers cannot open File Explorer, so the window shows the
PBI folder instead.

## View PBI Architecture
In the optional HTML form, open **Continue or refine a PBI**, select a saved PBI found in the
selected project, then choose **View PBI Architecture**. The numbered in-page choices are always
available (no native popup is required):

1. **Existing Business Workflow** — saved rules, conditions, outcomes, decisions and their source
   references. Rule order is not inferred.
2. **Repository Impact Map** — Legacy, CDMS, DAB, Shared UI and configured repositories; recorded
   branch coverage, target roles, proposed changes and evidence-backed relationships.
3. **Acceptance Criteria Traceability** — each saved criterion linked to its rule, source references
   and expected behavior.
4. **Complete Visual Report** — all views together.

The form reads only that PBI's `pbi.json` and `pbi-state.json`; it does not rescan repositories,
copy source excerpts, or alter the PBI, approval or handoff files. Missing or incomplete source
evidence is labelled **NOT VERIFIED**, not as a missing implementation. The report preview and
downloaded HTML are local and work offline. Report generation is manual and optional; it does not
change the approval workflow.

Your approval is the approval of the PBI draft only. PO/BA, security, architecture or technical
sign-off that your organization requires is a separate step. A material change to the reviewed
requirements, decisions, documents, attachments or recorded local evidence-source contents makes
a snapshot-bound approval stale; review and approve again. Document line endings and metadata JSON
layout are cosmetic. Source and attachment bytes are checked exactly, so even a formatting-only
edit to either requires review again. External evidence is bound to its recorded revision, but
the form cannot verify that repository's current contents. The final PBIs carry local draft
identifiers; the tool never creates or publishes Azure DevOps work items.

## Additional implementation references
The development target already decides which repositories are analyzed. Under **Add
implementation references** (Review & start) you can add other configured repositories as extra
read-only references for this PBI. The agent compares each requirement with them in the
"Implementation comparison" section of VALIDATION-MATRIX.md, with file and method references, or
"No matching implementation found". Configure repositories once: form setup (paths typed as
`Name = path`, plus the Legacy, CDMS, DAB and shared Angular UI paths) or the setup window (a path,
Browse and a status for each repository, in the one window). The check confirms completeness and
consistency; it cannot confirm that the content is right or who really approved.

## Read-only SQL schema references
Open **Read-only SQL export registration and evidence** near the top of the Builder. Select the
foreign-key, primary-key and table/column exports, enter each absolute path, and optionally enter
the source environment, extraction time and export revision. The browser reads only the selected
files; it does not connect to SQL Server or copy the exports into the repository. Because browsers
hide the selected file's absolute location, the typed path is provenance supplied by you and the
Builder can only compare its filename with the selected file.

**Register / revalidate exports** parses and hashes all three files and records provenance in
`playbook/pbi-builder/sql-reference-sources.json`. Review the detected formats, counts, diagnostics
and provenance before selecting a PBI and choosing **Create/update SQL analysis extension**. This
links source-row evidence and resolved/unresolved PK/FK relationships to that PBI's
`PBI-ANALYSIS-EXTENSION.json`; it does not rewrite `pbi-state.json` or handoff v1. The schema is
supporting reference evidence only: it does not prove application behavior or authorize SDD
implementation.

Rerun registration explicitly when you receive new exports. A changed hash causes attached
evidence to be revalidated and invalidates the affected analysis-package approval on relink.
If an export is unavailable, select it under **Mark a registered source unavailable** and confirm;
affected linked relationships become unresolved and block approval until all three exports are
registered again. Unqualified names that match multiple schemas remain ambiguous. Composite key
membership is preserved, but ordering remains unverified because these exports contain no key
ordinals. An empty lookup means the exports did not contain a matching row, not that no database
relationship exists.

## Offline SQL and GraphQL reference library
The installer deploys the Builder's fingerprinted CDMS SQL exports and GraphQL SDL files under
`playbook/pbi-builder/references/`, together with an offline GraphQL.js validator. The package build
checks the authoritative local reference files against their recorded SHA-256 fingerprints before
including them. No SQL or GraphQL service is contacted.

Every new PBI is instructed to reuse the installed references before source analysis. In the
Builder's **Offline CDMS and GraphQL reference library** panel, choose **Validate installed
references** to verify the installed hashes and validate the SQL exports and SDL schemas. Select a
PBI and choose **Create/update GraphQL analysis extension** to link the installed SDL snapshot and
its artifact hashes to that PBI's versioned analysis extension without rewriting `pbi-state.json`
or handoff v1.

GraphQL operations must be assigned explicitly to a named SDL and validate against that schema.
Cross-system mappings require exact-hash SQL, SDL and operation evidence; inferred or unresolved
mappings remain blockers. Changed or stale reference snapshots invalidate the affected analysis
approval and must be revalidated. These references are evidence only and never authorize SDD
implementation.

## Parent/Child implementation planning
The **Phase 05 · Parent PBI and implementation planning** panel is separate from the existing PBI
readiness and development-handoff workflow. It displays the original Parent PBI's five fields
(PBI ID, title, description, acceptance criteria and attachment references) without editing them.
The internal planning record is stored in the versioned analysis extension; it creates only
provisional local child IDs, not Azure DevOps work items.

Generate a plan only after Phase 04 analysis is consolidated and the source folders used by verified
evidence are available for read-only rechecking. The plan creates child work only for confirmed,
in-scope gaps; it preserves criterion traceability, groups shared Angular work, and records verified
dependencies. Unverified or stale evidence, conflicts, unresolved questions, out-of-scope work without
an explicit decision, and invalid dependency graphs block approval. Re-select source folders after a
Builder reload before verifying their evidence. Use **Check evidence freshness** to persist stale
status and invalidate a previous planning approval, or regenerate after the analysis inputs change.

**Record planning-package approval** stores one durable approval bound to the reviewed package
fingerprint and revision. It is not approval of implementation, does not start development, and does
not authorize implementation. SDD handoff v1 remains unchanged and cannot import child packages.
Use the existing PBI approval and manual **Start Development** flow for its original purpose; Phase
05 does not replace or alter it.

### Refinement quality (5.8.0)
Each generated 5.8 planning package also stores a versioned quality report in the
analysis extension. It scores business clarity (15%), child acceptance-criteria
testability (25%), business-rule completeness and traceability (20%), implementation
reuse (15%), technical accuracy and dependencies (15%), and test coverage expectations
(10%). A score of 90–100 is only a quality-ready candidate; 75–89 needs review; below
75 is incomplete. Any hard blocker forces **INCOMPLETE**, regardless of score.

Child criteria are separate from the unchanged Parent criteria and must have an
observable expected outcome, test scenario, and verified evidence. Missing outcomes
produce a blocking clarification instead of an invented behavior. Stale evidence,
unresolved mappings, required business-rule gaps, incomplete dependencies, and
blocking questions prevent package approval. The **Revalidate refinement quality**
action refreshes planning and quality against the current evidence. Changes to
requirements, evidence, relationships, questions, or child definitions invalidate the
saved quality fingerprint and any affected approval.

Quality readiness and planning-package approval are not implementation authorization. After
reviewing the current plan, explicitly select complete child PBIs, enter who authorized them and
the evidence of that intent, then use **Authorize selected child PBIs**. The durable authorization
binds to the approved package fingerprint, revision and exact child selection. Pending, deferred,
cancelled or otherwise unresolved blocking questions, incomplete children, invalid dependency
graphs, stale evidence, and partial shared-UI groups fail closed.

**Export authorized child package** rechecks the approval, quality report, parent state, attachments
and live source hashes before producing the versioned Builder-native
`akzo-builder-native-child-implementation-package` v1 JSON. It contains only the authorized children,
their requirement/business-rule and evidence traceability, shared-UI work, dependencies and
implementation order. It is not an Azure DevOps work item, is not accepted by the installed SDD
agent, does not start that agent, and does not execute or deploy code. Its `handoffReady` and
`implementationStarted` values remain false. The deterministic fingerprints bind reviewed content;
they are not cryptographic signatures or identity authentication.

Changes to requirements, evidence, relationships, questions, child definitions, approval or source
freshness invalidate the applicable approval/authorization. Re-select source folders after a reload
before authorizing or exporting. The existing SDD handoff v1 remains unchanged.

## CDMS, DAB and the legacy rules
The agent reads the legacy code (plugins, workflows, custom workflow activities, JavaScript,
HTML web resources and ribbon commands) and lists every business rule once, with all the places
it was found, in VALIDATION-MATRIX.md. Ask for LEGACY-BUSINESS-RULE-CATALOG.md or
BUSINESS-RULE-OWNERSHIP.md if you want them as separate documents.

## The repository is the source of truth
PBI -> repository discovery -> source investigation -> business-rule validation -> gaps ->
decisions only when blocked -> readiness -> refined PBI and SDD handoff.

**Evidence is collected automatically and only as much as the decision needs.** The agent
classifies each evidence record as VERIFIED (read in current source), ASSUMED or UNAVAILABLE, and
each open gap as BLOCKING, WARNING or INFORMATIONAL. Only a BLOCKING gap, or evidence a claim
cannot do without, holds a PBI back; unrelated legacy side effects and optional metadata become
warnings. Discover sources (Continue tab) maps solutions, entry points and the branch and commit
once, writes a source file-name index, and later runs reread only what changed. Refresh evidence
fingerprints marks a stored finding stale when its file, or a file it depends on, changes;
unchanged findings are reused by later PBIs. Decisions and answers are never reused across PBIs.
The collapsed **Run details** below the status line shows what an operation actually read and wrote.

The agent reads the application repository itself. It never needs, writes or waits for a separate
end-to-end analysis document. Older analysis documents, including the ColorDMS reports the form
can still install on request, are optional background: never a prerequisite, never evidence of
current behavior, and never deleted by the Builder. Every investigation checks the current code
again. Findings go, briefly and with file references, into EVIDENCE.md and VALIDATION-MATRIX.md.

Required per PBI: REQUEST.md, DRAFT-PBI.md, VALIDATION-MATRIX.md, EVIDENCE.md, DECISION-LOG.md,
OPEN-QUESTIONS.md, pbi-state.json and the final refined PBI. Only on request: PLUGIN-RULES.md,
PLUGIN-WORKFLOW-COVERAGE.md, the rule catalog, shared rules, ownership and acceptance-criteria
documents, and the developer handoff export.

- **CDMS:** a rule an existing CRM plugin already handles (with its registration checked) is
  reused; the PBI says to verify it, not to build it again. Workflow and JavaScript rules are
  included as CDMS API work or verification.
- **DAB:** there is no DAB plugin. Every applicable rule is a DAB requirement, implemented in DAB's
  own code (Azure Functions, CQRS handlers, FluentValidation for input checks, domain services,
  GraphQL). The PBI says what DAB already has, what is partial and what is missing.
- **Both:** one shared set of business rules and decisions, and two separate application PBIs.

Every rule is checked branch by branch (for example Yes and No, failure and rollback). A plugin
that handles the Yes path does not make the rule covered; a missing No path is reported as a
gap with its risk and a proposed approach.

## Handing over to development
**Approve & Generate** also writes the development handoff in the same step, from the approved state:
`business-rules.json`, `BRANCH-COVERAGE-MATRIX.md` and `HANDOFF-MANIFEST.json`. The manifest names the
PBI, the approval it belongs to (who, when and the reviewed-content fingerprint), the implementation
targets and read-only reference repositories, the requirement, acceptance-criteria, decision and
question IDs, the evidence with the repository each source came from, and the SHA-256 of every Refined
PBI and handoff file. It does not list or hash itself. If any file cannot be written, nothing is
approved and the earlier files are restored. **Download Complete Package — ZIP** contains the same
files, the attachments under `attachments/` and the working records under `supporting/`.

**Start Development** (in the PBI Generated Successfully window, on the Continue tab, or in Chat:
`Start Development <number>`) checks that the handoff still matches the approval: every listed file
unchanged, every Refined PBI of the target listed, the same approval, and business-rules.json and the
matrix still what the approved state gives. It then shows, for each implementation target, the command
that queues that Refined PBI for the Akzo Master SDD agent, for example:

    & "$env:USERPROFILE\.akzo-agent\modules\investigate\scripts\akzo.ps1" pick -Source 'C:\src\My Repo\playbook\pbis\<folder>' -File 'Refined-PBI-DAB.md'

Run one command per target, open the target repository, select the Akzo Master SDD agent in Copilot
Chat and type `start`. The commands only queue the PBI: nothing starts by itself, and the SDD agent
still asks you to confirm the PBI and approve the implementation. The form copies the commands to the
clipboard; copying starts nothing either. Fill in **Full project path** in setup to get absolute paths;
otherwise run them from the repository root.

Start Development never restarts refinement and never re-asks answered questions. When the PBI is not
ready it names its state and changes nothing: **DRAFT** (refinement not finished), **CONDITIONAL** (a
conditional draft with open dependencies) or **STALE** (approved content, or a generated file, changed
after approval: review and approve again). A PBI approved with an earlier version gets its handoff from
that approval the first time you use Start Development; nothing is approved again.

**Export developer handoff** remains for working drafts: on the Continue tab, select the PBI and click it. It writes
`business-rules.json` (for the development agent) and `BRANCH-COVERAGE-MATRIX.md` from the PBI's
recorded state, and keeps earlier exports in `history/`. The file separates approved
requirements, proposed requirements and technical findings, and lists every open gap.

Legacy code tells the agent what DAB must do; it never proves what DAB already does. If an
earlier decision left legacy evidence out of a PBI, it stays until you change it.

## Visual Studio: what the agent can read
In Visual Studio, Copilot's agent file tools read only files in the open solution, or in the
opened folder and its subfolders (Microsoft: "Use Agent Mode", FAQ). A repository next to it, such
as `..\AN.ColorDMS.Customizations`, is out of reach unless the folder you open contains it. The
agent checks this before every analysis, reports a source it cannot read as "configured but
inaccessible" (never as missing), and says which conclusions stay unverified.

Repository-level agents are found in the `.github\agents` folder at the repository root, and
skills in `.github\skills` (Visual Studio 18.5 or later; Microsoft Learn, "Use Agent Skills").
Install the Builder at the Git root (the folder with `.git`); the installer warns otherwise.

The agent searches the whole repository, not only the loaded solution. A repository can hold
several solutions, for example plugins in one and JavaScript web resources in a sibling one;
open the repository root as a folder so all of them are reachable. **Discover sources** lists
every solution and, per folder, the kinds of files it holds, including JavaScript that no project
lists. To name the folders that matter in one repository, create
`playbook\pbi-builder\knowledge\SEARCH-SCOPE.md` yourself, for example:

```
# Search scope
- Source/Formula
- Source/WebResources
- Source/Measurement
- Source/MarketColor
```

The installer never writes or overwrites it. Before saying a feature is missing, the agent searches
every relevant layer and reports each finding as found and verified, found but not yet reviewed,
not found within the listed searches, or inaccessible.

| Analysis | Install the Builder into | Role / sources | Open in Visual Studio |
| --- | --- | --- | --- |
| Custom (Legacy CRM/XRM) only | the legacy repository | role `legacy`, legacy source `.` | File > Open > Folder on the repository root (a `.sln` in a subfolder would leave the root, and the Builder's `playbook\` folder, outside the agent's reach) |
| DAB (GraphQL) only | the DAB repository | role `dab`, DAB source `.` | the repository root folder |
| CDMS only | the CDMS repository | role `cdms`, CDMS source `.` | the repository root folder |
| Several repositories | the repository you work in; other sources as relative paths (`../Legacy`) | as above | a common parent folder that contains every clone. Not verified yet: whether Visual Studio still lists an agent stored in a child repository when the opened folder is the parent. Check it with the list below; if the agent does not appear, analyse from each repository in turn |

Never copy application source into the Builder's folders; the Builder reads it where it is.

**Discover sources** (Continue tab of the form) writes `playbook\pbi-builder\knowledge\SOURCE-MAP.md`:
solutions, projects, project references, target frameworks, markers (CRM SDK, workflows, Web
Forms, Azure Functions, GraphQL, FluentValidation, data access) and whether each configured source
could be read. It reads only solution and project files and counts the rest; it never copies
code or configuration values. Run it again when projects change.

### Visual Studio check (once per team machine)
1. Install the Builder (form or `Install-PBIBuilder.cmd`) into the repository, then open the folder
   as in the table.
2. Copilot Chat > agent picker: "AKZO PBI Builder [Visual Studio]" or
   "AKZO PBI Builder [VS Code]" is listed for the chosen editor (Visual Studio 18.4 or
   later).
3. Select it, open the **Tools** panel and confirm `readfile`, `code_search`, `find_references` and
   `editfiles` are available and enabled (Microsoft notes that custom-agent tool groups can start
   disabled; re-enable them there).
4. Ask: "Check source access." It should name each source as readable, configured but inaccessible
   or not configured, quoting one file it actually read.
5. For several repositories, repeat steps 2 to 4 with the parent folder open.
