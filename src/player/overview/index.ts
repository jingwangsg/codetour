// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { reaction } from "mobx";
import { marked } from "marked";
import {
  commands,
  Disposable,
  ExtensionContext,
  ViewColumn,
  WebviewPanel,
  window
} from "vscode";
import { EXTENSION_NAME } from "../../constants";
import { CodeTour, store } from "../../store";
import { getOverviewRenderSignature } from "../renderSignatures";
import { renderOverviewHtml } from "./renderer";

interface PanelRecord {
  panel: WebviewPanel;
  disposeReaction: () => void;
}

const panels = new Map<string, PanelRecord>();

const NONCE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function getNonce(): string {
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += NONCE_ALPHABET.charAt(
      Math.floor(Math.random() * NONCE_ALPHABET.length)
    );
  }
  return nonce;
}

function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false }) as string;
}

function updatePanel(panel: WebviewPanel, tour: CodeTour): void {
  panel.title = `${tour.title} — Overview`;
  panel.webview.html = renderOverviewHtml({
    tour,
    siblings: store.tours,
    cspSource: panel.webview.cspSource,
    nonce: getNonce(),
    renderMarkdown
  });
}

function findTour(tourId: string): CodeTour | undefined {
  if (store.activeTour?.tour.id === tourId) {
    return store.activeTour.tour;
  }
  return store.tours.find(tour => tour.id === tourId);
}

export function openTourOverview(tour: CodeTour): void {
  const existing = panels.get(tour.id);
  if (existing) {
    existing.panel.reveal(existing.panel.viewColumn ?? ViewColumn.Active);
    updatePanel(existing.panel, tour);
    return;
  }

  const panel = window.createWebviewPanel(
    `${EXTENSION_NAME}.overview`,
    `${tour.title} — Overview`,
    { viewColumn: ViewColumn.Active, preserveFocus: false },
    { enableScripts: true, retainContextWhenHidden: true }
  );

  const disposeReaction = reaction(
    () => getOverviewRenderSignature(findTour(tour.id), store.tours),
    () => {
      const current = findTour(tour.id);
      if (current) {
        updatePanel(panel, current);
      } else {
        panel.dispose();
      }
    }
  );

  panel.webview.onDidReceiveMessage(message => {
    if (!message || message.type !== "openStep") {
      return;
    }
    const targetTourId: string | undefined = message.tourId;
    const stepNumber: number = Number(message.stepNumber);
    if (!targetTourId || !Number.isInteger(stepNumber) || stepNumber < 1) {
      return;
    }
    commands.executeCommand(
      `${EXTENSION_NAME}.startTour`,
      { tourId: targetTourId },
      stepNumber - 1
    );
  });

  panel.onDidDispose(() => {
    disposeReaction();
    panels.delete(tour.id);
  });

  panels.set(tour.id, { panel, disposeReaction });
  updatePanel(panel, tour);
}

export function registerOverviewModule(context: ExtensionContext): void {
  const disposable: Disposable = {
    dispose() {
      panels.forEach(record => {
        record.disposeReaction();
        record.panel.dispose();
      });
      panels.clear();
    }
  };
  context.subscriptions.push(disposable);
}
