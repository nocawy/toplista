import "./ActionBar.css";
import { Song } from "../Song";
import PlayTop50 from "./PlayTop50";
import useTop50Link from "../../hooks/useTop50Link";
import PlayRandom50 from "./PlayRandom50";
import ImportComponent from "./Import";
import ExportComponent from "./Export";

interface ActionBarProps {
  songs: Song[];
}

const ActionBar: React.FC<ActionBarProps> = ({ songs }) => {
  const top50Link = useTop50Link(songs);

  return (
    <nav className="ActionBar">
      <PlayTop50 link={top50Link} />
      <div className="nav-item">
        <PlayRandom50 songs={songs} />
      </div>
      <div className="nav-item"></div>
      <div>
        <ImportComponent />
        <ExportComponent songs={songs} />
      </div>
      <div className="nav-item"></div>
      {/* TODO: log in */}
      <div className="nav-item"></div>
    </nav>
  );
};

export default ActionBar;
