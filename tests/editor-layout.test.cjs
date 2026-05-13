const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/load-ts-module.cjs");

const {
  getStepPageViewColumn,
  shouldReuseVisibleEditor
} = loadTsModule("./src/player/editorLayout.ts");

test("shouldReuseVisibleEditor reuses matching editors only in the requested column", () => {
  assert.equal(
    shouldReuseVisibleEditor("file:///a.ts", "file:///a.ts", 2, undefined),
    true
  );
  assert.equal(
    shouldReuseVisibleEditor("file:///a.ts", "file:///a.ts", 2, 2),
    true
  );
  assert.equal(
    shouldReuseVisibleEditor("file:///a.ts", "file:///a.ts", 2, 1),
    false
  );
  assert.equal(
    shouldReuseVisibleEditor("file:///b.ts", "file:///a.ts", 1, 1),
    false
  );
});

test("getStepPageViewColumn opens the page beside the source editor", () => {
  const besideViewColumn = -2;

  assert.equal(getStepPageViewColumn(1, besideViewColumn), 2);
  assert.equal(getStepPageViewColumn(3, besideViewColumn), 4);
  assert.equal(getStepPageViewColumn(undefined, besideViewColumn), besideViewColumn);
  assert.equal(getStepPageViewColumn(-1, besideViewColumn), besideViewColumn);
});
