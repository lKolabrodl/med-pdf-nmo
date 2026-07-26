import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
import ts from "typescript";
import {describe, expect, it} from "vitest";
import {BM25Index} from "../src/bm25.js";
import type {PdfChunk} from "../src/chunk.js";
import {normalizeForSearch} from "../src/normalize.js";
import type {ExtractedPdfText, PdfPage} from "../src/pdf.js";
import {DEFAULT_CONFIG} from "../src/predictor/config.js";
import type {AnswerScoringContext} from "../src/predictor/contracts.js";

type ParameterDescriptor = {
  name: string;
  objectBinding: boolean;
  typeText: string;
};

type FunctionDescriptor = {
  key: string;
  filePath: string;
  name: string;
  parameters: ParameterDescriptor[];
  returnTypeText: string;
  exported: boolean;
  jsDoc: string | null;
};

type NeutralAnswer = {
  id: string;
  text: string;
};

export type ScorerFunctionManifest = Readonly<Record<string, readonly string[]>>;

export type ScorerTestContextOverrides =
  Omit<Partial<AnswerScoringContext>, "pdfText" | "runtime"> & {
    pdfText?: Partial<ExtractedPdfText>;
  };

const moduleCache = new Map<string, Promise<Record<string, unknown>>>();

/**
 * Возвращает минимальную страницу PDF, пригодную для unit-тестов scorer-ов.
 *
 * @param page Номер создаваемой страницы.
 * @param lines Физические строки страницы.
 * @returns Страница с согласованными `text`, `normalized` и layout-полями.
 */
export function scorerTestPage(page = 1, lines: string[] = []): PdfPage {
  const text = lines.join("\n");
  return {
    page,
    text,
    lines,
    blocks: [],
    lineItems: [],
    normalized: normalizeForSearch(text),
    charLength: text.length,
  };
}

/**
 * Создаёт полный типизированный контекст scorer-а и применяет только нужные
 * конкретному тесту переопределения.
 *
 * @param overrides Поля сценария, отличающиеся от безопасного нейтрального контекста.
 * @returns Валидный `AnswerScoringContext`, готовый для прямого вызова scorer-а.
 */
export function scorerTestContext(overrides: ScorerTestContextOverrides = {}): AnswerScoringContext {
  const {pdfText: pdfTextOverrides, ...contextOverrides} = overrides;
  const answer = contextOverrides.answer ?? neutralAnswer();
  const pages = contextOverrides.pages ?? [scorerTestPage()];
  const chunks: PdfChunk[] = contextOverrides.chunks ?? [];
  const pdfText: ExtractedPdfText = {
    pdfId: "test",
    cacheVersion: 2,
    pageCount: pages.length,
    extractedAt: "2026-01-01T00:00:00.000Z",
    pages,
    abbreviations: [],
    ocrNeeded: false,
    ...pdfTextOverrides,
  };
  const index = contextOverrides.index ?? new BM25Index<PdfChunk>(chunks);

  return {
    runtime: {pdfText, chunks, index},
    config: DEFAULT_CONFIG,
    mode: "single",
    question: "",
    answers: [answer],
    questionTokens: [],
    focusTokens: [],
    intent: {negative: false, exception: false, numeric: false, listLike: false},
    anchorSegments: [],
    sectionSegments: [],
    topQuestionMatches: [],
    topQuestionPages: new Set<number>(),
    rowSegments: [],
    boundedListSegments: [],
    visualTableColumnTargetsByPage: null,
    coordinateTableRowsByPage: null,
    coordinateRelationalRowsByPage: null,
    coordinateTableGroupsByPage: null,
    coordinateMultiCellRowsByPage: null,
    coordinateTableMembershipsByPage: null,
    pages,
    pdfText,
    chunks,
    index,
    answer,
    answerTokens: [],
    siblingListResolution: new Map(),
    ...contextOverrides,
  };
}

/**
 * Регистрирует colocated contract-тесты для каждой именованной функции scorer-модуля.
 *
 * Каждый helper получает отдельный тест на подробный JSDoc и отдельный runtime
 * smoke-тест с нейтральным валидным контекстом. Непубличные функции временно
 * экспортируются только в in-memory esbuild-бандле; production API не меняется.
 *
 * @param testFileUrl Значение `import.meta.url` colocated test-файла.
 * @returns Ничего; функция регистрирует Vitest suites.
 */
