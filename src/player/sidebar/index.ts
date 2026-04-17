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
        | "deleteTour"
        | "showTourMenu";
      tourId: string;
      stepNumber?: number;
    }
  | {
      type: "command";
      action:
        | "editTourAtStep"
        | "changeTourStepColor"
        | "changeTourStepTags"
        | "deleteTourStep";
      tourId: string;
      stepNumber: number;
    }
  | {
      type: "command";
      action: "reorderTourStep";
      tourId: string;
      fromStep: number;
      toStep: number;
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
      case "showTourMenu":
        return this.showTourMenu(message.tourId);
      case "editTourAtStep":
      case "changeTourStepColor":
      case "changeTourStepTags":
      case "deleteTourStep":
        return vscode.commands.executeCommand(`${EXTENSION_NAME}.${message.action}`, {
          tourId: message.tourId,
          stepNumber: message.stepNumber
        });
      case "reorderTourStep":
        return vscode.commands.executeCommand(`${EXTENSION_NAME}.reorderTourStep`, {
          tourId: message.tourId,
          fromStep: message.fromStep,
          toStep: message.toStep
        });
    }
  }

  private async showTourMenu(tourId: string) {
    const state = buildSidebarState(store);
    const tour = state.tours.find(t => t.id === tourId);
    if (!tour) {
      return;
    }

    type MenuItem = vscode.QuickPickItem & { run: () => Thenable<unknown> | void };
    const target = { tourId };
    const run = (action: string, ...rest: unknown[]) =>
      vscode.commands.executeCommand(`${EXTENSION_NAME}.${action}`, target, ...rest);

    const items: MenuItem[] = [];

    if (tour.isActive) {
      items.push({
        label: "$(play) Resume Tour",
        run: () => run("startTour", state.activeStepNumber ?? 0)
      });
      items.push({
        label: "$(stop-circle) End Tour",
        run: () => vscode.commands.executeCommand(`${EXTENSION_NAME}.endTour`)
      });
    } else {
      items.push({
        label: "$(play) Start Tour",
        run: () => run("startTour", 0)
      });
    }

    items.push({
      label: tour.isEditing ? "$(preview) Preview Tour" : "$(edit) Edit Tour",
      run: () => run(tour.isEditing ? "previewTour" : "editTour")
    });
    items.push({ label: "$(pencil) Change Title", run: () => run("changeTourTitle") });
    items.push({ label: "$(note) Change Description", run: () => run("changeTourDescription") });
    items.push({ label: "$(git-branch) Change Ref", run: () => run("changeTourRef") });
    items.push({
      label: tour.isPrimary ? "$(star-empty) Unset Primary" : "$(star-full) Make Primary",
      run: () => run(tour.isPrimary ? "unmakeTourPrimary" : "makeTourPrimary")
    });
    items.push({ label: "$(export) Export Tour", run: () => run("exportTour") });
    items.push({ label: "$(trash) Delete Tour", run: () => run("deleteTour") });

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: tour.title,
      title: `Tour: ${tour.title}`
    });
    picked?.run();
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
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
        background: var(--vscode-sideBar-background, var(--vscode-editor-background));
        font: 13px/1.4 var(--vscode-font-family);
      }

      button {
        font: inherit;
      }

      .app {
        padding: 8px 8px 14px;
      }

      .empty-state {
        display: grid;
        gap: 10px;
        padding: 12px;
        border: 1px solid var(--vscode-editorWidget-border, transparent);
        border-radius: 6px;
        background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
      }

      .empty-title {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
      }

      .empty-copy {
        margin: 0;
        color: var(--vscode-descriptionForeground);
      }

      .toolbar,
      .summary-row,
      .tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .tour-header-end {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
      }

      .toolbar {
        margin-top: 4px;
      }

      .section {
        margin-bottom: 8px;
        border: 1px solid var(--vscode-editorWidget-border, transparent);
        border-radius: 6px;
        overflow: hidden;
        background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
      }

      .section[open] {
        border-color: var(--vscode-focusBorder);
      }

      summary {
        list-style: none;
        cursor: pointer;
        padding: 10px 10px 6px;
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
        font-size: 14px;
        font-weight: 600;
      }

      .tour-copy {
        margin: 6px 0 0;
        color: var(--vscode-descriptionForeground);
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        padding: 1px 7px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        border: 1px solid transparent;
      }

      .status-badge.primary {
        background: transparent;
        border-color: var(--vscode-focusBorder);
        color: var(--vscode-descriptionForeground);
      }

      .status-badge.active {
        background: transparent;
        border-color: var(--vscode-focusBorder);
        color: var(--vscode-focusBorder);
      }

      .button {
        border: 1px solid var(--vscode-button-border, transparent);
        border-radius: 3px;
        padding: 3px 8px;
        color: inherit;
        background: transparent;
        cursor: pointer;
      }

      .button:hover:not(:disabled) {
        background: var(--vscode-list-hoverBackground);
      }

      .button:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .cards {
        display: grid;
        gap: 4px;
        padding: 0 10px 10px;
      }

      .card {
        position: relative;
        border: 1px solid transparent;
        border-radius: 4px;
        background: transparent;
        display: flex;
        align-items: stretch;
        gap: 2px;
      }

      .card[draggable="true"] {
        cursor: grab;
      }

      .card:hover {
        background: var(--vscode-list-hoverBackground);
      }

      .card.has-color {
        border-color: var(--step-accent-border);
        background: var(--step-accent-background);
      }

      .card.has-color:hover {
        background:
          linear-gradient(
            0deg,
            var(--vscode-list-hoverBackground),
            var(--vscode-list-hoverBackground)
          ),
          var(--step-accent-background);
      }

      .card.active {
        border-left: 2px solid var(--vscode-focusBorder);
        background: var(--vscode-list-inactiveSelectionBackground, transparent);
      }

      .card.has-color.active {
        background:
          linear-gradient(
            0deg,
            var(--vscode-list-inactiveSelectionBackground, transparent),
            var(--vscode-list-inactiveSelectionBackground, transparent)
          ),
          var(--step-accent-background);
      }

      .card.complete:not(.active) {
        opacity: 0.65;
      }

      .card.dragging {
        opacity: 0.4;
      }

      .card.drop-before {
        border-top: 2px solid var(--vscode-focusBorder);
      }

      .card.drop-after {
        border-bottom: 2px solid var(--vscode-focusBorder);
      }

      .card-main {
        flex: 1 1 auto;
        min-width: 0;
        padding: 4px 6px;
        border: 0;
        color: inherit;
        text-align: left;
        background: transparent;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .card-header {
        display: flex;
        align-items: baseline;
        gap: 6px;
        min-width: 0;
      }

      .step-index {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        font-weight: 600;
        flex: 0 0 auto;
      }

      .card-title {
        margin: 0;
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }

      .tag-row {
        cursor: pointer;
        padding: 1px 0 0;
        margin: 0;
      }

      .tag {
        display: inline-flex;
        align-items: center;
        padding: 0 6px;
        border-radius: 999px;
        font-size: 10px;
        line-height: 16px;
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        border: 1px solid transparent;
      }

      .tag.placeholder {
        background: transparent;
        color: var(--vscode-descriptionForeground);
        border: 1px dashed var(--vscode-descriptionForeground);
        opacity: 0.55;
      }

      .tag-row:hover .tag:not(.placeholder) {
        border-color: var(--vscode-focusBorder);
      }

      .tag-row:hover .tag.placeholder {
        opacity: 1;
      }

      .card-actions {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 2px 4px;
        flex: 0 0 auto;
      }

      .icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        padding: 0;
        border: 0;
        border-radius: 3px;
        background: transparent;
        color: var(--vscode-icon-foreground, inherit);
        cursor: pointer;
        opacity: 0.65;
      }

      .icon-button:hover {
        opacity: 1;
        background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground));
      }

      .icon-button svg {
        width: 14px;
        height: 14px;
        display: block;
      }

      .empty-tour {
        margin: 0 10px 10px;
        padding: 10px;
        border: 1px dashed var(--vscode-editorWidget-border, var(--vscode-descriptionForeground));
        border-radius: 4px;
        color: var(--vscode-descriptionForeground);
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
      let dragState = null;
      let suppressNextClick = false;

      const ICON_EDIT = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M13.23 1a1.77 1.77 0 0 1 1.25 3.02l-.84.84-2.5-2.5.84-.84A1.77 1.77 0 0 1 13.23 1zm-3.02 2.43L1.97 11.67 1.5 14.5l2.83-.47 8.24-8.24-2.36-2.36z"/></svg>';
      const ICON_COLOR = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8.68 1.5 2.35 7.82a3.5 3.5 0 1 0 4.95 4.96l6.33-6.33L8.68 1.5zm-.62 10.57a2.25 2.25 0 0 1-3.18-3.18l4.95-4.95 3.18 3.18-4.95 4.95z"/><path fill="currentColor" d="M10.75 12.5c1.24 0 2.25.84 2.25 1.88 0 .34-.1.66-.29.93h-3.92c-.19-.27-.29-.6-.29-.93 0-1.04 1-1.88 2.25-1.88z"/></svg>';
      const ICON_DELETE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 8.707l3.646 3.647.708-.708L8.707 8l3.647-3.646-.708-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z"/></svg>';
      const ICON_MORE = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.3" fill="currentColor"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="12.5" cy="8" r="1.3" fill="currentColor"/></svg>';

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

      function renderCard(step) {
        const tagPills = step.tags.length
          ? step.tags.map(tag => '<span class="tag">' + escapeHtml(tag) + "</span>").join("")
          : '<span class="tag placeholder">+ tags</span>';

        const stateClass = [
          step.color ? "has-color" : "",
          step.isActive ? "active" : "",
          step.isComplete ? "complete" : ""
        ].filter(Boolean).join(" ");
        const styleAttribute = step.cardStyle
          ? ' style="' + escapeHtml(step.cardStyle) + '"'
          : "";

        return \`
          <article class="card \${stateClass}" draggable="true"\${styleAttribute}
                   data-tour-id="\${escapeHtml(step.tourId)}"
                   data-step-number="\${step.stepNumber}">
            <button class="card-main"
                    data-action="startTour"
                    data-tour-id="\${escapeHtml(step.tourId)}"
                    data-step-number="\${step.stepNumber}">
              <div class="card-header">
                <span class="step-index">#\${step.stepNumber + 1}</span>
                <h3 class="card-title">\${escapeHtml(step.title)}</h3>
              </div>
              <div class="tag-row"
                   data-action="changeTourStepTags"
                   data-tour-id="\${escapeHtml(step.tourId)}"
                   data-step-number="\${step.stepNumber}"
                   role="button"
                   title="Edit tags">\${tagPills}</div>
            </button>
            <div class="card-actions">
              <button class="icon-button"
                      data-action="changeTourStepColor"
                      data-tour-id="\${escapeHtml(step.tourId)}"
                      data-step-number="\${step.stepNumber}"
                      title="Change color">\${ICON_COLOR}</button>
              <button class="icon-button"
                      data-action="editTourAtStep"
                      data-tour-id="\${escapeHtml(step.tourId)}"
                      data-step-number="\${step.stepNumber}"
                      title="Edit step">\${ICON_EDIT}</button>
              <button class="icon-button"
                      data-action="deleteTourStep"
                      data-tour-id="\${escapeHtml(step.tourId)}"
                      data-step-number="\${step.stepNumber}"
                      title="Delete step">\${ICON_DELETE}</button>
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
                <div class="tour-header-end">
                  \${badges}
                  <button class="icon-button more-button"
                          data-action="showTourMenu"
                          data-tour-id="\${escapeHtml(tour.id)}"
                          title="More actions">\${ICON_MORE}</button>
                </div>
              </div>
              \${tour.description ? '<p class="tour-copy">' + escapeHtml(tour.description) + "</p>" : ""}
            </summary>
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

      function clearDropIndicators() {
        app.querySelectorAll(".card.drop-before, .card.drop-after").forEach(el => {
          el.classList.remove("drop-before", "drop-after");
        });
      }

      function bindCardDragHandlers() {
        app.querySelectorAll(".card[draggable='true']").forEach(card => {
          const tourId = card.dataset.tourId;
          const fromStep = Number(card.dataset.stepNumber);

          card.addEventListener("dragstart", event => {
            dragState = { tourId, fromStep };
            card.classList.add("dragging");
            if (event.dataTransfer) {
              event.dataTransfer.effectAllowed = "move";
              try { event.dataTransfer.setData("text/plain", String(fromStep)); } catch (e) {}
            }
          });

          card.addEventListener("dragend", () => {
            card.classList.remove("dragging");
            clearDropIndicators();
            dragState = null;
            suppressNextClick = true;
            setTimeout(() => { suppressNextClick = false; }, 0);
          });

          card.addEventListener("dragover", event => {
            if (!dragState || dragState.tourId !== tourId) {
              return;
            }
            event.preventDefault();
            const rect = card.getBoundingClientRect();
            const before = (event.clientY - rect.top) < rect.height / 2;
            clearDropIndicators();
            card.classList.add(before ? "drop-before" : "drop-after");
            if (event.dataTransfer) {
              event.dataTransfer.dropEffect = "move";
            }
          });

          card.addEventListener("dragleave", event => {
            if (!card.contains(event.relatedTarget)) {
              card.classList.remove("drop-before", "drop-after");
            }
          });

          card.addEventListener("drop", event => {
            if (!dragState || dragState.tourId !== tourId) {
              return;
            }
            event.preventDefault();
            const rect = card.getBoundingClientRect();
            const before = (event.clientY - rect.top) < rect.height / 2;
            let toStep = fromStep + (before ? 0 : 1);
            if (dragState.fromStep < toStep) {
              toStep -= 1;
            }
            clearDropIndicators();
            if (toStep !== dragState.fromStep) {
              vscode.postMessage({
                type: "command",
                action: "reorderTourStep",
                tourId: dragState.tourId,
                fromStep: dragState.fromStep,
                toStep
              });
            }
          });
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
        bindCardDragHandlers();
      }

      app.addEventListener("click", event => {
        if (suppressNextClick) {
          return;
        }

        const target = event.target.closest("[data-action]");
        if (!target || target.disabled) {
          return;
        }

        event.stopPropagation();
        // Prevent native <summary> toggle when clicking action controls inside it.
        if (target.closest("summary")) {
          event.preventDefault();
        }

        const payload = {
          type: "command",
          action: target.dataset.action,
          tourId: target.dataset.tourId,
          stepNumber:
            target.dataset.stepNumber === undefined
              ? undefined
              : Number(target.dataset.stepNumber)
        };

        vscode.postMessage(payload);
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
