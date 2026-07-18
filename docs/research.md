# Research

## Constraints

Runtime inference is JavaScript/Node.js only. It does not use LLMs, transformer inference, remote AI services, generated embeddings, HuggingFace inference, or answer keys. Correct labels are read only by eval scripts.

## Data found

The current deduplicated local corpus has 43 PDF groups under `__test__/NN-name/`. Each group contains `doc.pdf` and `cases.test.ts`. The TypeScript case files contain the question, variants, mode, and expected labels. The predictor never imports these files; `scripts/eval.ts`, `scripts/cases.ts`, and offline diagnostic scripts read them only for scoring or feature-label export.

Current parsed cases: 2,621, including 17 unkeyed cases that are skipped by exact eval.

- answer-keyed cases: 2,604
- single-answer answer-keyed cases: 1,754
- multi-answer answer-keyed cases: 850

Reproducibility caveat: only five group case files are tracked by Git; 38 corpus groups are local/ignored. The current metrics therefore require the local workspace dataset and its manifest fingerprints.

## Approaches considered

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Exact string matching | Strong when a question is a literal PDF prefix | Brittle to line breaks, OCR noise, inflection, and tables | Kept as one high-confidence signal |
| TF-IDF/BM25 retrieval | Fast, transparent, no model serving | Needs careful normalization and chunking | Implemented in repo |
| Question+answer phrase scoring | Good for cloze-style NMO questions | Can over-score distractors when all options are nearby | Implemented with proximity signals |
| Contrastive answer scoring | Compares options against the same retrieved context | Still confused by flattened tables | Implemented through per-answer raw scores and calibrated relative scores |
| List/anchor scoring | Improves "относятся/являются/следующие" multi questions | Requires robust anchor extraction | Implemented and kept |
| Line/table chunks | Can recover some table rows | `pdfjs-dist` often flattens table order into one paragraph | Tried; partially kept line chunks, not sufficient |
| Compact numeric windows | Intended to fix numeric table rows | Over-scored neighboring values in flattened text | Tried and reverted |
| Russian number-word aliases | Helps digits vs words like "six" | Folded Cyrillic/Latin extraction produced false numeric matches in nearby context | Tried and reverted |
| OCR fallback | Needed for scanned PDFs | JS OCR is heavy and not needed for current text-extractable corpus | Not implemented; low-text PDFs are flagged |
| Small non-LLM feature calibrator | Could improve near-ties and multi pruning without medical text memorization | Dangerous if trained on question/answer text, PDF ids, or labels leaking into features | Exporter and experiment script exist; learned weights are still rejected because dev/holdout stability is worse than fixed structural rules |
| Parenthetical category binding | Separates adjacent answer groups flattened into one paragraph | Unsafe if applied to incidental parentheses or factor-risk example lists | Kept narrowly for explicit category headings |
| Stable medical abbreviation aliases | Recovers common RU abbreviations such as `СПЯ` and `РЭ` | Broad aliases can leak semantics into unrelated endometrium/cancer contexts | Kept as a small guarded dictionary and low-weight evidence |
| PDF comparator artifact normalization | Distinguishes `<=4` from unrelated numeric thresholds | `£` can mean currency in general text | Kept only when `£` appears before a number |
| Type-label ordinal binding | Recovers classification rows like `2 тип: ...` when answer options are `N тип` | Unsafe if treated as a broad numeric boost | Kept through the existing ordinal-row scorer with focus-token and row-boundary guards |

## Iterations 96-100: Three Focused Theories

| theory | isolated validation | decision |
| --- | --- | --- |
| Atomic recommendation binding for single answers | Dev stayed `395/503`; guarded variants reduced holdout to `493/580` and then `492/580` | Rejected. Item boundaries alone do not reliably bind target, condition, and role. |
| Relation-aware numeric tuple resolution | Hardened version reached dev `396/503`; holdout remained `494/580` with zero selected-set changes | Retained. It requires one bounded `(subject, role, conditions, comparator, value, exact unit)` proof and otherwise abstains. |
| Source-coherent multi set decoding | Hardened isolated version reached dev `400/503`; holdout remained `494/580` with zero selected-set changes | Retained only for pure ordinal answer families and an explicit range/list in one atomic recommendation clause. |

The two retained rules are orthogonal: the tuple resolver handles single-answer numeric families, while the set decoder handles multi-answer ordinal families. Combined they reach dev `401/503 = 0.7972`, six cases above baseline, with no holdout selection changes.

Broad variants were intentionally rejected. Global number proximity crossed units and sibling rows; generic set completion treated ordinary list membership as correctness; recommendation-item boosts confused adjacent targets.

## Evaluation Integrity Finding

