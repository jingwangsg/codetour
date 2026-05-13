const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/load-ts-module.cjs");

const {
  STEP_DISPLAY_MODE_INLINE,
  STEP_DISPLAY_MODE_PAGE,
  normalizeStepDisplayMode
} = loadTsModule("./src/player/displayMode.ts");

test("normalizeStepDisplayMode accepts known display modes", () => {
  assert.equal(normalizeStepDisplayMode("inline"), STEP_DISPLAY_MODE_INLINE);
  assert.equal(normalizeStepDisplayMode("page"), STEP_DISPLAY_MODE_PAGE);
});

test("normalizeStepDisplayMode falls back to inline for unknown values", () => {
  assert.equal(normalizeStepDisplayMode(undefined), STEP_DISPLAY_MODE_INLINE);
  assert.equal(normalizeStepDisplayMode(null), STEP_DISPLAY_MODE_INLINE);
  assert.equal(normalizeStepDisplayMode("sidebar"), STEP_DISPLAY_MODE_INLINE);
  assert.equal(normalizeStepDisplayMode(42), STEP_DISPLAY_MODE_INLINE);
});
