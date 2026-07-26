import { normalizeForSearch } from "../../../normalize.js";

type OrdinalLabel = {
  kind: "stage" | "degree" | "type" | string;
  number: number;
};

/**
 * Выполняет внутренний этап `cueForKind`, подготавливающий маркера `for` типа для основного scorer-а.
 *
 * @param kind Значение `kind`, необходимое этому этапу scorer-а.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function cueForKind(kind: string): string {
  if (kind === "stage") return normalizeForSearch("стади");
  if (kind === "degree") return normalizeForSearch("степен");
  if (kind === "type") return normalizeForSearch("тип");
  return normalizeForSearch("класс");
}

/**
 * Выполняет внутренний этап `roman`, подготавливающий римского значения для основного scorer-а.
 *
 * @param number Каноническое числовое значение.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function roman(number: number): string {
  const values = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
  return values[number] ?? "";
}

/**
 * Выполняет внутренний этап `escapeRegExp`, подготавливающий `escape` `reg` `exp` для основного scorer-а.
 *
 * @param value Входное значение, которое требуется нормализовать или проверить.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The answer-ordinal scorer maps a compact option label to a labelled source
 * row. An ordinal mentioned later in a sentence is normally a condition of the
 * answer, not the identity of the answer itself, so it must not receive the
 * same large structural bonus.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.question Исходный текст вопроса.
 * @param context.answerText Исходный текст проверяемого варианта ответа.
 * @param context.label Разобранная метка строки, стадии или типа.
 * @returns `true`, если проверяемое условие выполнено; иначе `false`.
 */
export function answerOrdinalRowApplicable({
  question,
  answerText,
  label,
}: {
  question: string;
  answerText: string;
  label: OrdinalLabel;
}): boolean {
  const questionNorm = normalizeForSearch(question);
  const cue = cueForKind(label.kind);
  const countCues = ["сколько", "количеств", "число"].map((value) => escapeRegExp(normalizeForSearch(value)));
  const countQuestion = new RegExp(
    `(?:^|\\s)(?:${countCues[0]}|${countCues[1]}\\S*|${countCues[2]})\\s+(?:\\S+\\s+){0,2}${escapeRegExp(cue)}\\S*(?:\\s|$)`,
    "iu",
  );
  if (countQuestion.test(questionNorm)) return false;

  const answerNorm = normalizeForSearch(answerText);
  const variants = [String(label.number), roman(label.number)].filter(Boolean).map(escapeRegExp);
  const value = `(?:${variants.join("|")})`;
  const optionalSubtype = "(?:\\s+[a-zа-я])?";
  const directLabel = new RegExp(
    `^(?:${value}${optionalSubtype}\\s+${escapeRegExp(cue)}\\S*|${escapeRegExp(cue)}\\S*\\s+${value}${optionalSubtype})(?:\\s|$)`,
    "iu",
  );
  return directLabel.test(answerNorm);
}
