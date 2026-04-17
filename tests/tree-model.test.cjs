const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/load-ts-module.cjs");

const { buildTourTree } = loadTsModule("./src/player/tree/model.ts");

test("buildTourTree projects grouped steps into nested nodes while keeping ungrouped steps at the root", () => {
  const tour = {
    id: "tour-1",
    title: "Demo Tour",
    steps: [
      { title: "Intro", description: "Intro step" },
      { title: "Open explorer", description: "Explore", group: "Basics/Explorer" },
      { title: "Open scm", description: "SCM", group: "Basics/SCM" }
    ]
  };

  const tree = buildTourTree(tour);

  assert.deepEqual(tree, [
    { kind: "step", stepNumber: 0 },
    {
      kind: "group",
      path: "Basics",
      label: "Basics",
      children: [
        {
          kind: "group",
          path: "Basics/Explorer",
          label: "Explorer",
          children: [{ kind: "step", stepNumber: 1 }]
        },
        {
          kind: "group",
          path: "Basics/SCM",
          label: "SCM",
          children: [{ kind: "step", stepNumber: 2 }]
        }
      ]
    }
  ]);
});

test("buildTourTree normalizes grouped step paths by trimming whitespace and dropping empty segments", () => {
  const tour = {
    id: "tour-2",
    title: "Messy Paths",
    steps: [
      { title: "Messy", description: "Messy path", group: "  Basics // Explorer /  " }
    ]
  };

  const tree = buildTourTree(tour);

  assert.deepEqual(tree, [
    {
      kind: "group",
      path: "Basics",
      label: "Basics",
      children: [
        {
          kind: "group",
          path: "Basics/Explorer",
          label: "Explorer",
          children: [{ kind: "step", stepNumber: 0 }]
        }
      ]
    }
  ]);
});
