# nmo-pdf-easy-browser

JavaScript/Node.js пакет для выбора ответа на вопросы НМО по PDF-документу с медицинскими или клиническими рекомендациями.

Пакет принимает PDF медицинских рекомендаций, текст вопроса и варианты ответа, извлекает текст из PDF через PDF.js, ищет релевантные фрагменты документа и возвращает наиболее вероятный вариант или несколько вариантов ответа.

Runtime-часть не использует LLM, ChatGPT, OpenAI API, Anthropic, Gemini, HuggingFace inference, transformer-модели или внешние интеллектуальные сервисы. Алгоритм работает локально на эвристиках, поиске по тексту, нормализации, скоринге и извлеченных доказательных фрагментах из PDF.

## Что делает пакет

- Извлекает текст из PDF-файла через `pdfjs-dist`.
- Принимает вопрос и варианты ответа.
- Нормализует текст вопроса, вариантов и PDF, включая формы `ФНО-α`/`ФНО-альфа` и числовые библиографические ссылки вида `[151].`.
- Ищет совпадения, близкие фразы, числовые значения, секции и контекстные фрагменты.
- Считает score для каждого варианта.
- Возвращает выбранный ответ, confidence, таблицу score и evidence из PDF.
- Поддерживает single-answer и multi-answer вопросы.
- Может использоваться в браузере и в Node.js.

## Ориентировочные метрики

Текущие цифры получены на локальном корпусе PDF-групп с вопросами НМО и answer key. Это не гарантия качества на любых новых документах, а практический ориентир по текущей валидации.

| Набор | Общая exact accuracy | Single-answer | Multi-answer exact set |
| --- | ---: | ---: | ---: |
| Dev split | `75.05%` | `83.28%` | `56.25%` |
| Holdout split | `81.64%` | `85.07%` | `70.31%` |
| Все answer-keyed кейсы | `72.75%` | `80.56%` | `55.25%` |

Для single-answer вопроса правильным считается только точный выбор одного варианта. Для multi-answer вопроса правильным считается только полное совпадение множества выбранных ответов, поэтому multi-метрика обычно заметно ниже.

## Установка по HTTPS/Git URL

Если репозиторий опубликован на GitHub, пакет можно подключить напрямую через HTTPS.

```bash
npm install git+https://github.com/<user>/<repo>.git
```

Или добавить ссылку в `package.json` своего проекта:

```json
{
  "dependencies": {
    "nmo-pdf-easy-browser": "git+https://github.com/<user>/<repo>.git#main"
  }
}
```

Замените `<user>/<repo>` на реальный путь к вашему репозиторию.

Можно закрепить конкретный tag, branch или commit:

```json
{
  "dependencies": {
    "nmo-pdf-easy-browser": "git+https://github.com/<user>/<repo>.git#v0.1.0"
  }
}
```

При установке из Git сработает `prepare`, поэтому пакет сам соберет `dist`.

## Использование в Node.js

```js
import fs from "node:fs/promises";
import { answerQuestion } from "nmo-pdf-easy-browser";

const pdfBuffer = await fs.readFile("./doc.pdf");

const result = await answerQuestion(pdfBuffer, {
  question: "Какой препарат показан пациенту?",
  variants: [
    "Вариант A",
    "Вариант B",
    "Вариант C",
    "Вариант D"
  ],
  type: "single"
});

console.log(result.selectedIds);
console.log(result.selected);
console.log(result.confidence);
console.log(result.evidence);
```

В Node.js PDF можно передавать как `Buffer`, `Uint8Array` или `ArrayBuffer`.

Строка в качестве PDF-входа трактуется как URL:

```js
const result = await answerQuestion("https://example.com/doc.pdf", {
  question: "Текст вопроса",
  variants: ["Ответ A", "Ответ B", "Ответ C"],
  type: "single"
});
```

## Использование в браузере через script

Для прямого подключения в браузере используйте готовый IIFE-бандл:

```html
<script src="https://cdn.jsdelivr.net/gh/<user>/<repo>@main/dist/nmo-pdf-easy.browser.js"></script>
<script type="module">
  import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.mjs";

  NmoPdfEasy.setPdfJsLib(pdfjsLib);
</script>
```

Для локального файла можно использовать:

```html
<script src="./dist/nmo-pdf-easy.browser.js"></script>
```

Пример с `input type="file"`:

```html
<input id="pdf" type="file" accept="application/pdf" />

<script>
  document.querySelector("#pdf").addEventListener("change", async (event) => {
    const file = event.target.files[0];

    const result = await NmoPdfEasy.answerQuestion(file, {
      question: "Текст вопроса",
      variants: ["Ответ A", "Ответ B", "Ответ C"],
      type: "single"
    });

    console.log(result.selectedIds);
    console.log(result.selected);
    console.log(result.confidence);
  });
</script>
```

CDN-вариант через `jsDelivr` будет работать, если репозиторий публичный и папка `dist` закоммичена.

