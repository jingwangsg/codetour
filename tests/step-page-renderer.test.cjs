const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/load-ts-module.cjs");

const {
  buildStepPageMarkdown,
  renderStepPageHtml,
  rewriteImageSources
} = loadTsModule("./src/player/stepPage/renderer.ts");

const tour = {
  id: "tour-1",
  title: "Main <Tour>",
  steps: [
    { title: "Intro", description: "First **step**" },
    { description: "Second step" },
    { description: "Final step" }
  ]
};

function renderMarkdown(source) {
  return `<p>${source}</p>`;
}

test("buildStepPageMarkdown includes the active step description and navigation", () => {
  const markdown = buildStepPageMarkdown({
    tour,
    stepNumber: 1,
    previousStepLabel: "Intro",
    nextStepLabel: "Step #3",
    isFinalStep: false
  });

  assert.match(markdown, /^Second step/);
  assert.match(markdown, /command:codetour.previousTourStep/);
  assert.match(markdown, /Previous \(Intro\)/);
  assert.match(markdown, /command:codetour.nextTourStep/);
  assert.match(markdown, /Next \(Step #3\)/);
  assert.doesNotMatch(markdown, /command:codetour.finishTour/);
});

test("buildStepPageMarkdown renders Finish Tour on the final step", () => {
  const markdown = buildStepPageMarkdown({
    tour,
    stepNumber: 2,
    isFinalStep: true
  });

  assert.match(markdown, /command:codetour.finishTour/);
  assert.match(markdown, /Finish Tour/);
});

test("buildStepPageMarkdown preserves tour chaining links", () => {
  const previousArgs = encodeURIComponent(JSON.stringify(["Previous Tour"]));
  const nextArgs = encodeURIComponent(JSON.stringify(["Next Tour"]));

  const firstStep = buildStepPageMarkdown({
    tour,
    stepNumber: 0,
    previousTourLabel: "Previous Tour",
    previousTourCommandArgs: previousArgs,
    isFinalStep: false
  });
  assert.match(firstStep, /command:codetour.startTourByTitle/);
  assert.match(firstStep, /Previous Tour \(Previous Tour\)/);

  const finalStep = buildStepPageMarkdown({
    tour,
    stepNumber: 2,
    nextTourLabel: "Next Tour",
    nextTourCommandArgs: nextArgs,
    isFinalStep: true
  });
  assert.match(finalStep, /command:codetour.finishTour/);
  assert.match(finalStep, /Next Tour \(Next Tour\)/);
  assert.doesNotMatch(finalStep, /Finish Tour\]/);
});

test("renderStepPageHtml escapes titles, renders body, and sets image CSP", () => {
  const html = renderStepPageHtml({
    tour,
    stepNumber: 0,
    stepMarkdown: "First **step**",
    cspSource: "vscode-resource:",
    renderMarkdown
  });

  assert.match(html, /<title>Main &lt;Tour&gt; — Step #1<\/title>/);
  assert.match(html, /<h1>Main &lt;Tour&gt;<\/h1>/);
  assert.match(html, /<p>First \*\*step\*\*<\/p>/);
  assert.match(html, /Step #1 of 3/);
  assert.match(html, /img-src vscode-resource: https: http: data:/);
});

test("renderStepPageHtml defines readable markdown styles", () => {
  const html = renderStepPageHtml({
    tour,
    stepNumber: 0,
    stepMarkdown: "`inline`",
    cspSource: "vscode-resource:",
    renderMarkdown
  });

  assert.match(html, /<section class="step-content">/);
  assert.match(html, /code \{/);
  assert.match(html, /color: var\(--vscode-editor-foreground\)/);
  assert.match(html, /background: var\(--vscode-input-background/);
  assert.match(html, /tbody tr:nth-child\(even\)/);
});

test("renderStepPageHtml loads the Mermaid webview script", () => {
  const html = renderStepPageHtml({
    tour,
    stepNumber: 0,
    stepMarkdown: "```mermaid\ngraph TD\n  A --> B\n```",
    cspSource: "vscode-resource:",
    nonce: "test-nonce",
    mermaidScriptUri: "vscode-resource:/dist/mermaid-webview.js",
    renderMarkdown: source => `<div class="mermaid">${source}</div>`
  });

  assert.match(
    html,
    /<script nonce="test-nonce" src="vscode-resource:\/dist\/mermaid-webview\.js"><\/script>/
  );
});

test("rewriteImageSources rewrites only image src attributes", () => {
  const html =
    '<p><img alt="one" src="file:///tmp/one.png"><a href="file:///tmp/two.txt">file</a></p>';

  const rewritten = rewriteImageSources(html, source =>
    source.startsWith("file:///tmp/")
      ? source.replace("file:///tmp/", "vscode-resource:/")
      : source
  );

  assert.equal(
    rewritten,
    '<p><img alt="one" src="vscode-resource:/one.png"><a href="file:///tmp/two.txt">file</a></p>'
  );
});
