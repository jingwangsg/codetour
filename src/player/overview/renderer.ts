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

export function transformStepReferences(
  markdown: string,
  activeTour: CodeTour,
  siblings: ReadonlyArray<CodeTour>
): string {
  return markdown.replace(
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
