// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { marked } from "marked";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderMarkdownWithMermaid(source: string): string {
  const renderer = new marked.Renderer();
  const baseRenderer = new marked.Renderer();

  renderer.code = (code, infostring, escaped) => {
    const language = (infostring || "").trim().split(/\s+/)[0].toLowerCase();
    if (language === "mermaid") {
      return `<div class="mermaid">${escapeHtml(code)}</div>`;
    }

    return baseRenderer.code(code, infostring, escaped);
  };

  return marked.parse(source, { async: false, renderer }) as string;
}
