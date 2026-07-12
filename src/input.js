const IGNORED_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab", "Escape", "Enter"]);

export function isIgnoredKey(key) {
  return IGNORED_KEYS.has(key);
}

export function requiresShift(character) {
  return typeof character === "string" && /^[A-Z]$/.test(character);
}

export function isCorrectInput(expected, actual) {
  if (!expected || isIgnoredKey(actual)) return false;
  if (requiresShift(expected)) return actual === expected;
  return actual === expected || actual?.toLowerCase() === expected.toLowerCase();
}
