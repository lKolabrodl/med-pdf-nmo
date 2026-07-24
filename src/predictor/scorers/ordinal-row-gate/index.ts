import { normalizeForSearch } from "../../../normalize.js";

type OrdinalLabel = {
  kind: "stage" | "degree" | "type" | string;
  number: number;
};

function cueForKind(kind: string) {
  if (kind === "stage") return normalizeForSearch("стади");
  if (kind === "degree") return normalizeForSearch("степен");
  if (kind === "type") return normalizeForSearch("тип");
  return normalizeForSearch("класс");
}

function roman(number: number) {
  const values = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
  return values[number] ?? "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The answer-ordinal scorer maps a compact option label to a labelled source
 * row. An ordinal mentioned later in a sentence is normally a condition of the
 * answer, not the identity of the answer itself, so it must not receive the
 * same large structural bonus.
 */
export function answerOrdinalRowApplicable({
  question,
  answerText,
  label,
}: {
  question: string;
  answerText: string;
  label: OrdinalLabel;
}) {
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
