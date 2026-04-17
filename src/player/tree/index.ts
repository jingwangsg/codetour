// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { reaction } from "mobx";
import {
  Disposable,
  Event,
  EventEmitter,
  MarkdownString,
  TreeDataProvider,
  TreeItem,
  window
} from "vscode";
import { EXTENSION_NAME } from "../../constants";
import { generatePreviewContent } from "..";
import { store } from "../../store";
import { CodeTourNode, CodeTourStepGroupNode, CodeTourStepNode } from "./nodes";
import { buildTourTree, findGroupChildren } from "./model";

class CodeTourTreeProvider implements TreeDataProvider<TreeItem>, Disposable {
  private _disposables: Disposable[] = [];

  private _onDidChangeTreeData = new EventEmitter<TreeItem | undefined>();
  public readonly onDidChangeTreeData: Event<TreeItem | undefined> = this
    ._onDidChangeTreeData.event;

  constructor(private extensionPath: string) {
    reaction(
      () => [
        store.tours,
        store.hasTours,
        store.isRecording,
        store.progress.map(([id, completedSteps]) => [
          id,
          completedSteps.map(step => step)
        ]),
        store.activeTour
          ? [
              store.activeTour.tour.title,
              store.activeTour.tour.description,
              store.activeTour.tour.steps.map(step => [
                step.title,
                step.group,
                step.markerTitle,
                step.description
              ])
            ]
          : null
      ],
      () => {
        this._onDidChangeTreeData.fire(undefined);
      }
    );
  }

  getTreeItem = (node: TreeItem) => node;

  async getChildren(element?: TreeItem): Promise<TreeItem[] | undefined> {
    if (!element) {
      if (!store.hasTours && !store.activeTour) {
        return undefined;
      } else {
        const tours = store.tours.map(
          tour => new CodeTourNode(tour, this.extensionPath)
        );

        if (
          store.activeTour &&
          !store.tours.find(tour => tour.id === store.activeTour?.tour.id)
        ) {
          tours.unshift(
            new CodeTourNode(store.activeTour.tour, this.extensionPath)
          );
        }

        return tours;
      }
    } else if (element instanceof CodeTourNode) {
      if (element.tour.steps.length === 0) {
        let item;

        if (store.isRecording && store.activeTour?.tour.id == element.tour.id) {
          item = new TreeItem("Add tour step...");
          item.command = {
            command: "codetour.addContentStep",
            title: "Add tour step..."
          };
        } else {
          item = new TreeItem("No steps recorded");
        }

        return [item];
      } else {
        return this.getTourTreeItems(element.tour);
      }
    } else if (element instanceof CodeTourStepGroupNode) {
      return this.getTourTreeItems(element.tour, element.groupPath);
    }
  }

  async getParent(element: TreeItem): Promise<TreeItem | null> {
    if (element instanceof CodeTourStepNode) {
      if (element.parentGroupPath) {
        return new CodeTourStepGroupNode(element.tour, element.parentGroupPath);
      }

      return new CodeTourNode(element.tour, this.extensionPath);
    } else if (element instanceof CodeTourStepGroupNode) {
      if (element.parentGroupPath) {
        return new CodeTourStepGroupNode(element.tour, element.parentGroupPath);
      }

      return new CodeTourNode(element.tour, this.extensionPath);
    } else {
      return null;
    }
  }

  // This is called whenever a tree item is hovered over, and we're
  // using it to generate preview tooltips for tour steps on-demand.
  async resolveTreeItem(element: TreeItem): Promise<TreeItem> {
    if (element instanceof CodeTourStepNode) {
      const content = generatePreviewContent(
        element.tour.steps[element.stepNumber].description
      );

      const tooltip = new MarkdownString(content);
      tooltip.isTrusted = true;

      // @ts-ignore
      element.tooltip = tooltip;
    }

    return element;
  }

  dispose() {
    this._disposables.forEach(disposable => disposable.dispose());
  }

  private getTourTreeItems(tour: CodeTourNode["tour"], groupPath?: string) {
    const tree = buildTourTree(tour);
    const items = findGroupChildren(tree, groupPath);

    return items.map(item =>
      item.kind === "group"
        ? new CodeTourStepGroupNode(tour, item.path)
        : new CodeTourStepNode(tour, item.stepNumber)
    );
  }
}

export function registerTreeProvider(extensionPath: string) {
  const treeDataProvider = new CodeTourTreeProvider(extensionPath);
  const treeView = window.createTreeView(`${EXTENSION_NAME}.tours`, {
    showCollapseAll: true,
    treeDataProvider,
    canSelectMany: true
  });

  let isRevealPending = false;
  treeView.onDidChangeVisibility(e => {
    if (e.visible && isRevealPending) {
      isRevealPending = false;
      revealCurrentStepNode();
    }
  });

  function revealCurrentStepNode() {
    setTimeout(() => {
      treeView.reveal(new CodeTourStepNode(store.activeTour!.tour, store.activeTour!.step), {
        expand: true
      });
    }, 300);
  }

  reaction(
    () => [
      store.activeTour
        ? [
            store.activeTour.tour.title,
            store.activeTour.tour.steps.map(step => [step.title, step.group]),
            store.activeTour.step
          ]
        : null
    ],
    () => {
      if (store.activeTour && store.activeTour.step >= 0) {
        if (
          !treeView.visible ||
          store.activeTour.tour.steps[store.activeTour.step].view
        ) {
          isRevealPending = true;
          return;
        }

        revealCurrentStepNode();
      } else {
        // TODO: Once VS Code supports it, we want
        // to de-select the step node once the tour ends.
        treeView.message = undefined;
      }
    }
  );
}
