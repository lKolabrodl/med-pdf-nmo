# numeric

Модуль объединяет числовые scorer-ы, которые связывают значение с условием,
субъектом, диапазоном или пропуском в вопросе.

## Состав

- `exact-option.ts` — точное значение варианта в локальном сегменте;
- `subject-bound.ts` — число и субъект в одной клаузе;
- `numeric-condition.ts` — сравнения `меньше`, `больше`, `равно`;
- `condition-pair.ts` — согласованность парных условий;
- `count-relation.ts` — количество, привязанное к отношению;
- `cloze.ts` — числовое заполнение пропуска;
- `condition-family.ts` и `condition-focus.ts` — общие признаки;
- `dependencies.ts` — типизированный адаптер общих text-utils;
- `types.ts` — внутренние контракты.

`index.ts` экспортирует только runtime-функции, которые вызывает агрегатор.
Модуль не выбирает ответ самостоятельно: каждая функция возвращает evidence
или adjustment для конкретного варианта.

## Основные evidence-kind

`exact_numeric_option_segment`, `subject_numeric_clause`,
`numeric_condition_less_than`, `numeric_condition_more_than`,
`numeric_condition_equal`, `conditioned_number_segment`,
`count_relation_segment` и `cloze_gap_local`.
