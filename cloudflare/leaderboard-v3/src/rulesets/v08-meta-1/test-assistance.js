const STATE_CLASSES = new Set(["none", "observer_bot", "cheats", "mixed"]);
const REQUEST_CLASSES = new Set(["observer_bot", "cheats"]);

export function normalizeTestAssistanceV08(value) {
  const normalized = value === undefined ? "none" : String(value || "");
  if (!STATE_CLASSES.has(normalized)) {
    throw new TypeError("TEST_ASSISTANCE_STATE_INVALID");
  }
  return normalized;
}

export function applyTestAssistanceV08(state, requestedClass) {
  const requested = String(requestedClass || "");
  if (!REQUEST_CLASSES.has(requested)) {
    throw new TypeError("TEST_ASSISTANCE_CLASS_INVALID");
  }
  const current = normalizeTestAssistanceV08(state?.assistanceClass);
  const assistanceClass = current === "none"
    ? requested
    : current === requested || current === "mixed"
      ? current
      : "mixed";
  return {
    ...structuredClone(state),
    assistanceClass
  };
}
