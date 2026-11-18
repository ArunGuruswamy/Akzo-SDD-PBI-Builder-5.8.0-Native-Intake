# AKZO agent names and registration verification

## Result

Source generation now uses these display names, including single-editor installs:

| Product | VS Code | Visual Studio |
|---|---|---|
| PBI Builder | `AKZO PBI Builder [VS Code]` | `AKZO PBI Builder [Visual Studio]` |
| SDD Developer | `AKZO SDD Developer [VS Code]` | `AKZO SDD Developer [Visual Studio]` |

These are YAML `name` values, not new filenames. Project identity and version
remain in descriptions, agent bodies and configuration. Names do not grow when a
project name changes. Existing file paths are retained so a future approved
update changes an owned registration rather than adding a renamed duplicate.

**New live dropdowns and interactive startup are NOT VERIFIED.** No application
repository was modified and no registration was intentionally deleted.

**Test incident:** an SDD test command unintentionally invoked its installer
against the real user profile. The test agent restored the backed-up agent and
module files; an independent read confirmed the SDD agent's original hash and
timestamp. However, the user installation manifest was rewritten and its exact
previous contents have not yet been established. This violated the requested
no-install boundary; it is not presented as an authorized installation or a live
verification pass. No further profile changes will be made without a verified
recovery basis. Detailed accounting is below.

## Inventory and actual menu sources

### PBI Builder product

The canonical agent is generated from `AGENT_TEMPLATE` in
`maintainer/src/core.js`; it is not a checked-in live workspace `.agent.md`.
`templates()` and `editorAgents()` control registration paths; the same bundle
is rendered by `maintainer/installer/Install-PBIBuilder.ps1`.
`PBI-Builder-Setup.ps1` delegates installation to that engine. The standalone
HTML embeds that engine and uses the same generation rules.

| Configuration | Output definition | Tools |
|---|---|---|
| Visual Studio only | `.github/agents/akzo-sdd-pbi-builder.agent.md` | Visual Studio read/search/edit/create and `ask_question` |
| VS Code only | `.github/agents/akzo-sdd-pbi-builder.agent.md` | VS Code read/search/edit/execute and `vscode/askQuestions` |
| Both, Visual Studio | `.github/agents/akzo-sdd-pbi-builder.agent.md` | Visual Studio profile |
| Both, VS Code | `.github/agents/akzo-sdd-pbi-builder-vscode.agent.md` | VS Code profile |

The two **currently installed** Builder menu entries originate from
`C:\Users\RGA\source\repos\AN.ColorDMS.Customizations\.github\agents`:

- `akzo-sdd-pbi-builder.agent.md`: `Akzo SDD PBI Builder - AN.ColorDMS.Customizations (Visual Studio)`
- `akzo-sdd-pbi-builder-vscode.agent.md`: `Akzo SDD PBI Builder - AN.ColorDMS.Customizations (VS Code)`

They are different files with different content hashes and tools, deliberately
created by `ide: both`. They are **legitimate host-specific registrations**, not
two identical installations. Both are currently discoverable by VS Code because
both are in its workspace agent directory. Changing their display names alone
cannot hide the other host's entry.

Installed hashes at inspection:

| Definition | SHA-256 |
|---|---|
| Builder Visual Studio | `86c9ded2825f19df1338e1c12b852d39156fb9067f96f3032dd1cd6659c6b5a0` |
| Builder VS Code | `08671510181b5c0aa015e9b2400f78a4369aa7b45a0e748adade7a0a71558574` |

These are 5.7.0 installed definitions, not the new short-name source. A matching
version number does not establish matching generated content. The earlier stale
intake investigation is historical; the user has since updated the installed
VS Code agent to a later 5.7.0 definition, still with the long name.

Historical baseline templates in `maintainer/src/assets.json`, comparison agents
generated on demand and extracted packages under `releases` are **not active
registrations merely because they contain an agent template**. Baseline names
remain intentionally unchanged. No historical package was edited.

### SDD Developer product

Canonical source is `copilot/agents/akzo-master-sdd.agent.md` in
`C:\src\Agent Development\Akzo-SDD-Agent-v4.2.7-dev`.
`scripts/install.ps1` renders the host-specific installed definition;
`scripts/Install-MasterAgent.ps1` is the installer front end.

The observed user-level VS Code entry `akzo-master-sdd-v4.2.7` comes from
`%USERPROFILE%\.copilot\agents\akzo-master-sdd.agent.md`, **not** from the Builder
workspace. Its inspected SHA-256 was
`c9bd3f5d222defbc013e3b67f29cab8e482c43f27280aee5d0692532389a4859`.
Its visible versioned name is explicit YAML, not a filename fallback.
The installed home-level Visual Studio copy also exists at
`%USERPROFILE%\.github\agents\akzo-master-sdd.agent.md` with the same old YAML
name but different host-rendered content. Its SHA-256 is
`e0b70591fd637f3f3aab04f174809d9a2b9c8aef09c94ee7cc3ddbbf140eb91c`.
Those two SDD files are intended host-specific destinations, not identical
duplicate content. Whether that home-level path is actually discovered by the
open Visual Studio instance remains NOT VERIFIED.
No SDD developer definition was present in the inspected Legacy application's
workspace agent directory. A Visual Studio install can use a separate configured
workspace path; this inspection does not assert absence from every workspace on
the machine.

