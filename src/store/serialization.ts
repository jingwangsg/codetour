// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { CodeTour, CodeTourStep } from ".";

export const CODETOUR_SCHEMA_URL = "https://aka.ms/codetour-schema";

export function normalizeTags(
  tags?: readonly string[]
): string[] | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  const normalizedTags = tags
    .map(tag => tag.trim())
    .filter(tag => !!tag);

  return normalizedTags.length > 0 ? normalizedTags : undefined;
}

export function parseTagsInput(input: string): string[] | undefined {
  return normalizeTags(input.split(","));
}

export function sanitizeStepForPersistence(
  step: CodeTourStep
): Omit<CodeTourStep, "markerTitle"> {
  const sanitizedStep = { ...step } as Partial<CodeTourStep> & {
    group?: string;
  };

  delete sanitizedStep.group;
  delete sanitizedStep.markerTitle;

  const normalizedTags = normalizeTags(step.tags);
  if (normalizedTags) {
    sanitizedStep.tags = normalizedTags;
  } else {
    delete sanitizedStep.tags;
  }

  return sanitizedStep as Omit<CodeTourStep, "markerTitle">;
}

export function createPersistedTour(
  tour: CodeTour
): Omit<CodeTour, "id"> & { $schema: string } {
  const persistedTour: Partial<CodeTour> & { $schema: string } = {
    $schema: CODETOUR_SCHEMA_URL,
    ...tour,
    steps: tour.steps.map(step => sanitizeStepForPersistence(step))
  };

  delete persistedTour.id;

  return persistedTour as Omit<CodeTour, "id"> & { $schema: string };
}
