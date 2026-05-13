const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTsModule } = require("./helpers/load-ts-module.cjs");

const { renderMarkdownWithMermaid } = loadTsModule("./src/player/markdown.ts");

test("renderMarkdownWithMermaid renders mermaid fences as Mermaid containers", () => {
  const html = renderMarkdownWithMermaid(
    "```mermaid\ngraph TD\n  A --> B\n```"
  );

  assert.match(html, /<div class="mermaid">/);
  assert.match(html, /graph TD/);
  assert.match(html, /A --&gt; B/);
});

test("renderMarkdownWithMermaid keeps ordinary fences as code blocks", () => {
  const html = renderMarkdownWithMermaid("```ts\nconst value = 1;\n```");

  assert.match(html, /<pre><code class="language-ts">/);
  assert.match(html, /const value = 1;/);
  assert.doesNotMatch(html, /class="mermaid"/);
});
