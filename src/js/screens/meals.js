import { getState, setState, todayKey, logEvent } from "../state/store.js";
import { navigate, registerRoute, refresh } from "../router.js";
import { FOOD_CATALOG } from "../lib/mockData.js";
import {
  calcMealEntry, sumMealEntries, remainingCalories, macroRatio, hasNutritionGoals,
  validateNutritionGoals, validateCustomFood, validateGrams,
} from "../lib/nutrition.js";
import { el, withBottomNav, renderTopBar, sectionHeading, ICONS } from "../components/widgets.js";
import { showToast } from "../components/overlay.js";
import { updateBackgroundHeat } from "../components/background.js";
import { displayedHeatScore } from "../lib/dayEngine.js";
import { t, getLocale, fmtInt, fmtNumber } from "../i18n/index.js";

const MEAL_GROUPS = ["breakfast", "lunch", "dinner", "snacks"];

function foodName(food) {
  return food.name[getLocale()] ?? food.name["pt-BR"];
}

function foodServing(food) {
  return food.serving?.[getLocale()] ?? food.serving?.["pt-BR"] ?? "";
}

// ---------------- Meals ----------------
function renderMeals() {
  const state = getState();
  updateBackgroundHeat(displayedHeatScore(state));
  const key = todayKey();
  const entries = state.meals[key] ?? [];
  const totals = sumMealEntries(entries);
  const goals = state.nutritionGoals;

  const content = el("div", { class: "screen" });
  content.appendChild(el("h1", { class: "display", text: t("meals.title") }));

  if (!hasNutritionGoals(goals)) {
    // No invented personalized target: ask for the user's own numbers.
    content.appendChild(el("div", { class: "card card-gold", style: "margin-top:var(--space-5)" }, [
      el("h2", { style: "font-size:16px", text: t("meals.noGoalsTitle") }),
      el("p", { class: "lede text-small", style: "margin-top:var(--space-2)", text: t("meals.noGoalsBody") }),
      el("div", { class: "actions", style: "margin-top:var(--space-4)" }, [
        el("button", { class: "btn btn-primary", type: "button", text: t("meals.setGoals"), onClick: () => navigate("/nutrition-goals") }),
      ]),
    ]));
    content.appendChild(el("p", {
      class: "text-small text-secondary mono",
      style: "margin-top:var(--space-5)",
      text: t("meals.consumed", { value: fmtInt(totals.calories) }),
    }));
  } else {
    const remaining = remainingCalories(goals.calories, totals.calories);
    const summary = el("div", { class: "card", style: "margin-top:var(--space-5);text-align:center" }, [
      el("div", { class: "stat-label", text: t("meals.remaining") }),
      el("div", { class: "mono", style: "font-size:38px;color:var(--forged-gold);margin-top:4px", text: fmtInt(remaining) }),
      el("div", { class: "text-micro text-tertiary", style: "margin-top:2px", text: t("meals.ofTarget", { target: fmtInt(goals.calories) }) }),
      el("div", { class: "macro-row", style: "margin-top:var(--space-5)" }, [
        macroRing(t("meals.protein"), totals.protein, goals.protein, "var(--forged-gold)", "P"),
        macroRing(t("meals.carbs"), totals.carbs, goals.carbs, "var(--ember-orange)", "C"),
        macroRing(t("meals.fat"), totals.fat, goals.fat, "var(--forged-gold-dim)", "G"),
      ]),
    ]);
    content.appendChild(summary);
    content.appendChild(el("button", {
      class: "btn-ghost", type: "button", style: "margin-top:var(--space-2)",
      text: t("meals.editGoals"), onClick: () => navigate("/nutrition-goals"),
    }));
  }

  for (const group of MEAL_GROUPS) {
    const groupEntries = entries.filter((entry) => entry.group === group);
    content.appendChild(sectionHeading(t(`meals.groups.${group}`)));
    const panel = el("div", { class: "panel" });

    if (groupEntries.length === 0) {
      panel.appendChild(el("div", { class: "text-small text-tertiary", style: "padding:var(--space-3) 0", text: t("meals.noFood") }));
    } else {
      for (const entry of groupEntries) {
        const row = el("div", { class: "entry-row" }, [
          el("div", { class: "entry-main" }, [
            el("div", { class: "entry-name", text: entry.name }),
            el("div", { class: "entry-meta", text: `${fmtInt(entry.grams)} g · ${t("meals.entrySummary", {
              calories: fmtInt(entry.calories),
              protein: fmtNumber(entry.protein),
              carbs: fmtNumber(entry.carbs),
              fat: fmtNumber(entry.fat),
            })}` }),
          ]),
          el("button", {
            class: "icon-btn",
            type: "button",
            "aria-label": `${t("meals.removeEntry")} — ${entry.name}`,
            html: ICONS.trash,
            onClick: () => removeEntry(key, entry.id),
          }),
        ]);
        panel.appendChild(row);
      }
    }
    content.appendChild(panel);
    content.appendChild(el("button", {
      class: "btn btn-secondary",
      type: "button",
      style: "margin-top:var(--space-3)",
      text: t("meals.addFoodTo", { group: t(`meals.groups.${group}`) }),
      onClick: () => navigate(`/add-food?group=${group}`),
    }));
  }

  content.appendChild(el("p", { class: "text-micro text-tertiary", style: "margin-top:var(--space-8)", text: t("meals.goalsDisclaimer") }));

  return withBottomNav(content, "meals", navigate);
}

