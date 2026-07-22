# Research

## Constraints

Runtime inference is JavaScript/Node.js only. It does not use LLMs, transformer inference, remote AI services, generated embeddings, HuggingFace inference, or answer keys. Correct labels are read only by eval scripts.

## Data found

The current deduplicated local corpus has 45 PDF groups under `__test__/NN-name/`. Each group contains `doc.pdf` and `cases.test.ts`. The TypeScript case files contain the question, variants, mode, and expected labels. The predictor never imports these files; `scripts/eval.ts`, `scripts/cases.ts`, and offline diagnostic scripts read them only for scoring or feature-label export.

Current parsed cases: 2,701, including 17 unkeyed cases that are skipped by exact eval.

- answer-keyed cases: 2,684
- single-answer answer-keyed cases: 1,823
- multi-answer answer-keyed cases: 861

Reproducibility caveat: only five group case files are tracked by Git; most corpus groups are local/ignored. The current metrics therefore require the local workspace dataset and its manifest fingerprints.

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

On the deduplicated frozen split, the current algorithm reaches dev exact accuracy `415/523 = 0.7935` and holdout-regression exact accuracy `459/540 = 0.8500`, passing the command-level `0.80` acceptance target. Two PDFs added after the predictor was frozen establish a separate external baseline of `64/80 = 0.8000`. Future work should prioritize deeper coordinate-aware table/list reconstruction and another label-sealed external split after the next runtime freeze.

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

## July 2026 follow-up hypotheses after the full iteration audit

All 108 earlier iterations were reviewed before selecting the next experiments.
The new work deliberately avoids the approaches that already failed to transfer:
global multi thresholds, score-distribution cardinality models, broad
recommendation windows, page-section routing, and unconstrained list completion.

Five remaining representation gaps are testable without medical hardcode:

1. A sequence of bullet items with short labels preserves sibling-category
   boundaries even when paragraph extraction is flat. Multi answers found under
   the target label should not be mixed with members under adjacent labels.
2. The same structure can be read in reverse for single questions: a description
   in a bullet body can identify the corresponding short option label, provided
   competing labels occur in sibling bullets and the match is unique.
3. Numeric relation code currently treats some written intervals as two unrelated
   endpoints. A canonical interval object can unify hyphenated and `from ... to`
   spellings while retaining units and subject/role binding.
4. Count questions still use a relatively broad local window. A source clause
   that explicitly binds one number to the counted object is a safer proof than
   proximity to any count cue on the page.
5. Dense option families sometimes differ only by negation. Comparing the
   positive/negative members against the polarity of one bounded source clause
   can resolve the pair without adding domain facts.

Each hypothesis is designed to abstain when its structural proof is ambiguous.
Dev remains the iteration signal; the historically observed frozen holdout is a
compatibility report and acceptance gate, not a blind model-selection set.

### Results of the five-hypothesis round

| hypothesis | decision | exact effect |
| --- | --- | ---: |
| H1 source-coherent multi sibling bullets | kept | dev `+3`, holdout `0` |
| H2 inverse sibling-label binding | kept | dev `+2`, holdout `0` |
| H3 canonical whole-interval tuples | kept | dev `+3`, holdout `0` |
| H4 clause-local counted-object tuples | kept | dev `+2`, holdout `0` |
| H5 exact negation-pair polarity | disabled | dev `0`, holdout `0` |

The retained rules change ten of 523 dev selected sets, all wrong-to-right, and
none of 540 holdout sets. They contain no fixture ids, PDF names, page numbers,
answer text, or medical facts. The result supports the earlier conclusion that
bounded source relations transfer more safely than global score-shape or broad
proximity rules.

## Current corpus and PDF-structure audit

### Lessons from the earlier 115 iterations

The successful iterations share one property: they reconstruct a bounded source
relation before changing an answer score. Examples are comparator-preserving
number normalization, coordinate rows, sibling bullets, whole-interval tuples,
and clause-local count tuples. The rejected experiments also form a consistent
group: wide list completion, page/section routing, broad recommendation windows,
global multi thresholds, a train-only score-shape cardinality model, and broad
exact-answer boosts all mixed neighboring facts or learned the current PDF mix.

