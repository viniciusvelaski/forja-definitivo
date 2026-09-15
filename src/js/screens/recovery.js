// Recovery Support: multiple private goals, milestones, badges, and sharing
// that is always explicit and always previewed before anything leaves the app.
import { getState, setState, logEvent } from "../state/store.js";
import { navigate, registerRoute, refresh } from "../router.js";
import {
  RECOVERY_CATEGORY_IDS, MILESTONE_OPTIONS, BADGE_THRESHOLDS,
  createRecoveryGoal, validateRecoveryGoal, milestoneStatus, claimMilestone,
  activeGoals, archivedGoals,
} from "../lib/recoveryRules.js";
import { el, withBottomNav, renderTopBar, renderSelect, sectionHeading, ICONS } from "../components/widgets.js";
import { openConfirmDialog, openSheet, showToast } from "../components/overlay.js";
import { share, canShareNatively } from "../platform/native.js";
import { t, tPlural, fmtInt } from "../i18n/index.js";

function goalLabel(goal) {
  return goal.category === "custom" && goal.customLabel ? goal.customLabel : t(`recovery.categories.${goal.category}`);
}

// ---------------- List ----------------
function renderRecoveryList() {
  const state = getState();
  const goals = state.recoveryGoals ?? [];
  const active = activeGoals(goals);
  const archived = archivedGoals(goals);

  const content = el("div", { class: "screen" });
  content.appendChild(el("h1", { class: "display", text: t("recovery.title") }));
  content.appendChild(el("p", { class: "lede text-small", style: "margin-top:var(--space-3)", text: t("recovery.disclaimer") }));

  content.appendChild(el("div", { class: "actions", style: "margin-top:var(--space-5)" }, [
    el("button", {
      class: "btn btn-primary", type: "button", text: t("recovery.addGoal"),
      onClick: () => navigate("/recovery-edit?mode=new"),
    }),
  ]));

  if (!active.length && !archived.length) {
    content.appendChild(el("div", { class: "empty-state", text: t("recovery.empty") }));
    return withBottomNav(content, "profile", navigate);
  }

  if (active.length) {
    content.appendChild(sectionHeading(t("recovery.activeGoals")));
    content.appendChild(goalPanel(active));
  }
  if (archived.length) {
    content.appendChild(sectionHeading(t("recovery.archivedGoals")));
    content.appendChild(goalPanel(archived, { archived: true }));
  }

  return withBottomNav(content, "profile", navigate);
}

function goalPanel(goals, { archived = false } = {}) {
  const panel = el("div", { class: "panel" });
  for (const goal of goals) {
    const status = milestoneStatus(goal);
    panel.appendChild(el("button", {
      class: "row-button",
      type: "button",
      onClick: () => navigate(`/recovery-goal?id=${goal.id}`),
    }, [
      el("span", { style: "min-width:0" }, [
        el("span", { class: "text-micro text-tertiary", style: "display:block;text-transform:uppercase;letter-spacing:0.08em", text: goalLabel(goal) }),
        el("span", { style: "display:block;margin-top:3px", text: goal.positiveGoal }),
        el("span", {
          class: "settings-row-desc mono",
          text: archived ? t("common.paused") : tPlural("recovery.daysCount", status.elapsed),
        }),
      ]),
      el("span", { class: "row-chevron", html: ICONS.chevronRight }),
    ]));
  }
  return panel;
}