function macroRing(label, consumed, target, color, short) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const ratio = macroRatio(consumed, target);
  const wrap = el("div", { class: "macro" });
  wrap.innerHTML = `
    <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label="${label}: ${Math.round(consumed)} / ${Math.round(target ?? 0)} g">
      <circle cx="28" cy="28" r="${radius}" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="6" />
      <circle cx="28" cy="28" r="${radius}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"
        stroke-dasharray="${circumference}" stroke-dashoffset="${circumference - ratio * circumference}"
        transform="rotate(-90 28 28)" />
      <text x="28" y="32" text-anchor="middle" font-size="13" fill="${color}" font-family="JetBrains Mono, monospace">${short}</text>
    </svg>
  `;
  wrap.appendChild(el("div", { class: "macro-label", text: label }));
  wrap.appendChild(el("div", { class: "macro-value mono", text: `${fmtInt(consumed)}/${fmtInt(target ?? 0)} g` }));
  return wrap;
}

function removeEntry(key, entryId) {
  setState((state) => ({
    ...state,
    meals: { ...state.meals, [key]: (state.meals[key] ?? []).filter((entry) => entry.id !== entryId) },
  }));
  showToast(t("toast.deleted"));
  refresh();
}

// ---------------- Nutrition goals ----------------
function renderNutritionGoals() {
  const state = getState();
  const draft = { ...(state.nutritionGoals ?? { calories: "", protein: "", carbs: "", fat: "" }) };
  const screen = el("div", { class: "screen" });
  screen.appendChild(renderTopBar({ title: t("meals.goalsTitle"), onBack: () => navigate("/meals") }));
  screen.appendChild(el("p", { class: "lede text-small", text: t("meals.goalsSub") }));

  const fields = [
    { key: "calories", label: t("meals.dailyCalories") },
    { key: "protein", label: t("meals.dailyProtein") },
    { key: "carbs", label: t("meals.dailyCarbs") },
    { key: "fat", label: t("meals.dailyFat") },
  ];
  const inputs = {};
  const errorEls = {};
  const grid = el("div", { class: "field-grid", style: "margin-top:var(--space-5)" });

  for (const field of fields) {
    const input = el("input", {
      class: "input mono",
      type: "number",
      inputmode: "numeric",
      min: "0",
      id: `nutrition-${field.key}`,
      "data-field": `nutrition-${field.key}`,
      value: draft[field.key] === "" ? "" : String(draft[field.key]),
    });
    const error = el("div", { class: "field-error", style: "display:none" });
    input.addEventListener("input", () => { draft[field.key] = input.value; });
    inputs[field.key] = input;
    errorEls[field.key] = error;
    grid.appendChild(el("div", { class: "field" }, [
      el("label", { class: "field-label", for: `nutrition-${field.key}`, text: field.label }),
      input,
      error,
    ]));
  }
  screen.appendChild(grid);
  screen.appendChild(el("p", { class: "text-micro text-tertiary", text: t("meals.goalsDisclaimer") }));

  screen.appendChild(el("div", { class: "actions" }, [
    el("button", {
      class: "btn btn-primary",
      type: "button",
      text: t("common.save"),
      onClick: () => {
        const candidate = {
          calories: Number(draft.calories),
          protein: Number(draft.protein),
          carbs: Number(draft.carbs),
          fat: Number(draft.fat),
        };
        const { ok, errors } = validateNutritionGoals({
          calories: draft.calories, protein: draft.protein, carbs: draft.carbs, fat: draft.fat,
        });
        for (const field of fields) {
          const errorKey = errors[field.key];
          if (errorKey) {
            inputs[field.key].classList.add("invalid");
            errorEls[field.key].textContent = t(`meals.validation.${errorKey}`);
            errorEls[field.key].style.display = "block";
          } else {
            inputs[field.key].classList.remove("invalid");
            errorEls[field.key].style.display = "none";
          }
        }
        if (!ok) return;
        setState((s) => ({ ...s, nutritionGoals: candidate }));
        logEvent("nutrition_goals_set", candidate);
        showToast(t("toast.saved"));
        navigate("/meals");
      },
    }),
  ]));

  return screen;
}

