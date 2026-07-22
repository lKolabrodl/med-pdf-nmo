# Evaluation

## Dataset

The deduplicated local corpus contains 45 PDF groups under
`__test__/NN-name/` and 2,701 parsed cases. Exact metrics exclude 17 cases with
`expected: []`, leaving 2,684 keyed cases: 1,823 single-answer and 861
multi-answer cases.

| split | PDF groups | parsed | keyed | single | multi |
| --- | ---: | ---: | ---: | ---: | ---: |
| train | 25 | 1,558 | 1,541 | 1,001 | 540 |
| dev | 9 | 523 | 523 | 367 | 156 |
| holdout regression | 9 | 540 | 540 | 386 | 154 |
| external transfer | 2 | 80 | 80 | 69 | 11 |
| total | 45 | 2,701 | 2,684 | 1,823 | 861 |

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
- external transfer: `48-pereferi`, `49-central-ceroz`
- train: `01-toksic-galogen`, `02-metanol-glikol`, `03-chadlv`, `04-hep-d`, `05-bronhit-hron`, `09-covid`, `10-LPP`, `12-nos`, `13-pisha`, `20-hron`, `21-citovirus`, `22-eozif`, `24-kalit`, `26-blevota`, `27-cistit`, `29-tpank`, `30-heart`, `35-cron`, `36-anrid`, `37-bazal`, `38-katarakta`, `39-glaurova`, `40-deficit`, `45-botulizm`, `46-yazva`

The manifest also stores two integrity hashes:

- PDF fingerprint: `cb29ea46952100dcde5c4e51c9734795996bf9c1c6d302f13763713608481497`;
- parsed-case fingerprint, including expected values: `1030ee32b346580ef8e805431c41631f43fad254ad3ee94bb0bdabd6aaecfa89`.

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
| train | `1069/1541 = 0.6937` | `790/1001 = 0.7892` | `279/540 = 0.5167` | `0.6999` |
| dev | `415/523 = 0.7935` | `308/367 = 0.8392` | `107/156 = 0.6859` | `0.8011` |
| holdout regression | `459/540 = 0.8500` | `347/386 = 0.8990` | `112/154 = 0.7273` | `0.8383` |
| external transfer | `64/80 = 0.8000` | `61/69 = 0.8841` | `3/11 = 0.2727` | `0.7800` |
| all keyed cases | `2007/2684 = 0.7478` | `1506/1823 = 0.8261` | `501/861 = 0.5819` | — |

The predictor was frozen before the two current external groups were added.
Their first recorded result is therefore a clean baseline for this commit:
`48-pereferi` scores `43/50 = 0.8600`, and `49-central-ceroz` scores
`21/30 = 0.7000`. No predictor rule was changed after reading either label set.
Diagnostics have now been generated, so future iterations must treat `64/80`
as a regression baseline rather than claiming that the same PDFs remain blind.

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
    "confused_with_distractor": 78,
    "multi_cardinality": 30
  }
}
```

Final holdout-regression summary:

```json
{
  "total": 540,
  "correct": 459,
  "exactAccuracy": 0.85,
  "singleAccuracy": 0.899,
  "multiExactAccuracy": 0.7273,
  "macroAccuracyByPdf": 0.8383,
  "noEvidence": 0,
  "errorBuckets": {
    "confused_with_distractor": 49,
    "multi_cardinality": 32
  }
}
```

External-transfer summary:

```json
{
  "total": 80,
  "correct": 64,
  "exactAccuracy": 0.8,
  "singleAccuracy": 0.8841,
  "multiExactAccuracy": 0.2727,
  "macroAccuracyByPdf": 0.78,
  "noEvidence": 0
}
```

The original holdout remains a repeatedly inspected frozen acceptance suite.
The current external score is the first frozen baseline for those two PDFs; any
later rule selected using their errors must report against this stored result.

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

Dev is the primary iteration signal. Holdout is used as a compatibility report
and `0.80` acceptance gate. The current external result was recorded only after
runtime logic was frozen, but its labels are now available to diagnostics. A
future unbiased estimate therefore requires another deduplicated PDF set whose
labels remain unseen until the next runtime version is frozen.

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
