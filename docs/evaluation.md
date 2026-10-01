# Evaluation

## Dataset

The current local corpus contains 48 canonical PDF groups under
`__test__/NN-name/` and 2,954 parsed cases. Exact metrics exclude 18 cases with
`expected: []`, leaving 2,936 keyed cases: 1,945 single-answer and 991
multi-answer cases.

| split | PDF groups | parsed | keyed | single | multi |
| --- | ---: | ---: | ---: | ---: | ---: |
| train | 25 | 1,558 | 1,541 | 1,001 | 540 |
| dev | 9 | 523 | 523 | 367 | 156 |
| holdout regression | 9 | 540 | 540 | 386 | 154 |
| external transfer | 5 | 333 | 332 | 191 | 141 |
| total | 48 | 2,954 | 2,936 | 1,945 | 991 |

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

The current validator reports zero duplicate PDF hashes, zero likely duplicate
group pairs, and zero cross-split duplicate records. Two repeated records within
`52-infection` remain counted consistently in both baseline and candidate.
`53-NOC_Blood` is a verified alias of train `12-nos`: both PDF bytes and parsed
cases must match before the loader excludes the duplicate copy. A changed PDF or
changed label in the alias makes validation fail; no source file is deleted.

## Frozen split

The split is stored in `scripts/dataset-manifest.ts`; it no longer changes when a
directory is added or removed.

- dev: `07-hron`, `08-ask`, `15-toxic`, `25-shigez`, `28-tanzilt`, `31-hbs`, `32-gemor`, `41-destonia`, `42-skvoz`
- holdout regression: `06-co-toksic`, `11-mening`, `14-sarkoidoz`, `17-gepatit`, `19-gepatitc`, `23-nimana`, `33-aorta`, `43-anomali`, `44-girshprunga`
- external transfer: `48-pereferi`, `49-central-ceroz`, `50-dr-gepatit`, `51-travma`, `52-infection`
- train: `01-toksic-galogen`, `02-metanol-glikol`, `03-chadlv`, `04-hep-d`, `05-bronhit-hron`, `09-covid`, `10-LPP`, `12-nos`, `13-pisha`, `20-hron`, `21-citovirus`, `22-eozif`, `24-kalit`, `26-blevota`, `27-cistit`, `29-tpank`, `30-heart`, `35-cron`, `36-anrid`, `37-bazal`, `38-katarakta`, `39-glaurova`, `40-deficit`, `45-botulizm`, `46-yazva`

The manifest also stores two integrity hashes:

- PDF fingerprint: `7d990701f1f6c6ef730783ff305c9905f893a3d0d85f04386d92149ac31200a2`;
- parsed-case fingerprint, including expected values: `d4323e60a8e01fb20751e182349686a0ff7ecc3ca56af081e5c82f451a479b4c`.

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

## Experiment integrity in iterations 166–175

Train/dev/holdout group membership was preserved. Manifest v8 adds the already
locally available `52-infection` only to external. Its unchanged-predictor score
was recorded before this round's scorer changes. Old cache artifacts had already
evaluated it, so it is not a new blind holdout. The verified `53-NOC_Blood` alias
is never counted as an independent external PDF.

Candidate logic is chosen from dev, train errors, and synthetic nonmedical
counterexamples. Holdout/external runs are used after that choice to assess
regression and transfer. All of these PDF collections have been inspected in
prior work; an unbiased generalization estimate requires additional untouched
PDF groups with complete independently prepared answer sets.

New JSON summaries record the SHA-256 fingerprint of non-test runtime sources,
the fully resolved configuration, manifest version and data fingerprints, and
installed Node/PDF.js versions. The PDF-group runner refuses to aggregate reports
with inconsistent provenance. It runs the fixed predictor separately on each
PDF, without fitting per fold; it is a stability audit rather than trained-model
leave-one-out validation.

The old 47-PDF subset was rehashed independently: both its PDF fingerprint
(`311bf1cbdec7a6d02d86247f09ee7d62ff0c3167c1c4ef71f1513ff3f0e983c1`)
and parsed-case fingerprint including labels
(`f16dead6fec4ed63b500bb2e7c990732611d8d4a6cf80b8d55c2cdd9e47b4cea`)
still match manifest v7 exactly.

## September candidate review

| split | accepted baseline | rejected H2 candidate | net correct |
| --- | ---: | ---: | ---: |
| train | `1074/1541 = 0.6970` | `1080/1541 = 0.7008` | +6 |
| dev | `416/523 = 0.7954` | `425/523 = 0.8126` | +9 |
| holdout regression | `460/540 = 0.8519` | `458/540 = 0.8481` | −2 |
| external transfer | `221/332 = 0.6657` | `222/332 = 0.6687` | +1 |
| all keyed cases | `2171/2936 = 0.7394` | `2185/2936 = 0.7442` | +14 |

H1 native tags changed no dev score or selected set and was rejected. H2 raised
aggregate accuracy, but its holdout decline fails the retention criterion fixed
before transfer review. The whole H2 candidate is disabled. Its earlier unsafe
versions are not restored to recover a better score. Both experimental flags
are false in the accepted default.

