import type { GuestsPageData } from "@/features/guests/queries";

export type Guest = GuestsPageData["guests"][number];
export type Group = GuestsPageData["groups"][number];
export type SeatingTable = GuestsPageData["tables"][number];
