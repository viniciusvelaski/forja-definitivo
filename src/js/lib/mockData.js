// Local fixtures for the prototype. No network calls, no AI, no paid APIs.
// Anything user-visible carries both locales so no screen ever mixes languages.
import { WEEKDAYS } from "./goals.js";

const EVERY_DAY = [...WEEKDAYS];

// Plan templates define STRUCTURE only; titles come from i18n (plans.<code>.goals[i]).
export const PLAN_TEMPLATES = {
  A: {
    code: "A",
    goals: [
      { titleIndex: 0, category: "routine", type: "binary", reminderTime: "07:00", activeDays: EVERY_DAY, isPrimary: true },
      { titleIndex: 1, category: "study", type: "quantitative", unit: "minutes", targetDisplay: 15, reminderTime: "16:00", activeDays: EVERY_DAY, isPrimary: true },
      { titleIndex: 2, category: "sleep", type: "binary", reminderTime: "22:00", activeDays: EVERY_DAY, isPrimary: true },
    ],
  },
  B: {
    code: "B",
    goals: [
      { titleIndex: 0, category: "routine", type: "binary", reminderTime: null, activeDays: EVERY_DAY, isPrimary: true },
      { titleIndex: 1, category: "study", type: "quantitative", unit: "minutes", targetDisplay: 25, reminderTime: null, activeDays: EVERY_DAY, isPrimary: true },
      { titleIndex: 2, category: "sleep", type: "binary", reminderTime: null, activeDays: EVERY_DAY, isPrimary: true },
    ],
  },
  C: {
    code: "C",
    goals: [
      { titleIndex: 0, category: "routine", type: "binary", reminderTime: "06:30", activeDays: EVERY_DAY, isPrimary: true },
      { titleIndex: 1, category: "study", type: "quantitative", unit: "minutes", targetDisplay: 40, reminderTime: "15:00", activeDays: EVERY_DAY, isPrimary: true },
      { titleIndex: 2, category: "sleep", type: "binary", reminderTime: "21:30", activeDays: EVERY_DAY, isPrimary: true },
    ],
  },
};

// Secondary goals: tracked and editable, but they do not score Forge Heat.
export const PARTIAL_GOAL_TEMPLATES = [
  { id: "water", titleKey: "goal.categories.water", category: "water", type: "quantitative", unit: "ml", targetDisplay: 2000, activeDays: EVERY_DAY, isPrimary: false },
  { id: "movement", titleKey: "goal.categories.gym", category: "gym", type: "quantitative", unit: "minutes", targetDisplay: 20, activeDays: EVERY_DAY, isPrimary: false },
];

export const FOOD_CATALOG = [
  { id: "chicken-breast", name: { "pt-BR": "Peito de frango grelhado", "en-US": "Chicken breast, grilled" }, serving: { "pt-BR": "1 filé ≈ 150 g", "en-US": "1 fillet ≈ 150 g" }, caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 },
  { id: "white-rice", name: { "pt-BR": "Arroz branco cozido", "en-US": "White rice, cooked" }, serving: { "pt-BR": "1 xícara ≈ 160 g", "en-US": "1 cup ≈ 160 g" }, caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3 },
  { id: "beans", name: { "pt-BR": "Feijão carioca cozido", "en-US": "Pinto beans, cooked" }, serving: { "pt-BR": "1 concha ≈ 80 g", "en-US": "1 ladle ≈ 80 g" }, caloriesPer100g: 76, proteinPer100g: 4.8, carbsPer100g: 13.6, fatPer100g: 0.5 },
  { id: "eggs", name: { "pt-BR": "Ovo inteiro cozido", "en-US": "Egg, whole, cooked" }, serving: { "pt-BR": "1 ovo ≈ 50 g", "en-US": "1 egg ≈ 50 g" }, caloriesPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11 },
  { id: "oats", name: { "pt-BR": "Aveia em flocos (crua)", "en-US": "Rolled oats, dry" }, serving: { "pt-BR": "½ xícara ≈ 40 g", "en-US": "½ cup ≈ 40 g" }, caloriesPer100g: 389, proteinPer100g: 16.9, carbsPer100g: 66, fatPer100g: 6.9 },
  { id: "banana", name: { "pt-BR": "Banana", "en-US": "Banana" }, serving: { "pt-BR": "1 média ≈ 118 g", "en-US": "1 medium ≈ 118 g" }, caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3 },
  { id: "greek-yogurt", name: { "pt-BR": "Iogurte grego natural", "en-US": "Greek yogurt, plain" }, serving: { "pt-BR": "1 pote ≈ 130 g", "en-US": "1 cup ≈ 245 g" }, caloriesPer100g: 59, proteinPer100g: 10, carbsPer100g: 3.6, fatPer100g: 0.4 },
  { id: "tapioca", name: { "pt-BR": "Goma de tapioca hidratada", "en-US": "Tapioca starch, hydrated" }, serving: { "pt-BR": "1 disco ≈ 60 g", "en-US": "1 crepe ≈ 60 g" }, caloriesPer100g: 240, proteinPer100g: 0, carbsPer100g: 60, fatPer100g: 0 },
  { id: "almonds", name: { "pt-BR": "Amêndoas", "en-US": "Almonds" }, serving: { "pt-BR": "1 punhado ≈ 28 g", "en-US": "1 handful ≈ 28 g" }, caloriesPer100g: 579, proteinPer100g: 21, carbsPer100g: 22, fatPer100g: 50 },
  { id: "sweet-potato", name: { "pt-BR": "Batata-doce assada", "en-US": "Sweet potato, baked" }, serving: { "pt-BR": "1 média ≈ 130 g", "en-US": "1 medium ≈ 130 g" }, caloriesPer100g: 90, proteinPer100g: 2, carbsPer100g: 21, fatPer100g: 0.1 },
  { id: "salmon", name: { "pt-BR": "Salmão grelhado", "en-US": "Salmon, grilled" }, serving: { "pt-BR": "1 posta ≈ 150 g", "en-US": "1 fillet ≈ 150 g" }, caloriesPer100g: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13 },
  { id: "broccoli", name: { "pt-BR": "Brócolis no vapor", "en-US": "Broccoli, steamed" }, serving: { "pt-BR": "1 xícara ≈ 90 g", "en-US": "1 cup ≈ 90 g" }, caloriesPer100g: 35, proteinPer100g: 2.4, carbsPer100g: 7.2, fatPer100g: 0.4 },
  { id: "whole-bread", name: { "pt-BR": "Pão integral", "en-US": "Whole wheat bread" }, serving: { "pt-BR": "1 fatia ≈ 30 g", "en-US": "1 slice ≈ 30 g" }, caloriesPer100g: 247, proteinPer100g: 13, carbsPer100g: 41, fatPer100g: 3.4 },
  { id: "peanut-butter", name: { "pt-BR": "Pasta de amendoim", "en-US": "Peanut butter" }, serving: { "pt-BR": "1 colher ≈ 16 g", "en-US": "1 tbsp ≈ 16 g" }, caloriesPer100g: 588, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50 },
  { id: "minas-cheese", name: { "pt-BR": "Queijo minas frescal", "en-US": "Fresh white cheese" }, serving: { "pt-BR": "1 fatia ≈ 30 g", "en-US": "1 slice ≈ 30 g" }, caloriesPer100g: 264, proteinPer100g: 17, carbsPer100g: 3, fatPer100g: 20 },
];

