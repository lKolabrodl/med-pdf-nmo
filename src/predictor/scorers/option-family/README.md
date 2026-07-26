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
