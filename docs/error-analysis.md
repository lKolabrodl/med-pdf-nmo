# Error Analysis

## October 2026 comparator experiments

The audit finds an independent source representation failure: a substring search
can manufacture an exact-bound contradiction from a decimal, range, fraction,
or grouped integer. For example, `>50` overlaps `<50.5`, but reading the latter
as `<50` falsely makes the intervals disjoint. Invented nonmedical checks isolate
this without consulting corpus labels.

A broad grammar repair fixes many syntax failures but train drops from
`1074/1541` to `1073/1541` by adding an extra multi option. An additive penalty
can move a global multi cutoff; improving one local comparison is not enough to
improve the whole selected set. Requiring shared non-bound text restores the
multi exact count, but loses one single answer on each of dev and train.
Both broad candidates are rejected before transfer review.

Iteration 180 retains the original grammar and tests only complete source-token
identity. Sixteen invented scenarios cover partial matches, overlapping bounds,
mathematical expressions, valid full bounds, and id/order invariance. Its fresh
dev result is zero-delta (`416/523`), including every score and confidence value.
Final train/transfer acceptance is recorded in the iteration log and archived
report; this audit alone does not establish an accuracy gain or an algorithmic
ceiling. Unresolved condition ownership and multi-set membership remain the
larger error classes documented below.

Final iteration 180 is accepted with fresh train `1074/1541`, holdout `460/540`
and external `221/332`. All 2,936 predictions, scores, confidence values and
labels match baseline. Consequently the 765 corpus errors and their categories
are unchanged. The fixed numeric-token defect is demonstrated on independent
syntax examples; neither the rejected aggregate losses nor these examples are
presented as a corpus gain. No transfer-derived follow-up rule is added.

## September analysis, iterations 166–175

Iteration 175 freshly restores these baseline counts on the expanded canonical
corpus, with identical behavior on all 2,936 keyed records:

| split | correct | errors | single errors | multi errors |
| --- | ---: | ---: | ---: | ---: |
| train | `1074/1541` | 467 | 208 | 259 |
| dev | `416/523` | 107 | 59 | 48 |
| holdout regression | `460/540` | 80 | 38 | 42 |
| external transfer | `221/332` | 111 | 28 | 83 |
| all keyed cases | `2171/2936` | 765 | 333 | 432 |

Of the 432 multi-answer errors, 168 under-select, 122 over-select, and 142 have
the right count but a wrong member. The rejected single-answer resolver does not
change these sets. These counts include the expanded external corpus; older
diagnostic tables below use a smaller historical corpus.

The recovered option-family prototype initially reached `430/523` on dev, but
that score concealed logical errors. Synthetic examples showed that it could
accept a negated number, combine a number with the wrong color, ignore a shared
numeric attribute, partially match a long option, and equate strict and inclusive
bounds. Those versions were rejected despite their higher aggregate score.

The corrected resolver requires joint support for these constraints inside a
bounded source fragment. Eighteen invented nonmedical tests cover positive
proofs and counterexamples, option-id/order invariance, source ambiguity, units,
numeric signs, comparator boundaries, and explicit question identifiers.

Train error review found one additional scope defect: a general statement was
being used for a question containing a narrower uppercase identifier. The same
syntactic preservation rule now applies to every such identifier, without a list
of medical abbreviations. It restores one baseline-correct train answer while
withdrawing other unsupported apparent gains. After that correction, dev gains
nine correct answers and train gains six, with no previously correct answer lost
in either split. Their multi-answer sets do not change.

The native-tag hypothesis has a separate failure: incremental coverage is zero.
Seven of nine dev PDFs expose some native tags, but the strict row/column proof
produces no score or selected-set change. Tag availability is not evidence that a
particular question can be answered from a complete tagged cell. The consumer
remains off; broadening to adjacent cells would discard its ownership guarantee.