// ---------------- Detail ----------------
function renderRecoveryDetail({ id }) {
  const state = getState();
  const goal = (state.recoveryGoals ?? []).find((item) => item.id === id);
  const screen = el("div", { class: "screen" });
  screen.appendChild(renderTopBar({
    title: t("recovery.title"),
    onBack: () => navigate("/recovery"),
    right: el("button", {
      class: "icon-btn", type: "button", "aria-label": t("common.edit"),
      html: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
      onClick: () => navigate(`/recovery-edit?id=${id}`),
    }),
  }));

  if (!goal) {
    screen.appendChild(el("div", { class: "empty-state", text: t("recovery.empty") }));
    return screen;
  }

  const status = milestoneStatus(goal);

  screen.appendChild(el("div", { class: "card card-elevated" }, [
    el("div", { class: "eyebrow", text: goalLabel(goal) }),
    el("div", { style: "font-size:16px;margin-top:6px", text: goal.positiveGoal }),
    el("div", { class: "mono text-gold", style: "font-size:26px;margin-top:var(--space-4)", text: tPlural("recovery.daysCount", status.elapsed) }),
    el("div", { class: "text-micro text-tertiary", text: status.ready ? t("recovery.milestoneReady") : t("recovery.nextBadge", { days: fmtInt(status.daysToNext) }) }),
  ]));

  if (status.ready && !goal.archived) {
    screen.appendChild(el("button", {
      class: "btn btn-primary",
      type: "button",
      style: "margin-top:var(--space-4)",
      text: t("recovery.claim"),
      onClick: () => {
        setState((s) => ({
          ...s,
          recoveryGoals: s.recoveryGoals.map((item) => (item.id === goal.id ? claimMilestone(item) : item)),
        }));
        logEvent("recovery_milestone_reached", { id: goal.id });
        showToast(t("toast.saved"));
        refresh();
      },
    }));
  }

  screen.appendChild(sectionHeading(t("recovery.badges")));
  const badges = el("div", { class: "badge-grid" });
  for (const badge of BADGE_THRESHOLDS) {
    const unlocked = (goal.badges ?? []).includes(badge.id);
    badges.appendChild(el("div", {
      class: `badge-seal${unlocked ? "" : " locked"}`,
      title: unlocked ? t(`recovery.badgeDescriptions.${badge.id}`) : t("recovery.badgeLocked"),
      "aria-label": `${t(`recovery.badgeNames.${badge.id}`)} — ${unlocked ? t(`recovery.badgeDescriptions.${badge.id}`) : t("recovery.badgeLocked")}`,
    }, [el("span", { text: t(`recovery.badgeNames.${badge.id}`) })]));
  }
  screen.appendChild(badges);

  screen.appendChild(sectionHeading(t("recovery.sharing")));
  screen.appendChild(el("p", { class: "text-micro text-tertiary", text: t("recovery.sharingNote") }));
  screen.appendChild(el("button", {
    class: "btn btn-secondary",
    type: "button",
    style: "margin-top:var(--space-3)",
    text: t("recovery.shareCard"),
    onClick: () => openShareSheet(goal, status),
  }));

  screen.appendChild(el("div", { class: "actions" }, [
    el("button", {
      class: "btn btn-quiet",
      type: "button",
      text: goal.archived ? t("common.unarchive") : t("common.archive"),
      onClick: () => {
        if (goal.archived) {
          setArchived(goal.id, false);
          showToast(t("toast.restored"));
          refresh();
          return;
        }
        openConfirmDialog({
          title: t("recovery.archiveConfirmTitle"),
          body: t("recovery.archiveConfirmBody"),
          confirmLabel: t("common.archive"),
          onConfirm: () => {
            setArchived(goal.id, true);
            showToast(t("toast.archived"));
            navigate("/recovery");
          },
        });
      },
    }),
    el("button", {
      class: "btn btn-danger",
      type: "button",
      text: t("common.delete"),
      onClick: () => openConfirmDialog({
        title: t("recovery.deleteConfirmTitle"),
        body: t("recovery.deleteConfirmBody"),
        confirmLabel: t("common.delete"),
        danger: true,
        onConfirm: () => {
          setState((s) => ({ ...s, recoveryGoals: s.recoveryGoals.filter((item) => item.id !== goal.id) }));
          logEvent("recovery_goal_deleted", { id: goal.id });
          showToast(t("toast.deleted"));
          navigate("/recovery");
        },
      }),
    }),
  ]));

  return screen;
}

function setArchived(id, archived) {
  setState((state) => ({
    ...state,
    recoveryGoals: state.recoveryGoals.map((goal) => (goal.id === id ? { ...goal, archived } : goal)),
  }));
}

// ---------------- Share ----------------
function shareText(goal, status) {
  return `${t("recovery.shareCardTitle")}\n${tPlural("recovery.daysCount", status.elapsed)} — ${goal.positiveGoal}`;
}

