// components/ActionBar/ActionBar.tsx
import "./ActionBar.css";
import { Song } from "../Song";
import PlayTop50 from "./PlayTop50";
import PlayRandom50 from "./PlayRandom50";
import ImportComponent from "./Import";
import ExportComponent from "./Export";
import LoginForm from "./LoginForm";
import { useAuth } from "../../contexts/AuthContext";
import RankingSwitcher from "./RankingSwitcher";

interface ActionBarProps {
  songs: Song[];
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  onPlayTop50: () => void;
  onPlayRandom50: (selectedSongs: Song[]) => void;
}

const ActionBar: React.FC<ActionBarProps> = ({ songs, setSongs, onPlayTop50, onPlayRandom50 }) => {
  const { isLoggedIn } = useAuth();

  return (
    <nav className="ActionBar">
      <div className="actionbar-left">
        <RankingSwitcher />
      </div>
      <div className="actionbar-center">
        <div className="nav-item">
          <PlayTop50 onPlay={onPlayTop50} />
        </div>
        <div className="nav-item">
          <PlayRandom50 songs={songs} onPlayRandom={onPlayRandom50} />
        </div>
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
