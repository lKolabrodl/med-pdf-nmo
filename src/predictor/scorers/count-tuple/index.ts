import { normalizeForSearch, normalizeText, uniqueTokens } from "../../../normalize.js";
import type { PdfLinePage } from "../../../pdf.js";
import { tokenizeNormalized } from "../../text-utils.js";
import type { AnswerScore } from "../../types.js";
import { buildRelationTupleFragments } from "../relation-tuple/index.js";

type AnswerOption = { id: string; text: string };
type CountProof = { answerId: string; page: number; text: string };
type CountFamilyMember = {answer: AnswerOption; value: string};

const COUNT_QUESTION_CUES = ["\u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432", "\u0447\u0438\u0441\u043b\u043e", "\u0441\u043a\u043e\u043b\u044c\u043a"].map(normalizeForSearch);
const COUNT_SOURCE_CUES = [
  "\u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432",
  "\u0447\u0438\u0441\u043b\u043e",
  "\u0441\u043e\u0441\u0442\u0430\u0432\u043b",
  "\u0432\u044b\u0434\u0435\u043b",
  "\u043f\u0440\u043e\u0432\u043e\u0434",
  "\u043f\u043e\u0434\u0440\u0430\u0437\u0434\u0435\u043b",
  "\u043d\u0430\u0441\u0447\u0438\u0442",
  "\u0432\u043a\u043b\u044e\u0447",
  "\u043e\u0431\u044a\u0435\u0434\u0438\u043d",
].map(normalizeForSearch);

const COUNT_GENERIC_TOKENS = new Set(
  [
    "\u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e",
    "\u0447\u0438\u0441\u043b\u043e",
    "\u0441\u043a\u043e\u043b\u044c\u043a\u043e",
    "\u0441\u043e\u0441\u0442\u0430\u0432\u043b\u044f\u0435\u0442",
    "\u043e\u043f\u0440\u0435\u0434\u0435\u043b\u044f\u0435\u0442",
    "\u0438\u043c\u0435\u0435\u0442",
  ].flatMap((item) => uniqueTokens(item)),
);

const COUNT_WORD_FORMS = new Map<string, string[]>(
  Object.entries({
    "0": ["\u043d\u043e\u043b\u044c", "\u043d\u0443\u043b\u044f"],
    "1": ["\u043e\u0434\u0438\u043d", "\u043e\u0434\u043d\u0430", "\u043e\u0434\u043d\u043e", "\u043e\u0434\u043d\u043e\u0439"],
    "2": ["\u0434\u0432\u0430", "\u0434\u0432\u0435", "\u0434\u0432\u0443\u0445", "\u0434\u0432\u0443\u043c\u044f"],
    "3": ["\u0442\u0440\u0438", "\u0442\u0440\u0435\u0445", "\u0442\u0440\u0435\u043c\u044f"],
    "4": ["\u0447\u0435\u0442\u044b\u0440\u0435", "\u0447\u0435\u0442\u044b\u0440\u0435\u0445", "\u0447\u0435\u0442\u044b\u0440\u044c\u043c\u044f"],
    "5": ["\u043f\u044f\u0442\u044c", "\u043f\u044f\u0442\u0438", "\u043f\u044f\u0442\u044c\u044e"],
    "6": ["\u0448\u0435\u0441\u0442\u044c", "\u0448\u0435\u0441\u0442\u0438", "\u0448\u0435\u0441\u0442\u044c\u044e"],
    "7": ["\u0441\u0435\u043c\u044c", "\u0441\u0435\u043c\u0438", "\u0441\u0435\u043c\u044c\u044e"],
    "8": ["\u0432\u043e\u0441\u0435\u043c\u044c", "\u0432\u043e\u0441\u044c\u043c\u0438", "\u0432\u043e\u0441\u0435\u043c\u044c\u044e"],
    "9": ["\u0434\u0435\u0432\u044f\u0442\u044c", "\u0434\u0435\u0432\u044f\u0442\u0438", "\u0434\u0435\u0432\u044f\u0442\u044c\u044e"],
    "10": ["\u0434\u0435\u0441\u044f\u0442\u044c", "\u0434\u0435\u0441\u044f\u0442\u0438"],
    "11": ["\u043e\u0434\u0438\u043d\u043d\u0430\u0434\u0446\u0430\u0442\u044c", "\u043e\u0434\u0438\u043d\u043d\u0430\u0434\u0446\u0430\u0442\u0438"],
    "12": ["\u0434\u0432\u0435\u043d\u0430\u0434\u0446\u0430\u0442\u044c", "\u0434\u0432\u0435\u043d\u0430\u0434\u0446\u0430\u0442\u0438"],
  }).map(([value, forms]) => [value, [...new Set(forms.flatMap((form) => uniqueTokens(form)))]]),
);