### User, profile and other workspace checks

Read-only inspection covered:

- `%USERPROFILE%\.copilot\agents`
- `%USERPROFILE%\.github\agents`
- `%APPDATA%\Code\User\prompts` and profile-specific files below
  `%APPDATA%\Code\User\profiles`
- `chat.agentFilesLocations` / legacy mode-file paths in inspected user/profile
  settings (no additional configured locations found)
- `.github\agents` in the four application roots named in the task context
- the Visual Studio Copilot directory, which contained MCP configuration rather
  than an additional inspected agent source

The Shared Angular UI workspace has unrelated API Service, Create Component,
Create Feature, Form Validation, Generate Jest Tests, Migrate to Zoneless,
Optimize Performance and Refactor to Signals agents. They were left untouched.
No extra Builder/Developer copy was found in the inspected user/profile
locations. This is a bounded inventory, not a claim about every directory,
extension-contributed agent or remote organization registration.

## Host targeting and safety

Both hosts discover workspace `.github/agents` definitions. No verified
Visual-Studio-only discovery-filter field was identified; therefore this change
does **not** invent `target: visualstudio` or claim that a suffix filters menus.
VS Code's documented YAML `name` is used. Prior live native tests also showed
Visual Studio using the Builder's YAML name rather than its filename.
References:

