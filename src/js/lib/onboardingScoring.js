// Deterministic A/B/C plan selection from onboarding questions 21-25.
// answers21to25: array of 5 values, each one of "A" | "B" | "C".
export function selectPlan(answers21to25) {
  if (!Array.isArray(answers21to25) || answers21to25.length !== 5) {
    throw new Error("selectPlan requires exactly 5 answers (questions 21-25)");
  }

  const scores = { A: 0, B: 0, C: 0 };
  for (const answer of answers21to25) {
    if (answer !== "A" && answer !== "B" && answer !== "C") {
      throw new Error(`Invalid answer "${answer}": must be A, B, or C`);
    }
    scores[answer] += 1;
  }

  const max = Math.max(scores.A, scores.B, scores.C);
  const leaders = ["A", "B", "C"].filter((code) => scores[code] === max);

  // Tie-break: the answer to question 25 (index 4) decides, per spec.
  const tieBreakUsed = leaders.length > 1;
  const selectedPlan = tieBreakUsed ? answers21to25[4] : leaders[0];

  return { selectedPlan, scores, tieBreakUsed };
}
