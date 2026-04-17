// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CodeTour, store } from "./store";

export interface TourTarget {
  tourId: string;
}

export interface StepTarget extends TourTarget {
  stepNumber: number;
}

export function resolveTour(target?: CodeTour | TourTarget): CodeTour | undefined {
  if (!target) {
    return store.activeTour?.tour;
  }

  if (isCodeTour(target)) {
    return target;
  }

  return (
    store.tours.find(tour => tour.id === target.tourId) ||
    (store.activeTour?.tour.id === target.tourId
      ? store.activeTour.tour
      : undefined)
  );
}

export function resolveStep(target: StepTarget) {
  const tour = resolveTour(target);
  if (!tour || target.stepNumber < 0 || target.stepNumber >= tour.steps.length) {
    return;
  }

  return {
    tour,
    stepNumber: target.stepNumber
  };
}

export function isTourTarget(value: unknown): value is TourTarget {
  return !!value && typeof value === "object" && "tourId" in value;
}

export function isStepTarget(value: unknown): value is StepTarget {
  return (
    isTourTarget(value) &&
    "stepNumber" in value &&
    typeof (value as StepTarget).stepNumber === "number"
  );
}

function isCodeTour(value: unknown): value is CodeTour {
  return (
    !!value &&
    typeof value === "object" &&
    "id" in value &&
    "steps" in value &&
    Array.isArray((value as CodeTour).steps)
  );
}
