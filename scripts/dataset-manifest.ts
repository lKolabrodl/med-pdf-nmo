export const DATASET_MANIFEST_VERSION = 6;

/**
 * SHA-256 over sorted `<group>:<pdf-sha256>` rows for the deduplicated local corpus.
 * The individual corpus files remain local, but this fingerprint prevents silent
 * replacement/addition/removal from changing evaluation composition.
 */
export const DATASET_PDF_FINGERPRINT = "97babb222308b6cfd88cdaf2854bfffabe190ef696075db95a4a3109fb6f5f22";

/** SHA-256 over stable parsed case tuples, including expected values. */
export const DATASET_CASE_FINGERPRINT = "538a4c48ee220f79cd71d9044e5d65f476e6cb2e60c39b82baa09ff94ffc295c";

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
  external: ["48-pereferi", "49-central-ceroz", "50-dr-gepatit"],
} as const;

export const DATASET_GROUPS = [
  ...FROZEN_SPLIT_GROUPS.train,
  ...FROZEN_SPLIT_GROUPS.dev,
  ...FROZEN_SPLIT_GROUPS.holdout,
  ...FROZEN_SPLIT_GROUPS.external,
].sort((left, right) => left.localeCompare(right, "en"));
