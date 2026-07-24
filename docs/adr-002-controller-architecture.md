# ADR 002: Управляющие классы predictor

## Статус

Принято.

Подробная карта реализованных слоев, lifecycle и правил расширения находится в
[`architecture.md`](./architecture.md).

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

Повторный strict zero-delta прогон выполнен и после второго этапа: удаления
общего `legacy.ts`, выделения тематических scorer-модулей, типизации runtime-
границ и замены монолитной post-scoring стадии на ordered processors. Все
`2 754` результата снова остались идентичными.

## Последствия

- `src/predictor.ts` уменьшен с 4 522 до 65 строк.
- Управляющие стадии можно тестировать через injected dependencies без разбора PDF.
- Runtime-кеш принадлежит конкретному `PredictorEngine`.
- Публичный функциональный API остался совместимым.
- На втором этапе общий `scorers/legacy.ts` удален: scorer-ы разнесены по
  тематическим модулям, а их прежний порядок сохранен в
  `answer-score/index.ts`.
- Каждый scorer оформлен как feature-папка с обязательным `index.ts`.
  Крупные семейства (`coordinate-table/`, `numeric/`) скрывают внутренние
  реализации за стабильным facade; controller и pipeline импортируют только
  этот facade.
- Set-level корректировки реализованы отдельными
  `ScoreAdjustmentProcessor`-классами и явно собираются в composition root.
- Runtime-контракты типизированы; в `src/**` больше нет явных `any`.
- `coordinate-table/` и `numeric/` защищены отдельными TypeScript
  `strict`-gate; следующий безопасный рефактор — так же декомпозировать и
  strict-типизировать оставшиеся крупные feature-модули с zero-delta проверкой.
