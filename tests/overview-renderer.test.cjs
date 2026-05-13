const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/load-ts-module.cjs");

const { renderOverviewHtml, transformStepReferences } = loadTsModule(
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

test("leaves [#N] inside inline code spans literal", () => {
  const input = "Use `[#1]` here.";
  assert.equal(transformStepReferences(input, tour, siblings), input);
});

test("leaves [#N] inside fenced code blocks literal", () => {
  const input =
    "See [#1] outside.\n\n```js\n// Reference format is [#2], [#3], ...\n```\n";
  const out = transformStepReferences(input, tour, siblings);
  // Outside reference must be transformed.
  assert.match(out, /data-step="1"[^>]*>#1<\/a>/);
  // Inside-fence references must remain literal.
  assert.ok(
    out.includes("// Reference format is [#2], [#3], ..."),
    `expected fenced content to remain literal, got: ${out}`
  );
  assert.ok(!out.includes('data-step="2"'));
  assert.ok(!out.includes('data-step="3"'));
});

test("handles multiple backtick-run lengths", () => {
  const input = "Outside [#1]. Inline ``code with ` and [#2] inside`` tail.";
  const out = transformStepReferences(input, tour, siblings);
  assert.match(out, /data-step="1"[^>]*>#1<\/a>/);
  assert.ok(
    out.includes("``code with ` and [#2] inside``"),
    `expected double-backtick span to stay literal, got: ${out}`
  );
  assert.ok(!out.includes('data-step="2"'));
});

test("handles tilde-fenced blocks", () => {
  const input = "Outside [#1].\n\n~~~\n[#2] should stay literal\n~~~\n";
  const out = transformStepReferences(input, tour, siblings);
  assert.match(out, /data-step="1"[^>]*>#1<\/a>/);
  assert.ok(
    out.includes("[#2] should stay literal"),
    `expected tilde fence to stay literal, got: ${out}`
  );
  assert.ok(!out.includes('data-step="2"'));
});

test("renderOverviewHtml loads the Mermaid webview script", () => {
  const html = renderOverviewHtml({
    tour: {
      ...tour,
      overview: "```mermaid\ngraph TD\n  A --> B\n```"
    },
    siblings,
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

test("renderOverviewHtml defines readable markdown styles", () => {
  const html = renderOverviewHtml({
    tour: {
      ...tour,
      overview: "`inline`"
    },
    siblings,
    cspSource: "vscode-resource:",
    nonce: "test-nonce",
    renderMarkdown: source => `<p>${source}</p>`
  });

  assert.match(html, /\.overview \{/);
  assert.match(html, /max-width: 1040px/);
  assert.match(html, /code \{/);
  assert.match(html, /color: var\(--vscode-editor-foreground\)/);
  assert.match(html, /background: var\(--vscode-input-background/);
  assert.match(html, /tbody tr:nth-child\(even\)/);
});
