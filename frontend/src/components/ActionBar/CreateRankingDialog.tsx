import React, { useState } from "react";
import apiClient from "../../api/apiClient";
import { Ranking } from "../../api/utilRanking";

interface CreateRankingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (ranking: Ranking) => void | Promise<void>;
}

const CreateRankingDialog: React.FC<CreateRankingDialogProps> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !isSubmitting;

  const createRanking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await apiClient.post<Ranking>("rankings/", { name: trimmedName });
      setName("");
      await onCreated(response.data);
      onClose();
    } catch (err) {
      console.error("Error creating ranking:", err);
      setError("Could not create ranking");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ranking-dialog-backdrop">
      <div className="ranking-dialog" role="dialog" aria-modal="true" aria-labelledby="create-ranking-title">
        <h2 id="create-ranking-title">Create ranking</h2>
        <form onSubmit={createRanking}>
          <label className="ranking-dialog-field">
            Ranking name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. top2025"
            />
          </label>
          {error && <div className="error">{error}</div>}
          <div className="ranking-dialog-actions">
            <button type="button" className="text-button" onClick={onClose} disabled={isSubmitting}>
              cancel
            </button>
            <button type="submit" className="ranking-dialog-submit" disabled={!canSubmit}>
              {isSubmitting ? "creating..." : "create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRankingDialog;