The candidate fixes 17 cases and regresses three; there is also one
wrong-to-wrong change. All three regressions are on holdout. Every multi selected
set remains identical to baseline. The `0.80` holdout command passes even for
this rejected candidate, illustrating why that absolute gate does not by itself
establish improvement over an already stronger baseline.

Machine-readable split, per-PDF, exact-set-change, and provenance details are in
[`experiments/2026-09-05-results.json`](experiments/2026-09-05-results.json).
The rejected source fingerprint is
`bc01f27437cf01d3d37a167189956f392e7b326e0acc871f517792f05cba80b1`.

Iteration 175 freshly reevaluated every split after disabling both experiments.
All **2,936 keyed records** match baseline exactly, including selected-id order,
raw/calibrated scores and confidence. The accepted result is the baseline column
above. Holdout exits zero at `0.8519`; the full-corpus single accuracy is
`1612/1945 = 0.8288` and multi exact is `559/991 = 0.5641`. Restored source
fingerprint:
`2065251f5544ea1680c5c50e127aa62755d545d8345c278fe251866e12d65a2f`.

Validation: 825 unit/contract tests, normal typecheck, both existing strict
scopes, all three Node/browser builds, dataset integrity, and source/packaged CLI
smoke checks pass. Vitest intentionally skips 2,984 raw corpus fixtures (including
the duplicate directory); canonical eval accounts for the 2,936 keyed records.

Reproduce either disabled experiment explicitly on dev:

```bash
npm run eval -- --config nativePdfStructure=true,contrastiveOptionFamily=false --report-tag native-table-experiment
npm run eval -- --config contrastiveOptionFamily=true --report-tag contrastive-experiment
```

On Windows PowerShell, use `npm.cmd` if a shell wrapper strips arguments after
`--`. Running the commands without those overrides evaluates the accepted default.

## Historical result before the expanded external set

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

## October 2026 exact-bound parser protocol

Iteration 176 freshly reproduces dev `416/523` from accepted runtime fingerprint
`2065251f5544ea1680c5c50e127aa62755d545d8345c278fe251866e12d65a2f`.
The iteration-175 train/holdout/external reports provide same-corpus baselines
of `1074/1541`, `460/540`, and `221/332`. The manifest, PDFs, cases, expected
sets, and split assignments are unchanged.

The development sequence uses invented syntax counterexamples before corpus
evaluation. The first replacement parser is rejected for two new floating-point
identity failures; its canceled dev/train jobs are not aggregate results. The
exact-string parser then passes all 29 syntax scenarios and 857 total unit and
contract tests. Dev and train are evaluated through isolated PDF processes,
with all group provenance required to match. No per-fold fitting occurs.

Retention is declared in iteration 177 before its candidate eval: no decrease
in exact dev or train count, the holdout acceptance command must pass, and no
decrease in either holdout or external exact count. A zero-delta fix may be
retained for demonstrated parsing correctness, without reporting an accuracy
gain. Only a frozen candidate can reach transfer reporting; the historical
holdout and external sets remain observed regression sets. Transfer errors
cannot be used to select case-specific repairs.

Frozen iteration-178 runtime fingerprint:
`7ac5d3c200ec5b77ea5224af6f26f1fff5d704fe64fe936cf11bc94ad9446b0c`.
Use tagged reports so canceled and final revisions cannot be mixed. Selection
sets, raw/calibrated scores, confidence, labels, and dataset provenance are
compared against their accepted counterparts. Final results will be archived in
`docs/experiments/2026-10-01-results.json` when the complete gate finishes.

Iterations 178 and 179 fail the dev/train criterion and receive no transfer
evaluation. The retained candidate under consideration is instead iteration
180: complete source numeric-token lookup with the original answer grammar,
cue rules and scoring weights. Its dev report is fully zero-delta on all 523
records. Source fingerprint:
`022fa533610332bc14cec0543d98034e198289ae2573476262e13fc52638c9fb`.
Final reports use `r180-final-token`; canceled `r180-token` jobs are excluded.
The frozen dev/train candidate must pass the same transfer gate. The rejected
parser's archived text files are development artifacts and are not runtime
dependencies or active tests.

Final iteration 180 passes retention with fresh exact counts:

| split | exact |
| --- | ---: |
| train | `1074/1541 = 0.6970` |
| dev | `416/523 = 0.7954` |
| holdout regression | `460/540 = 0.8519` |
| external transfer | `221/332 = 0.6657` |
| all keyed | `2171/2936 = 0.7394` |

The holdout command exits zero. Strict all-record comparison confirms identical
selected-id order, raw/calibrated scores, confidence, correctness and labels
against accepted iteration 175. The source lookup is retained for demonstrated
parsing correctness; it yields no corpus accuracy gain. Full tests pass (`841`),
including the 16 added scenarios, typecheck and all three builds pass. Final
and rejected summaries are archived in `docs/experiments/2026-10-01-results.json`.
