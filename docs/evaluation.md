# Evaluation

## Dataset

The deduplicated local corpus contains 43 PDF groups under
`__test__/NN-name/` and 2,621 parsed cases. Exact metrics exclude 17 cases with
`expected: []`, leaving 2,604 keyed cases: 1,754 single-answer and 850
multi-answer cases.

| split | PDF groups | parsed | keyed | single | multi |
| --- | ---: | ---: | ---: | ---: | ---: |
| train | 25 | 1,558 | 1,541 | 1,001 | 540 |
| dev | 9 | 523 | 523 | 367 | 156 |
| holdout regression | 9 | 540 | 540 | 386 | 154 |
| total | 43 | 2,621 | 2,604 | 1,754 | 850 |

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
- train: `01-toksic-galogen`, `02-metanol-glikol`, `03-chadlv`, `04-hep-d`, `05-bronhit-hron`, `09-covid`, `10-LPP`, `12-nos`, `13-pisha`, `20-hron`, `21-citovirus`, `22-eozif`, `24-kalit`, `26-blevota`, `27-cistit`, `29-tpank`, `30-heart`, `35-cron`, `36-anrid`, `37-bazal`, `38-katarakta`, `39-glaurova`, `40-deficit`, `45-botulizm`, `46-yazva`

The manifest also stores two integrity hashes:

- PDF fingerprint: `688b55d1d015fa0fbbed8b32d080cdee554917d1924b6e6e144c589145cb7345`;
- parsed-case fingerprint, including expected values: `4df47c865fd6714faa2e037110b93bfda51b3399aded4ecc4ecb311c09badb47`.

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
npm run diagnostics
npm run predict -- --input request.json
```

`npm run eval:holdout` exits non-zero when exact accuracy is below `0.80`.

## Final result

| split | exact | single | multi exact set | macro by PDF |
| --- | ---: | ---: | ---: | ---: |
| train | `1070/1541 = 0.6944` | `790/1001 = 0.7892` | `280/540 = 0.5185` | `0.7008` |
| dev | `415/523 = 0.7935` | `308/367 = 0.8392` | `107/156 = 0.6859` | `0.8011` |
| holdout regression | `458/540 = 0.8481` | `346/386 = 0.8964` | `112/154 = 0.7273` | `0.8367` |
| all keyed cases | `1943/2604 = 0.7462` | `1444/1754 = 0.8233` | `499/850 = 0.5871` | — |

The fresh iteration-109 baseline, reproduced after the full 108-iteration audit,
was dev `405/523 = 0.7744` and holdout `458/540 = 0.8481`. Four narrowly gated
source-structure changes add ten exact dev cases. Every dev selection change is
wrong-to-right; the frozen holdout has no selected-set churn:

| split | baseline | final | selected-set changes | net exact |
| --- | ---: | ---: | ---: | ---: |
| dev | `405/523` | `415/523` | `10/523` | `+10` |
| holdout regression | `458/540` | `458/540` | `0/540` | `0` |

The retained changes are format-general rather than case-specific: bounded
sibling-bullet membership (`+5`), whole-interval relation tuples (`+3`), and
clause-local counted-object tuples (`+2`). A fifth exact-negation-pair prototype
was exact-neutral and is disabled by default.

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
  "correct": 458,
  "exactAccuracy": 0.8481,
  "singleAccuracy": 0.8964,
  "multiExactAccuracy": 0.7273,
  "macroAccuracyByPdf": 0.8367,
  "noEvidence": 0,
  "errorBuckets": {
    "confused_with_distractor": 51,
    "multi_cardinality": 31
  }
}
```

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
and `0.80` acceptance gate. A trustworthy unbiased estimate requires a new
deduplicated PDF set whose labels remain unseen until runtime logic is frozen.

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
