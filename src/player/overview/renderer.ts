// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { CodeTour } from "../../store";

const TOUR_REFERENCE_PATTERN =
  /(?:\[(?<linkTitle>[^\]]+)\])?\[(?=\s*[^\]\s])(?<tourTitle>[^\]#]+)?(?:#(?<stepNumber>\d+))?\](?!\()/g;

function escapeAttribute(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeText(value: string): string {
  return escapeAttribute(value);
}

function findTourByTitle(
  title: string,
  siblings: ReadonlyArray<CodeTour>
): CodeTour | undefined {
  const trimmed = title.trim();
  return siblings.find(tour => tour.title.trim() === trimmed);
}

interface MarkdownSegment {
  text: string;
  protected: boolean;
}

/**
 * Split markdown into alternating (transformable | protected) segments so
 * downstream transforms do not touch inline code spans or fenced code blocks.
 *
 * Protected regions:
 * - Fenced code blocks opened by ``` or ~~~ at the start of a line (after
 *   optional whitespace), closed by a run of the same fence character of at
 *   least the opening length at the start of a line.
 * - Inline code spans: a run of N backticks opens a span that closes at the
 *   next run of exactly N backticks (GFM rule).
 */
export function splitProtectedRegions(markdown: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  let buffer = "";
  let i = 0;
  const n = markdown.length;

  const flushBuffer = () => {
    if (buffer.length > 0) {
      segments.push({ text: buffer, protected: false });
      buffer = "";
    }
  };

  const isAtLineStart = (pos: number): boolean => {
    let j = pos - 1;
    while (j >= 0 && (markdown[j] === " " || markdown[j] === "\t")) {
      j--;
    }
    return j < 0 || markdown[j] === "\n";
  };

  while (i < n) {
    const ch = markdown[i];

    // Try fenced code block at line start.
    if ((ch === "`" || ch === "~") && isAtLineStart(i)) {
      let runLen = 0;
      while (i + runLen < n && markdown[i + runLen] === ch) {
        runLen++;
      }
      if (runLen >= 3) {
        // Find the end of this line (the opening fence line).
        let lineEnd = markdown.indexOf("\n", i + runLen);
        if (lineEnd === -1) {
          lineEnd = n;
        }
        const fenceStart = i;
        let searchFrom = lineEnd;
        let closed = false;
        let blockEnd = n;
        while (searchFrom < n) {
          const nextNewline = markdown.indexOf("\n", searchFrom + 1);
          const lineStart = searchFrom + 1;
          // Skip leading whitespace (up to 3 spaces is standard; accept any).
          let k = lineStart;
          while (k < n && (markdown[k] === " " || markdown[k] === "\t")) {
            k++;
          }
          let closeLen = 0;
          while (k + closeLen < n && markdown[k + closeLen] === ch) {
            closeLen++;
          }
          if (closeLen >= runLen) {
            // The closing fence line must contain only the fence (and optional
            // trailing whitespace). A strict check is fine for our purposes.
            let after = k + closeLen;
            while (after < n && (markdown[after] === " " || markdown[after] === "\t")) {
              after++;
            }
            if (after === n || markdown[after] === "\n") {
              closed = true;
              blockEnd = after === n ? n : after;
              // Include the trailing newline of the closing fence in the block.
              if (blockEnd < n && markdown[blockEnd] === "\n") {
                blockEnd += 1;
              }
              break;
            }
          }
          if (nextNewline === -1) {
            break;
          }
          searchFrom = nextNewline;
        }
        flushBuffer();
        if (closed) {
          segments.push({
            text: markdown.slice(fenceStart, blockEnd),
            protected: true
          });
          i = blockEnd;
        } else {
          // Unclosed fence: protect the rest of the document to be safe.
          segments.push({
            text: markdown.slice(fenceStart),
            protected: true
          });
          i = n;
        }
        continue;
      }
    }

    // Try inline code span.
    if (ch === "`") {
      let runLen = 0;
      while (i + runLen < n && markdown[i + runLen] === "`") {
        runLen++;
      }
      // Look for a closing run of exactly runLen backticks.
      let searchFrom = i + runLen;
      let closeAt = -1;
      while (searchFrom < n) {
        const nextTick = markdown.indexOf("`", searchFrom);
        if (nextTick === -1) {
          break;
        }
        let closeLen = 0;
        while (nextTick + closeLen < n && markdown[nextTick + closeLen] === "`") {
          closeLen++;
        }
        if (closeLen === runLen) {
          closeAt = nextTick;
          break;
        }
        searchFrom = nextTick + closeLen;
      }
      if (closeAt !== -1) {
        flushBuffer();
        const spanEnd = closeAt + runLen;
        segments.push({
          text: markdown.slice(i, spanEnd),
          protected: true
        });
        i = spanEnd;
        continue;
      }
      // No closing run: treat the backticks as literal text.
    }

    buffer += ch;
    i++;
  }

  flushBuffer();
  return segments;
}

export function transformStepReferences(
  markdown: string,
  activeTour: CodeTour,
  siblings: ReadonlyArray<CodeTour>
): string {
  const replace = (text: string): string =>
    text.replace(
      TOUR_REFERENCE_PATTERN,
      (full, linkTitle, tourTitle, stepNumber) => {
        if (!stepNumber) {
          return full;
        }

        const step = Number(stepNumber);
        if (!Number.isInteger(step) || step < 1) {
          return full;
        }

        let targetTour: CodeTour | undefined;
        if (tourTitle) {
          targetTour = findTourByTitle(tourTitle, siblings);
          if (!targetTour) {
            return full;
          }
        } else {
          targetTour = activeTour;
        }

        if (step > targetTour.steps.length) {
          return full;
        }

        const defaultLabel = tourTitle
          ? `${targetTour.title}#${step}`
          : `#${step}`;
        const label = linkTitle || defaultLabel;

        return (
          `<a href="#" data-action="openStep" ` +
          `data-tour-id="${escapeAttribute(targetTour.id)}" ` +
          `data-step="${step}">${escapeText(label)}</a>`
        );
      }
    );

  return splitProtectedRegions(markdown)
    .map(segment => (segment.protected ? segment.text : replace(segment.text)))
    .join("");
}

export interface OverviewRenderOptions {
  tour: CodeTour;
  siblings: ReadonlyArray<CodeTour>;
  cspSource: string;
  nonce: string;
  renderMarkdown: (source: string) => string;
}

export function renderOverviewHtml({
  tour,
  siblings,
  cspSource,
  nonce,
  renderMarkdown
}: OverviewRenderOptions): string {
  const rawOverview = tour.overview?.trim();
  const source = rawOverview && rawOverview.length > 0
    ? transformStepReferences(rawOverview, tour, siblings)
    : `*This tour has no overview yet. Add an \`overview\` field to the tour file.*`;

  const body = renderMarkdown(source);
  const title = escapeText(tour.title);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} — Overview</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        padding: 24px 32px 40px;
        font: 14px/1.6 var(--vscode-font-family);
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
      }
      .overview { max-width: 820px; margin: 0 auto; }
      h1, h2, h3, h4 { color: var(--vscode-foreground); }
      pre, code {
        font-family: var(--vscode-editor-font-family, monospace);
        background: var(--vscode-textCodeBlock-background, rgba(127,127,127,0.1));
      }
      pre { padding: 10px 12px; border-radius: 4px; overflow: auto; }
      code { padding: 1px 4px; border-radius: 3px; }
      a { color: var(--vscode-textLink-foreground); cursor: pointer; }
      a:hover { text-decoration: underline; }
      blockquote {
        border-left: 3px solid var(--vscode-textBlockQuote-border, var(--vscode-focusBorder));
        margin: 0 0 1em;
        padding: 4px 12px;
        color: var(--vscode-textBlockQuote-foreground, inherit);
        background: var(--vscode-textBlockQuote-background, transparent);
      }
      table { border-collapse: collapse; }
      th, td { border: 1px solid var(--vscode-editorWidget-border, #8884); padding: 4px 8px; }
    </style>
  </head>
  <body>
    <main class="overview">${body}</main>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      document.addEventListener("click", event => {
        const anchor = event.target.closest('a[data-action="openStep"]');
        if (!anchor) return;
        event.preventDefault();
        vscode.postMessage({
          type: "openStep",
          tourId: anchor.dataset.tourId,
          stepNumber: Number(anchor.dataset.step)
        });
      });
    </script>
  </body>
</html>`;
}
