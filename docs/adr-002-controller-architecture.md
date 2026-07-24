# ADR 002: Управляющие классы predictor

## Статус

Принято.

## Контекст

Исторически `src/predictor.ts` одновременно содержал публичный API, подготовку
PDF runtime, построение контекста вопроса, запуск scorer-ов, post-scoring
корректировки, selection, confidence, diagnostics и legacy-эвристики. Файл
достиг 4 522 строк. Порядок стадий был неявным, а тестировать orchestration без
полного PDF-прогона было сложно.

Рефактор не должен менять медицинскую логику, веса, пороги, evidence-kind или
результаты ни одного размеченного кейса.

## Решение

Prediction lifecycle разделен на управляющие классы:

1. `PredictorEngine` задает порядок стадий.
2. `PdfRuntimeStore` владеет PDF runtime и кешем.
3. `PredictionContextBuilder` один раз строит общий контекст вопроса.
4. `StructuralResolverPipeline` запускает document-level resolver-ы.
5. `AnswerScoringPipeline` оценивает варианты в исходном порядке.
6. `ScoreAdjustmentPipeline` применяет set-level корректировки в фиксированном порядке.
7. `AnswerSelector` калибрует score и выбирает single/multi набор.
8. `ConfidenceCalculator` рассчитывает confidence без влияния на selection.
9. `PredictionResultBuilder` формирует evidence, diagnostics и UI provenance.

`src/predictor.ts` остается composition root и совместимым функциональным API.
`createPredictorEngine()` позволяет создать независимый engine с собственным
PDF-кешем. Существующие `predict()` и `clearPredictorCache()` делегируют одному
default engine.

Pure-функции нормализации, поиска и медицинских эвристик не превращаются в
классы. Класс используется только там, где есть жизненный цикл, состояние,
фиксированный порядок стадий или внедрение зависимостей.

## Совместимость

Поведение считается сохраненным только при выполнении всех условий:

- совпадает selected set каждого keyed case;
- совпадает порядок selected id;
- совпадают `rawScores`;
- совпадают calibrated `scores`;
- совпадает `confidence`;
- проходят unit/leakage tests, typecheck и Node/browser build;
- holdout остается выше acceptance threshold `0.80`.

`scripts/diff-results.mjs` выполняет строгую case-level проверку этих полей.

## Результат проверки

Финальный refactor прошел strict zero-delta сравнение на всех `2 754` keyed
cases:

| split | baseline | после refactor | changed cases |
| --- | ---: | ---: | ---: |
| train | `1074/1541 = 0.6970` | `1074/1541 = 0.6970` | `0` |
| dev | `415/523 = 0.7935` | `415/523 = 0.7935` | `0` |
| holdout regression | `460/540 = 0.8519` | `460/540 = 0.8519` | `0` |
| external | `129/150 = 0.8600` | `129/150 = 0.8600` | `0` |

Во всех кейсах идентичны selection, порядок ID, `rawScores`, calibrated
`scores` и `confidence`.

## Последствия

- `src/predictor.ts` уменьшен с 4 522 до 65 строк.
- Управляющие стадии можно тестировать через injected dependencies без разбора PDF.
- Runtime-кеш принадлежит конкретному `PredictorEngine`.
- Публичный функциональный API остался совместимым.
- Legacy scorer-ы изолированы в `src/predictor/scorers/legacy.ts`.
- Следующий безопасный рефактор — переносить группы legacy scorer-ов в
  специализированные модули по одной группе с zero-delta проверкой после
  каждого переноса.