## Использование в браузере как ESM

```js
import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.mjs";
import { answerQuestion, setPdfJsLib } from "./dist/nmo-pdf-easy.browser.mjs";

setPdfJsLib(pdfjsLib);

const result = await answerQuestion(file, {
  question: "Текст вопроса",
  variants: ["Ответ A", "Ответ B", "Ответ C"],
  type: "single"
});
```

## API

### `answerQuestion(pdf, options)`

Основной удобный API.

```js
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
- URL-строкой
- объектом с методом `arrayBuffer()`

`options`:

- `question` - текст вопроса.
- `variants` - массив вариантов ответа.
- `answers` - альтернативное имя для `variants`.
- `type` - `"single"` или `"multi"`.
- `mode` - альтернативное имя для `type`.
- `cacheKey` - ключ кеша для повторного использования извлеченного текста PDF.
- `pdfjsLib` - явная передача PDF.js модуля.

Варианты можно передавать строками:

```js
variants: ["Ответ A", "Ответ B", "Ответ C"]
```

Или объектами с собственными ID:

```js
variants: [
  { id: "A", text: "Ответ A" },
  { id: "B", text: "Ответ B" },
  { id: "C", text: "Ответ C" }
]
```

### Результат `answerQuestion`

```js
{
  selected: ["Ответ B"],
  selectedIds: ["B"],
  mode: "single",
  confidence: 0.73,
  scores: [
    { id: "A", variant: "Ответ A", score: 0.12, raw: 0.41 },
    { id: "B", variant: "Ответ B", score: 0.73, raw: 1.92 },
    { id: "C", variant: "Ответ C", score: 0.08, raw: 0.29 }
  ],
  evidence: [],
  meta: {},
  raw: {}
}
```

Главные поля:

- `selected` - выбранные тексты ответов.
- `selectedIds` - ID выбранных ответов.
- `confidence` - относительная уверенность.
- `scores` - score по всем вариантам.
- `evidence` - найденные фрагменты PDF, на которые опирался алгоритм.
- `raw` - низкоуровневый результат predictor.

## Multi-answer вопросы

Для вопросов с несколькими правильными вариантами используйте `type: "multi"`:

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

В ответе `selectedIds` будет массив выбранных ID.

## Низкоуровневый API

Пакет также экспортирует:

```js
import {
  predict,
  answerQuestion,
  setPdfJsLib,
  clearPredictorCache
} from "nmo-pdf-easy-browser";
```

- `answerQuestion` - удобная обертка для обычного использования.
- `predict` - низкоуровневый predictor API.
- `setPdfJsLib` - настройка PDF.js, особенно полезна в браузере.
- `clearPredictorCache` - очистка runtime-кеша predictor.

## CLI

После установки пакет добавляет команду:

```bash
nmo-pdf-easy --help
```

Пример:

```bash
nmo-pdf-easy --pdf doc.pdf --question "Текст вопроса" --mode single --answer A="Ответ A" --answer B="Ответ B"
```

Локально в этом репозитории можно запускать:

```bash
npm run predict -- --pdf doc.pdf --question "Текст вопроса" --mode single --answer A="Ответ A" --answer B="Ответ B"
```

## Сборка

```bash
npm install
npm run build
```

Сборка создает:

- `dist/index.js` - основной ESM entrypoint для Node.js и bundler-ов.
- `dist/index.d.ts` - TypeScript-типы.
- `dist/nmo-pdf-easy.browser.js` - браузерный global-бандл `NmoPdfEasy`.
- `dist/nmo-pdf-easy.browser.mjs` - браузерный ESM-бандл.
- `dist/cli.js` - CLI entrypoint.

## Проверки разработки

```bash
npm test
npm run typecheck
npm run build
npm pack --dry-run
npm run eval
npm run eval:holdout
```

`npm run eval` и `npm run eval:holdout` нужны для проверки качества predictor. Они являются developer tooling и могут читать локальные тестовые PDF и answer key для расчета accuracy.

Runtime API пакета не читает eval-файлы, split-файлы, правильные ответы или тестовые fixtures во время inference.

## Ограничения

- Пакет не является медицинским советником и не заменяет эксперта.
- Качество зависит от того, насколько хорошо PDF.js извлек текст из конкретного PDF.
- Сканированные PDF без текстового слоя могут потребовать OCR до передачи в пакет.
- Алгоритм выбирает вероятный ответ по содержимому PDF, но не гарантирует абсолютную правильность.
- Runtime не использует LLM и не обращается к внешним интеллектуальным сервисам.

## Короткий пример результата

```js
if (result.selectedIds.includes("B")) {
  console.log("Алгоритм выбрал вариант B");
}

for (const item of result.scores) {
  console.log(item.id, item.score, item.variant);
}
```

## Лицензия

MIT. Подробнее см. [LICENSE](./LICENSE).