The earlier deterministic split was group-wise by directory but not content-deduplicated. The audit found two byte-identical pairs and one near-identical COVID pair. All three duplicates are now removed, the split is frozen in a manifest, and validation reports zero repeated normalized records between groups or splits. Historical holdout labels still informed more than 100 iterations, so the current holdout remains a regression/acceptance result rather than a blind generalization estimate.

## Display Source / Provenance Research

The old public `evidence` array is a global top-N scorer trace. It is intentionally compact, may contain penalties or broad lookup hits, and does not guarantee one item per answer. Enlarging `EvidenceItem.text` in place was rejected because selection and structural grouping read that text internally.

The retained architecture adds a post-selection presentation layer instead:

- preserve scorer evidence unchanged;
- retain logical PDF blocks and physical line ranges beside the historical scoring text;
- localize the best evidence for each variant back into original page blocks;
- prefer selected-answer evidence as the primary question paragraph;
- expose explicit `stance`, `localizationMatch`, `contentMatch`, and `truncated` metadata so UI code does not mistake a broad mention for exact proof;
- expose a singular `source: { page, text } | null` projection for clients that need only the primary citation; long excerpts prefer sentence boundaries and nearby paragraph edges;
- expose full extracted page text once per referenced page in `sources.pages`, rather than duplicating it inside every excerpt;
- return empty excerpts rather than a guessed citation when localization or numeric semantics are unsafe.

Real-PDF review found and fixed several visual-provenance traps before retention: `800` inside `8000`, `<5%` vs `>5%`, `3.5` vs `3-5`, slash-dose vs range, unrelated top question pages, mojibake bullet markers, numeric dose lines misread as list numbering, paragraph over-expansion, and eager all-page preparation. The final layer is selection-neutral and uses lazy cached page windows.

## Selected best architecture

The best retained version extracts PDF text with `pdfjs-dist`, normalizes Russian/medical text, builds sentence/list/line chunks, indexes them with BM25, and scores each answer using an ensemble of non-LLM evidence signals:

- direct normalized `question + answer` phrase support;
- answer occurrence near or after question-like text on the same page;
- list-like question anchor segments;
- prefix continuation matching;
- BM25 for `question`, `answer`, and `question + answer`;
- answer coverage and token proximity inside top question chunks;
- calibrated relative scoring and dev-tuned multi thresholds;
- minimum multi-answer cardinality and a narrow third-answer near-tie rule;
- single-character numeric token preservation for dosage/frequency variants.
- narrow line-level binding for dose frequency, conditional-only recommendations, first-line therapy rows, biological/mechanical valve prosthesis recommendation rows, and fibrosis stage rows extracted from the PDF.
- explicit recommendation target binding for multi questions about `назначение/проведение/выполнение X`, so an answer must be supported by the recommendation block for target `X`;
- conservative multi contrast-cue pruning for opposite option cues such as upper/lower, increased/decreased, and distal-proximal/proximal-distal.
- conservative coordinate table-group reconstruction for explicit `Таблица` layouts, binding left row labels to right-side values in multi questions and using a small high-confidence RU route dictionary (`per os`/`внутрь`, `в/в`, `в/м`, `п/к`) for administration-route rows.
- inverse coordinate table binding when the question matches the right-side value and answer options are left-side labels, plus multi-cell row reconstruction with numeric direction checks and structural completion for answers from the same table row.
- narrow full-answer exact matching for single oral-dose questions where the answer is a multi-number phrase and the PDF contains it near the question focus.
- preceding-label binding for long single-answer description prompts that quote text after a label.
- explicit parenthetical category binding and guarded short medical abbreviations for stable Russian forms such as `СПЯ` and `РЭ`.
- comparator normalization for `≤`/`≥` and numeric `£` extraction artifacts.
- narrow continuation-list binding for `основано/основаны на данных...` multi prompts and full-phrase numeric option binding for recommendation/dose/frequency single prompts.
- diagnostics-driven confidence calibration that lowers confidence for flat evidence, close raw-score boundaries, and broad shared chunks without changing answer selection.
- narrow hour-duration alias binding for stable Russian forms such as `6 часов` / `6 ч`, isolated from the broader numeric scorer after a general alias expansion regressed holdout.
- narrow cleanup of spaced numeric reference artifacts such as `[ 8 10 ].`, gated to sentence-final references, plus count-relation binding for `различают N серотипов`-style prompts.
- guarded inline parenthetical-group binding for same-sentence lists such as `ряд ферментов (A, B, C), ...`, requiring focus support around the group and multiple answer options inside it.
- ordinal-row binding for answer labels of the form `N тип`, so classification definition lists like `2 тип: ...` can be used without relying on broad neighboring chunks.
- rejected broad recommendation-block paragraph grouping: it improved dev but regressed holdout, so future work should focus on stronger row/item target binding rather than larger recommendation windows.

