import { create } from "zustand";

export type View = "calendar" | "trips" | "plan" | "burndown" | "sessions";

type UiState = {
  readonly view: View;
  readonly tripBeingEdited: string | "new" | null;
  readonly setView: (view: View) => void;
  readonly openTripEditor: (id: string | "new") => void;
  readonly closeTripEditor: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  view: "calendar",
  tripBeingEdited: null,
  setView: (view) => set({ view }),
  openTripEditor: (id) => set({ tripBeingEdited: id }),
  closeTripEditor: () => set({ tripBeingEdited: null }),
}));
