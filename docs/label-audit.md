# Source audit of disputed case labels

Date: 2026-07-22.

## Scope and decision rule

The audit started from all 676 predictor/fixture mismatches present in the
working corpus at the start of the review. Every mismatch was screened against
the extracted PDF page blocks. The 160 strongest cases in which the predictor's
alternative had direct source overlap were then reviewed manually. Pages with
lists, classifications, or tables were also rendered and inspected visually.

The predictor output was never treated as an answer key. A fixture was changed
only when one bounded sentence, bullet list, or table row in its own PDF made the
existing label clearly false or incomplete. Ambiguous cases were left unchanged.
No predictor code or runtime threshold changed during this audit.

## Confirmed corrections

| case | correction | PDF evidence |
| --- | --- | --- |
| `01-toksic-galogen#20` | `нефротоксичностью` -> `нейротоксичностью` | Page 6 states that methyl bromide has high neurotoxicity. |
| `05-bronhit-hron#22` | changed from multi `[амоксициллин, левофлоксацин]` to single `[левофлоксацин]` | Page 28, table 7: the complicated-exacerbation row lists amoxicillin + clavulanic acid or respiratory fluoroquinolones. Plain amoxicillin and cefixime belong to the uncomplicated row; among the supplied variants only levofloxacin matches. |
| `40-deficit#15` | added `3-гидрокси-3-метилглутаровой кислоты` | Pages 14 and 17 list this acid together with 3-methylglutaconic and adipic acids among the elevated diagnostic metabolites. |
| `43-anomali#2` | added `при неэффективности медикаментозной терапии` | Page 17 gives three biopsy indications in one sentence: age over 40 with abnormal uterine bleeding, younger patients with endometrial-cancer risk factors, or ineffective drug therapy. |
| `46-yazva#6` | added `поясничный отдел позвоночника` | Page 7 states that pain can radiate to the left chest, left scapula, and thoracic or lumbar spine. |
| `49-central-ceroz#6` | removed `расширение слоя хориокапилляров и слоя Саттлера` | Page 6 says the choriocapillaris and Sattler layer are thinned; dilation applies to choroidal vessels, specifically the large Haller-layer vessels. The predictor's three-option set therefore contains one false extra. |

## Deliberately unchanged ambiguous source

`40-deficit#1` was not changed. The narrative on PDF page 7 says that HMG-CoA
lyase produces acetoacetate and acetyl-CoA, while the diagram on the same page
labels the second product as acetoacetyl-CoA. Because the PDF contradicts itself,
this fixture does not meet the audit's unambiguous-source rule.

## Result

- Dataset manifest version: `5`.
- Case fingerprint: `3517fb694ec83e33c1d143e8a9acedc6d79c7a9a72b1d64b1d87f7c4e79a5cbb`.
- Keyed cases: `2,684` (`1,824` single, `860` multi).
- Train: `1072/1541 = 0.6957` (previously `1069/1541`).
- Dev: `415/523 = 0.7935`, unchanged.
- Holdout: `459/540 = 0.8500`, unchanged and above the `0.80` gate.
- External: `64/80 = 0.8000`, unchanged from the frozen baseline.

Validation passed with `npm run dataset:validate`, `npm test`, `npm run
typecheck`, `npm run eval:train`, `npm run eval`, `npm run eval:holdout`, and
`npm run eval:external`.
