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
  "correct": 355,
  "exactAccuracy": 0.7505,
  "singleAccuracy": 0.8328,
  "multiExactAccuracy": 0.5625,
  "macroAccuracyByPdf": 0.7578,
  "noEvidence": 0,
  "avgConfidenceCorrect": 0.9159,
  "avgConfidenceIncorrect": 0.8588,
  "errorBuckets": {
    "confused_with_distractor": 75,
    "multi_cardinality": 43
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
  "correct": 449,
  "exactAccuracy": 0.8164,
  "singleAccuracy": 0.8507,
  "multiExactAccuracy": 0.7031,
  "macroAccuracyByPdf": 0.8137,
  "noEvidence": 0,
  "avgConfidenceCorrect": 0.9267,
  "avgConfidenceIncorrect": 0.8673,
  "errorBuckets": {
    "confused_with_distractor": 71,
    "multi_cardinality": 30
  },
  "skippedNoExpected": 0
}
```

Holdout by PDF:

| PDF group | accuracy |
| --- | ---: |
| `06-co-toksic` | 0.8286 |
| `11-mening` | 0.8429 |
| `14-sarkoidoz` | 0.8125 |
| `17-gepatit` | 0.8429 |
| `18-gepatitabc` | 0.8143 |
| `19-gepatitc` | 0.7400 |
| `23-nimana` | 0.8429 |
| `33-aorta` | 0.7857 |

## Current All 42 PDF Groups

Combining train, dev, and holdout diagnostic runs gives `1906/2620 = 0.7275` exact accuracy across all answer-keyed groups (`72.75%`). This is the user-requested overall metric for the current continuation. Including the `17` unkeyed `22-eozif` cases as denominator gives `1906/2637 = 0.7228`.

Latest split percentages:

| split | correct / total | exact accuracy |
| --- | ---: | ---: |
| train | `1102/1597` | `69.00%` |
| dev | `355/473` | `75.05%` |
| holdout | `449/550` | `81.64%` |
| all answer-keyed cases | `1906/2620` | `72.75%` |
| all cases including 17 unkeyed `22-eozif` cases | `1906/2637` | `72.28%` |

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
| `09-covid` | `57/70` | `81.43%` |
| `10-LPP` | `50/70` | `71.43%` |
| `11-mening` | `59/70` | `84.29%` |
| `12-nos` | `18/30` | `60.00%` |
| `13-pisha` | `45/70` | `64.29%` |
| `14-sarkoidoz` | `65/80` | `81.25%` |
| `15-toxic` | `43/70` | `61.43%` |
| `16-hb` | `48/70` | `68.57%` |
| `17-gepatit` | `59/70` | `84.29%` |
| `18-gepatitabc` | `57/70` | `81.43%` |
| `19-gepatitc` | `37/50` | `74.00%` |
| `20-hron` | `52/70` | `74.29%` |
| `21-citovirus` | `52/70` | `74.29%` |
| `22-eozif` | `23/31` | `74.19%` |
| `23-nimana` | `59/70` | `84.29%` |
| `24-kalit` | `42/70` | `60.00%` |
| `25-shigez` | `50/70` | `71.43%` |
| `26-blevota` | `37/50` | `74.00%` |
| `27-cistit` | `21/30` | `70.00%` |
| `28-tanzilt` | `38/50` | `76.00%` |
| `29-tpank` | `44/70` | `62.86%` |
| `30-heart` | `43/70` | `61.43%` |
| `31-hbs` | `31/43` | `72.09%` |
| `32-gemor` | `53/70` | `75.71%` |
| `33-aorta` | `55/70` | `78.57%` |
| `34-covid` | `57/70` | `81.43%` |
| `35-cron` | `41/72` | `56.94%` |
| `36-anrid` | `43/70` | `61.43%` |
| `37-bazal` | `40/70` | `57.14%` |
| `38-katarakta` | `23/30` | `76.67%` |
| `39-glaurova` | `47/69` | `68.12%` |
| `40-deficit` | `38/50` | `76.00%` |
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
