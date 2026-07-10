# Error Analysis

## Current Error Counts

The final iterations 96-100 result is compared with the baseline from the start of this work.

| split | version | correct | errors | single errors | multi errors |
| --- | --- | ---: | ---: | ---: | ---: |
| dev | baseline | 395/503 | 108 | 55 | 53 |
| dev | final | 401/503 | 102 | 54 | 48 |
| holdout regression | baseline | 494/580 | 86 | 48 | 38 |
| holdout regression | final | 494/580 | 86 | 48 | 38 |

The final dev error buckets are `confused_with_distractor = 72` and `multi_cardinality = 30`. Holdout remains `confused_with_distractor = 57` and `multi_cardinality = 29`. `noEvidence = 0` on both splits: the common failure is selecting the wrong relation, row, or exact set after finding a relevant area, not failing to retrieve any PDF text.

## Three Tested Theories

| theory | strongest isolated result | decision | main finding |
| --- | ---: | --- | --- |
| Atomic recommendation binding for single-answer questions | dev `395/503`; holdout fell as low as `492/580` | rejected | Recommendation items still contain neighboring targets/conditions; a generic item boost creates false bindings. |
| Relation-aware numeric option-family resolver | dev `396/503`; holdout `494/580` with zero selected-set delta | retained | A number is useful only as a bounded `(subject, role, conditions, comparator, value, exact unit)` tuple. Global numeric proximity was unsafe. |
| Source-coherent multi set decoder | dev `400/503`; holdout `494/580` with zero selected-set delta | retained | Exact set decoding is reliable for a narrow pure ordinal option family when one atomic recommendation clause explicitly encodes the whole range/list. |

Combined, the two retained theories reach dev `401/503 = 0.7972`, a gain of six exact cases, while all 580 holdout selections remain unchanged.

## Residual Diagnostic Classes

`npm run diagnostics` assigns each remaining error to a likely next work area:

| likely next work | dev errors | holdout errors |
| --- | ---: | ---: |
| option-family resolver | 29 | 21 |
| multi set selection | 22 | 18 |
| recommendation-block parser | 17 | 35 |
| table/layout parser | 19 | 3 |
| negative/exception semantics | 7 | 2 |
| retrieval precision | 7 | 4 |
| definition binding | 1 | 3 |

Multi-answer residuals show why a global threshold is unlikely to help:

| cardinality failure | dev | holdout |
| --- | ---: | ---: |
| under-selected | 16 | 13 |
| over-selected | 14 | 16 |
| right count, wrong member | 18 | 9 |

Under- and over-selection are both common. Moving one scalar threshold trades one class for the other; new source structure is required.

## Main Remaining Failure Modes

### Recommendation target and condition binding

Several valid recommendations are often adjacent and share the same population, therapy, or procedure vocabulary. The rejected theory 1 confirmed that even an apparent bullet/item boundary is not enough for single answers unless the exact target, role, polarity, and subgroup condition are bound inside one clause.

### Numeric option families

Percentages, durations, doses, ages, stages, and thresholds recur throughout the same PDF. The retained resolver is deliberately limited to dense single-answer families with an explicit relation role and one bounded source proof. The 29 remaining dev option-family errors include units, roles, or layouts that cannot yet meet those guards safely.

### Exact multi-answer sets

The new decoder fixes explicit ordinal ranges, but most remaining multi questions use ordinary membership lists, several sibling subtypes, or prose spread across clauses. List membership alone is not equivalent to correctness; previous broad list completion repeatedly added plausible distractors.

### Flattened tables and sibling rows

`pdfjs-dist` can preserve all words while losing the row/column relationship. Retrieval then finds the correct table but assigns a neighboring value or category. Coordinate scorers cover some clean tables, yet merged cells and line continuation remain ambiguous.

### Negation and contrast

Negative questions and phrases such as `not recommended`, `except`, `without`, or an adversative clause can reverse otherwise strong lexical evidence. The new parsers explicitly split adversative clauses and check postposed negation, but this remains a smaller residual class.

## Data Quality Findings

- `28-tanzilt#11` has malformed duplicate expected ids: `["A", "A"]`.
- `41-destonia#58` and `41-destonia#61` have labels that conflict with literal PDF statements (`3-6 months` and `75%` respectively). The predictor's source-grounded answers disagree with the current keys.
- Cross-split duplicate content makes the historical holdout optimistic; see `docs/evaluation.md`.

No label was read by the predictor or converted into a runtime exception. The questionable keys are documented instead of being used as medical hardcode.

## Recommended Next Experiments

1. Create a deduplicated, newly sealed PDF-level test split before further selection work.
2. Extend atomic recommendation parsing with explicit grammatical target/condition roles, but keep it abstaining unless all roles resolve in one clause.
3. Reconstruct sibling list/table boundaries from PDF coordinates and heading geometry, then validate by leave-one-PDF-out groups.
4. Add dataset validation for duplicate expected ids, contradictory duplicate cases, and tracked-corpus completeness.

Threshold-only tuning and broad recommendation/list boosts should not be revisited without new structural evidence; both have extensive measured regressions in the iteration log.