/**
 * Выполняет внутренний этап `pureCountValue`, подготавливающий `pure` количества значения для основного scorer-а.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function pureCountValue(text: string): string | null {
  const clean = normalizeText(text).trim();
  if (!/^\d{1,2}$/u.test(clean)) return null;
  const value = String(Number(clean));
  return Number(value) <= 12 ? value : null;
}

/**
 * Строит структуру количества семейства вариантов из переданного локального контекста.
 *
 * @param answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function buildCountFamily(answers: AnswerOption[]): CountFamilyMember[] | null {
  if (answers.length < 3) return null;
  const members = answers.map((answer) => ({ answer, value: pureCountValue(answer.text) }));
  if (members.some((member) => member.value == null)) return null;
  if (new Set(members.map((member) => member.value)).size !== members.length) return null;
  return members as CountFamilyMember[];
}

/**
 * Выделяет специфичные токены объекта, количество которого требуется определить.
 *
 * @param question Исходный текст вопроса.
 * @returns Подготовленная коллекция; пустая коллекция означает отсутствие подходящих элементов.
 * @internal
 */
function countedObjectTokens(question: string): string[] {
  return uniqueTokens(question).filter(
    // General search stopwords intentionally include words such as "group".
    // In a count question that word can be the counted-object head, so only
    // count-specific grammar is removed here.
    (token) => token.length >= 4 && !/^\d/u.test(token) && !COUNT_GENERIC_TOKENS.has(token),
  );
}

/**
 * Проверяет структурную совместимость токена.
 *
 * @param target Значение `target`, необходимое этому этапу scorer-а.
 * @param source Ограниченный исходный фрагмент PDF.
 * @returns `true`, если проверяемое условие выполнено; иначе `false`.
 * @internal
 */
function tokenCompatible(target: string, source: string): boolean {
  if (target === source) return true;
  if (Math.min(target.length, source.length) < 4) return false;
  const shorter = target.length <= source.length ? target : source;
  const longer = target.length > source.length ? target : source;
  return longer.endsWith(shorter) && longer.length - shorter.length <= 6;
}

/**
 * Выполняет внутренний этап `objectCoverage`, подготавливающий объекта `coverage` для основного scorer-а.
 *
 * @param target Значение `target`, необходимое этому этапу scorer-а.
 * @param source Ограниченный исходный фрагмент PDF.
 * @returns Вычисленное числовое значение или специальное граничное значение при отсутствии совпадения.
 * @internal
 */
function objectCoverage(target: string[], source: string[]): number {
  if (!target.length) return 0;
  return target.filter((token) => source.some((candidate) => tokenCompatible(token, candidate))).length / target.length;
}

/**
 * Выполняет внутренний этап `countValuePresent`, подготавливающий количества значения `present` для основного scorer-а.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @param sourceTokens Нормализованные токены соответствующего текста.
 * @param value Входное значение, которое требуется нормализовать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function countValuePresent(text: string, sourceTokens: string[], value: string): boolean {
  const normalized = normalizeForSearch(text);
  if (new RegExp(`(?:^|[^0-9])${value}(?![0-9])`, "u").test(normalized)) return true;
  return (COUNT_WORD_FORMS.get(value) ?? []).some((form) => sourceTokens.includes(form));
}

/**
 * Выполняет внутренний этап `countQuestion`, подготавливающий количества вопроса для основного scorer-а.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function countQuestion(text: string): boolean {
  const normalized = normalizeForSearch(text);
  return COUNT_QUESTION_CUES.some((cue) => normalized.includes(cue));
}

/**
 * Извлекает из исходного PDF-фрагмента исходного фрагмента количества маркера.
 *
 * @param text Текст, который требуется разобрать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function sourceCountCue(text: string): boolean {
  const normalized = normalizeForSearch(text);
  return COUNT_SOURCE_CUES.some((cue) => normalized.includes(cue));
}

/**
 * Разрешает уникальное количество, связанное с объектом вопроса в одной клаузе.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.mode Режим выбора ответа: `single` или `multi`.
 * @param context.question Исходный текст вопроса.
 * @param context.answers Полный набор вариантов, необходимый для контрастного сравнения.
 * @param context.fragments Значение `fragments`, необходимое этому этапу scorer-а.
 * @returns Структурное разрешение; пустое значение означает, что scorer воздержался.
 */