function openShareSheet(goal, status) {
  openSheet({
    title: t("recovery.sharePreviewTitle"),
    buildBody: (body, close) => {
      // Preview exactly what leaves the app: no private category, no notes.
      body.appendChild(el("div", { class: "share-card" }, [
        el("div", { class: "eyebrow text-gold", text: t("recovery.shareCardTitle") }),
        el("div", { class: "share-card-days mono", style: "margin-top:var(--space-3)", text: tPlural("recovery.daysCount", status.elapsed) }),
        el("div", { class: "text-small", style: "margin-top:var(--space-2)", text: goal.positiveGoal }),
      ]));
      body.appendChild(el("p", { class: "text-micro text-tertiary", style: "margin-top:var(--space-3)", text: t("recovery.sharePreviewNote") }));

      const actions = el("div", { class: "actions" });
      const canShare = canShareNatively();

      actions.appendChild(el("button", {
        class: "btn btn-primary",
        type: "button",
        text: t("recovery.shareNow"),
        disabled: canShare ? null : "disabled",
        onClick: async () => {
          // Uses the device share sheet on native, the Web Share API otherwise.
          const result = await share({ title: t("recovery.shareCardTitle"), text: shareText(goal, status) });
          if (result === "native") {
            logEvent("recovery_shared", { id: goal.id, method: "share-sheet" });
            close();
          }
        },
      }));

      // Fallbacks for devices without the Web Share API.
      actions.appendChild(el("button", {
        class: "btn btn-secondary",
        type: "button",
        text: t("recovery.shareCopy"),
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(shareText(goal, status));
          } catch {
            const helper = document.createElement("textarea");
            helper.value = shareText(goal, status);
            document.body.appendChild(helper);
            helper.select();
            document.execCommand("copy");
            helper.remove();
          }
          logEvent("recovery_shared", { id: goal.id, method: "copy" });
          showToast(t("recovery.shareCopied"));
          close();
        },
      }));

      // Hidden only where the host blocks page-initiated downloads (the shared
      // single-file build sets this flag); locally the download works.
      if (window.__FORJA_SHARE_DOWNLOAD__ !== false) {
        actions.appendChild(el("button", {
          class: "btn btn-secondary",
          type: "button",
          text: t("recovery.shareDownload"),
          onClick: () => {
            downloadShareCard(goal, status);
            logEvent("recovery_shared", { id: goal.id, method: "download" });
            close();
          },
        }));
      }

      if (!canShare) {
        actions.appendChild(el("p", { class: "text-micro text-tertiary", text: t("recovery.shareUnavailable") }));
      }
      body.appendChild(actions);
    },
  });
}

function downloadShareCard(goal, status) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0A0A0C";
  ctx.fillRect(0, 0, 1080, 1080);
  const gradient = ctx.createRadialGradient(540, 300, 40, 540, 300, 700);
  gradient.addColorStop(0, "rgba(255,90,31,0.22)");
  gradient.addColorStop(1, "rgba(255,90,31,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.strokeStyle = "rgba(232,176,75,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(60, 60, 960, 960);

  ctx.textAlign = "center";
  ctx.fillStyle = "#E8B04B";
  ctx.font = "600 34px Oswald, Arial, sans-serif";
  ctx.fillText(t("recovery.shareCardTitle").toUpperCase(), 540, 300);

  ctx.fillStyle = "#F4F1EA";
  ctx.font = "600 150px 'JetBrains Mono', monospace";
  ctx.fillText(String(status.elapsed), 540, 560);

  ctx.fillStyle = "#A9A49A";
  ctx.font = "400 44px 'Source Sans 3', Arial, sans-serif";
  ctx.fillText(tPlural("recovery.daysCount", status.elapsed), 540, 630);

  ctx.fillStyle = "#F4F1EA";
  ctx.font = "400 40px 'Source Sans 3', Arial, sans-serif";
  wrapText(ctx, goal.positiveGoal, 540, 760, 820, 52);

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "forja-marco.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = candidate;
    }
  }
  ctx.fillText(line, x, currentY);
}

// ---------------- Create / edit ----------------
let pendingRecoveryDraft = null;