export function defineScorerFunctionContract(
  testFileUrl: string,
  manifest: ScorerFunctionManifest,
): void {
  const functions = discoverFunctions(testFileUrl);
  const moduleName = path.basename(path.dirname(fileURLToPath(testFileUrl)));
  const declaredKeys = Object.entries(manifest)
    .flatMap(([fileName, names]) => names.map((name) => `${fileName}:${name}`));
  const descriptors = new Map(functions.map((descriptor) => [descriptor.key, descriptor]));

  describe(`${moduleName} function contracts`, () => {
    it("explicitly lists every named function exactly once", () => {
      expect([...declaredKeys].sort()).toEqual(functions.map((descriptor) => descriptor.key).sort());
    });

    for (const key of declaredKeys) {
      it(`${key} has explicit types, detailed JSDoc, and handles neutral input`, async () => {
        const descriptor = descriptors.get(key);
        if (!descriptor) throw new Error(`${key} is listed in the test but does not exist`);

        for (const parameter of descriptor.parameters) {
          expect(parameter.typeText.trim(), `${descriptor.key}:${parameter.name} has no explicit type`).not.toBe("");
        }
        expect(descriptor.returnTypeText.trim(), `${descriptor.key} has no explicit return type`).not.toBe("");

        expect(descriptor.jsDoc, `${descriptor.key} has no JSDoc`).not.toBeNull();
        expect(descriptor.jsDoc).toMatch(/@returns?\b/u);
        const prose = descriptor.jsDoc
          ?.replace(/^\/\*\*|\*\/$/gu, "")
          .split(/\n\s*\*\s*@/u)[0]
          .replace(/\s*\*\s?/gu, " ")
          .trim() ?? "";
        expect(prose.length, `${descriptor.key} has no useful description`).toBeGreaterThan(24);
        for (const parameter of descriptor.parameters) {
          if (parameter.objectBinding) {
            expect(descriptor.jsDoc).toMatch(/@param\b/u);
            continue;
          }
          expect(descriptor.jsDoc, `${descriptor.key} does not document ${parameter.name}`)
            .toMatch(new RegExp(`@param\\s+${parameter.name}\\b`, "u"));
        }
        if (!descriptor.exported) expect(descriptor.jsDoc).toMatch(/@internal\b/u);

        const fn = await loadFunction(descriptor, functions);
        const args = descriptor.parameters.map((parameter) => neutralArgument(parameter, descriptor));
        const value = (fn as (...input: unknown[]) => unknown)(...args);
        if (value && typeof (value as PromiseLike<unknown>).then === "function") {
          await expect(value).resolves.not.toBeInstanceOf(Error);
        } else {
          expect(value).not.toBeInstanceOf(Error);
        }
      });
    }
  });
}

/**
 * Находит именованные top-level функции во всех source-файлах colocated модуля.
 *
 * @param testFileUrl URL test-файла внутри scorer-папки.
 * @returns Дескрипторы функций с параметрами, export-флагом и исходным JSDoc.
 * @internal
 */
function discoverFunctions(testFileUrl: string): FunctionDescriptor[] {
  const moduleDir = path.dirname(fileURLToPath(testFileUrl));
  const sourceFiles = fs.readdirSync(moduleDir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .sort();
  const descriptors: FunctionDescriptor[] = [];

  for (const fileName of sourceFiles) {
    const filePath = path.join(moduleDir, fileName);
    const text = fs.readFileSync(filePath, "utf8");
    const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const node of source.statements) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        descriptors.push(descriptorFor(text, source, filePath, node.name.text, node, node));
      }
      if (!ts.isVariableStatement(node)) continue;
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        if (!ts.isArrowFunction(declaration.initializer) && !ts.isFunctionExpression(declaration.initializer)) continue;
        descriptors.push(descriptorFor(text, source, filePath, declaration.name.text, node, declaration.initializer));
      }
    }
  }

  return descriptors.sort((left, right) => left.key.localeCompare(right.key));
}

/**
 * Создаёт единый дескриптор function declaration или function-valued variable.
 *
 * @param text Полный исходный текст TypeScript-файла.
 * @param source Разобранный TypeScript source file.
 * @param filePath Абсолютный путь к исходному файлу.
 * @param name Имя функции.
 * @param declaration Top-level узел, содержащий export-модификатор и JSDoc.
 * @param callable Узел с параметрами вызываемой функции.
 * @returns Дескриптор, используемый contract-тестами.
 * @internal
 */
