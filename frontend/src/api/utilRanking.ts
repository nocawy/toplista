export const getCurrentRankingSlug = (): string => {
  return localStorage.getItem("currentRankingSlug") || "main";
};

export interface Ranking {
  id: number;
  name: string;
  slug: string;
  created_on: string;
}


