// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { comparer, reaction } from "mobx";
import * as vscode from "vscode";
import { EXTENSION_NAME } from "../../constants";
import { store } from "../../store";
import { buildSidebarState, SidebarState } from "./state";

type SidebarCommandMessage =
  | { type: "command"; action: "recordTour" | "openTourFile" | "openTourUrl" | "endTour" }
  | {
      type: "command";
      action:
        | "startTour"
        | "editTour"
        | "previewTour"
        | "changeTourTitle"
        | "changeTourDescription"
        | "changeTourRef"
        | "makeTourPrimary"
        | "unmakeTourPrimary"
        | "exportTour"
        | "deleteTour";
      tourId: string;
      stepNumber?: number;
    }
  | {
      type: "command";
      action:
        | "editTourAtStep"
        | "changeTourStepTags"
        | "moveTourStepBack"
        | "moveTourStepForward"
        | "deleteTourStep";
      tourId: string;
      stepNumber: number;
    };

class CodeTourSidebarProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  private view?: vscode.WebviewView;
  private readonly disposeReaction = reaction(
    () => buildSidebarState(store),
    state => this.postState(state),
    { equals: comparer.structural }
  );

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = {
      enableScripts: true
    };
    view.webview.html = getSidebarHtml(view.webview, buildSidebarState(store));

    view.webview.onDidReceiveMessage(message => this.handleMessage(message));
    view.onDidDispose(() => {
      if (this.view === view) {
        this.view = undefined;
      }
    });
  }

  dispose() {
    this.disposeReaction();
  }

  private postState(state: SidebarState) {
    this.view?.webview.postMessage({
      type: "state",
      state
    });
  }

  private handleMessage(message: SidebarCommandMessage) {
    if (!message || message.type !== "command") {
      return;
    }

    switch (message.action) {
      case "recordTour":
      case "openTourFile":
      case "openTourUrl":
      case "endTour":
        return vscode.commands.executeCommand(`${EXTENSION_NAME}.${message.action}`);
      case "startTour":
        return vscode.commands.executeCommand(
          `${EXTENSION_NAME}.startTour`,
          { tourId: message.tourId },
          message.stepNumber
        );
      case "editTour":
      case "previewTour":
      case "changeTourTitle":
      case "changeTourDescription":
      case "changeTourRef":
      case "makeTourPrimary":
      case "unmakeTourPrimary":
      case "exportTour":
      case "deleteTour":
        return vscode.commands.executeCommand(`${EXTENSION_NAME}.${message.action}`, {
          tourId: message.tourId
        });
      case "editTourAtStep":
      case "changeTourStepTags":
      case "moveTourStepBack":
      case "moveTourStepForward":
      case "deleteTourStep":
        return vscode.commands.executeCommand(`${EXTENSION_NAME}.${message.action}`, {
          tourId: message.tourId,
          stepNumber: message.stepNumber
        });
    }
  }
}

export function registerSidebarViewProvider(context: vscode.ExtensionContext) {
  const provider = new CodeTourSidebarProvider();
  context.subscriptions.push(
    provider,
    vscode.window.registerWebviewViewProvider(`${EXTENSION_NAME}.tours`, provider, {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    })
  );
}

