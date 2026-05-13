// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { reaction } from "mobx";
import {
  commands,
  Comment,
  CommentAuthorInformation,
  CommentController,
  CommentMode,
  comments,
  CommentThread,
  CommentThreadCollapsibleState,
  ExtensionContext,
  MarkdownString,
  Range,
  Selection,
  TextDocument,
  TextEditor,
  TextEditorRevealType,
  Uri,
  ViewColumn,
  window,
  workspace
} from "vscode";
import { SMALL_ICON_URL } from "../constants";
import { EXTENSION_NAME } from "../constants";
import { CodeTour, store } from "../store";
import { initializeStorage } from "../store/storage";
import {
  getActiveStepMarker,
  getActiveTourNumber,
  getFileUri,
  getStepFileUri,
  getStepLabel,
  getTourTitle
} from "../utils";
import { registerCodeStatusModule } from "./codeStatus";
import { registerPlayerCommands } from "./commands";
import { registerDecorators } from "./decorator";
import {
  normalizeStepDisplayMode,
  STEP_DISPLAY_MODE_CONFIG_KEY,
  STEP_DISPLAY_MODE_PAGE,
  STEP_DISPLAY_MODE_SETTING
} from "./displayMode";
import {
  getStepPageViewColumn,
  shouldReuseVisibleEditor
} from "./editorLayout";
import { registerFileSystemProvider } from "./fileSystem";
import { registerTextDocumentContentProvider } from "./fileSystem/documentProvider";
import { registerOverviewModule } from "./overview";
import { getActiveTourRenderSignature } from "./renderSignatures";
import { registerSidebarViewProvider } from "./sidebar";
import { registerStatusBar } from "./status";
import {
  closeStepPage,
  openStepPage,
  registerStepPageModule,
  revealStepPage
} from "./stepPage";
import { buildStepPageMarkdown } from "./stepPage/renderer";

const CONTROLLER_ID = "codetour";
const CONTROLLER_LABEL = "CodeTour V2";

let id = 0;

const SHELL_SCRIPT_PATTERN = /^>>\s+(?<script>.*)$/gm;

const COMMAND_PATTERN =
  /(?<commandPrefix>\(command:[\w+\.]+\?)(?<params>\[[^\]\)]+\])/gm;

const TOUR_REFERENCE_PATTERN =
  /(?:\[(?<linkTitle>[^\]]+)\])?\[(?=\s*[^\]\s])(?<tourTitle>[^\]#]+)?(?:#(?<stepNumber>\d+))?\](?!\()/gm;
const FILE_REFERENCE_PATTERN = /(\!)?(\[[^\]]+\]\()(\.[^\)]+)(?=\))/gm;
const CODE_FENCE_PATTERN = /```[^\n]+\n(.+)\n```/gms;

