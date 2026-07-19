# med-pdf-nmo

[English README](./README.md)

`med-pdf-nmo` - browser-first JavaScript/Node.js пакет, который выбирает наиболее вероятный ответ или набор ответов на НМО-вопрос по PDF-файлу с медицинскими или клиническими рекомендациями.

Runtime работает локально и не использует LLM. В inference нет ChatGPT, OpenAI API, Anthropic, Gemini, HuggingFace inference, transformer-моделей или внешних интеллектуальных сервисов. Алгоритм основан на извлечении текста PDF, нормализации, поиске, структурных эвристиках, скоринге и evidence-фрагментах из PDF.

## Что делает пакет

- Принимает PDF медицинских рекомендаций, вопрос и варианты ответа.
- Извлекает текст из PDF через `pdfjs-dist`.
- Нормализует русский медицинский текст, PDF-артефакты, греческие буквы, числовые ссылки, дозировки и частые OCR-искажения.
- Считает score для каждого варианта ответа.
- Поддерживает `single` и `multi` вопросы.
- Возвращает выбранные ответы, confidence, score по вариантам, raw score, evidence из PDF и метаданные.
- Работает в Node.js, browser bundle и Chrome-extension окружениях.

## Текущие метрики

Цифры получены на очищенном от дублей локальном корпусе: 43 PDF-группы и 2 604 keyed cases. Это не гарантия качества на новом PDF, а текущий ориентир после полного финального прогона.

| Набор | Exact accuracy | Single-answer | Multi-answer exact set |
| --- | ---: | ---: | ---: |
| Все keyed cases | `74.62%` (`1943/2604`) | `82.33%` (`1444/1754`) | `58.71%` (`499/850`) |
| Train split | `69.44%` (`1070/1541`) | `78.92%` | `51.85%` |
| Dev split | `79.35%` (`415/523`) | `83.92%` | `68.59%` |
| Замороженный holdout regression | `84.81%` (`458/540`) | `89.64%` | `72.73%` |

Для `single` правильным считается только точный выбор одного ответа. Для `multi` правильным считается только полное совпадение множества ответов, поэтому multi-метрика строже и обычно ниже.

Последний раунд структурных правил изменил ровно десять dev-наборов из неправильных в правильные (`405 -> 415/523`) и не изменил ни одного holdout-набора. Замороженный holdout проходит gate `0.80`, но исторически уже использовался для анализа, поэтому это regression suite, а не слепая оценка обобщения.

## Установка

Из npm, когда пакет опубликован:

```bash
npm install med-pdf-nmo
```

Напрямую из Git HTTPS URL:

```bash
npm install git+https://github.com/lKolabrodl/med-pdf-nmo.git#main
```

Или в `package.json`:

```json
{
  "dependencies": {
    "med-pdf-nmo": "git+https://github.com/lKolabrodl/med-pdf-nmo.git#main"
  }
}
```

При установке из Git npm выполнит `prepare`, поэтому пакет сам соберет `dist`.

## Browser / React / Chrome Extension

Для браузерного окружения используй browser entrypoint:

```ts
import { answerQuestion } from "med-pdf-nmo/browser";

const result = await answerQuestion(new Uint8Array(pdfData.slice(0)), {
  question,
  variants,
  type: isSingle ? "single" : "multi",
});
```

Browser entrypoint уже содержит и регистрирует PDF.js внутри пакета. В обычном React, Vite, Webpack или Chrome-extension коде не нужно отдельно импортировать `pdfjs-dist`, настраивать `GlobalWorkerOptions.workerSrc` или передавать `pdfjsLib` в каждый вызов.

## Подключение через script tag

Для прямого подключения в браузере:

```html
<script src="./dist/med-pdf-nmo.browser.js"></script>
```

Глобальный объект:

```html
<input id="pdf" type="file" accept="application/pdf" />

<script>
  document.querySelector("#pdf").addEventListener("change", async (event) => {
    const file = event.target.files[0];

    const result = await MedPdfNmo.answerQuestion(file, {
      question: "Текст вопроса",
      variants: ["Ответ A", "Ответ B", "Ответ C"],
      type: "single"
    });

    console.log(result.selectedIds, result.selected, result.confidence);
  });
</script>
```

Для публичного GitHub-репозитория можно использовать CDN:

```html
<script src="https://cdn.jsdelivr.net/gh/lKolabrodl/med-pdf-nmo@main/dist/med-pdf-nmo.browser.js"></script>
```

## Node.js

