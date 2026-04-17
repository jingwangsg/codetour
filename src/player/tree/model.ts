// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CodeTour } from "../../store";

export interface TourTreeStepItem {
  kind: "step";
  stepNumber: number;
}

export interface TourTreeGroupItem {
  kind: "group";
  path: string;
  label: string;
  children: TourTreeItem[];
}

export type TourTreeItem = TourTreeGroupItem | TourTreeStepItem;

export function buildTourTree(tour: CodeTour): TourTreeItem[] {
  const root: TourTreeItem[] = [];
  const groups = new Map<string, TourTreeGroupItem>();

  tour.steps.forEach((_, stepNumber) => {
    const groupSegments = getStepGroupSegments(tour, stepNumber);

    if (groupSegments.length === 0) {
      root.push({ kind: "step", stepNumber });
      return;
    }

    let children = root;
    const currentPath: string[] = [];

    groupSegments.forEach(segment => {
      currentPath.push(segment);

      const path = currentPath.join("/");
      let group = groups.get(path);
      if (!group) {
        group = {
          kind: "group",
          path,
          label: segment,
          children: []
        };

        groups.set(path, group);
        children.push(group);
      }

      children = group.children;
    });

    children.push({ kind: "step", stepNumber });
  });

  return root;
}

export function findGroupChildren(
  tree: TourTreeItem[],
  groupPath?: string
): TourTreeItem[] {
  if (!groupPath) {
    return tree;
  }

  const group = findGroup(tree, groupPath);
  return group?.children || [];
}

export function getParentGroupPath(groupPath?: string): string | undefined {
  if (!groupPath) {
    return;
  }

  const segments = groupPath.split("/");
  segments.pop();

  return segments.length > 0 ? segments.join("/") : undefined;
}

export function getStepGroupPath(
  tour: CodeTour,
  stepNumber: number
): string | undefined {
  const segments = getStepGroupSegments(tour, stepNumber);
  return segments.length > 0 ? segments.join("/") : undefined;
}

export function isStepInGroupPath(
  tour: CodeTour,
  stepNumber: number,
  groupPath: string
): boolean {
  const stepGroupPath = getStepGroupPath(tour, stepNumber);
  return !!stepGroupPath && (stepGroupPath === groupPath || stepGroupPath.startsWith(`${groupPath}/`));
}

function findGroup(
  items: TourTreeItem[],
  groupPath: string
): TourTreeGroupItem | undefined {
  for (const item of items) {
    if (item.kind !== "group") {
      continue;
    }

    if (item.path === groupPath) {
      return item;
    }

    const childMatch = findGroup(item.children, groupPath);
    if (childMatch) {
      return childMatch;
    }
  }
}

function getStepGroupSegments(tour: CodeTour, stepNumber: number): string[] {
  return normalizeGroupSegments(tour.steps[stepNumber].group);
}

function normalizeGroupSegments(group?: string): string[] {
  if (!group) {
    return [];
  }

  return group
    .split("/")
    .map(segment => segment.trim())
    .filter(segment => !!segment);
}