export function generatePreviewContent(content: string) {
  return content
    .replace(SHELL_SCRIPT_PATTERN, (_, script) => {
      const args = encodeURIComponent(JSON.stringify([script]));
      const s = `> [${script}](command:codetour.sendTextToTerminal?${args} "Run \\"${script.replace(
        /"/g,
        "'"
      )}\\" in a terminal")`;
      return s;
    })
    .replace(COMMAND_PATTERN, (_, commandPrefix, params) => {
      const args = encodeURIComponent(JSON.stringify(JSON.parse(params)));
      return `${commandPrefix}${args}`;
    })
    .replace(FILE_REFERENCE_PATTERN, (_, isImage, prefix, filePath) => {
      const workspaceUri = workspace.getWorkspaceFolder(
        Uri.parse(store.activeTour!.tour.id)
      )!.uri;
      const fileUri = Uri.joinPath(workspaceUri, filePath);

      if (isImage) {
        return `!${prefix}${fileUri.toString()}`;
      } else {
        const args = encodeURIComponent(JSON.stringify([fileUri]));
        return `${prefix}command:vscode.open?${args} "Open ${filePath}"`;
      }
    })
    .replace(TOUR_REFERENCE_PATTERN, (_, linkTitle, tourTitle, stepNumber) => {
      if (!tourTitle) {
        const title = linkTitle || `#${stepNumber}`;
        return `[${title}](command:codetour.navigateToStep?${stepNumber} "Navigate to step #${stepNumber}")`;
      }

      const tours = store.activeTour?.tours || store.tours;
      const tour = tours.find(tour => getTourTitle(tour) === tourTitle);
      if (tour) {
        const args: [string, number?] = [tour.title];

        if (stepNumber) {
          args.push(Number(stepNumber));
        }
        const argsContent = encodeURIComponent(JSON.stringify(args));
        const title = linkTitle || tour.title;
        return `[${title}](command:codetour.startTourByTitle?${argsContent} "Start \\"${tour.title}\\" tour")`;
      }

      return _;
    })
    .replace(CODE_FENCE_PATTERN, (_, codeBlock) => {
      const params = encodeURIComponent(JSON.stringify([codeBlock]));
      return `${_}
↪ [Insert Code](command:codetour.insertCodeSnippet?${params} "Insert Code")`;
    });
}

export class CodeTourComment implements Comment {
  public id: string = (++id).toString();
  public contextValue: string = "";
  public author: CommentAuthorInformation = {
    name: CONTROLLER_LABEL,
    iconPath: Uri.parse(SMALL_ICON_URL)
  };
  public body: MarkdownString;

  constructor(
    content: string,
    public label: string = "",
    public parent: CommentThread,
    public mode: CommentMode
  ) {
    const body =
      mode === CommentMode.Preview ? generatePreviewContent(content) : content;

    this.body = new MarkdownString(body);
    this.body.isTrusted = true;
  }
}

let controller: CommentController | null;

export async function focusPlayer() {
  if (store.activeTour && shouldUseStepPage()) {
    await renderCurrentStep({ runStepCommands: false });
    revealStepPage();
    return;
  }

  const currentThread = store.activeTour?.thread;
  if (currentThread?.range) {
    await showDocument(currentThread.uri, currentThread.range);
  } else if (store.activeTour) {
    await renderCurrentStep({ runStepCommands: false });
  }
}

function updateCurrentThreadNavigation(
  thread: CommentThread,
  hasPreviousStep: boolean,
  hasNextStep: boolean,
  collapsibleState: CommentThreadCollapsibleState
) {
  const contextValues = [];
  if (hasPreviousStep) {
    contextValues.push("hasPrevious");
  }

  if (hasNextStep) {
    contextValues.push("hasNext");
  }

  // @ts-ignore
  thread.canReply = false;
  thread.contextValue = contextValues.join(".");
  thread.collapsibleState = collapsibleState;
}

export async function startPlayer() {
  if (controller) {
    controller.dispose();
  }

  controller = comments.createCommentController(
    CONTROLLER_ID,
    CONTROLLER_LABEL
  );

  // TODO: Correctly limit the commenting ranges
  // to files within the workspace root
  controller.commentingRangeProvider = {
    provideCommentingRanges: (document: TextDocument) => {
      if (store.isRecording) {
        return [new Range(0, 0, document.lineCount, 0)];
      } else {
        return null;
      }
    }
  };
}

export async function stopPlayer() {
  if (store.activeTour?.thread) {
    store.activeTour!.thread.dispose();
    store.activeTour!.thread = null;
  }

  closeStepPage();

  if (controller) {
    controller.dispose();
    controller = null;
  }
}