function descriptorFor(
  text: string,
  source: ts.SourceFile,
  filePath: string,
  name: string,
  declaration: ts.Node,
  callable: ts.FunctionLikeDeclaration,
): FunctionDescriptor {
  const docs = (ts.getLeadingCommentRanges(text, declaration.getFullStart()) ?? [])
    .filter((range) => text.slice(range.pos, range.end).startsWith("/**"));
  const exported = (ts.getModifiers(declaration as ts.HasModifiers) ?? [])
    .some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  return {
    key: `${path.basename(filePath)}:${name}`,
    filePath,
    name,
    parameters: callable.parameters.map((parameter, index) => ({
      name: ts.isIdentifier(parameter.name) ? parameter.name.text : `context${index + 1}`,
      objectBinding: ts.isObjectBindingPattern(parameter.name),
      typeText: parameter.type?.getText(source) ?? "",
    })),
    returnTypeText: callable.type?.getText(source) ?? "",
    exported,
    jsDoc: docs.length ? text.slice(docs.at(-1)!.pos, docs.at(-1)!.end) : null,
  };
}

/**
 * Загружает одну функцию из временно инструментированного in-memory бандла.
 *
 * @param descriptor Дескриптор целевой функции.
 * @param moduleFunctions Все функции scorer-папки для определения внутренних экспортов.
 * @returns Загруженная callable-функция.
 * @internal
 */
async function loadFunction(descriptor: FunctionDescriptor, moduleFunctions: FunctionDescriptor[]) {
  let bundled = moduleCache.get(descriptor.filePath);
  if (!bundled) {
    bundled = bundleSourceFile(descriptor.filePath, moduleFunctions);
    moduleCache.set(descriptor.filePath, bundled);
  }
  const module = await bundled;
  const fn = module[descriptor.name];
  expect(fn, `${descriptor.key} is not callable`).toBeTypeOf("function");
  return fn;
}

/**
 * Собирает TypeScript-файл и добавляет test-only exports для внутренних helpers.
 *
 * @param filePath Путь к инструментируемому source-файлу.
 * @param moduleFunctions Дескрипторы функций текущего scorer-модуля.
 * @returns Namespace собранного ESM-модуля.
 * @internal
 */