function renderRecoveryEditor({ id, mode }) {
  const state = getState();
  const existing = id ? (state.recoveryGoals ?? []).find((goal) => goal.id === id) : null;
  const isNew = mode === "new" || !existing;
  const draft = existing
    ? { ...existing }
    : (pendingRecoveryDraft ?? { category: "screen", customLabel: "", positiveGoal: "", milestoneScheduleId: "7d" });
  if (isNew) pendingRecoveryDraft = draft;
  else pendingRecoveryDraft = null;

  const screen = el("div", { class: "screen" });
  screen.appendChild(renderTopBar({
    title: isNew ? t("recovery.newGoal") : t("recovery.editGoal"),
    onBack: () => navigate(isNew ? "/recovery" : `/recovery-goal?id=${id}`),
  }));

  screen.appendChild(el("div", { class: "field" }, [
    el("span", { class: "field-label", text: t("recovery.category") }),
    renderSelect({
      value: draft.category,
      title: t("recovery.category"),
      options: RECOVERY_CATEGORY_IDS.map((category) => ({ value: category, label: t(`recovery.categories.${category}`) })),
      onChange: (category) => { draft.category = category; refresh(); },
    }),
  ]));

  const labelInput = el("input", {
    class: "input", type: "text", id: "recovery-label", "data-field": "recovery-label",
    value: draft.customLabel ?? "",
  });
  const labelError = el("div", { class: "field-error", style: "display:none" });
  labelInput.addEventListener("input", () => { draft.customLabel = labelInput.value; });
  screen.appendChild(el("div", { class: "field" }, [
    el("label", { class: "field-label", for: "recovery-label", text: t("recovery.customLabel") }),
    labelInput,
    labelError,
  ]));

  const goalInput = el("input", {
    class: "input", type: "text", id: "recovery-goal-input", "data-field": "recovery-goal-input",
    placeholder: t("recovery.positiveGoalPlaceholder"),
    value: draft.positiveGoal ?? "",
  });
  const goalError = el("div", { class: "field-error", style: "display:none" });
  goalInput.addEventListener("input", () => { draft.positiveGoal = goalInput.value; });
  screen.appendChild(el("div", { class: "field" }, [
    el("label", { class: "field-label", for: "recovery-goal-input", text: t("recovery.positiveGoal") }),
    goalInput,
    goalError,
  ]));

  screen.appendChild(el("div", { class: "field" }, [
    el("span", { class: "field-label", text: t("recovery.milestoneInterval") }),
    renderSelect({
      value: draft.milestoneScheduleId,
      title: t("recovery.milestoneInterval"),
      options: MILESTONE_OPTIONS.map((option) => ({ value: option.id, label: t(`recovery.milestones.${option.id}`) })),
      onChange: (value) => { draft.milestoneScheduleId = value; refresh(); },
    }),
  ]));

  screen.appendChild(el("div", { class: "actions" }, [
    el("button", {
      class: "btn btn-primary",
      type: "button",
      text: isNew ? t("recovery.createGoal") : t("common.saveChanges"),
      onClick: () => {
        const { ok, errors } = validateRecoveryGoal(draft);
        goalError.style.display = errors.positiveGoal ? "block" : "none";
        goalError.textContent = errors.positiveGoal ? t(`recovery.validation.${errors.positiveGoal}`) : "";
        goalInput.classList.toggle("invalid", Boolean(errors.positiveGoal));
        labelError.style.display = errors.customLabel ? "block" : "none";
        labelError.textContent = errors.customLabel ? t(`recovery.validation.${errors.customLabel}`) : "";
        labelInput.classList.toggle("invalid", Boolean(errors.customLabel));
        if (!ok) return;

        if (isNew) {
          const goal = createRecoveryGoal(draft);
          setState((s) => ({ ...s, recoveryGoals: [...(s.recoveryGoals ?? []), goal] }));
          pendingRecoveryDraft = null;
          logEvent("recovery_goal_created", { category: goal.category });
        } else {
          setState((s) => ({
            ...s,
            recoveryGoals: s.recoveryGoals.map((goal) => (goal.id === id
              ? { ...goal, category: draft.category, customLabel: draft.customLabel.trim(), positiveGoal: draft.positiveGoal.trim(), milestoneScheduleId: draft.milestoneScheduleId }
              : goal)),
          }));
        }
        showToast(t("toast.saved"));
        navigate("/recovery");
      },
    }),
  ]));

  return screen;
}

export function registerRecoveryRoutes() {
  registerRoute("/recovery", renderRecoveryList);
  registerRoute("/recovery-goal", renderRecoveryDetail);
  registerRoute("/recovery-edit", renderRecoveryEditor);
}
