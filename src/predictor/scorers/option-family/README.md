# option-family

Модуль уточняет score внутри плотного семейства похожих вариантов ответа.
Он не ищет новый факт, а проверяет, соответствует ли найденное evidence
различающей части варианта.

## Правила

- comparator guard различает `< N` и `> N` для одного и того же числа;
- compact-combo guard различает совместную схему `A/B` и альтернативу
  `A или B`;
- правило включается только при наличии контрастного варианта или подходящего
  вопроса о лечении;
- медицинские факты не зашиты: сравнивается только форма текста evidence.

Функции возвращают `{adjustment, evidence}`. Диагностические kind:
`option_family_comparator_mismatch`,
`option_family_compact_combo_match` и
`option_family_compact_combo_mismatch`.

## Публичный API

- `optionFamilyComparatorAdjustment(...)`;
- `optionFamilyCompactComboAdjustment(...)`.

## Contrastive constraints

Experimental and disabled by default: the frozen candidate raised dev/train
accuracy but regressed holdout, so it was rejected. Bounded co-occurrence still
does not establish ownership across multiple condition/value pairs or combined
categories. See `docs/iteration-log.md`, iterations 166–175.

The `contrastive.ts` resolver is exposed through this feature's `index.ts`.
`contrastiveOptionFamily` controls its single-answer adjustment. It requires
joint support for option numbers, units, changing lexical attributes, question
conditions, and comparison direction. Shared numeric attributes still constrain
the proof. Unsupported source negation, ambiguous competing clauses, and
incomplete variable slots cause abstention. Strict and inclusive bounds differ.
Uppercase identifiers in mixed-case questions must appear in the same source
fragment; units, Roman ordinals, and fully uppercase questions are not treated
as lists of such identifiers.

The fixed adjustment is 3.6; global selector thresholds and multi-answer
cardinality are unchanged. Synthetic tests use nonmedical descriptions and
check polarity, units, signed values, full attribute binding, and answer-order
invariance. All corpus labels remain in development tooling.