The practical rule for the new round is therefore: improve representation first,
require sibling/row contrast, and abstain when a physical line appears to contain
several flattened columns. A higher retrieval weight without a relation parser is
not a plausible fix for the dominant errors.

### Comparable non-LLM document parsing approaches

The implementation remains JavaScript-only, but two mature document parsers
confirm the chosen architecture. Camelot's documented Stream parser groups words
into rows by vertical overlap and infers columns from horizontal text ranges;
its Network parser instead builds and prunes bounding-box alignments before
growing a table. GROBID's full-text pipeline explicitly segments headings,
paragraphs, list items/markers, and tables rather than treating a PDF as one bag
of words. These are structural lessons, not runtime dependencies: Camelot is
Python-based and GROBID is Java-based, so neither was added to this Node runtime.
See [Camelot: How It Works](https://camelot-py.readthedocs.io/en/stable/user/how-it-works.html)
and [GROBID full-text model](https://grobid.readthedocs.io/en/latest/training/fulltext/).

The local implementation uses the coordinates and physical lines already
returned by PDF.js, then reconstructs only structures that can be proved from
adjacent labels, bullets, and numbering. No transformer, LLM, embedding service,
or external inference dependency is used.

### All-PDF extraction audit

`npx tsx scripts/pdf-noise.ts` ran the real extractor over all 45 available PDFs:

- 3,375 pages, about 5.36 million extracted characters, and 89,173 retained
  physical lines;
- all 45 PDFs contain clean Cyrillic text; no mojibake and no PDF met the
  extractor's `ocrNeeded` threshold;
- 4,073 bullet lines and 3,287 numbered lines confirm that list hierarchy is a
  first-class signal, not an edge case;
- 1,818 physical lines end in a word hyphen. Search normalization already joins
  ordinary line-break hyphenation, while intra-item splits such as `Гры жа` need a
  separate conservative document-lexicon repair if pursued later;
- 5,311 retained lines (6.0%) are repeated or generic boilerplate. The largest
  residual classes are evidence-grade annotations (2,664), registry/drug-table
  boilerplate (528), appendix references (455), and running guideline headers
  (448). One document has 27% repeated registry-table fragments; most other
  high-noise PDFs are around 7-9%;
- 692 page objects are empty after intentional removal of table-of-contents,
  bibliography, and bounded metadata-appendix spans. This is not an OCR failure.

Blindly deleting all residual noise would be unsafe. Evidence-grade lines are
useful item boundaries, appendix references can route to clinical algorithms,
and registry text can be the subject of a real question. The safer cleanup work
is layout-aware: remove only headers/footers repeated at the same page edge,
preserve grade lines as metadata boundaries rather than answer evidence, and keep
physical list markers available to structural scorers. The audit also found that
the historical scoring-text joiner recognizes a mojibake bullet spelling while
the presentation block builder recognizes the real `•`; changing that broad
legacy representation was not mixed into this focused predictor round.

### Current external baseline

The predictor was frozen before `48-pereferi` and `49-central-ceroz` were added.
Their first evaluation therefore gives a useful transfer snapshot rather than a
post-tuning score:

- combined exact accuracy: `64/80 = 0.8000`;
- per PDF: `43/50 = 0.8600` and `21/30 = 0.7000`;
- single exact accuracy: `61/69 = 0.8841`;
- multi exact-set accuracy: `3/11 = 0.2727`.

No runtime rule was changed after reading these labels. Diagnostics show 16
errors: eight single and eight multi. Five multi errors over-select, three choose
the wrong member at the correct count, and none under-select. The external data
therefore argues against lowering global multi thresholds. It instead supports
the existing research direction: prove list/recommendation membership and reject
neighboring distractors inside bounded physical blocks.

The cleanup conclusion is deliberately conservative. All PDFs already contain
usable text, so OCR or aggressive character cleanup is not the bottleneck.
Retaining both `page.lines` and `page.blocks` is more valuable than collapsing
them into one string: lines preserve exact physical boundaries, while blocks
provide proof for wrapped list items. A future cleanup pass should prioritize
coordinate-stable repeated headers/footers and conservative document-internal
repair of split words; it should not globally delete evidence grades, appendix
references, registry text, or every repeated line.
