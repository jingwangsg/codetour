// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export function getStepPageLocalResourceRoots(
  extensionDistUri: string | undefined,
  workspaceFolderUris: string[]
): string[] | undefined {
  const roots = [
    ...(extensionDistUri ? [extensionDistUri] : []),
    ...workspaceFolderUris
  ];
  const uniqueRoots = Array.from(new Set(roots));

  return uniqueRoots.length > 0 ? uniqueRoots : undefined;
}
