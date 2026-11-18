# Quoted continuation

For a single-answer question, look for its final five words in the extracted
PDF. The sequence must occur exactly once, and exactly one full answer must
follow it on the same page. A colon or dash may separate the two. Decimal
values, punctuation, negation and comparison signs participate in the match.
The resolver abstains if a leading dash could be a numeric minus sign.
Questions containing a marked blank are skipped.

The processor runs after the other adjustments. If the existing selector
disagrees with the quote, it promotes the matching answer above the configured
specificity tie band and records the page and normalized phrase as evidence.
The `quotedContinuation` configuration flag controls this behavior.
