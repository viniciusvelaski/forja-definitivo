// Onboarding structure only — every visible string lives in the i18n layer.
// Answers are stored as stable values (option index for profile questions, plan
// letter for questions 21-25) so switching language never corrupts saved state.

export const PROFILE_QUESTIONS = [
  { id: 1, options: 4 }, { id: 2, options: 4 }, { id: 3, options: 4 }, { id: 4, options: 4 },
  { id: 5, options: 4 }, { id: 6, options: 4 }, { id: 7, options: 4 }, { id: 8, options: 4 },
  { id: 9, options: 4 }, { id: 10, options: 4 }, { id: 11, options: 4 }, { id: 12, options: 4 },
  { id: 13, options: 4 }, { id: 14, options: 4 }, { id: 15, options: 4 }, { id: 16, options: 4 },
  { id: 17, options: 4 }, { id: 18, options: 4 }, { id: 19, options: 3 }, { id: 20, options: 4 },
];

// Questions 21-25 are the only inputs to the A/B/C plan-selection score.
export const PLAN_QUESTIONS = [
  { id: 21, plans: ["A", "B", "C"] },
  { id: 22, plans: ["A", "B", "C"] },
  { id: 23, plans: ["A", "B", "C"] },
  { id: 24, plans: ["A", "B", "C"] },
  { id: 25, plans: ["A", "B", "C"] },
];

export const TOTAL_QUESTIONS = PROFILE_QUESTIONS.length + PLAN_QUESTIONS.length;

export const REMINDER_FREQUENCIES = ["essential", "morning_evening", "each_goal", "none"];
export const REMINDER_TONES = ["direct", "encouraging", "neutral", "mixed"];
export const FAITH_ANSWERS = ["occasional", "frequent", "none"];
const Q20_TO_RESOURCE_CATEGORY = ["health", "study", "emotional-regulation", "personal-development"];

export function questionAt(index) {
  if (index < PROFILE_QUESTIONS.length) {
    return { kind: "profile", question: PROFILE_QUESTIONS[index] };
  }
  return { kind: "plan", question: PLAN_QUESTIONS[index - PROFILE_QUESTIONS.length] };
}

// Maps questions 17-20 to the stable preference values the app actually uses.
export function derivePreferences(answers) {
  const frequencyIndex = answers[17];
  const toneIndex = answers[18];
  const faithIndex = answers[19];
  const areaIndex = answers[20];
  return {
    reminderFrequency: REMINDER_FREQUENCIES[frequencyIndex] ?? "morning_evening",
    reminderTone: REMINDER_TONES[toneIndex] ?? "direct",
    faithOptIn: faithIndex !== undefined && FAITH_ANSWERS[faithIndex] !== "none",
    preferredResourceCategory: Q20_TO_RESOURCE_CATEGORY[areaIndex] ?? "study",
  };
}

export function planAnswersFrom(answers) {
  return PLAN_QUESTIONS.map((question) => answers[question.id]);
}

export function isComplete(answers) {
  return [...PROFILE_QUESTIONS, ...PLAN_QUESTIONS].every((question) => answers[question.id] !== undefined);
}
