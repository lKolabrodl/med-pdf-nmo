import {
  answerSearchPhrases,
  betterEvidence,
  evidenceSnippet,
  extractNumbers,
  findPhraseOccurrences,
  normalizeForSearch,
  normalizeText,
  proximityBonus,
} from "./dependencies.js";
import {conditionFamily, nearestConditionFamily} from "./condition-family.js";
import type {ConditionFamily} from "./condition-family.js";
import type {ConditionPairInput, NumericEvidence, ScoreAdjustment} from "./types.js";

type AnswerValueCondition = {
  value: string;
  condition: string;
  family: ConditionFamily;
};

/**
 * Извлекает или проверяет варианта ответа значения условия в варианте ответа.
 *
 * @param answerText Исходный текст проверяемого варианта ответа.
 * @returns Вычисленное значение; `null` или пустая структура означают отсутствие применимого сигнала, если это предусмотрено функцией.
 * @internal
 */
function answerValueCondition(answerText: string): AnswerValueCondition | null {
  const raw = normalizeText(answerText);
  const match = raw.match(/^(.{2,90}?)\s+для\s+(.{3,120})$/u);
  if (!match) return null;
  const value = match[1].trim();
  const condition = match[2].trim();
  if (!extractNumbers(value).length && !/(год|месяц|дн|сут|раз)/u.test(value)) return null;
  const family = conditionFamily(condition);
  if (!family) return null;
  return { value, condition, family };
}

/**
 * Проверяет совместимость числового ответа с парным условием меньше/больше.
 *
 * @param context Контекстные параметры текущего scorer-этапа.
 * @param context.pages Извлечённые страницы PDF, доступные scorer-у.
 * @param context.topQuestionPages Страницы, наиболее релевантные вопросу по поисковому индексу.
 * @param context.answer Проверяемый вариант ответа с идентификатором и текстом.
 * @returns Поправка score и, при наличии, объясняющее evidence.
 */
export function conditionPairAdjustment({pages,topQuestionPages,answer}: ConditionPairInput): ScoreAdjustment {
  const pair = answerValueCondition(answer.text);
  if (!pair) return { adjustment: 0, evidence: null };
  let bestMatch: NumericEvidence = null;
  let bestMismatch: NumericEvidence = null;
  const valuePhrases = answerSearchPhrases(pair.value).slice(0, 8);

  for (const page of pages) {
    if (topQuestionPages?.size && !topQuestionPages.has(page.page)) continue;
    for (const phrase of valuePhrases) {
      const phraseNorm = normalizeForSearch(phrase);
      if (!phraseNorm || phraseNorm.length < 3) continue;
      const hits = findPhraseOccurrences(page.normalized, phrase, {textIsNormalized: true});
      for (const hit of hits) {
        const after = page.normalized.slice(hit + phraseNorm.length, hit + phraseNorm.length + 120);
        const actual = nearestConditionFamily(after);
        if (!actual) continue;
        const local = page.normalized.slice(Math.max(0, hit - 80), hit + phraseNorm.length + 160);
        const evidence = {
          answerId: answer.id,
          page: page.page,
          text: evidenceSnippet(page.text, pair.value, pair.condition),
          score: actual === pair.family ? 8.8 : 2.4,
          kind: actual === pair.family ? "condition_pair_match" : "condition_pair_mismatch",
        };
        if (actual === pair.family) {
          const proximity = after.indexOf(normalizeForSearch(pair.condition).slice(0, 5));
          bestMatch = betterEvidence(bestMatch, {...evidence, score: evidence.score + proximityBonus(proximity, 120)});
        } else if (local) {
          bestMismatch = betterEvidence(bestMismatch, evidence);
        }
      }
    }
  }

  if (bestMatch) return { adjustment: 4.6, evidence: bestMatch };
  if (bestMismatch) return { adjustment: -2.4, evidence: bestMismatch };
  return { adjustment: 0, evidence: null };
}
