export const DATASET_MANIFEST_VERSION = 2;

/**
 * SHA-256 over sorted `<group>:<pdf-sha256>` rows for the deduplicated local corpus.
 * The individual corpus files remain local, but this fingerprint prevents silent
 * replacement/addition/removal from changing evaluation composition.
 */
export const DATASET_PDF_FINGERPRINT = "688b55d1d015fa0fbbed8b32d080cdee554917d1924b6e6e144c589145cb7345";

/** SHA-256 over stable parsed case tuples, including expected values. */
export const DATASET_CASE_FINGERPRINT = "4df47c865fd6714faa2e037110b93bfda51b3399aded4ecc4ecb311c09badb47";

/**
 * Frozen PDF-level split for the deduplicated local corpus.
 */
export const FROZEN_SPLIT_GROUPS = {
  train: [
    "01-toksic-galogen",
    "02-metanol-glikol",
    "03-chadlv",
    "04-hep-d",
    "05-bronhit-hron",
    "09-covid",
    "10-LPP",
    "12-nos",
    "13-pisha",
    "20-hron",
    "21-citovirus",
    "22-eozif",
    "24-kalit",
    "26-blevota",
    "27-cistit",
    "29-tpank",
    "30-heart",
    "35-cron",
    "36-anrid",
    "37-bazal",
    "38-katarakta",
    "39-glaurova",
    "40-deficit",
    "45-botulizm",
    "46-yazva",
  ],
  dev: [
    "07-hron",
    "08-ask",
    "15-toxic",
    "25-shigez",
    "28-tanzilt",
    "31-hbs",
    "32-gemor",
    "41-destonia",
    "42-skvoz",
  ],
  holdout: [
    "06-co-toksic",
    "11-mening",
    "14-sarkoidoz",
    "17-gepatit",
    "19-gepatitc",
    "23-nimana",
    "33-aorta",
    "43-anomali",
    "44-girshprunga",
  ],
} as const;

export const DATASET_GROUPS = [...FROZEN_SPLIT_GROUPS.train, ...FROZEN_SPLIT_GROUPS.dev, ...FROZEN_SPLIT_GROUPS.holdout].sort(
  (left, right) => left.localeCompare(right, "en"),
);
