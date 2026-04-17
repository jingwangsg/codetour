const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/load-ts-module.cjs");

const {
  CODETOUR_SCHEMA_URL,
  createPersistedTour,
  normalizeColor,
  parseColorInput,
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

test("normalizeColor expands short hex and lowercases full hex", () => {
  assert.equal(normalizeColor("#AbC"), "#aabbcc");
  assert.equal(normalizeColor("  #A1B2C3 "), "#a1b2c3");
  assert.equal(normalizeColor("blue"), undefined);
  assert.equal(normalizeColor("#abcd"), undefined);
});

test("parseColorInput trims values and rejects blanks", () => {
  assert.equal(parseColorInput("  #F0A "), "#ff00aa");
  assert.equal(parseColorInput("   "), undefined);
  assert.equal(parseColorInput("#12"), undefined);
});

test("createPersistedTour strips runtime fields, legacy group metadata, and normalizes tags and colors", () => {
  const persisted = createPersistedTour({
    id: "tour-1",
    title: "Demo Tour",
    steps: [
      {
        title: "Intro",
        description: "Hello world",
        group: "Basics/Explorer",
        markerTitle: "CT 1.1",
        tags: ["  basics ", " ", "ui"],
        color: " #AbC "
      },
      {
        description: "Second step",
        tags: [],
        color: "not-a-color"
      }
    ]
  });

  assert.equal(persisted.$schema, CODETOUR_SCHEMA_URL);
  assert.equal(persisted.id, undefined);
  assert.deepEqual(persisted.steps, [
    {
      title: "Intro",
      description: "Hello world",
      tags: ["basics", "ui"],
      color: "#aabbcc"
    },
    {
      description: "Second step"
    }
  ]);
});