```js
import fs from "node:fs/promises";
import { answerQuestion } from "med-pdf-nmo";

const pdfBuffer = await fs.readFile("./doc.pdf");

const result = await answerQuestion(pdfBuffer, {
  question: "Какой препарат показан пациенту?",
  variants: ["Ответ A", "Ответ B", "Ответ C", "Ответ D"],
  type: "single"
});

console.log(result.selectedIds);
console.log(result.selected);
console.log(result.confidence);
console.log(result.evidence);
console.log(result.source);
```

В Node.js PDF можно передавать как `Buffer`, `Uint8Array`, `ArrayBuffer` или URL-строку.

## API

### `answerQuestion(pdf, options)`

```ts
const result = await answerQuestion(pdf, {
  question: "Текст вопроса",
  variants: ["Ответ A", "Ответ B", "Ответ C"],
  type: "single"
});
```

`pdf` может быть:

- `File`
- `Blob`
- `Buffer`
- `ArrayBuffer`
- `Uint8Array`
- URL-строка
- объект с методом `arrayBuffer()`

`options`:

- `question`: текст вопроса.
- `variants`: варианты ответа.
- `answers`: алиас для `variants`.
- `type`: `"single"` или `"multi"`.
- `mode`: алиас для `type`.
- `cacheKey`: необязательный ключ кеша для текста PDF.
- `pdfjsLib`: необязательная явная передача PDF.js модуля.
- `pdfVerbosity`: необязательный уровень логирования PDF.js. По умолчанию показываются только ошибки PDF.js, поэтому нефатальные font warnings вроде `TT: undefined function` подавляются.
- `includeSources`: добавлять крупные фрагменты источника для интерфейса; по умолчанию `true`.
- `sourcePassageMaxChars`: максимальная длина одного фрагмента; по умолчанию `1400` символов.
- `sourcePassagesPerAnswer`: число фрагментов на вариант от `1` до `3`; по умолчанию `1`.

Варианты можно передавать строками:

```js
variants: ["Ответ A", "Ответ B", "Ответ C"]
```

Или объектами со стабильными ID:

```js
variants: [
  { id: "A", text: "Ответ A" },
  { id: "B", text: "Ответ B" },
  { id: "C", text: "Ответ C" }
]
```

### Результат

```js
const result = {
  selected: ["Ответ B"],
  selectedIds: ["B"],
  mode: "single",
  confidence: 0.73,
  scores: [
    { id: "A", variant: "Ответ A", score: 0.12, raw: 0.41 },
    { id: "B", variant: "Ответ B", score: 0.73, raw: 1.92 }
  ],
  evidence: [],
  source: {
    page: 12,
    text: "Законченное предложение или ближайший абзац из исходного PDF."
  },
  sources: {
    question: null,
    answers: [],
    pages: [
      {
        page: 12,
        text: "Полный извлечённый текст страницы 12 с сохранёнными переносами строк."
      }
    ]
  },
  meta: {},
  raw: {}
};
```

Главные поля:

- `selected`: выбранные тексты ответов.
- `selectedIds`: ID выбранных ответов.
- `confidence`: относительная уверенность.
- `scores`: score по всем вариантам.
- `evidence`: найденные фрагменты PDF.
- `source`: один основной источник `{ page, text }`, связанный с выбранным ответом, либо `null`.
- `sources`: подробный контекст вопроса, вариантов ответа и полный текст упомянутых страниц.
- `raw`: низкоуровневый результат predictor.

`source.text` по возможности начинается и заканчивается на границе предложения. Если граница абзаца находится рядом, фрагмент расширяется до начала или конца абзаца. Поле строится после выбора ответа и не участвует в скоринге. При `includeSources: false` оно равно `null`.

`sources.pages` содержит полный извлечённый текст каждой страницы, на которую ссылаются `sources.question` или `sources.answers[].excerpts`. Одна страница добавляется только один раз, страницы сортируются по номеру, физические переносы строк сохраняются. При `includeSources: false` массив пуст.

## Multi-answer вопросы

```js
const result = await answerQuestion(pdfBuffer, {
  question: "Какие утверждения верны?",
  variants: [
    { id: "A", text: "Утверждение A" },
    { id: "B", text: "Утверждение B" },
    { id: "C", text: "Утверждение C" },
    { id: "D", text: "Утверждение D" }
  ],
  type: "multi"
});
```

В `selectedIds` будет массив выбранных ID.

В режиме `multi` selector намеренно возвращает минимум два различных ответа,
если доступно хотя бы два варианта. Это зафиксированное правило задачи: реальный
multi-вопрос обычно требует больше одного выбора, во всех размеченных multi-кейсах
проверенного локального корпуса правильных ответов не меньше двух, а сохранение
этого guard улучшает exact pass rate. Количество дополнительных ответов по-прежнему
определяется только по evidence из PDF; во время inference predictor не читает
answer key и не знает ожидаемую мощность множества.

