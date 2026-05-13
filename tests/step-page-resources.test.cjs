const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/load-ts-module.cjs");

const { getStepPageLocalResourceRoots } = loadTsModule(
  "./src/player/stepPage/resources.ts"
);

test("getStepPageLocalResourceRoots allows Mermaid assets and workspace images", () => {
  assert.deepEqual(
    getStepPageLocalResourceRoots("file:///extension/dist", [
      "file:///workspace",
      "file:///extension/dist"
    ]),
    ["file:///extension/dist", "file:///workspace"]
  );
});

test("getStepPageLocalResourceRoots falls back to workspace roots", () => {
  assert.deepEqual(
    getStepPageLocalResourceRoots(undefined, ["file:///workspace"]),
    ["file:///workspace"]
  );
  assert.equal(getStepPageLocalResourceRoots(undefined, []), undefined);
});