function getSidebarHtml(webview: vscode.Webview, state: SidebarState): string {
  const nonce = getNonce();
  const initialState = JSON.stringify(state).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: light dark;
        --surface: var(--vscode-sideBar-background);
        --surface-strong: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
        --surface-active: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground));
        --surface-complete: rgba(46, 160, 67, 0.12);
        --border: var(--vscode-editorWidget-border, rgba(127, 127, 127, 0.22));
        --border-strong: var(--vscode-focusBorder);
        --muted: var(--vscode-descriptionForeground);
        --accent: var(--vscode-focusBorder);
        --shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        color: var(--vscode-sideBar-foreground);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 24%),
          var(--vscode-sideBar-background);
        font: 13px/1.45 var(--vscode-font-family);
      }

      button {
        font: inherit;
      }

      .app {
        padding: 14px 12px 28px;
      }

      .empty-state {
        display: grid;
        gap: 12px;
        padding: 16px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: linear-gradient(180deg, var(--surface-strong), var(--surface));
        box-shadow: var(--shadow);
      }

      .empty-title {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
      }

      .empty-copy {
        margin: 0;
        color: var(--muted);
      }

      .toolbar,
      .tour-actions,
      .card-actions,
      .meta-row,
      .summary-row,
      .tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .toolbar {
        margin-top: 4px;
      }

      .section {
        margin-bottom: 14px;
        border: 1px solid var(--border);
        border-radius: 18px;
        overflow: hidden;
        background: linear-gradient(180deg, var(--surface-strong), var(--surface));
        box-shadow: var(--shadow);
      }

      .section[open] {
        border-color: var(--border-strong);
      }

      summary {
        list-style: none;
        cursor: pointer;
        padding: 14px 14px 10px;
      }

      summary::-webkit-details-marker {
        display: none;
      }

      .summary-row {
        align-items: center;
        justify-content: space-between;
      }

      .tour-title {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
      }

      .tour-copy {
        margin: 8px 0 0;
        color: var(--muted);
      }

      .status-badge,
      .tag,
      .step-index {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      .status-badge {
        border: 1px solid var(--border);
        background: rgba(127, 127, 127, 0.12);
      }

      .status-badge.active {
        border-color: var(--accent);
        background: rgba(80, 140, 255, 0.18);
      }

      .status-badge.primary {
        border-color: var(--vscode-terminal-ansiYellow);
        background: rgba(255, 200, 56, 0.18);
      }

      .tour-actions {
        padding: 0 14px 14px;
      }

      .button {
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 5px 10px;
        color: inherit;
        background: rgba(127, 127, 127, 0.1);
        cursor: pointer;
      }

      .button:hover:not(:disabled) {
        border-color: var(--border-strong);
        background: var(--vscode-list-hoverBackground);
      }

      .button:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .cards {
        display: grid;
        gap: 12px;
        padding: 0 14px 14px;
      }

      .card {
        border: 1px solid var(--border);
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 28%), var(--surface);
        overflow: hidden;
      }

      .card.active {
        border-color: var(--accent);
        background: linear-gradient(180deg, rgba(80, 140, 255, 0.08), transparent 22%), var(--surface-active);
      }

      .card.complete:not(.active) {
        background: linear-gradient(180deg, rgba(46, 160, 67, 0.08), transparent 22%), var(--surface-complete);
      }

      .card-main {
        width: 100%;
        padding: 14px 14px 10px;
        border: 0;
        color: inherit;
        text-align: left;
        background: transparent;
        cursor: pointer;
      }

      .card-title {
        margin: 8px 0 0;
        font-size: 14px;
        font-weight: 700;
      }

      .card-copy {
        margin: 8px 0 0;
        color: var(--muted);
        display: -webkit-box;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
      }

      .meta-row {
        align-items: center;
      }

      .step-index {
        border: 1px solid var(--border);
        background: rgba(127, 127, 127, 0.1);
      }

      .context {
        color: var(--muted);
        font-size: 12px;
      }

      .tag {
        border: 1px solid rgba(80, 140, 255, 0.35);
        background: rgba(80, 140, 255, 0.14);
        text-transform: none;
        letter-spacing: normal;
      }

      .card-actions {
        padding: 0 14px 14px;
      }

      .empty-tour {
        margin: 0 14px 14px;
        padding: 14px;
        border: 1px dashed var(--border);
        border-radius: 14px;
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <div id="app" class="app"></div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const app = document.getElementById("app");
      let sidebarState = ${initialState};
      let expandedTourIds = new Set((vscode.getState() || {}).expandedTourIds || []);

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function persistExpandedState() {
        vscode.setState({
          expandedTourIds: Array.from(expandedTourIds)
        });
      }

      function ensureExpandedDefaults(state) {
        if (expandedTourIds.size > 0) {
          return;
        }

        state.tours.forEach((tour, index) => {
          if (tour.isActive || state.tours.length === 1 || index === 0) {
            expandedTourIds.add(tour.id);
          }
        });
      }

      function renderButton(label, action, attributes = {}) {
        const attrText = Object.entries(attributes)
          .map(([key, value]) => {
            if (value === false || value === undefined || value === null) {
              return "";
            }

            if (value === true) {
              return key;
            }

            return key + '="' + escapeHtml(value) + '"';
          })
          .filter(Boolean)
          .join(" ");

        return '<button class="button" data-action="' + escapeHtml(action) + '" ' + attrText + ">" + escapeHtml(label) + "</button>";
      }

      function renderTourActions(tour) {
        const actions = [];
        actions.push(
          renderButton(tour.isActive ? "Resume" : "Start", "startTour", {
            "data-tour-id": tour.id,
            "data-step-number": tour.isActive ? sidebarState.activeStepNumber : 0
          })
        );
        actions.push(
          renderButton(tour.isEditing ? "Preview" : "Edit", tour.isEditing ? "previewTour" : "editTour", {
            "data-tour-id": tour.id
          })
        );

        if (tour.isActive) {
          actions.push(renderButton("End", "endTour"));
        }

        actions.push(
          renderButton("Title", "changeTourTitle", {
            "data-tour-id": tour.id
          }),
          renderButton("Description", "changeTourDescription", {
            "data-tour-id": tour.id
          }),
          renderButton("Ref", "changeTourRef", {
            "data-tour-id": tour.id
          }),
          renderButton(tour.isPrimary ? "Unset Primary" : "Make Primary", tour.isPrimary ? "unmakeTourPrimary" : "makeTourPrimary", {
            "data-tour-id": tour.id
          }),
          renderButton("Export", "exportTour", {
            "data-tour-id": tour.id
          }),
          renderButton("Delete", "deleteTour", {
            "data-tour-id": tour.id
          })
        );

        return actions.join("");
      }

      function renderCard(step) {
        const statusBadges = [
          step.isActive ? '<span class="status-badge active">Active</span>' : "",
          !step.isActive && step.isComplete ? '<span class="status-badge">Done</span>' : ""
        ].join("");

        const tags = step.tags
          .map(tag => '<span class="tag">' + escapeHtml(tag) + "</span>")
          .join("");

        return \`
          <article class="card \${step.isActive ? "active" : ""} \${step.isComplete ? "complete" : ""}">
            <button
              class="card-main"
              data-action="startTour"
              data-tour-id="\${escapeHtml(step.tourId)}"
              data-step-number="\${step.stepNumber}"
            >
              <div class="meta-row">
                <span class="step-index">Step #\${step.stepNumber + 1}</span>
                \${statusBadges}
              </div>
              <h3 class="card-title">\${escapeHtml(step.title)}</h3>
              \${step.contextLabel ? '<div class="context">' + escapeHtml(step.contextLabel) + "</div>" : ""}
              \${step.descriptionPreview ? '<p class="card-copy">' + escapeHtml(step.descriptionPreview) + "</p>" : ""}
              \${tags ? '<div class="tag-row">' + tags + "</div>" : ""}
            </button>
            <div class="card-actions">
              \${renderButton("Edit", "editTourAtStep", {
                "data-tour-id": step.tourId,
                "data-step-number": step.stepNumber
              })}
              \${renderButton("Tags", "changeTourStepTags", {
                "data-tour-id": step.tourId,
                "data-step-number": step.stepNumber
              })}
              \${renderButton("Up", "moveTourStepBack", {
                "data-tour-id": step.tourId,
                "data-step-number": step.stepNumber,
                disabled: !step.canMoveBack
              })}
              \${renderButton("Down", "moveTourStepForward", {
                "data-tour-id": step.tourId,
                "data-step-number": step.stepNumber,
                disabled: !step.canMoveForward
              })}
              \${renderButton("Delete", "deleteTourStep", {
                "data-tour-id": step.tourId,
                "data-step-number": step.stepNumber
              })}
            </div>
          </article>
        \`;
      }

      function renderTour(tour) {
        const badges = [
          tour.isPrimary ? '<span class="status-badge primary">Primary</span>' : "",
          tour.isActive ? '<span class="status-badge active">Current</span>' : "",
          '<span class="status-badge">' + tour.stepCount + " steps</span>"
        ].join("");

        return \`
          <details class="section" data-tour-id="\${escapeHtml(tour.id)}" \${expandedTourIds.has(tour.id) ? "open" : ""}>
            <summary>
              <div class="summary-row">
                <h2 class="tour-title">\${escapeHtml(tour.title)}</h2>
                <div class="meta-row">\${badges}</div>
              </div>
              \${tour.description ? '<p class="tour-copy">' + escapeHtml(tour.description) + "</p>" : ""}
            </summary>
            <div class="tour-actions">\${renderTourActions(tour)}</div>
            \${tour.steps.length > 0
              ? '<div class="cards">' + tour.steps.map(renderCard).join("") + "</div>"
              : '<div class="empty-tour">No steps recorded yet.</div>'}
          </details>
        \`;
      }

      function renderEmptyState() {
        app.innerHTML = \`
          <section class="empty-state">
            <h1 class="empty-title">CodeTour</h1>
            <p class="empty-copy">Record a guided walkthrough or open a tour someone shared with you.</p>
            <div class="toolbar">
              \${renderButton("Record Tour", "recordTour")}
              \${renderButton("Open Tour File", "openTourFile")}
              \${renderButton("Open Tour URL", "openTourUrl")}
            </div>
          </section>
        \`;
      }

      function bindSectionToggles() {
        app.querySelectorAll("details[data-tour-id]").forEach(section => {
          section.ontoggle = () => {
            const tourId = section.dataset.tourId;
            if (!tourId) {
              return;
            }

            if (section.open) {
              expandedTourIds.add(tourId);
            } else {
              expandedTourIds.delete(tourId);
            }

            persistExpandedState();
          };
        });
      }

      function render(state) {
        sidebarState = state;
        ensureExpandedDefaults(state);

        if (!state.hasTours) {
          renderEmptyState();
          return;
        }

        app.innerHTML = state.tours.map(renderTour).join("");
        bindSectionToggles();
      }

      app.addEventListener("click", event => {
        const target = event.target.closest("[data-action]");
        if (!target || target.disabled) {
          return;
        }

        vscode.postMessage({
          type: "command",
          action: target.dataset.action,
          tourId: target.dataset.tourId,
          stepNumber:
            target.dataset.stepNumber === undefined
              ? undefined
              : Number(target.dataset.stepNumber)
        });
      });

      window.addEventListener("message", event => {
        if (event.data && event.data.type === "state") {
          render(event.data.state);
        }
      });

      render(sidebarState);
    </script>
  </body>
</html>`;
}

function getNonce() {
  return Math.random().toString(36).slice(2);
}
