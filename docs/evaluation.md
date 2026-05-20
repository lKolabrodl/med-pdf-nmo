# Evaluation

## Dataset Layout

As of the latest run, the repository contains 44 PDF groups under `__test__/NN-name/`.

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

- dev: `07-hron`, `08-ask`, `15-toxic`, `28-tanzilt`, `31-hbs`, `32-gemor`, `34-covid`, `41-destonia`, `44-girshprunga`
- holdout: `06-co-toksic`, `11-mening`, `14-sarkoidoz`, `17-gepatit`, `18-gepatitabc`, `19-gepatitc`, `23-nimana`, `33-aorta`, `43-anomali`

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
  "total": 503,
  "correct": 386,
  "exactAccuracy": 0.7674,
  "singleAccuracy": 0.8281,
  "multiExactAccuracy": 0.6299,
  "macroAccuracyByPdf": 0.7715,
  "noEvidence": 0,
  "avgConfidenceCorrect": 0.7952,
  "avgConfidenceIncorrect": 0.6704,
  "errorBuckets": {
    "confused_with_distractor": 77,
    "multi_cardinality": 40
  },
  "skippedNoExpected": 0
}
```

## Final Holdout Result

Command: `npm run eval:holdout`

The command returned exit code `0` because the acceptance target was met.

```json
{
  "total": 580,
  "correct": 482,
  "exactAccuracy": 0.831,
  "singleAccuracy": 0.867,
  "multiExactAccuracy": 0.7222,
  "macroAccuracyByPdf": 0.8269,
  "noEvidence": 0,
  "avgConfidenceCorrect": 0.8154,
  "avgConfidenceIncorrect": 0.6919,
  "errorBuckets": {
    "confused_with_distractor": 67,
    "multi_cardinality": 31
  },
  "skippedNoExpected": 0
}
```

Holdout by PDF:

| PDF group | accuracy |
| --- | ---: |
| `06-co-toksic` | 0.8571 |
| `11-mening` | 0.8571 |
| `14-sarkoidoz` | 0.8625 |
| `17-gepatit` | 0.8571 |
| `18-gepatitabc` | 0.8143 |
| `19-gepatitc` | 0.7800 |
| `23-nimana` | 0.8429 |
| `33-aorta` | 0.7714 |
| `43-anomali` | 0.8000 |

## Current All 44 PDF Groups

Combining train, dev, and holdout diagnostic runs gives `1969/2680 = 0.7347` exact accuracy across all answer-keyed cases (`73.47%`). Including the `17` unkeyed `22-eozif` cases as denominator gives `1969/2697 = 0.7301`.

Latest split percentages:

| split | correct / total | exact accuracy |
| --- | ---: | ---: |
| train | `1101/1597` answer-keyed, `1101/1614` including unkeyed | `68.94%` answer-keyed, `68.22%` including unkeyed |
| dev | `386/503` | `76.74%` |
| holdout | `482/580` | `83.10%` |
| all answer-keyed cases | `1969/2680` | `73.47%` |
| all cases including 17 unkeyed `22-eozif` cases | `1969/2697` | `73.01%` |

Per-PDF percentages across all 44 groups:

| PDF group | correct / total | exact accuracy |
| --- | ---: | ---: |
| `01-toksic-galogen` | `50/68` | `73.53%` |
| `02-metanol-glikol` | `55/70` | `78.57%` |
| `03-chadlv` | `47/67` | `70.15%` |
| `04-hep-d` | `57/70` | `81.43%` |
| `05-bronhit-hron` | `48/70` | `68.57%` |
| `06-co-toksic` | `60/70` | `85.71%` |
| `07-hron` | `55/71` | `77.46%` |
| `08-ask` | `28/30` | `93.33%` |
| `09-covid` | `57/70` | `81.43%` |
| `10-LPP` | `50/70` | `71.43%` |
| `11-mening` | `60/70` | `85.71%` |
| `12-nos` | `19/30` | `63.33%` |
| `13-pisha` | `45/70` | `64.29%` |
| `14-sarkoidoz` | `69/80` | `86.25%` |
| `15-toxic` | `51/70` | `72.86%` |
| `16-hb` | `48/70` | `68.57%` |
| `17-gepatit` | `60/70` | `85.71%` |
| `18-gepatitabc` | `57/70` | `81.43%` |
| `19-gepatitc` | `39/50` | `78.00%` |
| `20-hron` | `52/70` | `74.29%` |
| `21-citovirus` | `52/70` | `74.29%` |
| `22-eozif` | `23/31` | `74.19%` |
| `23-nimana` | `59/70` | `84.29%` |
| `24-kalit` | `41/70` | `58.57%` |
| `25-shigez` | `50/70` | `71.43%` |
| `26-blevota` | `38/50` | `76.00%` |
| `27-cistit` | `22/30` | `73.33%` |
| `28-tanzilt` | `38/50` | `76.00%` |
| `29-tpank` | `45/70` | `64.29%` |
| `30-heart` | `39/70` | `55.71%` |
| `31-hbs` | `31/43` | `72.09%` |
| `32-gemor` | `54/70` | `77.14%` |
| `33-aorta` | `54/70` | `77.14%` |
| `34-covid` | `57/70` | `81.43%` |
| `35-cron` | `41/72` | `56.94%` |
| `36-anrid` | `43/70` | `61.43%` |
| `37-bazal` | `40/70` | `57.14%` |
| `38-katarakta` | `22/30` | `73.33%` |
| `39-glaurova` | `47/69` | `68.12%` |
| `40-deficit` | `38/50` | `76.00%` |
| `41-destonia` | `54/69` | `78.26%` |
| `42-skvoz` | `32/50` | `64.00%` |
| `43-anomali` | `24/30` | `80.00%` |
| `44-girshprunga` | `21/30` | `70.00%` |

## Leakage Checks

`npm test` verifies that runtime predictor/CLI files do not reference:

- `__test__`
- case files
- expected labels
- answer keys

The predictor receives only PDF path, question, answers, and mode during inference.

The leakage check currently scans `src/predictor.ts`, `src/predictor/**/*.ts`, and `src/cli.ts`; eval and answer-key parsing stay in `scripts/`.

## Offline Feature Export

`npm run features:export -- --split dev` creates `.cache/features/dev-features.json` for non-LLM calibrator research.

The exporter is intentionally separate from runtime inference:

- it reads labels only in `scripts/`, like eval;
- it calls predictor without answer keys;
- it writes labels outside the `features` object;
- `features` contain no question text, answer text, PDF text, PDF group, case id, or answer id;
- PDF group and case id are metadata only for split diagnostics;
- the JSON summary reports `stringValuesInsideFeatures`; it must stay empty.

Current feature exports:

| split | cases | answer rows | exact | single | multi | oracle top-k | multi oracle top-k |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| train | `1597` | `6689` | `0.6925` | `0.7802` | `0.5196` | `0.7445` | `0.6797` |
| dev | `473` | `1956` | `0.7674` | `0.8328` | `0.6181` | `0.8076` | `0.7500` |
| holdout | `550` | `2283` | `0.8291` | `0.8578` | `0.7344` | `0.8509` | `0.8359` |

All three feature exports report an empty `stringValuesInsideFeatures` list.

This export is a diagnostic baseline only. Learned weights are not part of runtime yet and must not be selected on holdout.

## Calibrator Experiment

`npm run calibrator:experiment` reads the local feature exports and writes `.cache/features/calibrator-experiment.json`.

Current experiment:

| selector | train exact | dev exact | holdout report-only exact | decision |
| --- | ---: | ---: | ---: | --- |
| baseline | `0.6925` | `0.7674` | `0.8291` | current runtime |
| logistic model replaces selector | `0.6988` | `0.7421` | `0.8000` | rejected |
| logistic post-corrects baseline multi | `0.6938` | `0.7674` | `0.8255` | rejected for instability |

The learned selectors still do not improve dev and do not survive holdout reporting, so no learned weights are frozen into predictor.

## OCR Limitation

The extractor marks `ocrNeeded: true` when a PDF yields too little text. A JS-only OCR fallback is not implemented. Current corpus PDFs produce text with `pdfjs-dist`, but table/layout semantics are often flattened.
