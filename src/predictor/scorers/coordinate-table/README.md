# coordinate-table

Модуль восстанавливает таблицы из геометрии текста PDF, когда обычная строковая
экстракция смешивает соседние колонки.

## Состав

- `shared.ts` — общие признаки таблицы, ячейки и строки;
- `relational.ts` — строки вида `субъект → характеристика`;
- `groups.ts` — группы и многоячейковые строки;
- `membership.ts` — принадлежность элементов к заголовку или категории;
- `types.ts` — внутренние типы;
- `index.ts` — ограниченный публичный facade.

## Как работает

Модуль группирует `lineItems` по координатам `x/y`, находит заголовки колонок,
проверяет табличный контекст и сопоставляет ответ только с целевой строкой или
ячейкой. Текст без координат не превращается в таблицу автоматически.

Основные evidence-kind: `coordinate_table_row`,
`coordinate_relational_row`, `coordinate_table_group`,
`coordinate_table_multicell_row` и `coordinate_table_membership`.

## Публичный API

Facade экспортирует функции `buildCoordinate*ByPage`, `bestCoordinate*Support`
и узкие проверки применимости `hasCoordinate*Cue`.
