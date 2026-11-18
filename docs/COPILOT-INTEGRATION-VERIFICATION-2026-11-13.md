# Final Copilot integration verification - 2026-11-13

## Follow-up - 2026-11-16

The isolated-host log review narrowed model unavailability to the profile
having no resolved GitHub sign-in. Account entitlement remains unverified.
The minimum manual setup and fresh Builder regression results below were
added; no host configuration or account state was changed.
The host process recorded in the original report (PID 29668) is no longer
running, so a future manual Copilot check must relaunch the isolated host.

## Result

**BLOCKED: actual Copilot integration has not been demonstrated.**
The isolated diagnostic command/tool bridge passes. A real completed-session
process restart also passes after a diagnostic-only restoration fix. Neither
result proves that Copilot discovered, invoked or consumed the tool.

No Computer Use, simulated keyboard/mouse input, automatic chat submission,
installation, production integration, publication, push or release was used.
The isolated host's verified main process was PID 29668 at the original
reporting time; process IDs are not durable.

The original host had already exited. A shutdown-time `Canceled` error is not
evidence of a user cancelling a QuickPick.

## Priority 1: actual Copilot

| Requested stage | Status | Evidence / remaining gate |
| --- | --- | --- |
| Launch isolated Extension Development Host | PASS | New real host; VS Code 1.146.0; diagnostic-only workspace and storage. |
| Activate and register diagnostic tool | PASS | Fixed-restart bootstrap reports `activation: PASS`, `toolRegistration: PASS`, `toolListed: true`. This is extension registry membership only. |
| Open actual GitHub Copilot Chat | BLOCKED | No manual chat interaction performed. Startup renderer messages show `no-model-at-toolbar-build` for `agent-host-copilotcli`; bootstrap reports `copilot: null`. The renderer also logged `No signed-in session resolved for resource: https://api.github.com` and `/repos`. This explains why the isolated profile had no Copilot model to select; it does not establish an entitlement failure or prove that every Copilot implementation is unavailable. |
| See the tool in Copilot's available-tools picker | BLOCKED | No actual tools-picker observation. Registry membership is not this acceptance test. |
| Invoke from the actual Copilot agent | BLOCKED | Captured invocations are command-context calls; fixed-restart log has `hasChatContext: false`. |
| See a native popup from that agent invocation | BLOCKED | Earlier manual command-level native popups passed, not an actual-agent popup. |
| Select DAB API in that agent run | BLOCKED | No such agent run exists. The captured run selected all three targets, not DAB alone. Current diagnostic source labels ID `dab` as `DAB API (synthetic)`; this source-only label update has no new live result. |
| Receive selection in the same agent conversation | BLOCKED | Only the command response handler has consumed a recorded result. |
| Agent automatically asks the next question | BLOCKED | Command-level mode-to-targets progression passed previously; actual agent continuation is untested. Targets are final in this two-question diagnostic, so it cannot ask another question after DAB without a diagnostic change. |
| Capture logs/state | PASS / BLOCKED | Real command/restart artifacts captured below. Actual Copilot invocation/conversation evidence remains absent. |

### Model availability diagnosis and minimum live-test setup

The logs narrow the blocker to the isolated profile's missing GitHub
authentication, not to QuickPick registration:

* The diagnostic bootstrap reports `vscodeVersion: 1.146.0`,
  `activation: PASS`, `toolRegistration: PASS`, `toolListed: true`, and
  `copilot: null`.
* The Extension Host renderer log reports no signed-in GitHub session for
  `https://api.github.com` and `https://api.github.com/repos`, followed by
  repeated `no-model-at-toolbar-build` events for `agent-host-copilotcli`.
* The agent host itself started its Copilot client successfully, but no model
  was made available to the chat surface.
* The isolated host's captured installed-extension registry is empty (`[]`).
  This does not establish whether the bundled Chat component was enabled, but
  no separately installed Copilot extension was evidenced in this profile.
