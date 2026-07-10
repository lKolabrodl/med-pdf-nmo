# Evaluation

## Dataset

The local corpus currently contains 46 PDF groups under `__test__/NN-name/` and 2,831 parsed cases. Exact metrics exclude 17 cases with `expected: []`, leaving 2,814 answer-keyed cases: 1,938 single-answer and 876 multi-answer cases.

| split | PDF groups | keyed cases | single | multi |
| --- | ---: | ---: | ---: | ---: |
| train | 28 | 1,731 | 1,153 | 578 |
| dev | 9 | 503 | 349 | 154 |
| holdout | 9 | 580 | 436 | 144 |
| total | 46 | 2,814 | 1,938 | 876 |

Each group contains `doc.pdf` and `cases.test.ts`. Runtime code receives only the PDF path, question, answer variants, and mode. Expected labels are read only by scripts under `scripts/`.

## Split

The deterministic split uses seed `20260509` and assigns whole directory groups, not individual questions.

- dev: `07-hron`, `08-ask`, `15-toxic`, `28-tanzilt`, `31-hbs`, `32-gemor`, `34-covid`, `41-destonia`, `44-girshprunga`
- holdout: `06-co-toksic`, `11-mening`, `14-sarkoidoz`, `17-gepatit`, `18-gepatitabc`, `19-gepatitc`, `23-nimana`, `33-aorta`, `43-anomali`
- train: the remaining 28 groups

## Commands

```bash
npm test
npm run typecheck
npm run eval
npm run eval:holdout
npm run predict -- --input request.json
```

`npm run eval:holdout` exits non-zero when exact accuracy is below `0.80`.

## Current Result

The baseline below is the checkout before iterations 96-100. The final result enables the retained relation-tuple resolver and explicit ordinal-range set decoder.

| split | version | exact | single | multi exact set | macro by PDF |
| --- | --- | ---: | ---: | ---: | ---: |
| dev | baseline | `395/503 = 0.7853` | `0.8424` | `0.6558` | `0.7915` |
| dev | final | `401/503 = 0.7972` | `0.8453` | `0.6883` | `0.8010` |
| holdout | baseline | `494/580 = 0.8517` | `0.8899` | `0.7361` | `0.8494` |
| holdout | final | `494/580 = 0.8517` | `0.8899` | `0.7361` | `0.8494` |

The final dev run changed exactly six selected sets relative to baseline. All six changes were wrong-to-right: five ordinal multi sets in `32-gemor` and one relation-bound numeric single in `34-covid`. The final holdout selected sets are byte-for-byte equivalent at the case level: zero changes across all 580 cases.

Final dev summary:

```json
{
  "total": 503,
  "correct": 401,
  "exactAccuracy": 0.7972,
  "singleAccuracy": 0.8453,
  "multiExactAccuracy": 0.6883,
  "macroAccuracyByPdf": 0.801,
  "noEvidence": 0,
  "avgConfidenceCorrect": 0.8108,
  "avgConfidenceIncorrect": 0.6698,
  "errorBuckets": {
    "confused_with_distractor": 72,
    "multi_cardinality": 30
  }
}
```

Final holdout-regression summary:

```json
{
  "total": 580,
  "correct": 494,
  "exactAccuracy": 0.8517,
  "singleAccuracy": 0.8899,
  "multiExactAccuracy": 0.7361,
  "macroAccuracyByPdf": 0.8494,
  "noEvidence": 0,
  "avgConfidenceCorrect": 0.8279,
  "avgConfidenceIncorrect": 0.6844,
  "errorBuckets": {
    "confused_with_distractor": 57,
    "multi_cardinality": 29
  }
}
```

## Presentation-Layer Zero-Delta Check

Iteration 101 adds display-only `sources` and logical PDF block metadata. Batch evaluation calls `predict(..., { includeSources: false })`, but still uses the refactored PDF extractor and therefore checks that scoring text and selection remain stable.

Case-level comparison against the accepted iteration-100 artifacts:

| split | before | after | selected-set changes |
| --- | ---: | ---: | ---: |
| dev | `401/503` | `401/503` | `0/503` |
| holdout regression | `494/580` | `494/580` | `0/580` |

The source builder itself is covered separately by unit and public-API tests, including real bullet boundaries, paragraph clipping, answer ordering, selected-answer primary context, numeric token boundaries, comparator/range/slash semantics, conflict labeling, JSON serialization, and enabled/disabled output equivalence.

## Evaluation Integrity Audit

The command-level acceptance gate passes, but the current holdout must be interpreted as a regression suite, not as an unbiased estimate of generalization.

- The holdout has informed decisions over more than 95 historical iterations. Repeated model selection against it removes its status as a blind holdout.
- Directory-level grouping does not prevent content duplication under different group names. The audit found an identical `04-hep-d`/`18-gepatitabc` PDF-question corpus across train and holdout, train `09-covid` questions duplicated in dev `34-covid`, and 138 normalized question/answer records with an exact counterpart across split boundaries.
- The local corpus has 46 groups, but only five group case files are tracked by Git; 41 local groups are ignored. Therefore the published metrics are not reproducible from the tracked repository alone.
- At least one malformed label exists (`28-tanzilt#11` contains duplicate expected id `A`), and two `41-destonia` labels conflict with literal source statements. These labels were not used to tune runtime facts or silently corrected.

A future trustworthy estimate requires a newly deduplicated PDF-level split whose test labels remain unseen until the algorithm is frozen. Until then, dev is the primary iteration signal and holdout is a compatibility/acceptance report only.

## Leakage Checks

`npm test` scans runtime predictor and CLI sources and rejects references to test cases, expected labels, answer keys, or split/eval files. The predictor does not receive case ids, PDF-group names, expected cardinality, or correct labels during inference.

The new rules are language- and layout-based. They do not contain question ids, PDF names, answer ids, page numbers, dataset medical facts, or expected answer text.

## Metrics

- Single-answer accuracy requires exactly one correct id.
- Multi-answer accuracy requires exact set equality.
- Macro accuracy is the unweighted mean of per-PDF exact accuracy.
- `skippedNoExpected` excludes cases without a complete key.
- `noEvidence` counts predictions without a supporting PDF evidence item.

Eval artifacts are written under `.cache/eval/`; frozen before/after artifacts for iterations 96-100 are under `.cache/experiments/user-3-theories/`.

## OCR Limitation

The extractor sets `ocrNeeded: true` for low-text PDFs. No OCR fallback is implemented. Current PDFs are text-extractable, but table and recommendation layout can still be flattened by `pdfjs-dist`.
