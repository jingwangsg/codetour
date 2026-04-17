const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/load-ts-module.cjs");

const { transformStepReferences } = loadTsModule(
  "./src/player/overview/renderer.ts"
);

const tour = {
  id: "tour-1",
  title: "Main Tour",
  steps: [
    { description: "a" },
    { description: "b" },
    { description: "c" }
  ]
};

const siblings = [
  tour,
  {
    id: "tour-2",
    title: "Other Tour",
    steps: [{ description: "x" }, { description: "y" }]
  }
];

test("transforms bare [#N] into an anchor targeting the current tour", () => {
  const out = transformStepReferences("See [#2] for details.", tour, siblings);
  assert.match(
    out,
    /<a [^>]*data-action="openStep"[^>]*data-tour-id="tour-1"[^>]*data-step="2"[^>]*>#2<\/a>/
  );
});

test("transforms [Link text][#N] using the custom label", () => {
  const out = transformStepReferences(
    "Jump to [the setup step][#1].",
    tour,
    siblings
  );
  assert.match(out, /data-step="1"[^>]*>the setup step<\/a>/);
});

test("transforms [Other Tour Title#N] to target that tour", () => {
  const out = transformStepReferences(
    "Cross-ref: [Other Tour#2].",
    tour,
    siblings
  );
  assert.match(
    out,
    /data-tour-id="tour-2"[^>]*data-step="2"[^>]*>Other Tour#2<\/a>/
  );
});

test("leaves unknown tour titles untouched", () => {
  const input = "Unknown [Missing Tour#1] stays literal.";
  assert.equal(transformStepReferences(input, tour, siblings), input);
});

test("escapes tour id and step values in emitted attributes", () => {
  const evilTour = {
    id: 'tour"-evil',
    title: "Main Tour",
    steps: [{ description: "a" }, { description: "b" }]
  };
  const out = transformStepReferences("Check [#1].", evilTour, [evilTour]);
  assert.match(out, /data-tour-id="tour&quot;-evil"/);
});

test("rejects out-of-range step numbers", () => {
  const input = "Bad [#42] reference.";
  assert.equal(transformStepReferences(input, tour, siblings), input);
});
