# Evaluation

## Dataset

The deduplicated local corpus contains 46 PDF groups under
`__test__/NN-name/` and 2,771 parsed cases. Exact metrics exclude 17 cases with
`expected: []`, leaving 2,754 keyed cases: 1,893 single-answer and 861
multi-answer cases.

| split | PDF groups | parsed | keyed | single | multi |
| --- | ---: | ---: | ---: | ---: | ---: |
| train | 25 | 1,558 | 1,541 | 1,001 | 540 |
| dev | 9 | 523 | 523 | 367 | 156 |
| holdout regression | 9 | 540 | 540 | 386 | 154 |
| external transfer | 3 | 150 | 150 | 139 | 11 |
| total | 46 | 2,771 | 2,754 | 1,893 | 861 |

Each group contains `doc.pdf` and `cases.test.ts`. Runtime receives only the PDF,
question, answer variants, and mode. Expected labels are read only by development
scripts under `scripts/`.

## Deduplication

Three duplicate groups were removed, leaving one canonical copy:

| removed | retained | evidence |
| --- | --- | --- |
| `16-hb` | `05-bronhit-hron` | byte-identical PDF and all 70 case records identical |
| `18-gepatitabc` | `04-hep-d` | byte-identical PDF and all 70 case records identical |
| `34-covid` | `09-covid` | same 171-page document in a different binary build; normalized token Jaccard `0.9937`, 107 pages exactly equal, 68/70 case records equal; the remaining two differ only by terminal punctuation |

The final validator reports zero duplicate PDF hashes, zero likely near-duplicate
group pairs, zero cross-split duplicate records, and zero same-split duplicate
records.

## Frozen split

The split is stored in `scripts/dataset-manifest.ts`; it no longer changes when a
directory is added or removed.

- dev: `07-hron`, `08-ask`, `15-toxic`, `25-shigez`, `28-tanzilt`, `31-hbs`, `32-gemor`, `41-destonia`, `42-skvoz`
- holdout regression: `06-co-toksic`, `11-mening`, `14-sarkoidoz`, `17-gepatit`, `19-gepatitc`, `23-nimana`, `33-aorta`, `43-anomali`, `44-girshprunga`
- external transfer: `48-pereferi`, `49-central-ceroz`, `50-dr-gepatit`
- train: `01-toksic-galogen`, `02-metanol-glikol`, `03-chadlv`, `04-hep-d`, `05-bronhit-hron`, `09-covid`, `10-LPP`, `12-nos`, `13-pisha`, `20-hron`, `21-citovirus`, `22-eozif`, `24-kalit`, `26-blevota`, `27-cistit`, `29-tpank`, `30-heart`, `35-cron`, `36-anrid`, `37-bazal`, `38-katarakta`, `39-glaurova`, `40-deficit`, `45-botulizm`, `46-yazva`

The manifest also stores two integrity hashes:

- PDF fingerprint: `97babb222308b6cfd88cdaf2854bfffabe190ef696075db95a4a3109fb6f5f22`;
- parsed-case fingerprint, including expected values: `538a4c48ee220f79cd71d9044e5d65f476e6cb2e60c39b82baa09ff94ffc295c`.

An intentional corpus change requires an explicit manifest update; silent PDF,
question, variant, or label changes fail `npm run dataset:validate`.

## Commands

```bash
npm run dataset:validate
npm test
npm run typecheck
npm run build
npm run eval:train
npm run eval
npm run eval:holdout
npm run eval:external
npx tsx scripts/eval.ts --group NN-name
npm run diagnostics
npm run pdf:audit
npm run predict -- --input request.json
```

`npm run eval:holdout` exits non-zero when exact accuracy is below `0.80`.

## Final result

| split | exact | single | multi exact set | macro by PDF |
| --- | ---: | ---: | ---: | ---: |
| train | `1074/1541 = 0.6970` | `793/1001 = 0.7922` | `281/540 = 0.5204` | `0.7030` |
| dev | `415/523 = 0.7935` | `308/367 = 0.8392` | `107/156 = 0.6859` | `0.8011` |
| holdout regression | `460/540 = 0.8519` | `348/386 = 0.9016` | `112/154 = 0.7273` | `0.8399` |
| external transfer | `129/150 = 0.8600` | `120/139 = 0.8633` | `9/11 = 0.8182` | `0.8543` |
| all keyed cases | `2078/2754 = 0.7545` | `1569/1893 = 0.8288` | `509/861 = 0.5912` | — |

## Controller refactor zero-delta verification

The class-based orchestration refactor was compared against pre-refactor JSON
artifacts case by case with `scripts/diff-results.mjs`. The comparator requires
identical selected sets, selected-id order, raw scores, calibrated scores, and
confidence.

