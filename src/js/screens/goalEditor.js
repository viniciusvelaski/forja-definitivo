// Create / edit goal. Every field here is wired to state: nothing is decorative.
// Definition fields persist immediately for existing goals (so a value survives
// navigating away and reloading), and the explicit Save action validates the
// whole form before leaving.
import { getState, todayKey, emptyDayLog } from "../state/store.js";
import { navigate, registerRoute, refresh } from "../router.js";
import { WEEKDAYS, GOAL_CATEGORIES, validateGoal, targetDisplay, progressBase, TITLE_MAX_LENGTH } from "../lib/goals.js";
import { UNIT_IDS, unitOf, toBase, fromBase, stepDisplay, convertDisplayValue, suggestedUnitForCategory } from "../lib/units.js";
import { addGoal, updateGoal, deleteGoal, setGoalPaused, setGoalProgress } from "../state/goalActions.js";
import { el, renderTopBar, renderSelect, renderStepper, renderToggle } from "../components/widgets.js";
import { openConfirmDialog, showToast } from "../components/overlay.js";
import { emitSparks, triggerHeatPulse } from "../components/background.js";
import { t } from "../i18n/index.js";

// Survives an in-place refresh so an unsaved new-goal draft is not lost when a
// select or toggle re-renders the screen.
let pendingNewDraft = null;
let pendingUnitNotice = null;

function draftFromGoal(goal) {
  return {
    id: goal.id,
    // A seeded goal shows its title in the interface language until renamed.
    title: goal.titleKey ? t(goal.titleKey) : goal.title,
    category: goal.category,
    type: goal.type,
    unit: goal.unit,
    targetDisplay: targetDisplay(goal),
    activeDays: [...goal.activeDays],
    reminderTime: goal.reminderTime,
    paused: goal.paused,
    isPrimary: goal.isPrimary !== false,
  };
}

function emptyDraft() {
  return {
    id: null,
    title: "",
    category: "routine",
    type: "binary",
    unit: "count",
    targetDisplay: 1,
    activeDays: [...WEEKDAYS],
    reminderTime: null,
    paused: false,
    isPrimary: true,
  };
}

