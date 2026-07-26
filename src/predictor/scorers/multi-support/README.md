# multi-support

Модуль содержит дополнительные источники поддержки для multi-answer задач,
когда несколько вариантов перечислены в одном общем фрагменте.

## Возможности

- короткие медицинские алиасы;
- группы внутри скобок;
- продолжение списка непосредственно после вопросительной формулировки;
- общий segment-support для нескольких ответов;
- согласованная поддержка набора генов в одном предложении.

Каждое правило имеет собственные gates и не превращает простое присутствие
ответов на одной странице в точный набор. Основные kind:
`short_medical_alias_segment`, `parenthetical_group_segment`,
`question_continuation_list` и `shared_multi_segment`.

## Публичный API

Функции `best*Support` возвращают evidence, а
`addSharedMultiSegmentSupport` и `applyGeneSentenceSetSupport` изменяют готовые
score только при выполнении set-level условий.