| split | cases compared | changed behavior |
| --- | ---: | ---: |
| train | `1541` | `0` |
| dev | `523` | `0` |
| holdout regression | `540` | `0` |
| external transfer | `150` | `0` |
| total | `2754` | `0` |

The refactor therefore leaves all exact metrics unchanged. The holdout command
continues to exit zero at `0.8519`, above the required `0.80` threshold.

## Technical-debt refactor zero-delta verification

The second architecture stage removed the shared `legacy.ts`, split its
behavior-frozen scorers into thematic modules, replaced the monolithic
post-scoring method with nine ordered processor classes, and strengthened
runtime/controller types. No score, threshold, gate, or evidence order was
intentionally changed.

The same pre-stage artifacts were compared with the final artifacts using the
strict comparator:

| split | cases compared | changed behavior | exact accuracy |
| --- | ---: | ---: | ---: |
| train | `1541` | `0` | `0.6970` |
| dev | `523` | `0` | `0.7935` |
| holdout regression | `540` | `0` | `0.8519` |
| external transfer | `150` | `0` | `0.8600` |
| total | `2754` | `0` | `0.7545` |

For every case, the selected set, selected-id order, raw scores, calibrated
scores, and confidence remain identical. Dataset fingerprints and split
membership are unchanged. OCR fallback was deliberately excluded because it
would change PDF runtime behavior and requires a separate functional
evaluation.

## Coordinate-table decomposition zero-delta verification

The third technical-debt stage replaced the 1,791-line coordinate-table
implementation with a 22-line compatibility facade and separate shared,
relational, group/multi-cell, membership, and type modules. It also introduced
an incremental strict-type gate for this complete scorer family.

The refactor removed all `217` strict errors previously attributed to
`coordinate-table.ts`; repository-wide strict errors fell from `1,347` to
`1,130`. No scoring formula, threshold, evidence kind, or execution order was
changed.

| split | cases compared | changed behavior | exact accuracy |
| --- | ---: | ---: | ---: |
| train | `1541` | `0` | `0.6970` |
| dev | `523` | `0` | `0.7935` |
| holdout regression | `540` | `0` | `0.8519` |
| external transfer | `150` | `0` | `0.8600` |
| total | `2754` | `0` | `0.7545` |

For every case, the selected set, selected-id order, raw scores, calibrated
scores, and confidence remain identical to the stage-3 baseline.
`npm run eval:holdout` exits zero at `0.8519`, and
`npm run typecheck:strict:coordinate` reports zero in-scope errors.

## Scorer feature-folders and numeric decomposition zero-delta verification

The fourth technical-debt stage moved every first-level scorer into one
feature folder with a mandatory `index.ts`. There are now 33 scorer feature
folders and no flat TypeScript modules directly under `scorers/`.
`coordinate-table/` owns its existing internal files, while the former
1,296-line numeric implementation is now a six-line facade over focused cloze,
condition-pair, exact-option, subject-bound, numeric-condition, and
count-relation modules.

The numeric scope now has zero strict errors and is protected by
`npm run typecheck:strict:numeric`. Together with removal of the unreachable
`condition_number_segment` path and its permanent `conditionNumber = null`
aggregation slots, the repository-wide strict backlog fell from `1,130` to
`971` errors. The dead-code cleanup changes no executable score because the
scorer had been explicitly disabled.

The stage-4 baseline was compared with the final artifacts:

| split | cases compared | changed behavior | exact accuracy |
| --- | ---: | ---: | ---: |
| train | `1541` | `0` | `0.6970` |
| dev | `523` | `0` | `0.7935` |
| holdout regression | `540` | `0` | `0.8519` |
| external transfer | `150` | `0` | `0.8600` |
| total | `2754` | `0` | `0.7545` |

For every case, selected IDs, selected order, raw scores, calibrated scores,
and confidence are identical. `npm run eval:holdout` exits zero above the
`0.80` acceptance target. Unit/architecture/leakage tests, normal typecheck,
both scoped strict gates, dataset validation, and Node/browser builds also pass.

Before this runtime round, the existing predictor scored train `1072/1541`,
dev `415/523`, holdout `459/540`, and external `109/150`. The newly added
`50-dr-gepatit` group was measured at `45/70` before any rule was selected from
its errors. The combined external set then became a transfer-development signal,
not a blind test. Final per-PDF external scores are `46/50`, `24/30`, and
`59/70`. The honest future generalization check therefore needs another
label-sealed PDF group.

Final dev summary:

```json
{
  "total": 523,
  "correct": 415,
  "exactAccuracy": 0.7935,
  "singleAccuracy": 0.8392,
  "multiExactAccuracy": 0.6859,
  "macroAccuracyByPdf": 0.8011,
  "noEvidence": 0,
  "errorBuckets": {
    "confused_with_distractor": 79,
    "multi_cardinality": 29
  }
}
```