On the deduplicated frozen split, the current algorithm reaches dev exact accuracy `405/523 = 0.7744` and holdout-regression exact accuracy `458/540 = 0.8481`, passing the command-level `0.80` acceptance target. Relative to the post-dedup baseline, comparator-bound spaced-thousands canonicalization gains one exact dev case and changes zero holdout selected sets. Future work should prioritize a newly label-sealed external split, recommendation target/condition parsing, and deeper table/list reconstruction.

## Feature Calibrator Research Guardrails

The next non-LLM research direction is a small frozen feature calibrator. To avoid fitting the current 40+ PDFs instead of the task, the first step is diagnostic export only:

- `npm run features:export -- --split dev` writes `.cache/features/dev-features.json`.
- Feature rows include labels for offline analysis, but labels are outside `features`.
- Feature rows do not contain question text, answer text, PDF text, PDF names, case ids, or PDF group ids.
- `pdfGroup`, `caseId`, and `answerId` are metadata only and must not be used as model inputs.
- Candidate features are abstract: raw score, calibrated score, rank/gap metrics, answer/question token counts, numeric flags, intent flags, selected-count ratios, and evidence-kind counters.
- Any learned coefficients must be validated by group split by PDF and a leave-PDF-out sanity check before being frozen into runtime.
- Holdout labels are for final reporting only, not for coefficient selection.

Historical pre-dedup dev diagnostic export (must be regenerated before reuse):

- baseline exact: `363/473 = 0.7674`
- single exact: `0.8328`
- multi exact: `0.6181`
- oracle top-k with known cardinality: `0.8076` overall and `0.7500` for multi
- selected false-positive answer rows: `103`
- missed positive answer rows: `99`

The oracle result means cardinality calibration is useful but not sufficient; the remaining gap also needs better structural evidence for tables, lists, and recommendation rows.

Historical train/dev/holdout feature files remain under `.cache/features/`. They are generated local artifacts, not runtime assets, and their old split composition means they must be regenerated before another calibrator experiment.

## First Calibrator Experiment

`npm run calibrator:experiment` trains a small logistic model on train feature rows only. It then tries two offline selection families:

- replacing the selector with model probabilities;
- keeping baseline selections and using the model only as a conservative multi-answer post-corrector.

Historical result on the old pre-dedup feature artifacts:

- full selector replacement remains worse than baseline on dev and holdout;
- after enabling the current fixed structural rules, the best dev-selected post-corrector no longer improves dev (`363/473 = 0.7674`);
- the same dev-selected strategy is slightly better on train (`1108/1597`) but weaker on holdout report-only (`454/550`), so it is still not stable enough to freeze into runtime.

Decision: keep the experiment script, reject the learned selector for now. The next calibrator attempt needs either richer structural features or leave-PDF-out stability checks before any runtime integration.

## July 2026 corpus and cardinality audit

The local corpus was deduplicated before new predictor work. Two duplicate PDFs
were byte-identical; a third COVID pair used different PDF binaries but had the
same 171-page content (`0.9937` normalized token-set Jaccard) and equivalent case
fixtures. The canonical corpus now has 43 PDF groups and no repeated normalized
case records between groups. A tracked manifest freezes the PDF-group split and
both PDF/case fingerprints; validation also rejects likely near-duplicate
groups when at least ten normalized cases recur between the pair.

Fresh exact-set baselines on the frozen split showed the same cardinality shape
on dev and holdout: both under- and over-selection are common. An oracle that
supplies only the true `K` while preserving raw-score rank reaches multi exact
`0.7692` on dev and `0.8247` on holdout, versus baseline `0.6603` and `0.7273`.
There is therefore real cardinality headroom, but it cannot be recovered by a
single global threshold.

A train-only logistic boundary model over abstract score-shape features confirmed
the transfer risk. Its best train result improved multi exact from `0.5185` to
`0.5407`, but dev fell to `0.6218` and holdout to `0.6883`. The model learned the
train document mix (more under-selection than over-selection), not a stable PDF
relation. No weights were added to runtime. The hard `multiMinAnswers = 2` prior
remains because it matches the task semantics and every validated keyed multi
case, while any answer beyond two still requires runtime evidence.

The retained predictor change instead fixes a source-representation mismatch:
comparator-bound grouped thousands such as `> 9 500` are canonicalized to the
same value as `>9500`. It changes exactly one dev selected set, wrong-to-right,
and changes zero holdout sets. This supports the current research direction:
prefer narrow source-structure corrections with abstention over broad statistical
cardinality priors.
