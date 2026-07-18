# Error Analysis

## Current error counts

These counts use the final deduplicated 43-PDF corpus and the frozen group split.

| split | correct | errors | single errors | multi errors |
| --- | ---: | ---: | ---: | ---: |
| dev | `405/523 = 0.7744` | 118 | 66 | 52 |
| holdout regression | `458/540 = 0.8481` | 82 | 40 | 42 |

`noEvidence = 0` on both splits. The dominant failure is not an inability to
find PDF text; it is choosing the wrong relation, table row, recommendation
target, or exact multi set after retrieving a relevant area.

## Residual diagnostic classes

`npm run diagnostics` assigns each error to the first likely work area:

| likely next work | dev | holdout regression |
| --- | ---: | ---: |
| option-family resolver | 35 | 17 |
| multi-set selection | 26 | 21 |
| table/layout parser | 21 | 3 |
| recommendation-block parser | 17 | 30 |
| negative/exception semantics | 7 | 3 |
| retrieval precision | 5 | 7 |
| definition binding | 5 | 1 |
| manual review | 2 | 0 |

Broad evidence remains common among errors (`91` dev, `66` holdout), and flat
retrieval evidence appears in `81` dev and `68` holdout errors. Structural
scorers therefore need wider but still well-bounded coverage; simply increasing
BM25 or shared-chunk weights would amplify many distractors.

## Multi-answer cardinality

The minimum-two rule remains correct for this task and corpus. Every validated
keyed multi case contains at least two expected answers. Residual errors occur
above that lower bound in both directions:

| cardinality failure | dev | holdout regression |
| --- | ---: | ---: |
| under-selected | 14 | 15 |
| over-selected | 17 | 16 |
| right count, wrong member | 21 | 11 |

An oracle that provides only the true count, while preserving the predictor's
raw-score order, reaches multi exact `0.7692` on dev and `0.8247` on holdout,
versus final `0.6667` and `0.7273`. This shows useful cardinality headroom, but
under- and over-selection are balanced enough that a scalar threshold merely
trades one class for the other.

The tested train-only logistic score-shape model illustrates the risk. It raised
train multi exact from `0.5185` to `0.5407`, yet reduced dev to `0.6218` and
holdout to `0.6883`. No learned weights were retained. New cardinality changes
should be driven by an explicit source list/table/recommendation structure, not
by the document-mix prior.

## Retained improvement

PDF text may spell a comparator-bound value as `> 9 500`, while an option uses
`>9500`. The general numeric matcher already treated these as equal, but the
shared-segment comparator guard did not. Canonicalizing grouped thousands fixed
one three-item dev list and changed no other dev/holdout selected set:

- dev: `404 -> 405/523`, multi `0.6603 -> 0.6667`;
- holdout: unchanged `458/540`, zero selected-set delta.

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

The explicit ordinal-range decoder is reliable, but most remaining sets use
nominal lists, sibling subtypes, or several clauses. A candidate's occurrence in
the same broad paragraph is not enough: prior wide list completion added plausible
distractors. Future work should reconstruct actual bullet/row membership from
PDF geometry before completing a set.

### Flattened tables

`pdfjs-dist` can preserve words while losing row and column ownership. Coordinate
scorers handle clean layouts, but merged cells, repeated headers, and continued
rows still bind values to neighboring labels.

### Negation and contrast

Negative questions, `except`, `not recommended`, subgroup exclusions, and
adversative clauses can reverse otherwise strong lexical evidence. This is a
smaller class, but unsafe broad matching is especially costly here.

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

1. Reconstruct bullet and table membership from PDF coordinates and require one
   source-coherent set before changing multi cardinality.
2. Extend atomic recommendation parsing with explicit grammatical target and
   condition roles, retaining abstention when roles cross item boundaries.
3. Add leave-one-PDF-out checks for any future learned calibrator; do not freeze
   a model selected only by aggregate train score.
4. Obtain a genuinely new, label-sealed PDF test set for an unbiased quality
   estimate after runtime logic is frozen.