function renderGoalEditor({ id, mode }) {
  const state = getState();
  const existing = id ? state.goals.find((goal) => goal.id === id) : null;
  const isNew = mode === "new" || !existing;
  const draft = existing ? draftFromGoal(existing) : (pendingNewDraft ?? emptyDraft());
  if (isNew) pendingNewDraft = draft;
  else pendingNewDraft = null;
  const unitNotice = pendingUnitNotice;
  pendingUnitNotice = null;

  const screen = el("div", { class: "screen" });
  screen.appendChild(renderTopBar({
    title: isNew ? t("goal.newTitle") : t("goal.editTitle"),
    onBack: () => navigate("/today"),
  }));

  // Persist a definition change right away when editing an existing goal.
  function persist(patch) {
    if (isNew) return;
    updateGoal(draft.id, patch);
  }

  // ---- Title ----
  const titleInput = el("input", {
    class: "input",
    type: "text",
    id: "goal-title",
    "data-field": "goal-title",
    maxlength: String(TITLE_MAX_LENGTH + 20),
    value: draft.title,
    placeholder: t("goal.fieldTitle"),
  });
  const titleError = el("div", { class: "field-error", style: "display:none" });
  titleInput.addEventListener("input", () => {
    draft.title = titleInput.value;
    const trimmed = draft.title.trim();
    if (!trimmed) showFieldError(titleInput, titleError, t("goal.validation.titleRequired"));
    else if (trimmed.length > TITLE_MAX_LENGTH) showFieldError(titleInput, titleError, t("goal.validation.titleTooLong"));
    else {
      clearFieldError(titleInput, titleError);
      persist({ title: trimmed });
    }
  });
  screen.appendChild(el("div", { class: "field" }, [
    el("label", { class: "field-label", for: "goal-title", text: t("goal.fieldTitle") }),
    titleInput,
    titleError,
  ]));

  // ---- Category ----
  screen.appendChild(el("div", { class: "field" }, [
    el("span", { class: "field-label", text: t("goal.fieldCategory") }),
    renderSelect({
      value: draft.category,
      title: t("goal.fieldCategory"),
      options: GOAL_CATEGORIES.map((category) => ({ value: category, label: t(`goal.categories.${category}`) })),
      onChange: (category) => {
        draft.category = category;
        if (draft.type === "quantitative") {
          draft.unit = suggestedUnitForCategory(category);
          persist({ category, unit: draft.unit, targetBase: toBase(draft.targetDisplay, draft.unit) });
        } else {
          persist({ category });
        }
        redraw();
      },
    }),
  ]));

  // ---- Type ----
  screen.appendChild(el("div", { class: "field" }, [
    el("span", { class: "field-label", text: t("goal.fieldType") }),
    renderSelect({
      value: draft.type,
      title: t("goal.fieldType"),
      options: [
        { value: "binary", label: t("goal.typeBinary") },
        { value: "quantitative", label: t("goal.typeQuantitative") },
      ],
      onChange: (type) => {
        draft.type = type;
        if (type === "quantitative" && draft.unit === "count") draft.unit = suggestedUnitForCategory(draft.category);
        persist({ type, unit: draft.unit, targetBase: type === "quantitative" ? toBase(draft.targetDisplay, draft.unit) : 1 });
        redraw();
      },
    }),
  ]));

  // ---- Target + unit (quantitative only) ----
  if (draft.type === "quantitative") {
    const unitDef = unitOf(draft.unit);
    const targetInput = el("input", {
      class: "input mono",
      type: "number",
      inputmode: "decimal",
      min: "0",
      step: String(stepDisplay(draft.unit)),
      id: "goal-target",
      "data-field": "goal-target",
      value: String(draft.targetDisplay),
    });
    const targetError = el("div", { class: "field-error", style: "display:none" });
    targetInput.addEventListener("input", () => {
      const value = Number(targetInput.value);
      draft.targetDisplay = value;
      if (!(value > 0)) {
        showFieldError(targetInput, targetError, t("goal.validation.targetPositive"));
      } else {
        clearFieldError(targetInput, targetError);
        persist({ targetBase: toBase(value, draft.unit) });
      }
    });

    const row = el("div", { class: "field-row" }, [
      el("div", { class: "field" }, [
        el("label", { class: "field-label", for: "goal-target", text: t("goal.fieldTarget") }),
        targetInput,
        targetError,
      ]),
      el("div", { class: "field" }, [
        el("span", { class: "field-label", text: t("goal.fieldUnit") }),
        renderSelect({
          value: draft.unit,
          title: t("goal.fieldUnit"),
          options: UNIT_IDS.map((unitId) => ({ value: unitId, label: t(`goal.units.${unitId}`) })),
          onChange: (nextUnit) => {
            const previousUnit = draft.unit;
            const { value, converted } = convertDisplayValue(draft.targetDisplay, previousUnit, nextUnit);
            draft.unit = nextUnit;
            draft.targetDisplay = value;
            pendingUnitNotice = converted
              ? t("goal.unitConverted", { from: t(`goal.units.${previousUnit}`), to: t(`goal.units.${nextUnit}`) })
              : t("goal.unitBaseChanged");
            persist({ unit: nextUnit, targetBase: toBase(value, nextUnit) });
            redraw();
          },
        }),
      ]),
    ]);
    screen.appendChild(row);
    if (unitNotice) screen.appendChild(el("p", { class: "field-hint", style: "margin:-8px 0 var(--space-4)", text: unitNotice }));

    // ---- Today's progress: slider + numeric + minus/plus, always in sync ----
    if (!isNew) {
      const log = state.dailyLogs[todayKey()] ?? emptyDayLog();
      const currentDisplay = fromBase(progressBase(log, draft.id), draft.unit);
      const labelId = "goal-progress-label";
      const progressLabel = el("span", { class: "field-label", id: labelId, text: t("goal.todayProgress") });

      const stepper = renderStepper({
        value: currentDisplay,
        min: 0,
        max: draft.targetDisplay,
        step: stepDisplay(draft.unit),
        decimals: unitDef.decimals,
        unitLabel: t(`goal.unitsShort.${draft.unit}`),
        labelId,
        onChange: (value) => {
          const result = setGoalProgress(draft.id, toBase(value, draft.unit));
          if (result.completed) {
            emitSparks(stepper, { count: 5 });
            triggerHeatPulse({ strong: result.dayComplete });
          }
        },
      });

      screen.appendChild(el("div", { class: "field" }, [progressLabel, stepper]));
    }
  }

  // ---- Reminder time ----
  const noReminder = draft.reminderTime == null;
  const timeInput = el("input", {
    class: "input",
    type: "time",
    id: "goal-reminder",
    "data-field": "goal-reminder",
    value: draft.reminderTime ?? "",
    disabled: noReminder ? "disabled" : null,
  });
  timeInput.addEventListener("change", () => {
    draft.reminderTime = timeInput.value || null;
    persist({ reminderTime: draft.reminderTime });
  });

  screen.appendChild(el("div", { class: "field" }, [
    el("label", { class: "field-label", for: "goal-reminder", text: t("goal.reminder") }),
    timeInput,
    el("div", { class: "settings-row", style: "padding-top:var(--space-2);min-height:auto" }, [
      el("span", { class: "settings-row-desc", text: t("goal.noReminder") }),
      renderToggle(noReminder, (on) => {
        draft.reminderTime = on ? null : "08:00";
        persist({ reminderTime: draft.reminderTime });
        redraw();
      }, { label: t("goal.noReminder") }),
    ]),
  ]));

  // ---- Active days ----
  const daysError = el("div", { class: "field-error", style: "display:none" });
  const dayRow = el("div", { class: "pill-row", role: "group", "aria-label": t("goal.activeDays") });
  WEEKDAYS.forEach((day) => {
    const selected = draft.activeDays.includes(day);
    const chip = el("button", {
      class: `pill${selected ? " pill-active" : ""}`,
      type: "button",
      role: "checkbox",
      "aria-checked": String(selected),
      text: t(`goal.weekdays.${day}`),
    });
    chip.addEventListener("click", () => {
      const isOn = draft.activeDays.includes(day);
      const next = isOn ? draft.activeDays.filter((item) => item !== day) : [...draft.activeDays, day];
      if (next.length === 0) {
        daysError.textContent = t("goal.validation.daysRequired");
        daysError.style.display = "block";
        return;
      }
      draft.activeDays = WEEKDAYS.filter((item) => next.includes(item));
      daysError.style.display = "none";
      // Immediate visual feedback, then persistence.
      chip.classList.toggle("pill-active", !isOn);
      chip.setAttribute("aria-checked", String(!isOn));
      persist({ activeDays: draft.activeDays });
    });
    dayRow.appendChild(chip);
  });

  screen.appendChild(el("div", { class: "field" }, [
    el("span", { class: "field-label", text: t("goal.activeDays") }),
    dayRow,
    el("div", { class: "field-hint", text: t("goal.activeDaysHint") }),
    daysError,
  ]));

  // ---- Scoring ----
  screen.appendChild(el("div", { class: "panel", style: "margin-bottom:var(--space-5)" }, [
    el("div", { class: "settings-row" }, [
      el("div", { class: "settings-row-main" }, [
        el("div", { class: "settings-row-label", text: t("goal.countsTowardHeat") }),
        el("div", { class: "settings-row-desc", text: t("goal.countsTowardHeatDesc") }),
      ]),
      renderToggle(draft.isPrimary, (on) => {
        draft.isPrimary = on;
        persist({ isPrimary: on });
      }, { label: t("goal.countsTowardHeat") }),
    ]),
  ]));

  // ---- Actions ----
  const actions = el("div", { class: "actions" });
  actions.appendChild(el("button", {
    class: "btn btn-primary",
    type: "button",
    text: isNew ? t("common.add") : t("common.saveChanges"),
    onClick: () => save(),
  }));

  if (!isNew) {
    actions.appendChild(el("button", {
      class: "btn btn-secondary",
      type: "button",
      text: draft.paused ? t("goal.resumeGoal") : t("goal.pauseGoal"),
      onClick: () => {
        setGoalPaused(draft.id, !draft.paused);
        showToast(t(draft.paused ? "toast.goalResumed" : "toast.goalPaused"));
        navigate("/today");
      },
    }));
    actions.appendChild(el("button", {
      class: "btn btn-danger",
      type: "button",
      text: t("goal.deleteGoal"),
      onClick: () => {
        openConfirmDialog({
          title: t("goal.deleteConfirmTitle"),
          body: t("goal.deleteConfirmBody"),
          confirmLabel: t("common.delete"),
          danger: true,
          onConfirm: () => {
            deleteGoal(draft.id);
            showToast(t("toast.deleted"));
            navigate("/today");
          },
        });
      },
    }));
  }
  screen.appendChild(actions);

  function save() {
    const candidate = {
      title: draft.title.trim(),
      activeDays: draft.activeDays,
      type: draft.type,
      targetBase: draft.type === "quantitative" ? toBase(draft.targetDisplay, draft.unit) : 1,
    };
    const { ok, errors: validation } = validateGoal(candidate);
    if (!ok) {
      if (validation.title) showFieldError(titleInput, titleError, t(`goal.validation.${validation.title}`));
      if (validation.activeDays) {
        daysError.textContent = t("goal.validation.daysRequired");
        daysError.style.display = "block";
      }
      if (validation.target) {
        const targetField = screen.querySelector('[data-field="goal-target"]');
        if (targetField) targetField.classList.add("invalid");
      }
      return;
    }

    if (isNew) {
      addGoal({
        title: candidate.title,
        category: draft.category,
        type: draft.type,
        unit: draft.unit,
        targetDisplay: draft.targetDisplay,
        activeDays: draft.activeDays,
        reminderTime: draft.reminderTime,
        isPrimary: draft.isPrimary,
      });
      pendingNewDraft = null;
      showToast(t("toast.goalAdded"));
    } else {
      updateGoal(draft.id, {
        title: candidate.title,
        category: draft.category,
        type: draft.type,
        unit: draft.unit,
        targetBase: candidate.targetBase,
        activeDays: draft.activeDays,
        reminderTime: draft.reminderTime,
        isPrimary: draft.isPrimary,
      });
      showToast(t("toast.saved"));
    }
    navigate("/today");
  }

  function redraw() {
    refresh();
  }

  return screen;
}

function showFieldError(input, errorEl, message) {
  input.classList.add("invalid");
  errorEl.textContent = message;
  errorEl.style.display = "block";
}

function clearFieldError(input, errorEl) {
  input.classList.remove("invalid");
  errorEl.style.display = "none";
}

export function registerGoalEditorRoutes() {
  registerRoute("/goal", renderGoalEditor);
}