- [VS Code custom agents](https://code.visualstudio.com/docs/agent-customization/custom-agents)
- [Prior actual IDE evidence](../PBI-BUILDER-INTERACTIVE-VERIFICATION.md)

Builder profiles retain separate tool allowlists. They now explicitly refuse
the wrong host before intake or repository actions, directing the user to the
other short name. This is a workflow guard, **not an executable discovery filter**.
The installed tools have not been changed by this source-only task.

Builder Start PBI/Create PBI/Resume/Start Development routing, fixed source
selection, independent development targets, question-result handling, approval
gates and handoff contracts are unchanged. Single-editor prompt headers now
reference the new exact agent name; shared prompts still use the host's selected
agent instead of forcing the wrong one. Preview, setup messages, per-editor
installer status and copy-prompt instructions use the same canonical names.

## Duplicate handling

No registrations were removed. The two Builder profiles should not be deleted
as duplicates: their tools and intended hosts differ. The user-level SDD agent
and workspace Builder are different products.

For a future explicitly approved update:

1. Use a valid package and inspect its update plan. Retain the existing file
   paths; do not copy short-name agents under new filenames.
2. Update only owned unedited definitions, preserving backups. User-edited files
   must remain conflicts requiring review.
3. If an additional same-product, same-host definition is then found, compare
   its source path, ownership record and content. Propose removal only after the
   intended replacement is verified in the real selector.
4. If the opposite-host entry is still listed, report it as shared discovery,
   not a failed rename. Do not silently hide or delete it.

## Verification

| Product/host | Source definition/name | Generated host tooling | New live selector | Startup/interactive live |
|---|---|---|---|---|
| Builder VS Code | PASS | PASS: distinct profile and fixed question arguments | NOT VERIFIED | NOT VERIFIED |
| Builder Visual Studio | PASS | PASS: distinct native-question profile | NOT VERIFIED | NOT VERIFIED |
| SDD VS Code | PASS | Host-specific name rendering; no new tool allowlist | NOT VERIFIED | NOT VERIFIED |
| SDD Visual Studio | PASS | VS Code-only invocation metadata stripped; no new tool allowlist | NOT VERIFIED | NOT VERIFIED |

Only the existing Legacy application Visual Studio window was available during
the read-only desktop check; no new agent selector entry was exposed in the
accessible controls inspected. No new definitions were installed to manufacture
a dropdown pass. Unit/generated-file tests do not establish visible menu names.
New installed-version/source parity is therefore also NOT VERIFIED.

Builder automated results:

- `node --test maintainer\test-561.cjs maintainer\test-interactive.cjs maintainer\test-modules.cjs`:
  **17 passed**, including real temporary-directory PowerShell generation parity,
  single/both editor names, exact prompt references, separate tools, explicit
  update permission, edited-file preservation and existing-PBI preservation.
- `node maintainer\test-ui.cjs`: **PASS** simulated-DOM handlers.
- `node maintainer\test-core.cjs`: **59 passed**.
- Focused final name/metadata/module check: **13 passed** (includes a long project
  identity that cannot change either short display name).
- SDD `scripts/test.ps1` final static checks: **109 passed, 0 failed**.
- SDD isolated temporary-profile rendering/lifecycle checks and PowerShell syntax
  checks for the three edited scripts: **PASS**, as reported by the test agent.
  These do not excuse the separate real-profile incident.
- `node maintainer\test-ps.cjs`: **15 passed**, including real temporary-profile
  installer parity, upgrade/repair/uninstall preservation and path persistence.

### SDD implementation and limitations

The canonical agent template is retained. The installer renders only the YAML
name per destination, so VS Code receives `AKZO SDD Developer [VS Code]` and
Visual Studio receives `AKZO SDD Developer [Visual Studio]`. Version remains in
the description. SDD does not currently declare a `tools` allowlist; this change
does not invent one or translate VS Code tools into Visual Studio tools.
Visual Studio rendering strips the existing VS Code-only
`disable-model-invocation` metadata. Name/hash verification uses rendered output,
duplicate checks do not delete files, and colliding destinations are rejected.
Host discovery filtering is not claimed.
Each rendered SDD copy now includes a host-boundary instruction before startup:
on the wrong host it must stop and direct the user to the other exact name;
unknown host identity requires confirmation. Available ask-tools alone do not
prove host identity. This is an instruction boundary, not a discovery filter or
live-proven enforcement. The final guard follow-up ran only static checks and
performed no installer/lifecycle execution or additional profile changes.

### Exact changed files for this task

Builder:

- `maintainer/src/core.js`
- `maintainer/src/ui.js`
- `maintainer/installer/Install-PBIBuilder.ps1`
- `maintainer/test-561.cjs`
- `maintainer/test-interactive.cjs`
- `maintainer/test-modules.cjs`
- `maintainer/test-ps.cjs`
- `maintainer/test-ui.cjs`
- `maintainer/README.md`
- `docs/USER-GUIDE.md`
- `docs/AGENT-REGISTRATION-VERIFICATION.md`
- `Akzo-SDD-PBI-Builder.html` (rebuilt; ignored maintainer build copy also rebuilt)

SDD Developer (existing dirty edits were preserved):

- `scripts/install.ps1`
- `scripts/test.ps1`
- `scripts/Install-MasterAgent.ps1`
- `README.md`
- `installation-guide.html`
- `RELEASE-NOTES.md`

### Real-profile test incident

The SDD test agent reported that an early test invocation briefly ran the
installer against the real profile. It restored backed-up agent/module files.
The parent independently re-read the installed SDD agent: its SHA-256 remained
`c9bd3f5d222defbc013e3b67f29cab8e482c43f27280aee5d0692532389a4859`
and its modification timestamp remained `2026-11-10T09:49:55.7944801+05:30`.
The installed Builder files also retained the hashes listed above.

`%USERPROFILE%\.akzo-agent\install-manifest.json` was rewritten with refreshed
hashes. Its original content was not captured by the parent's read-only initial
inventory, so byte-for-byte restoration cannot currently be certified. No
success or complete rollback claim is made.

The test command used a helper parameter named `$args`, colliding with
PowerShell's automatic variable. Its intended `-HomeRoot <temporary-folder>`
arguments were lost, causing the copied installer to use real-profile defaults.
The affected source copy was under
`%TEMP%\akzo-name-check-492106510cc7471ab0f8ed866488b6e3\source`.
Installer output reported six files written and 198 unchanged, none removed.

Backup directory:
`%USERPROFILE%\.akzo-agent\backups\20261110-101708`.
The six files restored from its index were:

- `.copilot\agents\akzo-master-sdd.agent.md`
- `.github\agents\akzo-master-sdd.agent.md`
- `.akzo-agent\modules\investigate\scripts\akzo.ps1`
- `.akzo-agent\modules\workflow\interactive-decisions.md`
- `.akzo-agent\modules\workflow\new-development.md`
- `.akzo-agent\modules\interaction\scripts\Start-Development.ps1`

The test agent verified restored bytes and timestamps against backups. It also
refreshed the installation manifest's file hashes; its 204 entries reportedly
match current bytes, but the original manifest itself was not backed up. Its
remaining changed SHA-256 is
`569aa2387506c4b8d9012739472f9c9b40912bbb71b6e2ffd9d475376e3507c0`.
It contains the temporary installer source path and new installed timestamp.
The new backup directory/index remain. Repositories, authorizations and VS Code
settings were reported retained, and their timestamps predate the incident.
Without a full pre-test snapshot, absence of every other side effect is not
provable.

No further real-profile installation, restoration or cleanup was performed
after this accounting. An authorized known-good reinstall or recovery of an
original manifest would be needed to restore provenance reliably; this report
does not silently authorize either action.

No release manifest or package was published/refreshed. Only the standalone
development HTML was rebuilt. A future authorized installation must use the
normal checksum-valid release process, never this checkout's stale root manifest.

## Manual acceptance after an authorized installation

For each IDE, open a fresh conversation in the intended workspace, open the real
agent selector and record the displayed name and definition path. Verify the
host suffix is visible, the description identifies project/version, and no
additional same-host copy exists at another user/workspace path. Select the
correct profile, exercise its existing startup and question/file-selection flow,
then verify the opposite profile refuses the host rather than executing an
incompatible workflow. Capture screenshots/results separately for all four
product/host combinations. Until then, installed dropdown results remain
**NOT VERIFIED**.
