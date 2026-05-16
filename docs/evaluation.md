# Evaluation

## Dataset Layout

As of the latest run, the repository contains 42 PDF groups under `__test__/NN-name/`.

Each group has:

- `doc.pdf`
- `cases.test.ts`

The case files contain question text, answer variants, mode, and expected answers. Expected answers are parsed only by `scripts/eval.ts` and `scripts/cases.ts`.

## Split

The split is group-wise by PDF, so questions from one PDF cannot appear in more than one split.

- seed: `20260509`
- holdout ratio: 20%
- dev ratio: 20%
- remaining groups: train

Groups:

- dev: `07-hron`, `08-ask`, `15-toxic`, `28-tanzilt`, `31-hbs`, `32-gemor`, `34-covid`, `41-destonia`
- holdout: `06-co-toksic`, `11-mening`, `14-sarkoidoz`, `17-gepatit`, `18-gepatitabc`, `19-gepatitc`, `23-nimana`, `33-aorta`

## Commands

```bash
npm test
npm run typecheck
npm run eval
npm run eval:holdout
```

`npm run eval:holdout` exits non-zero when holdout exact accuracy is below `0.80`.

## Metrics

Eval reports:

- overall exact accuracy;
- single-answer exact accuracy;
- multi-answer exact set accuracy;
- macro accuracy by PDF;
- error buckets;
- number of no-evidence cases;
- average confidence for correct and incorrect predictions.
- `skippedNoExpected`: cases with `expected: []`, which are excluded from exact-accuracy denominators because no answer key exists.

## Final Dev Result

Command: `npm run eval`

```json
{
  "total": 473,
  "correct": 356,
  "exactAccuracy": 0.7526,
  "singleAccuracy": 0.8359,
  "multiExactAccuracy": 0.5625,
  "macroAccuracyByPdf": 0.7607,
  "noEvidence": 0,
  "avgConfidenceCorrect": 0.9159,
  "avgConfidenceIncorrect": 0.857,
  "errorBuckets": {
    "confused_with_distractor": 68,
    "multi_cardinality": 49
  },
  "skippedNoExpected": 0
}
```

## Final Holdout Result

Command: `npm run eval:holdout`

The command returned exit code `0` because the acceptance target was met.

```json
{
  "total": 550,
  "correct": 446,
  "exactAccuracy": 0.8109,
  "singleAccuracy": 0.846,
  "multiExactAccuracy": 0.6953,
  "macroAccuracyByPdf": 0.809,
  "noEvidence": 0,
  "avgConfidenceCorrect": 0.9272,
  "avgConfidenceIncorrect": 0.8668,
  "errorBuckets": {
    "confused_with_distractor": 73,
    "multi_cardinality": 31
  },
  "skippedNoExpected": 0
}
```

Holdout by PDF:

| PDF group | accuracy |
| --- | ---: |
| `06-co-toksic` | 0.8286 |
| `11-mening` | 0.8429 |
| `14-sarkoidoz` | 0.7750 |
| `17-gepatit` | 0.8429 |
| `18-gepatitabc` | 0.8143 |
| `19-gepatitc` | 0.7400 |
| `23-nimana` | 0.8429 |
| `33-aorta` | 0.7857 |

## Current All 42 PDF Groups

Combining train, dev, and holdout diagnostic runs gives `1901/2620 = 0.7256` exact accuracy across all answer-keyed groups (`72.56%`). This is the user-requested overall metric for the current continuation. Including the `17` unkeyed `22-eozif` cases as denominator gives `1901/2637 = 0.7209`.

Latest split percentages:

| split | correct / total | exact accuracy |
| --- | ---: | ---: |
| train | `1099/1597` | `68.82%` |
| dev | `356/473` | `75.26%` |
| holdout | `446/550` | `81.09%` |
| all answer-keyed cases | `1901/2620` | `72.56%` |
| all cases including 17 unkeyed `22-eozif` cases | `1901/2637` | `72.09%` |

Per-PDF percentages across all 42 groups:

| PDF group | correct / total | exact accuracy |
| --- | ---: | ---: |
| `01-toksic-galogen` | `49/68` | `72.06%` |
| `02-metanol-glikol` | `55/70` | `78.57%` |
| `03-chadlv` | `47/67` | `70.15%` |
| `04-hep-d` | `57/70` | `81.43%` |
| `05-bronhit-hron` | `48/70` | `68.57%` |
| `06-co-toksic` | `58/70` | `82.86%` |
| `07-hron` | `53/71` | `74.65%` |
| `08-ask` | `26/30` | `86.67%` |
| `09-covid` | `58/70` | `82.86%` |
| `10-LPP` | `50/70` | `71.43%` |
| `11-mening` | `59/70` | `84.29%` |
| `12-nos` | `18/30` | `60.00%` |
| `13-pisha` | `46/70` | `65.71%` |
| `14-sarkoidoz` | `62/80` | `77.50%` |
| `15-toxic` | `44/70` | `62.86%` |
| `16-hb` | `48/70` | `68.57%` |
| `17-gepatit` | `59/70` | `84.29%` |
| `18-gepatitabc` | `57/70` | `81.43%` |
| `19-gepatitc` | `37/50` | `74.00%` |
| `20-hron` | `53/70` | `75.71%` |
| `21-citovirus` | `52/70` | `74.29%` |
| `22-eozif` | `21/31` | `67.74%` |
| `23-nimana` | `59/70` | `84.29%` |
| `24-kalit` | `40/70` | `57.14%` |
| `25-shigez` | `49/70` | `70.00%` |
| `26-blevota` | `36/50` | `72.00%` |
| `27-cistit` | `21/30` | `70.00%` |
| `28-tanzilt` | `38/50` | `76.00%` |
| `29-tpank` | `45/70` | `64.29%` |
| `30-heart` | `45/70` | `64.29%` |
| `31-hbs` | `32/43` | `74.42%` |
| `32-gemor` | `51/70` | `72.86%` |
| `33-aorta` | `55/70` | `78.57%` |
| `34-covid` | `58/70` | `82.86%` |
| `35-cron` | `43/72` | `59.72%` |
| `36-anrid` | `42/70` | `60.00%` |
| `37-bazal` | `40/70` | `57.14%` |
| `38-katarakta` | `20/30` | `66.67%` |
| `39-glaurova` | `47/69` | `68.12%` |
| `40-deficit` | `37/50` | `74.00%` |
| `41-destonia` | `54/69` | `78.26%` |
| `42-skvoz` | `32/50` | `64.00%` |

## Leakage Checks

`npm test` verifies that runtime predictor/CLI files do not reference:

- `__test__`
- case files
- expected labels
- answer keys

The predictor receives only PDF path, question, answers, and mode during inference.

The leakage check currently scans `src/predictor.ts`, `src/predictor/**/*.ts`, and `src/cli.ts`; eval and answer-key parsing stay in `scripts/`.

## OCR Limitation

The extractor marks `ocrNeeded: true` when a PDF yields too little text. A JS-only OCR fallback is not implemented. Current corpus PDFs produce text with `pdfjs-dist`, but table/layout semantics are often flattened.
