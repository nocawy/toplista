// components/ActionBar/ActionBar.tsx
import "./ActionBar.css";
import { Song } from "../Song";
import PlayTop50 from "./PlayTop50";
import useTop50Link from "../../hooks/useTop50Link";
import PlayRandom50 from "./PlayRandom50";
import ImportComponent from "./Import";
import ExportComponent from "./Export";
import LoginForm from "./LoginForm";
import { useAuth } from "../../contexts/AuthContext";
import RankingSwitcher from "./RankingSwitcher";

interface ActionBarProps {
  songs: Song[];
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  onRandomSelected?: (selectedSongIds: number[]) => void;
}

const ActionBar: React.FC<ActionBarProps> = ({ songs, setSongs, onRandomSelected }) => {
  const top50Link = useTop50Link(songs);
  const { isLoggedIn } = useAuth();

  return (
    <nav className="ActionBar">
      <div className="nav-item">
        <RankingSwitcher />
      </div>
      <div className="nav-item">
        <PlayTop50 link={top50Link} />
      </div>
      <div className="nav-item">
        <PlayRandom50 songs={songs} onRandomSelected={onRandomSelected} />
      </div>
      <div className="nav-item">
        {isLoggedIn ? <ImportComponent setSongs={setSongs} /> : <br />}
        <ExportComponent songs={songs} />
      </div>
      <div className="nav-item">
        <LoginForm />
      </div>
    </nav>
  );
};

export default ActionBar;