The next unresolved areas are condition ownership across headings and clauses,
complete table/list membership for multi answers, and documents whose extraction
does not preserve those relations. A scalar cardinality threshold or a larger
text window would not establish that missing structure. `noEvidence = 0` only
means some evidence was returned; it does not prove that the correct passage was
retrieved or that the answer follows from it. A new unseen PDF-group collection
is also required for a blind generalization estimate.

The frozen H2 candidate failed transfer retention: `458/540` on holdout versus
`460/540`, with one fix and three regressions. Error review after rejection found
two remaining classes: one physical fragment spans multiple condition/value
pairs, and a combined-subtype example displaces a more exact category row. The
new checks establish that attributes occur nearby, but do not prove that every
attribute belongs to the same relation. No rule was then tuned on those errors.
H2 is disabled with H1. The candidate's overall `2185/2936` is documented as a
rejected result, not an accepted improvement over `2171/2936`.

Next work should first define and test a condition-to-value representation on
invented examples and train/dev source structures. It should distinguish a
category from a conjunction of categories, and preserve explicit row-label
evidence when a competing clause establishes only broader membership. Any new
candidate needs independent PDF groups for a fresh transfer decision; the
failure just inspected cannot remain a blind test for that future work.

## Historical error counts on the 46-PDF corpus

These historical counts use the earlier deduplicated 46-PDF corpus and its frozen
groups. They are retained to explain earlier experiments; they are not the
September 48-PDF result.

| split | correct | errors | single errors | multi errors |
| --- | ---: | ---: | ---: | ---: |
| train | `1074/1541 = 0.6970` | 467 | 208 | 259 |
| dev | `415/523 = 0.7935` | 108 | 59 | 49 |
| holdout regression | `460/540 = 0.8519` | 80 | 38 | 42 |
| external transfer | `129/150 = 0.8600` | 21 | 19 | 2 |
| all keyed cases | `2078/2754 = 0.7545` | 676 | 324 | 352 |

`noEvidence = 0` on all splits. The dominant failure is not an inability to
find PDF text; it is choosing the wrong relation, table row, recommendation
target, or exact multi set after retrieving a relevant area.

## Residual diagnostic classes

`npm run diagnostics` assigns each error to the first likely work area:

| likely next work | train | dev | holdout | external |
| --- | ---: | ---: | ---: | ---: |
| multi-set selection | 136 | 23 | 21 | 0 |
| option-family resolver | 129 | 30 | 17 | 3 |
| recommendation-block parser | 96 | 17 | 28 | 2 |
| table/layout parser | 58 | 21 | 3 | 2 |
| retrieval precision | 25 | 4 | 7 | 11 |
| negative/exception semantics | 17 | 6 | 3 | 2 |
| definition binding | 4 | 5 | 1 | 1 |
| manual review | 2 | 2 | 0 | 0 |

Broad evidence remains common among errors (`387/83/65/18` by split), and flat
retrieval evidence appears in `362/74/66/20` errors. Structural
scorers therefore need wider but still well-bounded coverage; simply increasing
BM25 or shared-chunk weights would amplify many distractors.

## Multi-answer cardinality

The minimum-two rule remains correct for this task and corpus. Every validated
keyed multi case contains at least two expected answers. Residual errors occur
above that lower bound in both directions:

| cardinality failure | train | dev | holdout | external | total |
| --- | ---: | ---: | ---: | ---: | ---: |
| under-selected | 111 | 14 | 16 | 0 | 141 |
| over-selected | 71 | 15 | 17 | 1 | 104 |
| right count, wrong member | 77 | 20 | 9 | 1 | 107 |

An oracle that provides only the true count, while preserving the predictor's
raw-score order, reaches multi exact `0.7885` on dev and `0.8247` on holdout,
versus final `0.6859` and `0.7273`. This shows useful cardinality headroom, but
under- and over-selection are balanced enough that a scalar threshold merely
trades one class for the other.

The tested train-only logistic score-shape model illustrates the risk. It raised
train multi exact from `0.5185` to `0.5407`, yet reduced dev to `0.6218` and
holdout to `0.6883`. No learned weights were retained. New cardinality changes
should be driven by an explicit source list/table/recommendation structure, not
by the document-mix prior.

