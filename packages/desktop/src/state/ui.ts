import { create } from "zustand";
import type { Trip } from "@tp-scroll/core";

export type View = "calendar" | "trips" | "plan" | "burndown" | "sessions";

/**
 * Pre-fill payload used to hand off a planned trip from the Plan view to the
 * Trips form. Only the fields a planner-generated trip can fill are listed;
 * everything else uses the form's own defaults.
 */
export type TripPrefill = Pick<Trip, "departure" | "return" | "bucketId"> &
  Partial<Pick<Trip, "isActual" | "notes" | "dayOverrides">>;

type UiState = {
  readonly view: View;
  readonly tripBeingEdited: string | "new" | null;
  readonly tripPrefill: TripPrefill | null;
  readonly setView: (view: View) => void;
  readonly openTripEditor: (id: string | "new", prefill?: TripPrefill) => void;
  readonly closeTripEditor: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  view: "calendar",
  tripBeingEdited: null,
  tripPrefill: null,
  setView: (view) => set({ view }),
  openTripEditor: (id, prefill) =>
    set({ tripBeingEdited: id, tripPrefill: prefill ?? null }),
  closeTripEditor: () => set({ tripBeingEdited: null, tripPrefill: null }),
}));
