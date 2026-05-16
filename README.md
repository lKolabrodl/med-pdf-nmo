# nmo-pdf-easy-browser

Browser-first build of the strongest local NMO PDF predictor from this workspace.

## Browser usage

Load this library and give it a PDF.js module:

```html
<script src="./dist/nmo-pdf-easy.browser.js"></script>
<script type="module">
  import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.mjs";
  NmoPdfEasy.setPdfJsLib(pdfjsLib);
</script>
```

```html
<input id="pdf" type="file" accept="application/pdf" />
<script>
  document.querySelector("#pdf").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    const result = await NmoPdfEasy.answerQuestion(file, {
      question: "Question text",
      variants: ["A text", "B text", "C text"],
      type: "single"
    });
    console.log(result.selected, result.confidence, result.evidence);
  });
</script>
```

The runtime accepts `File`, `Blob`, `ArrayBuffer`, `Uint8Array`, or a URL string. It does not read test fixtures, expected answers, or local files.

## Development checks

```bash
npm test
npm run typecheck
npm run build
npm run eval
npm run eval:holdout
```

The eval scripts are Node-only developer tooling. They read local PDFs and answer keys to measure accuracy; the browser runtime under `src/` does not.