* The bootstrap captured the diagnostic extension only. Account entitlement,
  organization policy, model choice, and chat mode were not observable without
  an authenticated interactive Copilot session. No credentials or token
  stores were read.

Minimum supported configuration for a valid manual test:

1. A VS Code version satisfying the diagnostic extension's `engines.vscode`
   requirement (`^1.104.0`; the observed host was 1.146.0) with the Language
   Model Tools and Chat agent APIs available.
2. VS Code AI features enabled, and GitHub Copilot Chat available and activated
   in the test profile.
3. The user manually signs in within that profile using an organization-
   authorized GitHub account with an active Copilot plan/eligible entitlement.
   The user or organization administrator must confirm entitlement and policy;
   the current logs cannot.
4. An available Copilot model selected in the actual Chat **Agent** mode, with
   the diagnostic extension loaded and its tool enabled/allowed in that chat.
5. No second prompt after `start`: the same agent must make the `resume` call
   automatically after the first native answer.

The extension was not installed or enabled in another profile, and account or
organization settings were not changed. The host cannot be repaired
non-interactively under these boundaries. The diagnostic command's
`vscode.lm.invokeTool` path is not a substitute for the chat tool caller.

| Configuration check | Status | Evidence |
| --- | --- | --- |
| GitHub authentication in isolated host | FAIL | Renderer logged no signed-in session for `api.github.com` and `api.github.com/repos`. |
| Copilot account/organization entitlement | NOT VERIFIED | No authenticated account was resolved; the logs cannot establish plan, seat, policy or usage eligibility. |
| Diagnostic extension activation | PASS | Bootstrap records activation and tool registration. |
| Copilot Chat activation | NOT VERIFIED | No user-installed extension was listed; whether the bundled Chat component was enabled was not established. |
| Host profile isolation | PASS | Diagnostic-only user-data, extensions and workspace paths were used; no normal-profile credentials were copied. |
| Chat mode/model selection | NOT VERIFIED | No actual authenticated chat was opened; renderer recorded no model at toolbar build. |
| Copilot model availability in this host | FAIL | `copilot: null` and repeated `no-model-at-toolbar-build` events. |