## Retained improvement

The current round retained ten bounded hypotheses:

- coordinate reconstruction of relational table rows;
- conservative Cyrillic OCR/edit matching inside one focused sentence;
- subject-bound percentage clauses;
- comparator canonicalization;
- continued-table headers and inline abbreviation aliases;
- explicit table-region boundaries;
- discharge-indication scope separation;
- compact Roman parents with decimal children and negation polarity;
- repeated atomic recommendation targets for one patient context;
- directed risk-factor list membership with PDF-local abbreviation expansion.

Broad OCR, generic numeric clauses, and generic indication expansion were
rejected or narrowed after aggregate regressions. This is the preferred
improvement pattern: correct a general representation mismatch, require local
structural proof, and abstain when the PDF does not preserve enough ownership.

This is the preferred improvement pattern: correct a general representation
mismatch, keep strict relation semantics, and require an aggregate zero-regression
check.

## Main remaining failure modes

### Recommendation target and condition binding

Neighboring recommendations often repeat the same population, therapy, or
procedure vocabulary while changing the target, polarity, subgroup, or timing.
Paragraph-level boosts are too broad. A safe resolver must bind target, role,
conditions, and answer inside one atomic recommendation clause and abstain when
any role is unresolved.

### Numeric and dense option families

Percentages, durations, doses, ages, stages, and thresholds recur throughout a
single guideline. The bounded relation-tuple resolver covers only cases where
subject, semantic role, conditions, comparator, value, and unit coexist in one
proof fragment. The remaining option-family errors lack one of those bindings
or come from flattened tables.

### Ordinary multi lists

The explicit ordinal-range decoder and the new short-label sibling-bullet parser
are reliable, but most remaining sets use unlabeled nominal lists, nested bullets,
or several clauses. A candidate's occurrence in the same broad paragraph is not
enough: prior wide list completion added plausible distractors. Future work should
reconstruct more actual bullet/row membership from PDF geometry before completing
a set.

### Flattened tables

`pdfjs-dist` can preserve words while losing row and column ownership. Coordinate
scorers handle clean layouts, but merged cells, repeated headers, and continued
rows still bind values to neighboring labels.

### Negation and contrast

Negative questions, `except`, `not recommended`, subgroup exclusions, and
adversative clauses can reverse otherwise strong lexical evidence. This is a
smaller class, but unsafe broad matching is especially costly here. Exact paired
options are too rare to provide current headroom; a future rule needs a broader
yet still clause-bound representation rather than a global polarity boost.

## Data quality and leakage audit

- Three duplicate groups were removed. The final validator reports zero exact
  PDF duplicates, zero likely near-duplicate group pairs, zero cross-split
  duplicate records, and zero same-split duplicate records.
- The malformed duplicated expected answer in `28-tanzilt#11` was corrected to
  its actual single-answer form. Duplicate variants in two other fixtures were
  reconstructed or removed from the source PDF.
- `41-destonia#58` and `41-destonia#61` still appear to conflict with literal PDF
  statements (`3-6 months` and `75%`). They remain documented rather than being
  converted into runtime exceptions or medical hardcode.
- The predictor does not receive case ids, PDF-group names, expected counts, or
  labels. The historical holdout has informed many iterations, so it remains a
  frozen regression/acceptance suite, not a blind estimate of generalization.

## Recommended next experiments

1. Extend source-coherent membership to nested/unlabeled bullets and difficult
   table geometry, retaining sibling-boundary and ambiguity abstention.
2. Extend atomic recommendation parsing with explicit grammatical target and
   condition roles, retaining abstention when roles cross item boundaries.
3. Add leave-one-PDF-out checks for any future learned calibrator; do not freeze
   a model selected only by aggregate train score.
4. Obtain a genuinely new, label-sealed PDF test set for an unbiased quality
   estimate after runtime logic is frozen.

