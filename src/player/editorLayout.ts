// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export function shouldReuseVisibleEditor(
  editorUri: string,
  targetUri: string,
  editorViewColumn: number | undefined,
  requestedViewColumn: number | undefined
): boolean {
  return (
    editorUri === targetUri &&
    (requestedViewColumn === undefined ||
      editorViewColumn === requestedViewColumn)
  );
}

export function getStepPageViewColumn(
  sourceViewColumn: number | undefined,
  besideViewColumn: number
): number {
  return sourceViewColumn && sourceViewColumn > 0
    ? sourceViewColumn + 1
    : besideViewColumn;
}