// ---------------- Add food ----------------
function renderAddFood({ group = "snacks" }) {
  const screen = el("div", { class: "screen" });
  screen.appendChild(renderTopBar({
    title: t("meals.addTitle", { group: t(`meals.groups.${group}`) }),
    onBack: () => navigate("/meals"),
  }));

  const search = el("input", { class: "input", type: "search", placeholder: t("meals.searchPlaceholder"), id: "food-search", "data-field": "food-search" });
  screen.appendChild(el("div", { class: "field" }, [search]));

  const list = el("div", { class: "choice-list" });
  screen.appendChild(list);

  function drawList(filter = "") {
    list.innerHTML = "";
    const matches = FOOD_CATALOG.filter((food) => foodName(food).toLowerCase().includes(filter.toLowerCase()));
    if (matches.length === 0) {
      list.appendChild(el("div", { class: "empty-state", text: t("meals.noMatches") }));
      return;
    }
    for (const food of matches) {
      const card = el("button", { class: "choice", type: "button", style: "flex-direction:column;align-items:flex-start;gap:3px" }, [
        el("strong", { text: foodName(food) }),
        el("span", { class: "text-micro text-tertiary", text: `${foodServing(food)} · ${fmtInt(food.caloriesPer100g)} kcal ${t("meals.per100g")}` }),
      ]);
      card.addEventListener("click", () => openGramEntry(food));
      list.appendChild(card);
    }
  }
  search.addEventListener("input", () => drawList(search.value));
  drawList();

  screen.appendChild(el("button", {
    class: "btn btn-secondary",
    type: "button",
    style: "margin-top:var(--space-5)",
    text: t("meals.customFood"),
    onClick: () => openGramEntry(null),
  }));

  function openGramEntry(food) {
    screen.innerHTML = "";
    screen.appendChild(renderTopBar({
      title: food ? foodName(food) : t("meals.customFood"),
      onBack: () => navigate(`/add-food?group=${group}`),
    }));

    const draft = {
      name: food ? foodName(food) : "",
      grams: 100,
      caloriesPer100g: food ? food.caloriesPer100g : "",
      proteinPer100g: food ? food.proteinPer100g : "",
      carbsPer100g: food ? food.carbsPer100g : "",
      fatPer100g: food ? food.fatPer100g : "",
    };
    const inputs = {};
    const errorEls = {};

    function addField(key, label, parent, { type = "number", inputmode = "decimal" } = {}) {
      const input = el("input", {
        class: type === "number" ? "input mono" : "input",
        type,
        inputmode,
        min: "0",
        id: `food-${key}`,
        "data-field": `food-${key}`,
        value: draft[key] === "" ? "" : String(draft[key]),
      });
      const error = el("div", { class: "field-error", style: "display:none" });
      input.addEventListener("input", () => {
        draft[key] = input.value;
        updatePreview();
      });
      inputs[key] = input;
      errorEls[key] = error;
      parent.appendChild(el("div", { class: "field" }, [
        el("label", { class: "field-label", for: `food-${key}`, text: label }),
        input,
        error,
      ]));
    }

    if (!food) addField("name", t("meals.name"), screen, { type: "text", inputmode: "text" });
    addField("grams", t("meals.grams"), screen);

    if (!food) {
      addField("caloriesPer100g", t("meals.caloriesPer100g"), screen);
      const macroGrid = el("div", { class: "field-grid" });
      addField("proteinPer100g", t("meals.proteinPer100g"), macroGrid);
      addField("carbsPer100g", t("meals.carbsPer100g"), macroGrid);
      addField("fatPer100g", t("meals.fatPer100g"), macroGrid);
      screen.appendChild(macroGrid);
    }

    const preview = el("p", { class: "text-small text-secondary mono" });
    screen.appendChild(preview);

    function computed() {
      const reference = food ?? {
        caloriesPer100g: Number(draft.caloriesPer100g) || 0,
        proteinPer100g: Number(draft.proteinPer100g) || 0,
        carbsPer100g: Number(draft.carbsPer100g) || 0,
        fatPer100g: Number(draft.fatPer100g) || 0,
      };
      return calcMealEntry(reference, Number(draft.grams) || 0);
    }

    function updatePreview() {
      const values = computed();
      preview.textContent = t("meals.entrySummary", {
        calories: fmtInt(values.calories),
        protein: fmtNumber(values.protein),
        carbs: fmtNumber(values.carbs),
        fat: fmtNumber(values.fat),
      });
    }
    updatePreview();

    screen.appendChild(el("div", { class: "actions" }, [
      el("button", {
        class: "btn btn-primary",
        type: "button",
        text: t("meals.addToMeal"),
        onClick: () => {
          let errors = {};
          if (food) {
            const gramsError = validateGrams(draft.grams);
            if (gramsError) errors.grams = gramsError;
          } else {
            errors = validateCustomFood(draft).errors;
          }
          for (const [key, input] of Object.entries(inputs)) {
            const errorKey = errors[key];
            if (errorKey) {
              input.classList.add("invalid");
              errorEls[key].textContent = t(`meals.validation.${errorKey}`);
              errorEls[key].style.display = "block";
            } else {
              input.classList.remove("invalid");
              errorEls[key].style.display = "none";
            }
          }
          if (Object.keys(errors).length) return;

          const values = computed();
          const entry = {
            id: `m_${Date.now()}`,
            name: food ? foodName(food) : draft.name.trim(),
            grams: Number(draft.grams),
            group,
            ...values,
            at: new Date().toISOString(),
          };
          const key = todayKey();
          setState((state) => ({ ...state, meals: { ...state.meals, [key]: [...(state.meals[key] ?? []), entry] } }));
          logEvent("meal_logged", { group, foodId: food?.id ?? "custom" });
          showToast(t("toast.saved"));
          navigate("/meals");
        },
      }),
    ]));
  }

  return screen;
}

export function registerMealsRoutes() {
  registerRoute("/meals", renderMeals);
  registerRoute("/add-food", renderAddFood);
  registerRoute("/nutrition-goals", renderNutritionGoals);
}
