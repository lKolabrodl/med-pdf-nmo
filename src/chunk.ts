import { normalizeForSearch, tokenize } from "./normalize.js";

function splitSentences(text) {
  const normalized = String(text ?? "")
    .replace(/\r/g, "")
    .replace(/([.!?;])\s+(?=[А-ЯA-Z0-9])/g, "$1\n")
    .replace(/\n{3,}/g, "\n\n");
  return normalized
    .split(/\n+|(?<=[.!?;])\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8);
}

function tokenCount(text) {
  return tokenize(text, { keepStopwords: true, stem: false }).length;
}

export function buildChunks(pdfText, { targetTokens = 95, overlapSentences = 2 } = {}) {
  const chunks = [];

  for (const page of pdfText.pages) {
    const sentences = splitSentences(page.text);
    let current = [];
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = Math.max(1, tokenCount(sentence));
      if (current.length && currentTokens + sentenceTokens > targetTokens) {
        chunks.push(makeChunk(page.page, current.join(" ")));
        current = current.slice(-overlapSentences);
        currentTokens = tokenCount(current.join(" "));
      }
      current.push(sentence);
      currentTokens += sentenceTokens;
    }

    if (current.length) {
      chunks.push(makeChunk(page.page, current.join(" ")));
    }

    const lines = page.text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 12);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      chunks.push(makeChunk(page.page, line, "line"));
      if (i + 1 < lines.length) {
        chunks.push(makeChunk(page.page, `${line} ${lines[i + 1]}`, "line_pair"));
      }
      const listLike = /^(\d+(?:\.\d+)*[.)]?|[-*•]|[a-zа-я]\))\s+/iu.test(line);
      const headingLike = line.length < 120 && !/[.!?]$/.test(line);
      if (listLike || headingLike) {
        const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join(" ");
        chunks.push(makeChunk(page.page, context, listLike ? "list" : "heading"));
      }
    }
  }

  return chunks
    .filter((chunk) => chunk.tokens.length)
    .map((chunk, index) => ({ ...chunk, id: index }));
}

function makeChunk(page, text, kind = "body") {
  return {
    page,
    kind,
    text: String(text ?? "").replace(/\s+/g, " ").trim(),
    normalized: normalizeForSearch(text),
    tokens: tokenize(text),
    rawTokens: tokenize(text, { keepStopwords: true, stem: false }),
  };
}