Final holdout-regression summary:

```json
{
  "total": 540,
  "correct": 460,
  "exactAccuracy": 0.8519,
  "singleAccuracy": 0.9016,
  "multiExactAccuracy": 0.7273,
  "macroAccuracyByPdf": 0.8399,
  "noEvidence": 0,
  "errorBuckets": {
    "confused_with_distractor": 47,
    "multi_cardinality": 33
  }
}
```

External-transfer summary:

```json
{
  "total": 150,
  "correct": 129,
  "exactAccuracy": 0.86,
  "singleAccuracy": 0.8633,
  "multiExactAccuracy": 0.8182,
  "macroAccuracyByPdf": 0.8543,
  "noEvidence": 0
}
```

The original holdout remains a repeatedly inspected frozen acceptance suite.
The current external PDFs also informed this iteration. Their pre-change
`109/150` result is retained as the comparison baseline; the final `129/150`
must not be presented as blind accuracy.

## Multi-answer contract

Exact multi scoring requires full set equality. The runtime intentionally enforces
`multiMinAnswers = 2` when at least two options exist. This lower bound remains
because it matches multi-choice task semantics, improves observed pass rate, and
is independently true for every validated keyed multi case. It does not expose
the full expected count: answers beyond two are selected from runtime PDF evidence,
and inference never reads labels or split files.

`npm run dataset:validate` fails a keyed multi fixture with fewer than two expected
answers. The current corpus reports `multiMinimumExpectedAnswers = 2`.

## Integrity interpretation

The current command-level acceptance target is satisfied, but the holdout is a
regression suite rather than a blind estimate of generalization:

- it has informed many historical iterations;
- its group membership is now frozen and content-isolated, but its labels are not
  newly sealed;
- only five corpus groups are tracked by Git; the remaining local PDF/case groups
  are ignored, so published metrics still require the same local corpus whose two
  fingerprints are listed above.

Dev and external transfer were the primary iteration signals in this round.
Holdout was used as a compatibility report and `0.80` acceptance gate. All
current labels are now available to diagnostics, so a future unbiased estimate
requires another deduplicated PDF set whose labels remain unseen until the next
runtime version is frozen.

## Leakage checks

`npm test` scans runtime predictor and CLI sources and rejects references to test
cases, expected labels, answer keys, or split/eval files. Predictor input does not
contain case ids, PDF-group names, expected cardinality, or correct labels.

The retained rule is format-based. Runtime contains no question id, PDF name,
page number, answer id, expected answer text, or dataset-specific medical fact.

## Metrics

- Single accuracy requires exactly one correct id.
- Multi accuracy requires exact set equality.
- Macro accuracy is the unweighted mean of per-PDF exact accuracy.
- `skippedNoExpected` excludes cases without a complete key.
- `noEvidence` counts predictions without a supporting PDF evidence item.

Eval artifacts are written under `.cache/eval/`; frozen baseline and iteration
artifacts are stored under `.cache/experiments/` and are not runtime assets.

## OCR limitation

The extractor sets `ocrNeeded: true` for low-text PDFs. No OCR fallback is
implemented. Current PDFs are text-extractable, but recommendation and table
layout can still be flattened by `pdfjs-dist`.

## Iteration 163 corpus and final regression protocol

Manifest version 7 contains 47 unique PDF groups and 2,867 keyed cases:

- train: 1,541;
- dev: 523;
- frozen holdout regression: 540;
- external transfer/development: 263.

The new `51-travma` group was evaluated once at `46/113` before its labels
informed any runtime change, then added to external. It is no longer a blind
test. Its difficult multi-heavy composition explains why the expanded external
percentage is lower than the historical three-PDF `129/150 = 0.8600`; the
underlying older groups did not regress.

`npm run eval:loo` evaluates each requested PDF group in an isolated process,
then reports micro exact accuracy, macro/median/min/max per-PDF accuracy, and
per-PDF standard deviation. It does not train or tune a model per fold, so the
report identifies itself as `fit-free-pdf-group-stability`, not an unbiased
learned-model LOO estimate.

Candidate discipline used in iterations 159–163:

1. Evaluate full dev with a uniquely tagged config override.
2. Diff selected sets and raw scores case-by-case against the accepted default.
3. Reject zero/negative dev candidates without opening holdout.
4. For a positive dev candidate, verify train, frozen holdout, external, and all
   keyed cases before changing the default.

Only structural document-token repair passed this sequence. Final measured
default results are:

| split | exact |
| --- | ---: |
| train | `1074/1541 = 0.6970` |
| dev | `416/523 = 0.7954` |
| holdout | `460/540 = 0.8519` |
| external | `175/263 = 0.6654` |
| all | `2125/2867 = 0.7412` |

The holdout command remains an executable acceptance gate and exits non-zero
below `0.80`.