## Низкоуровневые exports

```js
import {
  predict,
  answerQuestion,
  setPdfJsLib,
  clearPredictorCache
} from "med-pdf-nmo";
```

- `answerQuestion`: удобный высокоуровневый API.
- `predict`: низкоуровневый predictor API.
- `setPdfJsLib`: ручная настройка PDF.js.
- `clearPredictorCache`: очистка runtime-кеша predictor.

## CLI

После установки пакет добавляет команду:

```bash
med-pdf-nmo --help
```

Пример:

```bash
med-pdf-nmo --pdf doc.pdf --question "Текст вопроса" --mode single --answer A="Ответ A" --answer B="Ответ B"
```

Локально в репозитории:

```bash
npm run predict -- --pdf doc.pdf --question "Текст вопроса" --mode single --answer A="Ответ A" --answer B="Ответ B"
```

## Сборка

```bash
npm install
npm run build
```

Сборка создает:

- `dist/index.js`: основной ESM entrypoint.
- `dist/index.d.ts`: TypeScript-типы.
- `dist/med-pdf-nmo.browser.js`: браузерный global bundle `MedPdfNmo`.
- `dist/med-pdf-nmo.browser.mjs`: браузерный ESM bundle с PDF.js внутри.
- `dist/browser-shims/*`: browser alias targets для Node built-ins.
- `dist/cli.js`: CLI entrypoint.

## Проверки разработки

```bash
npm run dataset:validate
npm test
npm run typecheck
npm run build
npm pack --dry-run
npm run eval:train
npm run eval
npm run eval:holdout
```

`npm run dataset:validate` проверяет fingerprint замороженного корпуса, дубли PDF/групп, изоляцию split, целостность разметки и нижнюю границу multi. Eval-команды относятся только к разработке: они читают локальные PDF и answer key, чтобы посчитать accuracy. `npm run eval:holdout` возвращает non-zero exit code при exact accuracy ниже `0.80`.

Runtime API пакета во время inference не читает eval-файлы, split-файлы, правильные ответы или тестовые fixtures.

## Ограничения

- Пакет не является медицинским советником и не заменяет эксперта.
- Качество зависит от того, насколько хорошо PDF.js извлек текст из конкретного PDF.
- Сканированные PDF без текстового слоя могут потребовать OCR до передачи в пакет.
- Алгоритм выбирает вероятные ответы по PDF evidence, но не гарантирует абсолютную правильность.
- Runtime inference не использует LLM и не обращается к внешним интеллектуальным сервисам.

## Расширенные фрагменты источника

Короткий `evidence` остаётся техническим следом scoring. Для отображения пользователю результат дополнительно содержит отдельный ключ `sources`, который не влияет на выбор ответа:

```js
const sources = {
  question: {
    page: 12,
    text: "Расширенный абзац из исходного PDF...",
    lineStart: 18,
    lineEnd: 23,
    blockKind: "recommendation",
    stance: "context",
    highlights: [{ start: 34, end: 59, role: "question" }],
    origin: "search_fallback",
    localizationMatch: "normalized",
    contentMatch: "partial",
    evidenceKinds: ["question_search"],
    score: 12.48,
    truncated: false
  },
  answers: [
    {
      id: "B",
      variant: "Ответ B",
      selected: true,
      excerpts: [
        {
          page: 12,
          text: "Полный пункт рекомендации с соседним контекстом...",
          lineStart: 20,
          lineEnd: 23,
          blockKind: "recommendation",
          stance: "support",
          highlights: [{ start: 110, end: 148, role: "answer" }],
          origin: "scoring_evidence",
          localizationMatch: "exact",
          contentMatch: "exact",
          evidenceKinds: ["recommendation_item_segment"],
          score: 14.2,
          truncated: false
        }
      ]
    }
  ]
};
```

Индексы строк отсчитываются с нуля внутри извлечённой страницы. Диапазоны `highlights` относятся прямо к возвращённому `text`, поэтому интерфейс может подсветить совпавшие слова без повторной нормализации. При `truncated: true` поля `lineStart`/`lineEnd` указывают на родительский блок для навигации, а offsets подсветки остаются точными для показанного текста. `stance: "context"` означает широкий поисковый контекст, `contradiction` — противоречащий фрагмент, а `mixed` — конфликтующие сигналы.

## Лицензия

MIT. Подробнее см. [LICENSE](./LICENSE).