const VIEW_COMMANDS = new Map([
  ["comments", "workbench.panel.comments"],
  ["console", "workbench.panel.console"],
  ["debug", "workbench.view.debug"],
  ["debug:breakpoints", "workbench.debug.action.focusBreakpointsView"],
  ["debug:callstack", "workbench.debug.action.focusCallStackView"],
  ["debug:variables", "workbench.debug.action.focusVariablesView"],
  ["debug:watch", "workbench.debug.action.focusWatchView"],
  ["explorer", "workbench.view.explorer"],
  ["extensions", "workbench.view.extensions"],
  ["extensions:disabled", "extensions.disabledExtensionList.focus"],
  ["extensions:enabled", "extensions.enabledExtensionList.focus"],
  ["output", "workbench.panel.output"],
  ["problems", "workbench.panel.markers"],
  ["scm", "workbench.view.scm"],
  ["search", "workbench.view.search"],
  ["terminal", "terminal.focus"]
]);

function getPreviousTour(): CodeTour | undefined {
  const previousTour = store.tours.find(
    tour => tour.nextTour === store.activeTour?.tour.title
  );

  if (previousTour) {
    return previousTour;
  }

  const match = store.activeTour?.tour.title.match(/^#?(\d+)\s+-/);
  if (match) {
    const previousTourNumber = Number(match[1]) - 1;
    return store.tours.find(tour =>
      tour.title.match(new RegExp(`^#?${previousTourNumber}\\s+[-:]`))
    );
  }
}

function getNextTour(): CodeTour | undefined {
  if (store.activeTour?.tour.nextTour) {
    return store.tours.find(
      tour => tour.title === store.activeTour?.tour.nextTour
    );
  } else {
    const tourNumber = getActiveTourNumber();
    if (tourNumber) {
      const nextTourNumber = tourNumber + 1;
      return store.tours.find(tour =>
        tour.title.match(new RegExp(`^#?${nextTourNumber}\\s+[-:]`))
      );
    }
  }
}

function getStepDisplayMode() {
  return normalizeStepDisplayMode(
    workspace
      .getConfiguration(EXTENSION_NAME)
      .get(STEP_DISPLAY_MODE_SETTING)
  );
}

function shouldUseStepPage(): boolean {
  return (
    getStepDisplayMode() === STEP_DISPLAY_MODE_PAGE &&
    !store.isRecording &&
    !store.isEditing
  );
}

function getTourCommandArgs(tour: CodeTour): string {
  return encodeURIComponent(JSON.stringify([tour.title]));
}

interface RenderCurrentStepOptions {
  runStepCommands?: boolean;
}

async function renderCurrentStep({
  runStepCommands = true
}: RenderCurrentStepOptions = {}) {
  if (store.activeTour!.thread) {
    store.activeTour!.thread.dispose();
    store.activeTour!.thread = null;
  }

  const currentTour = store.activeTour!.tour;
  const currentStep = store.activeTour!.step;

  const step = currentTour!.steps[currentStep];
  if (!step) {
    return;
  }

  const workspaceRoot = store.activeTour?.workspaceRoot;
  const uri = await getStepFileUri(step, workspaceRoot, currentTour.ref);

  let line = step.line
    ? step.line - 1
    : step.selection
    ? step.selection.end.line - 1
    : undefined;

  if (step.file && line === undefined) {
    const stepPattern = step.pattern || getActiveStepMarker();
    if (stepPattern) {
      const document = await workspace.openTextDocument(uri);
      const match = document.getText().match(new RegExp(stepPattern, "m"));
      if (match) {
        line = document.positionAt(match.index!).line;
      }
    }
  }

  if (line === undefined) {
    // The step doesn't have a discoverable line number and so
    // stick the step at the end of the file. Unfortunately, there
    // isn't a way to say EOF, so 2000 is a temporary hack.
    line = 2000;
  }

  const range = new Range(line!, 0, line!, 0);
  let label = `Step #${currentStep + 1} of ${currentTour!.steps.length}`;

  if (currentTour.title) {
    const title = getTourTitle(currentTour);
    label += ` (${title})`;
  }

  const mode =
    store.isRecording && store.isEditing
      ? CommentMode.Editing
      : CommentMode.Preview;
  let content = step.description;

  let hasPreviousStep = currentStep > 0;
  const hasNextStep = currentStep < currentTour.steps.length - 1;
  const isFinalStep = currentStep === currentTour.steps.length - 1;

  const showNavigation = hasPreviousStep || hasNextStep || isFinalStep;
  if (!store.isEditing && showNavigation) {
    content += "\n\n---\n";

    if (hasPreviousStep) {
      const stepLabel = getStepLabel(
        currentTour,
        currentStep - 1,
        false,
        false
      );
      const suffix = stepLabel ? ` (${stepLabel})` : "";
      content += `← [Previous${suffix}](command:codetour.previousTourStep "Navigate to previous step")`;
    } else {
      const previousTour = getPreviousTour();
      if (previousTour) {
        hasPreviousStep = true;

        const tourTitle = getTourTitle(previousTour);
        const argsContent = getTourCommandArgs(previousTour);
        content += `← [Previous Tour (${tourTitle})](command:codetour.startTourByTitle?${argsContent} "Navigate to previous tour")`;
      }
    }

    const prefix = hasPreviousStep ? " | " : "";
    if (hasNextStep) {
      const stepLabel = getStepLabel(
        currentTour,
        currentStep + 1,
        false,
        false
      );
      const suffix = stepLabel ? ` (${stepLabel})` : "";
      content += `${prefix}[Next${suffix}](command:codetour.nextTourStep "Navigate to next step") →`;
    } else if (isFinalStep) {
      const nextTour = getNextTour();
      if (nextTour) {
        const tourTitle = getTourTitle(nextTour);
        const argsContent = getTourCommandArgs(nextTour);
        content += `${prefix}[Next Tour (${tourTitle})](command:codetour.finishTour?${argsContent} "Start next tour")`;
      } else {
        content += `${prefix}[Finish Tour](command:codetour.finishTour "Finish the tour")`;
      }
    }

    content += "\n\n&nbsp;";
  }

  let selection;
  if (step.selection) {
    // Adjust the 1-based positions
    // to the 0-based positions that
    // VS Code's editor uses.
    selection = new Selection(
      step.selection.start.line - 1,
      step.selection.start.character - 1,
      step.selection.end.line - 1,
      step.selection.end.character - 1
    );
  } else {
    selection = new Selection(range.start, range.end);
  }

  if (shouldUseStepPage()) {
    const previousTour = currentStep === 0 ? getPreviousTour() : undefined;
    const nextTour = isFinalStep ? getNextTour() : undefined;
    const stepMarkdown = generatePreviewContent(
      buildStepPageMarkdown({
        tour: currentTour,
        stepNumber: currentStep,
        previousStepLabel: currentStep > 0
          ? getStepLabel(currentTour, currentStep - 1, false, false)
          : undefined,
        nextStepLabel: hasNextStep
          ? getStepLabel(currentTour, currentStep + 1, false, false)
          : undefined,
        previousTourLabel: previousTour ? getTourTitle(previousTour) : undefined,
        previousTourCommandArgs: previousTour
          ? getTourCommandArgs(previousTour)
          : undefined,
        nextTourLabel: nextTour ? getTourTitle(nextTour) : undefined,
        nextTourCommandArgs: nextTour ? getTourCommandArgs(nextTour) : undefined,
        isFinalStep
      })
    );

    store.activeTour!.thread = controller!.createCommentThread(uri, range, []);
    const anchorComment = new CodeTourComment(
      `[Open CodeTour V2 page](command:codetour.resumeTour "Open current step in CodeTour V2 page")`,
      label,
      store.activeTour!.thread!,
      CommentMode.Preview
    );
    store.activeTour!.thread.comments = [anchorComment];
    updateCurrentThreadNavigation(
      store.activeTour!.thread,
      hasPreviousStep,
      hasNextStep,
      CommentThreadCollapsibleState.Collapsed
    );

    const editor = await showDocument(uri, range, selection, ViewColumn.One);
    openStepPage(
      { tour: currentTour, stepNumber: currentStep, stepMarkdown },
      getStepPageViewColumn(editor.viewColumn, ViewColumn.Beside) as ViewColumn
    );

    if (step.directory) {
      const directoryUri = getFileUri(step.directory, workspaceRoot);
      commands.executeCommand("revealInExplorer", directoryUri);
    } else if (step.view) {
      await focusStepView(step.view);
    }

    if (runStepCommands && step.commands) {
      await executeStepCommands(step.commands);
    }

    return;
  }

  closeStepPage();

  store.activeTour!.thread = controller!.createCommentThread(uri, range, []);

  const comment = new CodeTourComment(
    content,
    label,
    store.activeTour!.thread!,
    mode
  );

  store.activeTour!.thread.comments = [comment];
  updateCurrentThreadNavigation(
    store.activeTour!.thread,
    hasPreviousStep,
    hasNextStep,
    CommentThreadCollapsibleState.Expanded
  );

  await showDocument(uri, range, selection);

  if (step.directory) {
    const directoryUri = getFileUri(step.directory, workspaceRoot);
    commands.executeCommand("revealInExplorer", directoryUri);
  } else if (step.view) {
    await focusStepView(step.view);
  }

  if (runStepCommands && step.commands) {
    await executeStepCommands(step.commands);
  }
}

async function focusStepView(view: string) {
  const commandName = VIEW_COMMANDS.has(view)
    ? VIEW_COMMANDS.get(view)!
    : `${view}.focus`;

  try {
    await commands.executeCommand(commandName);
  } catch {
    window.showErrorMessage(
      `The current tour step is attempting to focus a view which isn't available: ${view}. Please check the tour and try again.`
    );
  }
}

async function executeStepCommands(stepCommands: string[]) {
  for (const command of stepCommands) {
    let name = command,
      args: any[] = [];

    if (command.includes("?")) {
      const parts = command.split("?");
      name = parts[0];
      args = JSON.parse(parts[1]);
    }

    try {
      console.log("Executing command", name, JSON.stringify(args));
      await commands.executeCommand(name, ...args);
    } catch (e) {
      window.showErrorMessage(`An error has occurred: ${e}`);
    }
  }
}

async function showDocument(
  uri: Uri,
  range: Range,
  selection?: Selection,
  viewColumn?: ViewColumn
): Promise<TextEditor> {
  const uriString = uri.toString();
  const document =
    window.visibleTextEditors.find(
      editor =>
        shouldReuseVisibleEditor(
          editor.document.uri.toString(),
          uriString,
          editor.viewColumn,
          viewColumn
        )
    ) ||
    (await window.showTextDocument(uri, { preserveFocus: true, viewColumn }));

  // TODO: Figure out how to force focus when navigating
  // to documents which are already open.

  if (selection) {
    document.selection = selection;
  }

  document.revealRange(range, TextEditorRevealType.InCenter);
  return document;
}

export function registerPlayerModule(context: ExtensionContext) {
  registerPlayerCommands();
  registerSidebarViewProvider(context);
  registerFileSystemProvider();
  registerTextDocumentContentProvider();
  registerStatusBar();
  registerDecorators();
  registerCodeStatusModule();
  registerOverviewModule(context);
  registerStepPageModule(context);

  initializeStorage(context);

  context.subscriptions.push(
    workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration(STEP_DISPLAY_MODE_CONFIG_KEY)) {
        if (store.activeTour) {
          renderCurrentStep({ runStepCommands: false });
        } else {
          closeStepPage();
        }
      }
    })
  );

  // Watch for changes to the active tour property,
  // and automatically re-render the current step in response.
  reaction(
    () => getActiveTourRenderSignature(store.activeTour, store.tours),
    () => {
      if (store.activeTour) {
        renderCurrentStep();
      }
    }
  );
}
