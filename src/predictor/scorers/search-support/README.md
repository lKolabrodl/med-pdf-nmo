# search-support

Модуль содержит общие вспомогательные scorer-ы поверх чанков, префиксов и
условий вопроса.

## Возможности

- продолжение вопросительной фразы в тексте PDF;
- BM25-поддержка ответа в релевантных чанках;
- оценка специфичности числового варианта;
- gate для строкового token-support;
- согласование факторов риска и условий популяции;
- поиск строки, где класс или группа выступает субъектом.

Модуль возвращает evidence либо adjustments и используется центральным
`answer-score`. Он не выполняет финальный выбор.

## Публичный API

- `bestPrefixSupport(...)`, `bestChunkSupport(...)`,
  `bestClassSubjectSupport(...)`;
- `numberSpecificity(answer)`, `lineTokenApplicable(...)`;
- `riskConditionAdjustment(...)`,
  `genericPopulationConditionAdjustmentForMode(...)`.
