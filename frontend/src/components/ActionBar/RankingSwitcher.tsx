import React, { useCallback, useEffect, useState } from "react";
import { Ranking } from "../../api/utilRanking";
import apiClient from "../../api/apiClient";
import "./ActionBar.css";
import { useRanking } from "../../contexts/RankingContext";
import { useAuth } from "../../contexts/AuthContext";
import CreateRankingDialog from "./CreateRankingDialog";

interface RankingSwitcherProps {
  /** Slug of the ranking the playing queue belongs to, if a song is playing. */
  playingSlug: string | null;
}

const RankingSwitcher: React.FC<RankingSwitcherProps> = ({ playingSlug }) => {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const { currentSlug, setCurrentSlug } = useRanking();
  const { isLoggedIn } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  const loadRankings = useCallback(async () => {
    try {
      const resp = await apiClient.get<Ranking[]>("rankings/");
      setRankings(resp.data);
    } catch (error) {
      console.error("Error loading rankings:", error);
    }
  }, []);

  useEffect(() => {
    void loadRankings();
  }, [loadRankings]);

  useEffect(() => {
    if (rankings.length > 0 && !rankings.some((ranking) => ranking.slug === currentSlug)) {
      setCurrentSlug(rankings[0].slug);
    }
  }, [currentSlug, rankings, setCurrentSlug]);

  const handleCreated = async (ranking: Ranking) => {
    await loadRankings();
    setCurrentSlug(ranking.slug);
  };

  return (
    <div className="ranking-switcher">
      <div className="ranking-tabs" role="tablist" aria-label="Rankings">
        {rankings.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={r.slug === currentSlug}
            className={`ranking-tab${r.slug === currentSlug ? " ranking-tab-active" : ""}${
              r.slug === playingSlug ? " ranking-tab-playing" : ""
            }`}
            onClick={() => setCurrentSlug(r.slug)}
          >
            {r.name}
          </button>
        ))}
        {isLoggedIn && (
          <button
            type="button"
            className="ranking-tab ranking-tab-new"
            onClick={() => setIsCreateOpen(true)}
            aria-label="Create ranking"
          >
            +
          </button>
        )}
      </div>
      <CreateRankingDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
};

export default RankingSwitcher;
