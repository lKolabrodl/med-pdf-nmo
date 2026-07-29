export const DATASET_MANIFEST_VERSION = 7;

/**
 * SHA-256 over sorted `<group>:<pdf-sha256>` rows for the deduplicated local corpus.
 * The individual corpus files remain local, but this fingerprint prevents silent
 * replacement/addition/removal from changing evaluation composition.
 */
export const DATASET_PDF_FINGERPRINT = "311bf1cbdec7a6d02d86247f09ee7d62ff0c3167c1c4ef71f1513ff3f0e983c1";

/** SHA-256 over stable parsed case tuples, including expected values. */
export const DATASET_CASE_FINGERPRINT = "f16dead6fec4ed63b500bb2e7c990732611d8d4a6cf80b8d55c2cdd9e47b4cea";

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
  // Added after the original split was frozen. Keep these newer PDFs separate
  // so their transfer result stays visible without moving established groups.
  external: ["48-pereferi", "49-central-ceroz", "50-dr-gepatit", "51-travma"],
} as const;

export const DATASET_GROUPS = [
  ...FROZEN_SPLIT_GROUPS.train,
  ...FROZEN_SPLIT_GROUPS.dev,
  ...FROZEN_SPLIT_GROUPS.holdout,
  ...FROZEN_SPLIT_GROUPS.external,
].sort((left, right) => left.localeCompare(right, "en"));
