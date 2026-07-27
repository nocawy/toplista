import { getStorageItem } from "../utils/appStorage";

export const getCurrentRankingSlug = (): string => {
  return getStorageItem("currentRankingSlug") || "main";
};

export interface Ranking {
  id: number;
  name: string;
  slug: string;
  created_on: string;
}


