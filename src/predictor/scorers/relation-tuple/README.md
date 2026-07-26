# relation-tuple

Модуль совместно разрешает числовое семейство вариантов по ограниченному
кортежу `субъект + роль + условие + значение`.

## Примеры различаемых ролей

- стартовая, поддерживающая и максимальная доза;
- взрослые и дети;
- систолическое и диастолическое давление;
- значение при разных весовых или временных условиях;
- целый диапазон процентов, включая форму `от ... до ...`.

Модуль работает для `single`, требует однозначный кортеж в одном фрагменте и
не собирает значение из соседних предложений. Evidence-kind:
`relation_tuple_segment` или `interval_relation_tuple_segment`.

## Публичный API

- `canonicalIntervalTuples(text)`;
- `buildRelationTupleFragments(pages, topQuestionPages)`;
- `resolveRelationTuple(...)`;
- `applySingleRelationTupleResolver(...)`.
