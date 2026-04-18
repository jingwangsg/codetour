const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/load-ts-module.cjs");

const {
  getReconciledActiveStep,
  isDiscoverableTourPath,
  syncTourInPlace
} = loadTsModule("./src/store/refresh.ts");
const {
  getActiveTourRenderSignature,
  getOverviewRenderSignature
} = loadTsModule("./src/player/renderSignatures.ts");

test("isDiscoverableTourPath matches main, workspace, and nested tour files", () => {
  const directories = [".vscode/tours", ".github/tours", ".tours", "guides"];

  assert.equal(
    isDiscoverableTourPath(".tour", directories),
    true
  );
  assert.equal(
    isDiscoverableTourPath("main.tour", directories),
    true
  );
  assert.equal(
    isDiscoverableTourPath(".vscode/main.tour", directories),
    true
  );
  assert.equal(
    isDiscoverableTourPath(".tours/demo.tour", directories),
    true
  );
  assert.equal(
    isDiscoverableTourPath(".github/tours/platform/intro.tour", directories),
    true
  );
  assert.equal(
    isDiscoverableTourPath("guides/ios/onboarding.tour", directories),
    true
  );
});

test("isDiscoverableTourPath ignores unrelated files", () => {
  const directories = [".vscode/tours", ".github/tours", ".tours", "guides"];

  assert.equal(
    isDiscoverableTourPath("docs/demo.tour", directories),
    false
  );
  assert.equal(
    isDiscoverableTourPath(".tours/demo.md", directories),
    false
  );
  assert.equal(
    isDiscoverableTourPath("nested/.tour", directories),
    false
  );
});

test("syncTourInPlace removes stale optional fields while updating current values", () => {
  const current = {
    id: "tour-1",
    title: "Demo Tour",
    description: "Old description",
    overview: "Old overview",
    ref: "main",
    nextTour: "Next Tour",
    steps: [{ description: "Old step" }]
  };

  const incoming = {
    id: "tour-1",
    title: "Updated Tour",
    steps: [{ description: "New step" }]
  };

  syncTourInPlace(current, incoming);

  assert.deepEqual(current, incoming);
});

test("getReconciledActiveStep clamps to the last available step", () => {
  assert.equal(getReconciledActiveStep(4, 2), 1);
  assert.equal(getReconciledActiveStep(1, 2), 1);
});

test("getReconciledActiveStep signals that an emptied tour should end", () => {
  assert.equal(getReconciledActiveStep(0, 0), null);
  assert.equal(getReconciledActiveStep(3, 0), null);
});

test("getOverviewRenderSignature changes when overview content or sibling tour references change", () => {
  const tour = {
    id: "tour-1",
    title: "Main Tour",
    overview: "Intro",
    steps: [{ description: "One" }]
  };
  const sibling = {
    id: "tour-2",
    title: "Sibling Tour",
    steps: [{ description: "Sibling" }]
  };

  const base = getOverviewRenderSignature(tour, [tour, sibling]);
  const changedOverview = getOverviewRenderSignature(
    { ...tour, overview: "Updated intro" },
    [tour, sibling]
  );
  const changedSibling = getOverviewRenderSignature(tour, [
    tour,
    { ...sibling, title: "Renamed Sibling Tour" }
  ]);

  assert.notEqual(base, changedOverview);
  assert.notEqual(base, changedSibling);
});

test("getActiveTourRenderSignature changes when the active step or tour navigation context changes", () => {
  const sibling = {
    id: "tour-2",
    title: "Sibling Tour",
    steps: [{ description: "Sibling step" }]
  };
  const activeTour = {
    tour: {
      id: "tour-1",
      title: "Main Tour",
      ref: "main",
      nextTour: "Sibling Tour",
      steps: [
        { title: "Intro", description: "First step", file: "src/index.ts", line: 5 },
        { title: "Second", description: "Second step", view: "explorer" }
      ]
    },
    step: 0,
    tours: [sibling]
  };

  const base = getActiveTourRenderSignature(activeTour);
  const changedStep = getActiveTourRenderSignature({
    ...activeTour,
    tour: {
      ...activeTour.tour,
      steps: [
        { ...activeTour.tour.steps[0], description: "Updated first step" },
        activeTour.tour.steps[1]
      ]
    }
  });
  const changedSibling = getActiveTourRenderSignature({
    ...activeTour,
    tours: [{ ...sibling, title: "Renamed Sibling Tour" }]
  });

  assert.notEqual(base, changedStep);
  assert.notEqual(base, changedSibling);
});
