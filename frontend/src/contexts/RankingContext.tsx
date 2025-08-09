import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

interface RankingContextValue {
  currentSlug: string;
  setCurrentSlug: (slug: string) => void;
}

const RankingContext = createContext<RankingContextValue | undefined>(undefined);

export const RankingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSlug, setCurrentSlugState] = useState<string>(() => {
    return localStorage.getItem("currentRankingSlug") || "main";
  });

  useEffect(() => {
    localStorage.setItem("currentRankingSlug", currentSlug);
  }, [currentSlug]);

  const setCurrentSlug = (slug: string) => setCurrentSlugState(slug);

  const value = useMemo(
    () => ({ currentSlug, setCurrentSlug }),
    [currentSlug]
  );

  return <RankingContext.Provider value={value}>{children}</RankingContext.Provider>;
};

export const useRanking = (): RankingContextValue => {
  const ctx = useContext(RankingContext);
  if (!ctx) throw new Error("useRanking must be used within RankingProvider");
  return ctx;
};