export const RESOURCE_CATEGORY_IDS = [
  "digital-marketing", "emotional-regulation", "podcasts", "study", "health", "personal-development",
];

export const RESOURCE_SOURCE_IDS = ["article", "guide", "podcast"];

// Seed list. The admin area edits a persisted copy of this, which is exactly why
// a small protected admin exists: links change without shipping a new build.
export const SEED_RESOURCES = [
  { id: "r1", title: { "pt-BR": "Como montar um sistema de estudo que sobrevive a semanas cheias", "en-US": "Building a study system that survives busy weeks" }, category: "study", durationMin: 8, source: "article", language: "pt-BR", url: "https://example.com/sistema-de-estudo", order: 1, active: true },
  { id: "r2", title: { "pt-BR": "Exercício curto de respiração para ansiedade antes de começar", "en-US": "A short breathing exercise for pre-task anxiety" }, category: "emotional-regulation", durationMin: 5, source: "guide", language: "pt-BR", url: "https://example.com/respiracao", order: 2, active: true },
  { id: "r3", title: { "pt-BR": "Como hábitos compostos funcionam de verdade", "en-US": "How compound habits actually work" }, category: "personal-development", durationMin: 12, source: "article", language: "pt-BR", url: "https://example.com/habitos-compostos", order: 3, active: true },
  { id: "r4", title: { "pt-BR": "Treino de força para iniciantes, três dias por semana", "en-US": "Beginner strength training, three days a week" }, category: "health", durationMin: 10, source: "guide", language: "pt-BR", url: "https://example.com/forca-iniciante", order: 4, active: true },
  { id: "r5", title: { "pt-BR": "Falar dos seus objetivos sem vender ilusão", "en-US": "Talking about your goals without overselling them" }, category: "digital-marketing", durationMin: 9, source: "podcast", language: "pt-BR", url: "https://example.com/objetivos-marketing", order: 5, active: true },
  { id: "r6", title: { "pt-BR": "Podcast de 20 minutos para trabalho profundo", "en-US": "A 20-minute focus podcast for deep work" }, category: "podcasts", durationMin: 20, source: "podcast", language: "pt-BR", url: "https://example.com/trabalho-profundo", order: 6, active: true },
  { id: "r7", title: { "pt-BR": "Higiene do sono: o básico que realmente muda o dia", "en-US": "Sleep hygiene basics that actually move the needle" }, category: "health", durationMin: 7, source: "article", language: "pt-BR", url: "https://example.com/higiene-do-sono", order: 7, active: true },
  { id: "r8", title: { "pt-BR": "Nomear o sentimento antes de reagir a ele", "en-US": "Naming the feeling before reacting to it" }, category: "emotional-regulation", durationMin: 6, source: "guide", language: "pt-BR", url: "https://example.com/nomear-sentimento", order: 8, active: true },
];

// Clearly simulated admin dashboard numbers.
export const ADMIN_MOCK_STATS = {
  totalUsers: 1284,
  trialUsers: 96,
  activeSubs: 412,
  canceledSubs: 58,
  expiredSubs: 121,
};

export const ADMIN_MOCK_SUBSCRIPTIONS = [
  { user: "usuario_0142", planId: "annual", status: "active", renews: "2027-02-14" },
  { user: "usuario_0311", planId: "monthly", status: "trial", renews: "2026-09-09" },
  { user: "usuario_0477", planId: "semiannual", status: "active", renews: "2027-01-03" },
  { user: "usuario_0512", planId: "monthly", status: "canceled", renews: "—" },
  { user: "usuario_0689", planId: "annual", status: "expired", renews: "—" },
];
