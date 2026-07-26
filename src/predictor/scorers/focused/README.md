# focused

Модуль строит локальные evidence-окна вокруг наиболее специфичных токенов
вопроса.

## Как работает

- `questionFocusTokens` удаляет общие вопросительные и служебные слова;
- `bestFocusedSupport` оценивает компактное окно с ответом и фокусом;
- `cachedLineTokenSegments` один раз строит строковые сегменты страницы;
- `bestLineTokenSupport` требует совместного присутствия токенов в одной строке
  или соседней паре строк.

Это широкий lexical scorer: он помогает найти релевантную область, но не
считается самостоятельным структурным разрешением. Основные evidence-kind:
`focused_answer_window`, `line_token_line` и `line_token_line_pair`.

## Публичный API

- `questionFocusTokens(question)`;
- `bestFocusedSupport(...)`;
- `cachedLineTokenSegments(page)`;
- `bestLineTokenSupport(...)`.
