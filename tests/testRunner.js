// Tiny in-browser test runner (this machine has no Node.js or Python).
const results = [];

export function test(name, fn) {
  try {
    fn();
    results.push({ name, pass: true });
  } catch (error) {
    results.push({ name, pass: false, error: error.message });
  }
}

export function assertEqual(actual, expected, label = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label} expected ${e} but got ${a}`);
}

export function assertTrue(value, label = "expected true") {
  if (!value) throw new Error(label);
}

export function render(targetEl) {
  const passCount = results.filter((result) => result.pass).length;
  const failCount = results.length - passCount;
  targetEl.innerHTML = "";

  const summary = document.createElement("h2");
  summary.textContent = `${passCount}/${results.length} passed${failCount ? ` — ${failCount} FAILED` : ""}`;
  summary.style.color = failCount ? "#FF5A1F" : "#8FD19E";
  targetEl.appendChild(summary);

  const list = document.createElement("ul");
  list.style.paddingLeft = "18px";
  for (const result of results) {
    const item = document.createElement("li");
    item.textContent = `${result.pass ? "PASS  " : "FAIL  "}${result.name}${result.error ? ` — ${result.error}` : ""}`;
    item.style.color = result.pass ? "#8FD19E" : "#FF5A1F";
    item.style.marginBottom = "4px";
    list.appendChild(item);
  }
  targetEl.appendChild(list);

  window.__FORJA_TEST_RESULTS__ = { passCount, failCount, total: results.length, results };
  return { passCount, failCount, total: results.length };
}
