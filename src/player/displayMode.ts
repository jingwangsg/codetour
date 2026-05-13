// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export const STEP_DISPLAY_MODE_CONFIG_KEY = "codetour.stepDisplayMode";
export const STEP_DISPLAY_MODE_SETTING = "stepDisplayMode";
export const STEP_DISPLAY_MODE_INLINE = "inline";
export const STEP_DISPLAY_MODE_PAGE = "page";

export type StepDisplayMode =
  | typeof STEP_DISPLAY_MODE_INLINE
  | typeof STEP_DISPLAY_MODE_PAGE;

export const STEP_DISPLAY_MODES: StepDisplayMode[] = [
  STEP_DISPLAY_MODE_INLINE,
  STEP_DISPLAY_MODE_PAGE
];

export function normalizeStepDisplayMode(value: unknown): StepDisplayMode {
  return STEP_DISPLAY_MODES.includes(value as StepDisplayMode)
    ? (value as StepDisplayMode)
    : STEP_DISPLAY_MODE_INLINE;
}