async function bundleSourceFile(filePath: string, moduleFunctions: FunctionDescriptor[]): Promise<Record<string, unknown>> {
  const source = fs.readFileSync(filePath, "utf8");
  const internalNames = moduleFunctions
    .filter((item) => item.filePath === filePath && !item.exported)
    .map((item) => item.name);
  const instrumented = internalNames.length ? `${source}\nexport {${internalNames.join(", ")}};\n` : source;
  const result = await build({
    absWorkingDir: process.cwd(),
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    write: false,
    stdin: {
      contents: instrumented,
      loader: "ts",
      resolveDir: path.dirname(filePath),
      sourcefile: path.basename(filePath),
    },
  });
  const output = result.outputFiles[0]?.text;
  if (!output) throw new Error(`esbuild produced no output for ${filePath}`);
  const url = `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
  return import(url) as Promise<Record<string, unknown>>;
}

/**
 * Строит нейтральное значение для одного параметра smoke-теста.
 *
 * @param parameter Описание параметра функции.
 * @param descriptor Дескриптор вызываемой функции и её source-файла.
 * @returns Значение, позволяющее scorer-у безопасно воздержаться.
 * @internal
 */
function neutralArgument(parameter: ParameterDescriptor, descriptor: FunctionDescriptor): unknown {
  if (parameter.objectBinding) return neutralContext();
  return neutralValue(parameter.name, parameter.typeText, descriptor);
}

/**
 * Возвращает нейтральное значение по семантическому имени параметра.
 *
 * @param name Имя параметра из TypeScript AST.
 * @param typeText TypeScript-аннотация параметра, если она указана.
 * @param descriptor Дескриптор функции для учёта scorer-модуля.
 * @returns Строка, число, коллекция или объект безопасного контекста.
 * @internal
 */
function neutralValue(name: string, typeText: string, descriptor: FunctionDescriptor): unknown {
  const lowerName = name.toLowerCase();
  const compactType = typeText.replace(/\s/gu, "");

  if (lowerName === "cluster" && descriptor.name === "commonLabelTokens") return [neutralHierarchyParent()];
  if (/(?:^|[|<(])(?:readonly)?[^|]*(?:\[\]|Array<|ReadonlyArray<)/u.test(compactType)) return [];
  if (/RegExp/u.test(compactType)) return /$^/u;
  if (/\bSet</u.test(compactType)) return new Set();
  if (/\bMap</u.test(compactType)) return new Map();
  if (/\b(?:number|bigint)\b/u.test(compactType)) return 0;
  if (/\bboolean\b/u.test(compactType)) return false;
  if (/\bstring\b/u.test(compactType)) return "";
  if (/AnswerOption/u.test(compactType)) return neutralAnswer();
  if (/(?:PdfPage|ExtractedPdfPage)/u.test(compactType)) return scorerTestPage();
  if (/HierarchyParent/u.test(compactType)) return neutralHierarchyParent();
  if (/HierarchyChild/u.test(compactType)) return neutralHierarchyChild();
  if (/NumericFamilyMember/u.test(compactType)) return neutralNumericFamilyMember();
  if (/NumericFamily/u.test(compactType)) return neutralNumericFamily();
  if (/SiblingBlock/u.test(compactType)) return neutralSiblingBlock();
  if (/(?:CoordinateCell|CoordinateLine|CoordinateRow|CoordinateGroup|CoordinateXValue)/u.test(compactType)) {
    return neutralCoordinateObject();
  }

  if (lowerName === "mode") return "single";
  if (lowerName === "direction") return "less";
  if (lowerName === "kind") return "stage";
  if (/^(?:stage|number|value)$/u.test(lowerName)) return "1";
  if (/^(?:index|start|end|length|radius|distance|pagenumber|targetlength|docindex|lineindex|hit|phraselength|margin|total|tolerance)$/u.test(lowerName)) return 0;
  if (/^(?:predicate|matcher|startslist)$/u.test(lowerName)) return () => false;
  if (lowerName === "answer") return neutralAnswer();
  if (lowerName === "page") return scorerTestPage();
  if (lowerName === "intent") return {negative: false, exception: false, numeric: false, listLike: false};
  if (/^(?:indexinstance|bm25|searchindex)$/u.test(lowerName)) return {search: () => []};
  if (lowerName === "answernumbers") return new Set();
  if (/(?:map|bypage)$/u.test(lowerName)) return new Map();
  if (/set$/u.test(lowerName)) return new Set();
  if (/^(?:pages|answers|answerscores|chunks|lines|items|cells|rows|groups|segments|fragments|entries|evidence|conditions|sources|values|aliases|children|cluster|clusters|candidates|patterns|siblings)$/u.test(lowerName)) return [];
  if (/(?:tokens|phrases|forms|variants|windows|clauses|numbers|cues|labels|facts|values|aliases|cells|rows|groups)$/u.test(lowerName)) return [];
  if (/^(?:text|question|answertext|sourcetext|normalized|normalizedtext|normalizedpage|normalizedafter|pagenorm|token|word|code|classcode|left|right|cue|label|suffix|unit|requiredunit|role|raw|local|clean|after|before|phrase|scope|comparator)$/u.test(lowerName)) return "";
  if (lowerName === "target") return /$^/u;
  if (lowerName === "family") return neutralNumericFamily();
  if (lowerName === "member") return neutralNumericFamilyMember();
  if (lowerName === "parent") return neutralHierarchyParent();
  if (lowerName === "child") return neutralHierarchyChild();
  if (lowerName === "block") return neutralSiblingBlock();
  if (/^(?:fact|answerfact)$/u.test(lowerName)) return neutralDoseFact();
  if (/^(?:source|line|row|cell|group|item|context)$/u.test(lowerName)) {
    if (descriptor.filePath.includes("coordinate-table")) return neutralCoordinateObject();
    return neutralContext();
  }
  return neutralContext();
}

/**
 * Создаёт пустой вариант ответа для нейтральных scorer-вызовов.
 *
 * @returns Вариант с постоянным id и пустым текстом.
 * @internal
 */
function neutralAnswer(): NeutralAnswer {
  return {id: "A", text: ""};
}

/**
 * Создаёт полный безопасный контекст, на котором scorer должен воздержаться.
 *
 * @returns Контекст со всеми распространёнными полями scorer-функций.
 * @internal
 */
function neutralContext() {
  const answer = neutralAnswer();
  const page = scorerTestPage();
  return {
    mode: "single",
    question: "",
    answer,
    answers: [answer],
    answerText: "",
    questionTokens: [],
    answerTokens: [],
    focusTokens: [],
    pages: [page],
    pageIndex: 0,
    lineIndex: 0,
    topQuestionPages: new Set<number>(),
    chunks: [],
    index: {search: () => []},
    intent: {negative: false, exception: false, numeric: false, listLike: false},
    config: {
      countRelationBoost: false,
      optionFamilyComparatorGuard: false,
      optionFamilyCompactComboGuard: false,
    },
    pdfText: {
      pdfId: "test",
      cacheVersion: 2,
      pageCount: 0,
      extractedAt: "2026-01-01T00:00:00.000Z",
      pages: [],
      abbreviations: [],
      ocrNeeded: false,
    },
    anchorSegments: [],
    sectionSegments: [],
    rowSegments: [],
    boundedListSegments: [],
    topQuestionMatches: [],
    visualTableColumnTargetsByPage: null,
    coordinateTableRowsByPage: null,
    coordinateRelationalRowsByPage: null,
    coordinateTableGroupsByPage: null,
    coordinateMultiCellRowsByPage: null,
    coordinateTableMembershipsByPage: null,
    siblingListResolution: new Map(),
    evidence: [],
    fragments: [],
    answerPhrases: [],
    specificTokens: [],
    specificFocus: [],
    beforeText: "",
    afterText: "",
    target: "",
    best: null,
    label: {kind: "stage", value: 1, raw: "1"},
    lines: [],
    lineItems: [],
    cells: [],
    groups: [],
    memberships: [],
    text: "",
    normalized: "",
    page: 1,
  };
}

/**
 * Создаёт пустого родителя иерархического списка с согласованными дочерними полями.
 *
 * @returns Родитель, пригодный для безопасного вызова hierarchy helpers.
 * @internal
 */
function neutralHierarchyParent() {
  return {
    page: 1,
    flatIndex: 0,
    nextParentIndex: Number.POSITIVE_INFINITY,
    label: "",
    labelTokens: [],
    children: [],
  };
}

/**
 * Создаёт пустой дочерний элемент иерархического списка.
 *
 * @returns Дочерний элемент с текстом, токенами и координатами.
 * @internal
 */
function neutralHierarchyChild() {
  return {
    page: 1,
    flatIndex: 0,
    text: "",
    tokens: [],
  };
}

/**
 * Создаёт пустое семейство числовых вариантов ответа.
 *
 * @returns Семейство без участников, которое не может дать ложное совпадение.
 * @internal
 */
function neutralNumericFamily() {
  return {
    key: "",
    members: [],
  };
}

/**
 * Создаёт нейтрального участника семейства числовых вариантов.
 *
 * @returns Участник с пустыми числовыми кортежами и скалярной единицей.
 * @internal
 */
function neutralNumericFamilyMember() {
  return {
    answer: neutralAnswer(),
    numbers: [],
    variableTuples: [],
    intervalKey: null,
    intervalUnit: "scalar",
    unitClass: "scalar",
  };
}

/**
 * Создаёт пустой блок списка соседних категорий.
 *
 * @returns Блок с безопасными строковыми и коллекционными полями.
 * @internal
 */
function neutralSiblingBlock() {
  return {
    page: 1,
    flatIndex: 0,
    nextBlockIndex: Number.POSITIVE_INFINITY,
    label: "",
    labelTokens: [],
    body: "",
    bodyTokens: [],
    lines: [],
  };
}

/**
 * Создаёт пустой факт о дозировке и кратности препарата.
 *
 * @returns Факт без дозы, диапазона и частоты.
 * @internal
 */
function neutralDoseFact() {
  return {
    drug: "",
    dose: "",
    doseRange: null,
    unit: "",
    frequency: "",
  };
}

/**
 * Создаёт объект с нейтральной геометрией строки, ячейки и табличной группы.
 *
 * @returns Объект, содержащий безопасные поля coordinate-table helpers.
 * @internal
 */
function neutralCoordinateObject() {
  return {
    page: 1,
    text: "",
    normalized: "",
    headerText: "",
    labelText: "",
    valueText: "",
    bodyText: "",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    index: 0,
    items: [],
    cells: [],
    lines: [],
    lineItems: [],
    rows: [],
    groups: [],
    tokens: [],
  };
}