References: [VS Code Language Model Tool API](https://code.visualstudio.com/api/extension-guides/ai/tools)
and [Set up GitHub Copilot in VS Code](https://code.visualstudio.com/docs/setup/copilot).

## Priority 2: recovery

| Check | Status | Evidence |
| --- | --- | --- |
| First real completed-run restart | FAIL, fixed and retested | At `17:19:05Z`, activation had `restoredState: null`; Resume failed with `No synthetic diagnostic state exists. Start a diagnostic first.` The diagnostic's disk snapshot still existed. |
| Completed-run restart after fix | PASS | At `17:21:40.585Z`, activation reports `restorationSource: disk`, original run ID and answers. Resume returned `completed: true`, `cancelled: false`, `nextQuestion: null`. |
| No repeated completed questions after real restart | PASS | New immutable log contains activation, one Resume invocation, ready response and handler receipt; zero `question_opened` events. |
| Live Escape cancellation | BLOCKED | Requires manual input. Automated cancellation/response-handler tests pass. No shutdown error is counted as Escape. |
| Live interrupted-session restart | BLOCKED | Completed-state restart is not interrupted-state recovery. Automated cancellation recovery with empty host `globalState` and retained files passes. |
| Overlapping invocation prevention | PASS, automated only | Focused test rejects a second invocation while the first picker is pending. No live duplicate submission was attempted. Explicit sequential `start` creates a new synthetic run; agent replay/idempotence is not proven. |
| Existing production session preservation | PASS | Both historical session SHA-256 values match the frozen baseline, including `intake-aa8fdd55f1b9bf48222f76e3c589b91f`. Six frozen production engine/interaction files also match. |

### Diagnostic-only fix

The previous activation read only VS Code `globalState`, although it wrote a
separate disk snapshot. The real restarted test host supplied no saved
`globalState` entry, so Resume ignored the retained snapshot. The diagnostic now
loads its own disk snapshot on activation, validates its structure, checks for
conflicting state stores, and loads saved evidence before recording activation.
Invalid saved data fails explicitly rather than silently starting fresh.

The failed pre-fix activation overwrote the mutable `results.json` from empty
host evidence. Original bootstrap/completion artifacts and immutable logs remain
available. Use those original logs for original-run chronology; the new fix
preserves subsequent disk evidence. The earlier snapshot-aliasing caveat in the
baseline report also remains applicable to the original run.

## Evidence

Artifact paths below are relative to:

```text
C:\Users\RGA\.copilot\session-state\31598d29-0620-4cab-ad80-62cb8c06e677\files
```

| Artifact | Relative path |
| --- | --- |
| Failed restart activation | `quickpick-restart-20261113-2247\bootstrap.json` |
| Failed restart result | `quickpick-restart-20261113-2247\manual-command.json` |
| Successful fixed activation | `quickpick-restart-fixed-20261113\bootstrap.json` |
| Successful fixed Resume/handler result | `quickpick-restart-fixed-20261113\manual-command.json` |
| Fixed-run immutable diagnostic log | `quickpick-host-20261113-2234\logs\20261113T225135\window1\exthost\akzo-pbi-poc.akzo-pbi-native-selection-poc\AKZO Native Selection Diagnostic.log` |
| Fixed-run Extension Host log | `quickpick-host-20261113-2234\logs\20261113T225135\window1\exthost\exthost.log` |
| Fixed-run renderer/model startup log | `quickpick-host-20261113-2234\logs\20261113T225135\window1\renderer.log` |
| Current synthetic state and mutable evidence | `quickpick-host-20261113-2234\User\globalStorage\akzo-pbi-poc.akzo-pbi-native-selection-poc\state.json` and `results.json` |

Restored run ID: `99a194f0-56c1-449f-87d6-f134bc0480bf`.
Restored answers: mode `quick`; targets `cdms`, `dab`, `ui`.
Handler receipt at `17:21:41.108Z` records `persistedStateVerified: true`,
`copilotIntegrationProven: false`, `analysisStarted: false`.

## Exact remaining manual steps

1. Use the already-open isolated Extension Development Host, not the normal
   production window. Open its Copilot Chat manually and select an actual
   authenticated Copilot agent/model. If no model is available, stop this test
   and record the displayed blocker. Do not install extensions or copy
   credentials/profile data into this host.
2. Open that chat's available-tools picker and locate
   **AKZO PBI Native Selection Diagnostic** / `akzoPbiNativeSelectionPoc`.
   Enable it if available. If absent, record that fact and stop; do not
   substitute a command-palette invocation.
3. Submit this single diagnostic request in that actual conversation:

   > Diagnostic only. Invoke #akzoPbiNativeSelectionPoc with action start.
   > Wait for my native selection. When status is selected and nextQuestion is
   > non-null, automatically invoke the same tool with action resume without
   > another user message. Report the returned selection and final status in
   > this conversation. Stop on cancellation or completion. Do not read source,
   > access production sessions, create a PBI or start analysis.

4. Approve only the synthetic diagnostic tool if the host requests consent.
   Choose **Deep** in the first native popup.
5. Without submitting another chat message or running a command, observe
   whether the same agent invokes Resume and opens the targets popup.
6. Select only **DAB API (synthetic)**, then accept. Verify the same conversation
   reports target ID `dab` and completion. This is the final question; a further
   question after DAB is outside the current diagnostic shape.
7. Retain the conversation/tool-call transcript or screenshots, together with
   the diagnostic log and state files above. Check correlated run ID, actual
   agent tool calls and automatic Resume. A chat token alone is insufficient.

For **live interrupted recovery**, start a separate synthetic run through the
same agent, choose a mode, then press Escape at targets. Verify cancellation
stops automatic retries. Close the isolated host normally and relaunch with
the same isolated directories, a new result directory, and
`AKZO_PBI_DIAGNOSTIC_RESUME=1` as documented in the
[diagnostic README](../vscode-chat-poc/native-selection/README.md).
Only targets should reopen, with the original mode/run ID retained. This
runner's restart check is command-level recovery, not actual agent recovery.
To test the actual agent's interrupted recovery separately, cancel another
synthetic run, close the host, then relaunch using the same launch command but
**omit `--extensionTestsPath` and its argument**. This activates the diagnostic
without a startup command consuming the pending question. In the actual agent
conversation, request `action resume`; verify only targets reopen with the
saved mode/run ID. Do not count the runner-completed run as that test.

## Regression results and changed files

Latest focused run: **38 passed, 0 failed, 0 skipped**:

```powershell
node --test '.\vscode-chat-poc\native-selection\test.cjs' '.\vscode-chat-poc\test.cjs' '.\vscode-pbi-builder\test-controller.cjs' '.\vscode-pbi-builder\test-extension.cjs' '.\vscode-pbi-builder\test-webview.cjs' '.\vscode-pbi-builder\test-workflow.cjs'
```

This includes diagnostic recovery/cancellation/duplicates, historical participant
compatibility and production interaction regression tests. No real SDD Agent
integration or full normal-profile production journey is claimed. The earlier
65-entry baseline and disclosed real-SDD branch skip are historical results,
not a new full-suite run.

After the synthetic target-label change, the targeted diagnostic run was
**14 passed, 0 failed, 0 skipped**:

```powershell
node --test '.\vscode-chat-poc\native-selection\test.cjs'
```

This verifies the diagnostic's command/tool mock contract and returned label;
it does not re-run the host or establish Copilot discovery.

Fresh full Builder release regression: **56 passed, 0 failed, 1 skipped**,
`npm run test:release` from `maintainer/`. The skipped case is the real SDD
Agent integration test because `AKZO_SDD_AGENT` is not configured. This is a
test-suite result, not a VSIX build, clean install, live Copilot test, or team
distribution validation.

Changed in this verification:

- [Diagnostic extension](../vscode-chat-poc/native-selection/extension.js):
  own-disk restoration and explicit validation/error logging.
- [Diagnostic option label](../vscode-chat-poc/native-selection/extension.js):
  the synthetic `dab` option now reads `DAB API (synthetic)`; this is not a
  production API claim and has not been live-tested in Copilot.
- [Diagnostic tests](../vscode-chat-poc/native-selection/test.cjs):
  empty-host-state recovery, preservation of cancelled answers, invalid-state
  rejection, and the DAB API label in the returned synthetic answer.
- [Diagnostic README](../vscode-chat-poc/native-selection/README.md):
  restoration behavior and exact two-question/DAB limitation.
- This report and a latest-report pointer in the
  [baseline report](QUICKPICK-DIAGNOSTIC-2026-11-13.md).

## Priority 3: production proposal and approval gate

**BLOCKED / NOT EXECUTED:** the user conditioned the production integration
proposal on a passing real Copilot invocation. That condition is unmet.
The earlier report's candidate approach remains conditional, not a verified
file-level implementation approval. Production intake, clipboard handoff,
source analysis, quality gates and Phase 06 are unchanged.

## Release-package gate

**NOT VERIFIED / NOT STARTED:** no VSIX was built or inspected; no clean
Extension Development Host installation, production intake journey, actual
Copilot tool discovery, SDD handoff compatibility run, or team installation
was performed. These gates follow implementation approval and successful live
Copilot verification. No package was published or distributed.

Stop here. Complete the manual Copilot gate, then obtain explicit approval
before any production implementation. Installation/release requires separate
approval; nothing in this diagnostic authorizes it.
