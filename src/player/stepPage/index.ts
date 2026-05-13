// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
  Disposable,
  ExtensionContext,
  Uri,
  ViewColumn,
  WebviewPanel,
  window,
  workspace
} from "vscode";
import { EXTENSION_NAME } from "../../constants";
import { CodeTour } from "../../store";
import { renderMarkdownWithMermaid } from "../markdown";
import { getStepPageLocalResourceRoots } from "./resources";
import { renderStepPageHtml, rewriteImageSources } from "./renderer";

interface StepPageState {
  tour: CodeTour;
  stepNumber: number;
  stepMarkdown: string;
}

let panel: WebviewPanel | undefined;
let latestState: StepPageState | undefined;
let extensionUri: Uri | undefined;

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

function getMermaidScriptUri(panel: WebviewPanel): string | undefined {
  if (!extensionUri) {
    return undefined;
  }

  const scriptUri = Uri.joinPath(extensionUri, "dist", "mermaid-webview.js");
  return panel.webview.asWebviewUri(scriptUri).toString();
}

function getLocalResourceRoots(): Uri[] | undefined {
  const extensionDistUri = extensionUri
    ? Uri.joinPath(extensionUri, "dist").toString()
    : undefined;
  const workspaceFolderUris =
    workspace.workspaceFolders?.map(folder => folder.uri.toString()) || [];
  const roots = getStepPageLocalResourceRoots(
    extensionDistUri,
    workspaceFolderUris
  );

  return roots?.map(root => Uri.parse(root));
}

function renderMarkdown(source: string, panel: WebviewPanel): string {
  const html = renderMarkdownWithMermaid(source);
  return rewriteImageSources(html, imageSource => {
    try {
      const uri = Uri.parse(imageSource);
      if (uri.scheme === "file") {
        return panel.webview.asWebviewUri(uri).toString();
      }
    } catch {
      // Leave malformed image sources unchanged and let the webview handle them.
    }

    return imageSource;
  });
}

function updatePanel(): void {
  if (!panel || !latestState) {
    return;
  }

  const nonce = getNonce();
  panel.title = `CodeTour V2: ${latestState.tour.title}`;
  panel.webview.html = renderStepPageHtml({
    ...latestState,
    cspSource: panel.webview.cspSource,
    nonce,
    mermaidScriptUri: getMermaidScriptUri(panel),
    renderMarkdown: source => renderMarkdown(source, panel!)
  });
}

export function openStepPage(
  state: StepPageState,
  viewColumn: ViewColumn = ViewColumn.Beside
): void {
  latestState = state;

  if (!panel) {
    panel = window.createWebviewPanel(
      `${EXTENSION_NAME}.stepPage`,
      `CodeTour V2: ${state.tour.title}`,
      { viewColumn, preserveFocus: true },
      {
        enableCommandUris: true,
        enableScripts: true,
        localResourceRoots: getLocalResourceRoots(),
        retainContextWhenHidden: true
      }
    );

    panel.onDidDispose(() => {
      panel = undefined;
      latestState = undefined;
    });
  } else {
    panel.reveal(viewColumn, true);
  }

  updatePanel();
}

export function revealStepPage(): void {
  if (panel) {
    panel.reveal(panel.viewColumn ?? ViewColumn.Beside, true);
  }
}

export function closeStepPage(): void {
  if (panel) {
    panel.dispose();
  }
  panel = undefined;
  latestState = undefined;
}

export function registerStepPageModule(context: ExtensionContext): void {
  extensionUri = context.extensionUri;

  const disposable: Disposable = {
    dispose() {
      closeStepPage();
    }
  };
  context.subscriptions.push(disposable);
}
