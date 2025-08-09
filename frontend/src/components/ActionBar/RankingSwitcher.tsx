import React, { useEffect, useMemo, useState } from "react";
import { Ranking } from "../../api/utilRanking";
import apiClient from "../../api/apiClient";
import "./ActionBar.css";
import { useRanking } from "../../contexts/RankingContext";

const RankingSwitcher: React.FC = () => {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const { currentSlug, setCurrentSlug } = useRanking();
  const [newName, setNewName] = useState<string>("");
  const [newSlug, setNewSlug] = useState<string>("");

  const loadRankings = async () => {
    const resp = await apiClient.get<Ranking[]>("rankings/");
    setRankings(resp.data);
  };

  useEffect(() => {
    loadRankings();
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const slug = e.target.value;
    setCurrentSlug(slug);
  };

  const canCreate = useMemo(() => newName.trim().length > 0 && newSlug.trim().length > 0, [newName, newSlug]);

  const createRanking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    await apiClient.post("rankings/", { name: newName.trim(), slug: newSlug.trim() });
    setNewName("");
    setNewSlug("");
    await loadRankings();
    setCurrentSlug(newSlug.trim());
  };

  return (
    <div className="nav-item" style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <select value={currentSlug} onChange={handleChange}>
        {rankings.map((r) => (
          <option key={r.id} value={r.slug}>
            {r.name}
          </option>
        ))}
      </select>

      <form onSubmit={createRanking} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          placeholder="New ranking name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ width: 140 }}
        />
        <input
          placeholder="slug"
          value={newSlug}
          onChange={(e) => setNewSlug(e.target.value)}
          style={{ width: 100 }}
        />
        <button type="submit" disabled={!canCreate} className="nav-link">
          +
        </button>
      </form>
    </div>
  );
};

export default RankingSwitcher;