export function resolveClauseLocalCountTuple({
  mode,
  question,
  answers,
  fragments,
}: {
  mode: string;
  question: string;
  answers: AnswerOption[];
  fragments: Array<{ page: number; text: string }>;
}): CountProof | null {
  if (mode !== "single" || !countQuestion(question)) return null;
  if (/(?:^|\s)(?:\u043a\u0440\u043e\u043c\u0435|\u0438\u0441\u043a\u043b\u044e\u0447\u0430\u044f|\u043d\u0435)(?:\s|$)/u.test(normalizeText(question))) return null;
  const family = buildCountFamily(answers);
  if (!family) return null;
  const objectTokens = countedObjectTokens(question);
  if (objectTokens.length < 2) return null;
  const proofs: CountProof[] = [];

  for (const fragment of fragments) {
    if (!sourceCountCue(fragment.text)) continue;
    const sourceTokens = tokenizeNormalized(normalizeForSearch(fragment.text));
    const coverage = objectCoverage(objectTokens, sourceTokens);
    const minimumCoverage = objectTokens.length <= 2 ? 1 : 0.5;
    if (coverage < minimumCoverage || objectTokens.filter((token) => sourceTokens.some((candidate) => tokenCompatible(token, candidate))).length < 2) continue;
    const matching = family.filter((member) => countValuePresent(fragment.text, sourceTokens, member.value));
    if (matching.length !== 1) continue;
    proofs.push({ answerId: matching[0].answer.id, page: fragment.page, text: fragment.text });
  }

  const ids = new Set(proofs.map((proof) => proof.answerId));
  if (ids.size !== 1) return null;
  return proofs.find((proof) => proof.answerId === [...ids][0]) ?? null;
}

/**
 * Применяет clause-local разрешение к score всех вариантов single-вопроса.
 *
 * @param answerScores Текущие score и evidence всех вариантов ответа.
 * @param context Полный контекст скоринга текущего варианта.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 */
export function applyClauseLocalCountTupleResolver(
  answerScores: AnswerScore[],
  context: {
    mode: string;
    pages: PdfLinePage[];
    topQuestionPages?: Set<number>;
    question: string;
    answers: AnswerOption[];
  },
): AnswerScore[] {
  if (context.mode !== "single") return answerScores;
  const proof = resolveClauseLocalCountTuple({
    ...context,
    fragments: buildRelationTupleFragments(context.pages, context.topQuestionPages),
  });
  if (!proof) return answerScores;
  const target = answerScores.find((item) => item.answer.id === proof.answerId);
  if (!target) return answerScores;
  const maxRaw = Math.max(...answerScores.map((item) => item.raw));
  const top = [...answerScores].sort((left, right) => right.raw - left.raw)[0];
  const trustedKinds = new Set([
    "coordinate_table_row",
    "coordinate_table_group",
    "coordinate_table_group_inverse",
    "fibrosis_stage_row",
    "drug_dose_segment",
    "relation_tuple_segment",
    "interval_relation_tuple_segment",
  ]);
  const trustedTop =
    top?.answer.id !== target.answer.id &&
    (top?.evidence ?? []).some((item) => trustedKinds.has(item.kind) && (item.score ?? 0) >= 12);
  const rawGap = maxRaw - target.raw;
  const rawRatio = target.raw / Math.max(0.001, maxRaw);
  if (target.raw < maxRaw && (trustedTop || rawGap > 12 || rawRatio < 0.55)) return answerScores;
  return answerScores.map((item) =>
    item.answer.id !== proof.answerId
      ? item
      : {
          ...item,
          raw: item.raw >= maxRaw ? item.raw : maxRaw + 0.1,
          evidence: [
            ...(item.evidence ?? []),
            {
              answerId: item.answer.id,
              page: proof.page,
              text: proof.text,
              score: 18.5,
              kind: "clause_count_tuple_segment",
            },
          ],
        },
  );
}
