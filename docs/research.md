# Research

## Constraints

Runtime inference is JavaScript/Node.js only. It does not use LLMs, transformer inference, remote AI services, generated embeddings, HuggingFace inference, or answer keys. Correct labels are read only by eval scripts.

## Data found

The corpus has 35 PDF groups under `__test__/NN-name/`. Each group contains `doc.pdf` and `cases.test.ts`. The TypeScript case files contain the question, variants, mode, and expected labels. The predictor never imports these files; `scripts/eval.ts` and `scripts/cases.ts` read them only for scoring.

Total parsed cases: 2229.

- single-answer: 1537
- multi-answer: 692

## Approaches considered

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Exact string matching | Strong when a question is a literal PDF prefix | Brittle to line breaks, OCR noise, inflection, and tables | Kept as one high-confidence signal |
| TF-IDF/BM25 retrieval | Fast, transparent, no model serving | Needs careful normalization and chunking | Implemented in repo |
| Question+answer phrase scoring | Good for cloze-style NMO questions | Can over-score distractors when all options are nearby | Implemented with proximity signals |
| Contrastive answer scoring | Compares options against the same retrieved context | Still confused by flattened tables | Implemented through per-answer raw scores and calibrated relative scores |
| List/anchor scoring | Improves "относятся/являются/следующие" multi questions | Requires robust anchor extraction | Implemented and kept |
| Line/table chunks | Can recover some table rows | `pdfjs-dist` often flattens table order into one paragraph | Tried; partially kept line chunks, not sufficient |
| Compact numeric windows | Intended to fix numeric table rows | Over-scored neighboring values in flattened text | Tried and reverted |
| Russian number-word aliases | Helps digits vs words like "six" | Folded Cyrillic/Latin extraction produced false numeric matches in nearby context | Tried and reverted |
| OCR fallback | Needed for scanned PDFs | JS OCR is heavy and not needed for current text-extractable corpus | Not implemented; low-text PDFs are flagged |

## Selected best architecture

The best retained version extracts PDF text with `pdfjs-dist`, normalizes Russian/medical text, builds sentence/list/line chunks, indexes them with BM25, and scores each answer using an ensemble of non-LLM evidence signals:

- direct normalized `question + answer` phrase support;
- answer occurrence near or after question-like text on the same page;
- list-like question anchor segments;
- prefix continuation matching;
- BM25 for `question`, `answer`, and `question + answer`;
- answer coverage and token proximity inside top question chunks;
- calibrated relative scoring and dev-tuned multi thresholds;
- minimum multi-answer cardinality and a narrow third-answer near-tie rule;
- single-character numeric token preservation for dosage/frequency variants.
- narrow line-level binding for dose frequency, conditional-only recommendations, first-line therapy rows, biological/mechanical valve prosthesis recommendation rows, and fibrosis stage rows extracted from the PDF.

The best current algorithm reaches dev exact accuracy `0.6931` and holdout exact accuracy `0.8021`, passing the required `0.80` acceptance target. The codebase has been moved to TypeScript entrypoints with a gradual split under `src/predictor/` so scoring pieces can be extracted safely without changing runtime behavior.
