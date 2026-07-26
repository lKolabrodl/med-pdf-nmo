# recommendation-item

Модуль выделяет атомарные пункты рекомендаций и связывает действие с его
целевой группой или условием.

## Как работает

- объединяет переносы одной рекомендации, не смешивая соседние bullets;
- отделяет текст рекомендации от служебных строк уровня доказательности;
- ищет конкретный вариант внутри одного пункта;
- проверяет явную целевую группу;
- может вернуть штраф, если действие найдено у другого адресата;
- поддерживает более широкий блок только как резервный сигнал.

Основные evidence-kind: `explicit_recommendation_target_segment`,
`explicit_recommendation_target_mismatch`, `recommendation_item_segment` и
`recommendation_block_segment`.

## Публичный API

- `buildAtomicRecommendationSegments(pages)`;
- `explicitRecommendationTargetAdjustment(...)`;
- `bestRecommendationItemSupport(...)`;
- `bestRecommendationBlockSupport(...)`.
