import React, { useEffect, useState } from "react";
import { Ranking } from "../../api/utilRanking";
import apiClient from "../../api/apiClient";
import "./ActionBar.css";
import { useRanking } from "../../contexts/RankingContext";
import { useAuth } from "../../contexts/AuthContext";
import CreateRankingDialog from "./CreateRankingDialog";

const RankingSwitcher: React.FC = () => {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const { currentSlug, setCurrentSlug } = useRanking();
  const { isLoggedIn } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  const loadRankings = async () => {
    const resp = await apiClient.get<Ranking[]>("rankings/");
    setRankings(resp.data);
  };

  useEffect(() => {
    loadRankings();
  }, []);

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
            className={`ranking-tab${r.slug === currentSlug ? " ranking-tab-active" : ""}`}
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