## Top 10 remaining single-answer error classes

These ten classes are mutually exclusive and cover all `324` remaining single
errors. Counts join train, dev, holdout, and external. IDs are representative
examples for source review.

| rank | class | errors | representative IDs | interpretation |
| ---: | --- | ---: | --- | --- |
| 1 | numeric option family | 85 | `49-central-ceroz#19`, `11-mening#2` | the correct value is present, but belongs to a different subject, row, or subgroup |
| 2 | recommendation/treatment scope | 80 | `49-central-ceroz#13`, `11-mening#53` | target, population, timing, or polarity is taken from an adjacent recommendation |
| 3 | table/layout ownership | 47 | `50-dr-gepatit#21`, `14-sarkoidoz#73` | extracted cells survive, but their row or column relation remains ambiguous |
| 4 | flat or broad retrieval | 46 | `48-pereferi#23`, `11-mening#6` | the relevant page is found without a unique bounded proposition |
| 5 | negative/exception scope | 28 | `49-central-ceroz#21`, `11-mening#34` | negation or exclusion attaches to the wrong clause |
| 6 | dense text option family | 18 | `49-central-ceroz#20`, `19-gepatitc#50` | options differ by one role or modifier despite high shared overlap |
| 7 | definition binding | 11 | `49-central-ceroz#8`, `23-nimana#41` | a definition is retrieved but assigned to a neighboring label |
| 8 | manual/unclassified | 4 | `25-shigez#26`, `05-bronhit-hron#30` | diagnostics do not expose a stable reusable pattern |
| 9 | opposing option family | 4 | `07-hron#39`, `30-heart#10` | directionally opposite variants remain too lexically similar |
| 10 | gene-symbol retrieval | 1 | `07-hron#54` | a biomedical symbol is not bound to the correct local statement |

## Top 10 remaining multi-answer error classes

These ten classes are also mutually exclusive and cover all `352` remaining
multi exact-set errors.

| rank | class | errors | representative IDs | interpretation |
| ---: | --- | ---: | --- | --- |
| 1 | set under-selection | 84 | `06-co-toksic#22`, `15-toxic#17` | one or more true list members lack sufficiently local evidence |
| 2 | set over-selection | 48 | `06-co-toksic#63`, `15-toxic#44` | a neighboring or shared-paragraph distractor enters the set |
| 3 | right count, wrong members | 48 | `06-co-toksic#69`, `07-hron#5` | cardinality is plausible, but row/list ownership is wrong |
| 4 | recommendation without structural evidence | 42 | `48-pereferi#42`, `06-co-toksic#28` | broad recommendation prose is available but atomic targets are not reconstructed |
| 5 | dense text option family | 35 | `06-co-toksic#26`, `15-toxic#63` | similar variants compete inside one broad fragment |
| 6 | numeric option family | 29 | `06-co-toksic#70`, `15-toxic#42` | several values are present without enough relation binding |
| 7 | table without layout evidence | 23 | `28-tanzilt#20`, `05-bronhit-hron#65` | the source is table-like but usable coordinates/headers are absent |
| 8 | recommendation despite structural evidence | 21 | `14-sarkoidoz#12`, `15-toxic#52` | item boundaries exist, but target/condition resolution is incomplete |
| 9 | parsed table still ambiguous | 14 | `12-nos#15` | coordinate evidence exists but merged cells or headers remain unresolved |
| 10 | opposing option family | 8 | `49-central-ceroz#6`, `06-co-toksic#56` | inverse direction or polarity is not separated reliably |

## Current external comparison and residuals

Before selecting changes in this round, the three external PDFs scored
`109/150 = 0.7267`: `43/50`, `21/30`, and `45/70`. Final scores are
`129/150 = 0.8600`: `46/50`, `24/30`, and `59/70`. This is a transfer-development
gain of 20 exact cases, not a blind estimate.

Final residual errors are:

- dev: 108 (`59` single, `49` multi);
- frozen holdout: 80 (`38` single, `42` multi);
- external transfer: 21 (`19` single, `2` multi).

