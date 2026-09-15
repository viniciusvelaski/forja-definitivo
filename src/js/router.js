// Minimal hash router with in-place refresh.
// refresh() re-renders the current screen while preserving scroll position and
// keyboard focus, which is what lets every control show new state immediately
// instead of waiting for a reload.
const routes = new Map();
let rootEl = null;
let notFoundRender = null;
let guard = null;

// A guard may redirect before a screen renders (entitlement / onboarding state).
export function setGuard(fn) {
  guard = fn;
}

export function registerRoute(path, render) {
  routes.set(path, render);
}

export function setNotFound(render) {
  notFoundRender = render;
}

export function currentPath() {
  return location.hash.slice(1) || "/welcome";
}

export function navigate(path) {
  if (currentPath() === path) {
    refresh();
    return;
  }
  location.hash = path;
}

export function replaceRoute(path) {
  const url = `${location.pathname}${location.search}#${path}`;
  history.replaceState(null, "", url);
  render();
}

export function goBack(fallback = "/today") {
  if (history.length > 1) history.back();
  else navigate(fallback);
}

function parse(path) {
  const [base, query] = path.split("?");
  return { base, params: Object.fromEntries(new URLSearchParams(query ?? "")) };
}

function captureFocus() {
  const active = document.activeElement;
  if (!active || active === document.body) return null;
  const id = active.id;
  const field = active.getAttribute?.("data-field");
  if (!id && !field) return null;
  const state = { id, field, start: null, end: null };
  if (typeof active.selectionStart === "number") {
    state.start = active.selectionStart;
    state.end = active.selectionEnd;
  }
  return state;
}

function restoreFocus(state) {
  if (!state) return;
  const selector = state.id ? `#${CSS.escape(state.id)}` : `[data-field="${state.field}"]`;
  const target = rootEl.querySelector(selector);
  if (!target) return;
  target.focus({ preventScroll: true });
  if (state.start != null && typeof target.setSelectionRange === "function") {
    try {
      target.setSelectionRange(state.start, state.end);
    } catch {
      // input types like number/time do not support selection ranges
    }
  }
}

function render({ keepScroll = false } = {}) {
  const { base, params } = parse(currentPath());

  if (guard) {
    const redirect = guard(base, params);
    if (redirect && redirect !== base) {
      location.hash = redirect;
      return;
    }
  }

  const handler = routes.get(base) ?? notFoundRender;
  const scrollTop = rootEl.scrollTop;
  const focusState = keepScroll ? captureFocus() : null;

  rootEl.innerHTML = "";
  const node = handler ? handler(params) : null;
  if (node) rootEl.appendChild(node);

  rootEl.scrollTop = keepScroll ? scrollTop : 0;
  restoreFocus(focusState);
}

export function refresh() {
  if (rootEl) render({ keepScroll: true });
}

export function startRouter(container) {
  rootEl = container;
  window.addEventListener("hashchange", () => render());
  render();
}
