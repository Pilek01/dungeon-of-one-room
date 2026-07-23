export function normalizeFinalScore(value) {
  const score = Number(value);
  if (!Number.isSafeInteger(score) || score < 0) {
    throw new TypeError("RULESET_SCORE_INVALID");
  }
  return score;
}
