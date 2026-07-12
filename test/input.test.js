import test from "node:test";
import assert from "node:assert/strict";

import { isCorrectInput, isIgnoredKey, requiresShift } from "../src/input.js";

test("modifier keys do not create typing mistakes", () => {
  assert.equal(isIgnoredKey("Shift"), true);
  assert.equal(isIgnoredKey("Control"), true);
  assert.equal(isCorrectInput("A", "Shift"), false);
});

test("uppercase targets require the matching uppercase key event", () => {
  assert.equal(requiresShift("A"), true);
  assert.equal(isCorrectInput("A", "A"), true);
  assert.equal(isCorrectInput("A", "a"), false);
});

test("lowercase and space targets accept their normal browser key values", () => {
  assert.equal(requiresShift("f"), false);
  assert.equal(isCorrectInput("f", "f"), true);
  assert.equal(isCorrectInput(" ", " "), true);
});
