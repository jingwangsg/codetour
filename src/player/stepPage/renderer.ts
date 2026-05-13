// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { CodeTour } from "../../store";

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

export interface StepPageMarkdownOptions {
  tour: CodeTour;
  stepNumber: number;
  previousStepLabel?: string;
  nextStepLabel?: string;
  previousTourLabel?: string;
  previousTourCommandArgs?: string;
  nextTourLabel?: string;
  nextTourCommandArgs?: string;
  isFinalStep: boolean;
}

export function buildStepPageMarkdown({
  tour,
  stepNumber,
  previousStepLabel,
  nextStepLabel,
  previousTourLabel,
  previousTourCommandArgs,
  nextTourLabel,
  nextTourCommandArgs,
  isFinalStep
}: StepPageMarkdownOptions): string {
  const step = tour.steps[stepNumber];
  let content = step.description;
  const links: string[] = [];

  if (stepNumber > 0) {
    const suffix = previousStepLabel ? ` (${previousStepLabel})` : "";
    links.push(
      `[Previous${suffix}](command:codetour.previousTourStep "Navigate to previous step")`
    );
  } else if (previousTourLabel && previousTourCommandArgs) {
    links.push(
      `[Previous Tour (${previousTourLabel})](command:codetour.startTourByTitle?${previousTourCommandArgs} "Navigate to previous tour")`
    );
  }

  if (stepNumber < tour.steps.length - 1) {
    const suffix = nextStepLabel ? ` (${nextStepLabel})` : "";
    links.push(
      `[Next${suffix}](command:codetour.nextTourStep "Navigate to next step")`
    );
  } else if (isFinalStep && nextTourLabel && nextTourCommandArgs) {
    links.push(
      `[Next Tour (${nextTourLabel})](command:codetour.finishTour?${nextTourCommandArgs} "Start next tour")`
    );
  } else if (isFinalStep) {
    links.push(`[Finish Tour](command:codetour.finishTour "Finish the tour")`);
  }

  if (links.length > 0) {
    content += `\n\n---\n\n${links.join(" | ")}`;
  }

  return content;
}

export interface StepPageRenderOptions {
  tour: CodeTour;
  stepNumber: number;
  stepMarkdown: string;
  cspSource: string;
  nonce?: string;
  mermaidScriptUri?: string;
  renderMarkdown: (source: string) => string;
}

export function rewriteImageSources(
  html: string,
  rewriteSource: (source: string) => string
): string {
  return html.replace(
    /(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi,
    (_match, prefix, source, suffix) =>
      `${prefix}${rewriteSource(source)}${suffix}`
  );
}

export function renderStepPageHtml({
  tour,
  stepNumber,
  stepMarkdown,
  cspSource,
  nonce,
  mermaidScriptUri,
  renderMarkdown
}: StepPageRenderOptions): string {
  const body = renderMarkdown(stepMarkdown);
  const title = escapeText(tour.title);
  const stepLabel = `Step #${stepNumber + 1} of ${tour.steps.length}`;
  const scriptPolicy = nonce ? ` script-src 'nonce-${nonce}';` : "";
  const mermaidScript = nonce && mermaidScriptUri
    ? `    <script nonce="${nonce}" src="${escapeAttribute(mermaidScriptUri)}"></script>\n`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${cspSource} https: http: data:; style-src ${cspSource} 'unsafe-inline';${scriptPolicy}"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} — Step #${stepNumber + 1}</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        padding: 24px 32px 40px;
        font: 14px/1.6 var(--vscode-font-family);
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
      }
      .step-page { max-width: 1040px; margin: 0 auto; }
      .step-kicker {
        margin: 0 0 4px;
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        text-transform: uppercase;
      }
      h1 {
        margin: 0 0 18px;
        color: var(--vscode-foreground);
        font-size: 22px;
        line-height: 1.25;
      }
      h2, h3, h4 { color: var(--vscode-foreground); }
      .step-content {
        color: var(--vscode-editor-foreground);
      }
      .step-content > :first-child { margin-top: 0; }
      .step-content > :last-child { margin-bottom: 0; }
      p, ul, ol, blockquote, pre, table {
        margin: 0 0 16px;
      }
      pre,
      code {
        font-family: var(--vscode-editor-font-family, monospace);
      }
      pre {
        padding: 12px 14px;
        border: 1px solid var(--vscode-editorWidget-border, rgba(127,127,127,0.28));
        border-radius: 6px;
        overflow: auto;
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editorWidget-background, rgba(127,127,127,0.10));
      }
      pre code {
        padding: 0;
        border: 0;
        background: transparent;
      }
      code {
        padding: 1px 5px;
        border: 1px solid var(--vscode-editorWidget-border, rgba(127,127,127,0.24));
        border-radius: 4px;
        color: var(--vscode-editor-foreground);
        background: var(--vscode-input-background, rgba(127,127,127,0.12));
      }
      a { color: var(--vscode-textLink-foreground); cursor: pointer; }
      a:hover { text-decoration: underline; }
      blockquote {
        border-left: 3px solid var(--vscode-textBlockQuote-border, var(--vscode-focusBorder));
        margin: 0 0 1em;
        padding: 4px 12px;
        color: var(--vscode-textBlockQuote-foreground, inherit);
        background: var(--vscode-textBlockQuote-background, transparent);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid var(--vscode-editorWidget-border, rgba(127,127,127,0.28));
        background: var(--vscode-editor-background);
      }
      th,
      td {
        border: 1px solid var(--vscode-editorWidget-border, rgba(127,127,127,0.28));
        padding: 8px 10px;
        vertical-align: top;
      }
      th {
        color: var(--vscode-foreground);
        font-weight: 600;
        background: var(--vscode-editorWidget-background, rgba(127,127,127,0.10));
      }
      tbody tr:nth-child(even) {
        background: var(--vscode-list-hoverBackground, rgba(127,127,127,0.06));
      }
      hr {
        border: 0;
        border-top: 1px solid var(--vscode-editorWidget-border, rgba(127,127,127,0.28));
        margin: 22px 0 14px;
      }
    </style>
  </head>
  <body>
    <main class="step-page">
      <p class="step-kicker">${escapeText(stepLabel)}</p>
      <h1>${title}</h1>
      <section class="step-content">
        ${body}
      </section>
    </main>
${mermaidScript}
  </body>
</html>`;
}
