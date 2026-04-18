// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { CodeTour } from ".";

const DEFAULT_MAIN_TOUR_FILES = [".tour", ".vscode/main.tour", "main.tour"];

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

export function isDiscoverableTourPath(
  relativePath: string,
  subTourDirectories: readonly string[],
  mainTourFiles: readonly string[] = DEFAULT_MAIN_TOUR_FILES
): boolean {
  const normalizedPath = normalizeRelativePath(relativePath);
  if (!normalizedPath.endsWith(".tour")) {
    return false;
  }

  if (
    mainTourFiles.some(
      mainTourFile => normalizeRelativePath(mainTourFile) === normalizedPath
    )
  ) {
    return true;
  }

  return subTourDirectories.some(directory => {
    const normalizedDirectory = normalizeRelativePath(directory).replace(
      /\/$/,
      ""
    );
    const prefix = `${normalizedDirectory}/`;
    return (
      normalizedPath.startsWith(prefix) && normalizedPath.length > prefix.length
    );
  });
}

export function syncTourInPlace(target: CodeTour, source: CodeTour): void {
  Object.keys(target).forEach(key => {
    if (!(key in source)) {
      delete (target as Partial<CodeTour>)[key as keyof CodeTour];
    }
  });

  Object.assign(target, source);
}

export function getReconciledActiveStep(
  currentStep: number,
  stepCount: number
): number | null {
  if (stepCount < 1) {
    return null;
  }

  return Math.max(0, Math.min(currentStep, stepCount - 1));
}
