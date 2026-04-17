const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/load-ts-module.cjs");

const {
  CODETOUR_SCHEMA_URL,
  createPersistedTour,
  normalizeTags,
  parseTagsInput
} = loadTsModule("./src/store/serialization.ts");

test("normalizeTags trims values and drops empty tags", () => {
  assert.deepEqual(normalizeTags(["  Basics  ", "", "UI", "   "]), [
    "Basics",
    "UI"
  ]);
  assert.equal(normalizeTags(["", "   "]), undefined);
  assert.equal(normalizeTags(undefined), undefined);
});

test("parseTagsInput splits comma-separated tag input", () => {
  assert.deepEqual(parseTagsInput(" alpha, beta ,, gamma "), [
    "alpha",
    "beta",
    "gamma"
  ]);
  assert.equal(parseTagsInput("   "), undefined);
});

test("createPersistedTour strips runtime fields, legacy group metadata, and empty tags", () => {
  const persisted = createPersistedTour({
    id: "tour-1",
    title: "Demo Tour",
    steps: [
      {
        title: "Intro",
        description: "Hello world",
        group: "Basics/Explorer",
        markerTitle: "CT 1.1",
        tags: ["  basics ", " ", "ui"]
      },
      {
        description: "Second step",
        tags: []
      }
    ]
  });

  assert.equal(persisted.$schema, CODETOUR_SCHEMA_URL);
  assert.equal(persisted.id, undefined);
  assert.deepEqual(persisted.steps, [
    {
      title: "Intro",
      description: "Hello world",
      tags: ["basics", "ui"]
    },
    {
      description: "Second step"
    }
  ]);
});
