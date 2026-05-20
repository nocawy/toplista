// components/ActionBar/ActionBar.tsx
import "./ActionBar.css";
import { Song } from "../Song";
import PlayRandom from "./PlayRandom";
import ImportComponent from "./Import";
import ExportComponent from "./Export";
import LoginForm from "./LoginForm";
import { useAuth } from "../../contexts/AuthContext";
import RankingSwitcher from "./RankingSwitcher";
import type { QueueMode } from "../../hooks/usePlaybackQueue";

interface ActionBarProps {
  songs: Song[];
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  queueMode: QueueMode;
  onPlayRandom: (selectedSongs: Song[]) => void;
  onClearQueue: () => void;
}

const ActionBar: React.FC<ActionBarProps> = ({ songs, setSongs, queueMode, onPlayRandom, onClearQueue }) => {
  const { isLoggedIn } = useAuth();

  return (
    <nav className="ActionBar">
      <div className="actionbar-left">
        <RankingSwitcher />
      </div>
      <div className="actionbar-center">
        <PlayRandom
          songs={songs}
          queueMode={queueMode}
          onPlayRandom={onPlayRandom}
          onClearQueue={onClearQueue}
        />
      </div>
      <div className="actionbar-right">
        <div className="nav-item">
          {isLoggedIn ? (
            <ImportComponent setSongs={setSongs} />
          ) : (
            <span className="nav-link actionbar-placeholder">csv import</span>
          )}
          <ExportComponent songs={songs} />
        </div>
        <div className="nav-item actionbar-login-item">
          <LoginForm />
        </div>
      </div>
    </nav>
  );
};

export default ActionBar;
