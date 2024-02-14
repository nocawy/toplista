import "./App.css";
import SongList from "./components/SongList";
import useSongs from "./hooks/useSongs";

function App() {
  const { songs, setSongs } = useSongs();

  return (
    <div className="App">
      <header className="App-header">
        <h1>Osobisty Top Wszech Czasów</h1>
      </header>
      <SongList songs={songs} setSongs={setSongs} />
    </div>
  );
}

export default App;
