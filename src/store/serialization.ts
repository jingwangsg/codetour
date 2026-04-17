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

export function normalizeColor(color?: string): string | undefined {
  if (!color) {
    return undefined;
  }

  const normalizedColor = color.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(normalizedColor)) {
    return `#${normalizedColor
      .slice(1)
      .split("")
      .map(char => char + char)
      .join("")}`;
  }

  if (/^#[0-9a-f]{6}$/.test(normalizedColor)) {
    return normalizedColor;
  }

  return undefined;
}

export function parseColorInput(input: string): string | undefined {
  return normalizeColor(input);
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

  const normalizedColor = normalizeColor(step.color);
  if (normalizedColor) {
    sanitizedStep.color = normalizedColor;
  } else {
    delete sanitizedStep.color;
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