External multi exact accuracy is now `9/11 = 0.8182`; its two errors are one
over-selection and one right-count/wrong-member case. The largest remaining
cross-corpus class is still source ownership, not a global threshold.

## Cleanup findings

The final 46-PDF audit covers 3,476 pages, 91,536 physical lines, 4,161 bullet
lines, 3,358 numbered lines, and 1,831 word-hyphen line endings. All documents
are text-extractable with clean Cyrillic; none meets the full-OCR threshold.
There are still local token distortions and difficult continued tables, which
is why the retained OCR layer is a bounded token-repair scorer rather than a
full OCR dependency. Repeated/boilerplate-like lines are `5,348/91,536 = 5.8%`.

The remaining cleanup should be structural:

- keep physical `lines` and extractor-built `blocks` simultaneously;
- recognize both normal bullets and Word's private-use `U+F0B7` marker in the
  scorers that understand that structure;
- use evidence-grade lines as item boundaries, not answer evidence;
- remove repeated headers/footers only when position and cross-page repetition
  prove that they are boilerplate;
- consider a conservative document-internal lexicon for intra-item splits such
  as `Гры жа`, but do not globally concatenate short words.

Global deletion of evidence grades, appendix references, registry text, or all
repeated lines is unsafe because each class can carry a real question target or
an important boundary.

## Scorer-folder refactor impact

The feature-folder and numeric-decomposition stage changed `0` of `2,754`
case-level results across train, dev, holdout, and external. Therefore the
residual counts and mutually exclusive error classes above remain current.
Removing the disabled `condition_number_segment` implementation also produced
no changed case, confirming that it was dead code rather than an active error
signal. No new error category was introduced by this architecture-only stage.

## Residuals after the improvement-theory round

The expanded 47-PDF corpus has 742 remaining exact errors:

- single: `327/1905` errors, accuracy `1578/1905 = 0.8283`;
- multi: `415/962` exact-set errors, accuracy `547/962 = 0.5686`;
- train: 467 errors;
- dev: 107 errors (`59` single, `48` multi);
- frozen holdout: 80 errors;
- external: 88 errors, including the newly added difficult `51-travma`.

The only repaired exact case is `15-toxic#54`, a multi question whose correct
set became recoverable after a split syndrome heading was joined from
document-internal evidence. No previous correct selection changed.

The rejected theories sharpen the ownership diagnosis:

- T1 found substantial table geometry but changed no selected set. On
  `07-hron#7` both competing answers gained equally, showing that a better grid
  does not automatically identify the semantic owner of a value.
- T2/T3 found four complete contrastive sets (`41-destonia#33`–`#36`), but all
  were already correct. The remaining cardinality errors do not expose the
  complete, unambiguous substructure required by safe non-semantic completion.
- T4's strict exclusion form had zero dev coverage. Relaxing it would turn
  absence from a flattened paragraph into evidence, repeating the failure mode
  from iteration 84.
- The multi-heavy `51-travma` transfer check for combined T2/T3 changed neither
  selections nor raw scores (`46/113` remained unchanged).

Therefore the dominant unresolved class is still relation/ownership ambiguity,
not missing retrieval or a globally wrong cardinality threshold. The safe
structural signals are highly precise but now mostly overlap questions the
predictor already solves.


## Iteration 181: operational PDF failures

Three failures are reproduced independently of answer labels: permanent reuse
of a rejected extraction promise, incomplete object-identity cache clearing,
and missing PDF.js destruction after extraction. These can prevent retry or
retain obsolete runtime/resources in long-lived applications. They are not
newly discovered medical ranking errors and are not counted as accuracy gains.

Regression checks cover keyed and object caches, shared concurrent failures,
clear/settle races, page/text/structure/load failures, and cleanup-error
precedence. The implementation repairs these paths without changing scorer
weights or selected-set rules. Memory reduction is not benchmarked. The corpus
comparison and acceptance result are recorded in iteration-log.md.
