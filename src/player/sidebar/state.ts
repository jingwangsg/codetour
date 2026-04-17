// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { ActiveTour, CodeTour, CodeTourStep, Store } from "../../store";
import { normalizeColor, normalizeTags } from "../../store/serialization";

export interface SidebarStepState {
  tourId: string;
  stepNumber: number;
  title: string;
  tags: string[];
  color?: string;
  cardStyle?: string;
  isActive: boolean;
  isComplete: boolean;
}

export interface SidebarTourState {
  id: string;
  title: string;
  description?: string;
  stepCount: number;
  isPrimary: boolean;
  isActive: boolean;
  isRecording: boolean;
  isEditing: boolean;
  steps: SidebarStepState[];
}

export interface SidebarState {
  hasTours: boolean;
  activeTourId?: string;
  activeStepNumber?: number;
  tours: SidebarTourState[];
}

interface SidebarStoreLike
  extends Pick<Store, "tours" | "activeTour" | "progress" | "isRecording" | "isEditing"> {}

export function buildSidebarState({
  tours,
  activeTour,
  progress,
  isRecording,
  isEditing
}: SidebarStoreLike): SidebarState {
  const visibleTours = [...tours];
  if (
    activeTour &&
    !visibleTours.find(tour => tour.id === activeTour.tour.id)
  ) {
    visibleTours.unshift(activeTour.tour);
  }

  return {
    hasTours: visibleTours.length > 0,
    activeTourId: activeTour?.tour.id,
    activeStepNumber: activeTour?.step,
    tours: visibleTours.map(tour =>
      buildTourState(tour, activeTour, progress, isRecording, isEditing)
    )
  };
}

function buildTourState(
  tour: CodeTour,
  activeTour: ActiveTour | null,
  progress: Store["progress"],
  isRecording: boolean,
  isEditing: boolean
): SidebarTourState {
  const isActiveTour = activeTour?.tour.id === tour.id;
  const completedSteps =
    progress.find(([tourId]) => tourId === tour.id)?.[1] || [];

  return {
    id: tour.id,
    title: tour.title,
    description: tour.description,
    stepCount: tour.steps.length,
    isPrimary: !!tour.isPrimary,
    isActive: isActiveTour,
    isRecording: isActiveTour && isRecording,
    isEditing: isActiveTour && isEditing,
    steps: tour.steps.map((step, stepNumber) =>
      buildStepState(tour, step, stepNumber, activeTour, completedSteps)
    )
  };
}

function buildStepState(
  tour: CodeTour,
  step: CodeTourStep,
  stepNumber: number,
  activeTour: ActiveTour | null,
  completedSteps: number[]
): SidebarStepState {
  const color = normalizeColor(step.color);

  return {
    tourId: tour.id,
    stepNumber,
    title: step.title || `Step #${stepNumber + 1}`,
    tags: normalizeTags(step.tags) || [],
    color,
    cardStyle: buildCardStyle(color),
    isActive:
      activeTour?.tour.id === tour.id && activeTour.step === stepNumber,
    isComplete: completedSteps.includes(stepNumber)
  };
}

function buildCardStyle(color?: string): string | undefined {
  if (!color) {
    return undefined;
  }

  const red = parseInt(color.slice(1, 3), 16);
  const green = parseInt(color.slice(3, 5), 16);
  const blue = parseInt(color.slice(5, 7), 16);

  return `--step-accent-color:${color};--step-accent-background:rgba(${red}, ${green}, ${blue}, 0.18);--step-accent-border:rgba(${red}, ${green}, ${blue}, 0.42);`;
}
