// Sheets, dialogs and toasts. They mount into #overlay-root INSIDE the app
// frame, so they can never escape the mobile viewport or sit under the nav.
import { t } from "../i18n/index.js";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function overlayRoot() {
  return document.getElementById("overlay-root");
}

function trapFocus(container, event) {
  const items = [...container.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.offsetParent !== null);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function mountOverlay(buildContent, { onClose, labelledBy } = {}) {
  const root = overlayRoot();
  const previousFocus = document.activeElement;

  const backdrop = document.createElement("div");
  backdrop.className = "overlay-backdrop";

  const container = document.createElement("div");
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-modal", "true");
  if (labelledBy) container.setAttribute("aria-labelledby", labelledBy);

  function close() {
    document.removeEventListener("keydown", onKeyDown, true);
    backdrop.remove();
    container.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
    onClose?.();
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      trapFocus(container, event);
    }
  }

  buildContent(container, close);
  backdrop.addEventListener("click", close);
  root.appendChild(backdrop);
  root.appendChild(container);
  document.addEventListener("keydown", onKeyDown, true);

  const focusTarget = container.querySelector("[data-autofocus]") ?? container.querySelector(FOCUSABLE);
  focusTarget?.focus();

  return { close, container };
}

export function openSheet({ title, buildBody, onClose }) {
  const titleId = `sheet-title-${Date.now()}`;
  return mountOverlay((container, close) => {
    container.className = "sheet";
    const header = document.createElement("div");
    header.className = "sheet-header";
    header.innerHTML = `<span class="sheet-title" id="${titleId}"></span>`;
    header.querySelector(".sheet-title").textContent = title;

    const closeBtn = document.createElement("button");
    closeBtn.className = "icon-btn";
    closeBtn.setAttribute("aria-label", t("common.close"));
    closeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
    closeBtn.addEventListener("click", close);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "sheet-body";
    buildBody(body, close);

    container.appendChild(header);
    container.appendChild(body);
  }, { onClose, labelledBy: titleId });
}

// Styled replacement for native <select>: keyboard accessible, inside the frame.
export function openSelectSheet({ title, options, value, onSelect }) {
  openSheet({
    title,
    buildBody: (body, close) => {
      const list = document.createElement("div");
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", title);

      options.forEach((option) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "sheet-option";
        item.setAttribute("role", "option");
        const selected = option.value === value;
        item.setAttribute("aria-selected", String(selected));
        if (selected) item.setAttribute("data-autofocus", "true");

        const label = document.createElement("span");
        label.textContent = option.label;
        if (option.description) {
          const desc = document.createElement("span");
          desc.className = "settings-row-desc";
          desc.textContent = option.description;
          const stack = document.createElement("span");
          stack.appendChild(label);
          stack.appendChild(desc);
          item.appendChild(stack);
        } else {
          item.appendChild(label);
        }

        if (selected) {
          const check = document.createElement("span");
          check.className = "sheet-option-check";
          check.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
          item.appendChild(check);
        }

        item.addEventListener("click", () => {
          close();
          onSelect(option.value);
        });
        list.appendChild(item);
      });

      // Arrow-key navigation between options.
      list.addEventListener("keydown", (event) => {
        const items = [...list.querySelectorAll(".sheet-option")];
        const index = items.indexOf(document.activeElement);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const next = items[(index + delta + items.length) % items.length];
          next?.focus();
        }
      });

      body.appendChild(list);
    },
  });
}

export function openConfirmDialog({ title, body, confirmLabel, cancelLabel, danger = false, onConfirm }) {
  const titleId = `dialog-title-${Date.now()}`;
  mountOverlay((container, close) => {
    container.className = "dialog";
    const heading = document.createElement("h2");
    heading.id = titleId;
    heading.textContent = title;

    const text = document.createElement("p");
    text.className = "lede text-small";
    text.textContent = body;

    const actions = document.createElement("div");
    actions.className = "btn-row";
    actions.style.marginTop = "var(--space-5)";

    const cancel = document.createElement("button");
    cancel.className = "btn btn-quiet";
    cancel.textContent = cancelLabel ?? t("common.cancel");
    cancel.setAttribute("data-autofocus", "true");
    cancel.addEventListener("click", close);

    const confirm = document.createElement("button");
    confirm.className = `btn ${danger ? "btn-danger" : "btn-primary"}`;
    confirm.textContent = confirmLabel ?? t("common.confirm");
    confirm.addEventListener("click", () => {
      close();
      onConfirm();
    });

    actions.appendChild(cancel);
    actions.appendChild(confirm);
    container.appendChild(heading);
    container.appendChild(text);
    container.appendChild(actions);
  }, { labelledBy: titleId });
}

let toastTimer = null;
export function showToast(message) {
  const root = overlayRoot();
  root.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  root.appendChild(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.remove(), 2400);
}

export function closeAllOverlays() {
  const root = overlayRoot();
  if (root) root.innerHTML = "";
}
