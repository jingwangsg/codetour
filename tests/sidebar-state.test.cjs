const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/load-ts-module.cjs");

const { buildSidebarState } = loadTsModule("./src/player/sidebar/state.ts");

test("buildSidebarState projects tours into card sections with active, complete, and tag state", () => {
  const tours = [
    {
      id: "tour-1",
      title: "Demo Tour",
      description: "Introductory tour",
      isPrimary: true,
      steps: [
        {
          title: "Intro",
          description: "Welcome to the codebase",
          file: "src/extension.ts"
        },
        {
          description: "Focus the explorer and inspect the project structure",
          view: "explorer",
          tags: [" Basics ", " ", "UI"]
        }
      ]
    },
    {
      id: "tour-2",
      title: "Secondary Tour",
      steps: [{ description: "Follow-up step" }]
    }
  ];

  const state = buildSidebarState({
    tours,
    activeTour: { tour: tours[0], step: 1 },
    progress: [["tour-1", [0]]],
    isRecording: false,
    isEditing: false
  });

  assert.equal(state.activeTourId, "tour-1");
  assert.equal(state.activeStepNumber, 1);
  assert.equal(state.tours.length, 2);
  assert.equal(state.tours[0].isActive, true);
  assert.equal(state.tours[0].stepCount, 2);
  assert.deepEqual(
    state.tours[0].steps.map(step => ({
      stepNumber: step.stepNumber,
      title: step.title,
      isActive: step.isActive,
      isComplete: step.isComplete,
      tags: step.tags
    })),
    [
      {
        stepNumber: 0,
        title: "Intro",
        isActive: false,
        isComplete: true,
        tags: []
      },
      {
        stepNumber: 1,
        title: "Step #2",
        isActive: true,
        isComplete: false,
        tags: ["Basics", "UI"]
      }
    ]
  );
});

test("buildSidebarState prepends an active external tour that is not in discovered tours", () => {
  const externalTour = {
    id: "external-tour",
    title: "Shared Tour",
    steps: [{ description: "Opened from a URL" }]
  };

  const state = buildSidebarState({
    tours: [],
    activeTour: { tour: externalTour, step: 0 },
    progress: [],
    isRecording: false,
    isEditing: false
  });

  assert.deepEqual(
    state.tours.map(tour => ({
      id: tour.id,
      isActive: tour.isActive
    })),
    [{ id: "external-tour", isActive: true }]
  );
});
