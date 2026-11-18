# Optional PBI Architecture Views

## Architecture

The browser form exposes **View PBI Architecture** in the Continue tab. The action is manual,
the numbered choice panel and preview start hidden, and no diagram is produced during intake,
refinement, review, approval or handoff generation.

The visualization module consumes only the selected PBI's existing `pbi.json` and
`pbi-state.json`, through the Builder's root-scoped `PBI.read` helper. Repository roles come from
`pbi.json`; rules, branches, criteria, evidence references, decisions and path statuses come from
`pbi-state.json`. This reuses the Builder's canonical structured data and evidence collection; it
does not add another source scanner, reread source files or recalculate fingerprints.

`maintainer/src/visualization.js` is independent of `core.js` and the PowerShell handoff generator.
It produces:

- a rule/condition/outcome flow with recorded actor and decision context;
- a Legacy-to-modern rule map and repository impact table using recorded repository roles,
  branch coverage and evidence-backed path relationships;
- Acceptance Criterion → Business Rule → Source Evidence → Expected Behavior traceability;
- a static, self-contained HTML document and an in-form preview.

Stable source IDs become HTML anchors. Only repository-relative source references, symbols or
locations, and business-rule/criterion text are displayed; source excerpts and evidence summaries
are omitted. All untrusted text is HTML-escaped. The report's CSP denies network, scripts, objects,
forms and base URL changes; its CSS is embedded, and its interaction uses ordinary links and
`details`/`summary` controls rather than JavaScript animation. Source references are text, not
clickable local-file URLs.

The form reads only under the already-selected project root and only from a PBI in the Builder's
discovered PBI list. It does not write into the PBI folder; the reviewer can explicitly download
the HTML through the browser's save/download flow. A report failure is surfaced by the existing UI
error message and leaves normal Builder actions available. No approval, readiness, refinement,
canonical acceptance-criteria, branch-coverage, or handoff code is changed.

## Evidence and interpretation

The report uses the saved state as recorded. It does not establish that evidence remains current,
and does not re-hash source files. A source-cited rule is described as recorded evidence, not as a
fresh code review. A missing, stale, malformed or repository-mismatched reference is shown as
**NOT VERIFIED**; absence from the saved evidence is never described as a missing implementation.
For dependencies, a recorded `reaches` path is shown as evidence-backed only when its referenced
source evidence belongs to that repository. Otherwise the dependency remains **NOT VERIFIED**.

The impact map derives target/reference roles from `pbi.json`, and coverage from the rule branches
in `pbi-state.json`. It keeps recorded branch status distinct from repository-matched evidence and
labels the scope as recorded state. The HTML view cannot approve or change that state.

## Example

The non-sensitive fixture is in [`visualization.cjs`](../maintainer/fixtures/visualization.cjs).
Its illustrative rule is “An invalid measurement is rejected with a clear message”:

```text
Operator
  |
  v
BR-1: invalid measurement?
  +-- yes --> reject save and show a clear message
  |            Legacy: source reference EV-LEGACY
  |            CDMS: source reference EV-CDMS; branch coverage COVERED
  |            DAB: branch coverage PARTIAL; NOT VERIFIED (no DAB source reference)
  +-- expected behavior: recorded on AC-1
```

The workflow view presents the rule and condition as saved; it does not claim the order of multiple
rules. The impact view preserves all four repository boundaries even when no corresponding source
reference is recorded.

## Archify review and licensing

Reviewed Archify's current `main` at commit `11b0d6031853bdae89eed57e7979aabbf0034097`:
the [README](https://github.com/tt-a1i/archify/blob/11b0d6031853bdae89eed57e7979aabbf0034097/README.md),
strict [workflow JSON Schema](https://github.com/tt-a1i/archify/blob/11b0d6031853bdae89eed57e7979aabbf0034097/archify/schemas/workflow.schema.json),
[workflow renderer](https://github.com/tt-a1i/archify/blob/11b0d6031853bdae89eed57e7979aabbf0034097/archify/renderers/workflow/render-workflow.mjs),
example workflow JSON, validation generation script, embedded skill, standalone HTML examples,
`LICENSE`, and `NOTICE`. The current distribution is Apache-2.0 except where separately licensed;
the notice records historical MIT material and third-party components. The project validates
diagram schemas with generated AJV validators and compiles renderer inputs into large standalone
HTML artifacts.

Only the high-level ideas of structured diagram data, explicit validation, stable references and
self-contained output were adopted. No Archify source, schema, runtime, third-party component or
asset was copied or installed, so no Archify attribution/license files are required in this Builder
change.

## Tests and performance

`maintainer/test-visualization.cjs` exercises source-backed and incomplete diagrams, four-repository
relationships, branch coverage, out-of-scope handling, unknown dependencies, criterion traceability,
HTML escaping, offline CSP, explicit failure, and read-only separation from approval/handoff files.

### Performance comparison

The optional report is generated only after an explicit click. It reads two saved JSON files and
does not run in the approval or handoff path. On the same seven-run `benchmark-570.cjs` fixture,
the pre-feature sample and post-feature run had identical approval file operations; elapsed time
varied between samples and is not evidence of a speedup or slowdown.

| Measure | Before visualization | After visualization |
| --- | ---: | ---: |
| Approval median | 434 ms | 321 ms |
| Approval file opens | 151 | 151 |
| Approval bytes read | 384,936 | 384,936 |
| Approval writes | 13 | 13 |
| Complete fixture report generation (p50 / p95) | — | 0.091 / 0.287 ms |
| Complete fixture report HTML size | — | 10,184 bytes |
| Standalone Builder HTML size | 1,005,338 bytes | 1,026,863 bytes (+21,525) |

Report-generation timing is an in-process 600-run measurement using serialized fixture metadata
and state with an in-memory reader; it excludes disk and browser layout/rendering. The bundle-size
increase is the shipped UI/module cost; approval opens, reads and writes did not increase.

## Limitations

- Reports are available in the optional browser form, for a saved PBI with both metadata and a
  `pbi-state.json`; ZIP-only folders cannot be read from this view.
- The report does not inspect application repositories. New or changed code must be analyzed by the
  Builder's existing evidence workflow before the saved state can support the visualization.
- A recorded source reference is not proof that its file is unchanged today. Run the existing
  evidence/readiness checks for currentness.
- Repository roles and relationships absent from the saved data remain **NOT VERIFIED**. The report
  intentionally does not infer a gap or recommend an implementation from absent evidence.
