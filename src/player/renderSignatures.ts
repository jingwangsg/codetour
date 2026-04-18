// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { ActiveTour, CodeTour, CodeTourStep } from "../store";

function serializeSiblingTour(tour: CodeTour) {
  return [tour.id, tour.title, tour.steps.length];
}

function serializeSelection(
  selection: CodeTourStep["selection"]
): [number, number, number, number] | null {
  if (!selection) {
    return null;
  }

  return [
    selection.start.line,
    selection.start.character,
    selection.end.line,
    selection.end.character
  ];
}

function serializeStep(step: CodeTourStep) {
  return [
    step.title ?? null,
    step.description,
    step.file ?? null,
    step.directory ?? null,
    step.contents ?? null,
    step.uri ?? null,
    step.view ?? null,
    step.line ?? null,
    serializeSelection(step.selection),
    step.commands ? [...step.commands] : null,
    step.pattern ?? null
  ];
}

export function getOverviewRenderSignature(
  tour: CodeTour | undefined,
  siblings: ReadonlyArray<CodeTour>
): string | null {
  if (!tour) {
    return null;
  }

  return JSON.stringify({
    tour: {
      id: tour.id,
      title: tour.title,
      overview: tour.overview ?? null,
      stepCount: tour.steps.length
    },
    siblings: siblings.map(serializeSiblingTour)
  });
}

export function getActiveTourRenderSignature(
  activeTour: ActiveTour | null | undefined,
  siblings: ReadonlyArray<CodeTour> = activeTour?.tours || []
): string | null {
  if (!activeTour) {
    return null;
  }

  return JSON.stringify({
    step: activeTour.step,
    tour: {
      id: activeTour.tour.id,
      title: activeTour.tour.title,
      ref: activeTour.tour.ref ?? null,
      nextTour: activeTour.tour.nextTour ?? null,
      steps: activeTour.tour.steps.map(serializeStep)
    },
    siblings: siblings.map(serializeSiblingTour)
  });
}
