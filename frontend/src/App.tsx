import "./App.css";
import React, { useState } from "react";
import ActionBar from "./components/ActionBar/ActionBar";
import SongList from "./components/SongList";
import useSongs from "./hooks/useSongs";
import { AuthProvider } from "./contexts/AuthContext";
import Footer from "./components/Footer";

function App() {
  const { songs, setSongs } = useSongs();
  const [selectedRandomIds, setSelectedRandomIds] = useState<number[]>([]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Osobisty Top Wszech Czasów</h1>
      </header>
      <AuthProvider>
        <ActionBar
          songs={songs}
          setSongs={setSongs}
          onRandomSelected={setSelectedRandomIds}
        />
        <SongList
          songs={songs}
          setSongs={setSongs}
          selectedRandomIds={selectedRandomIds}
        />
      </AuthProvider>
      <Footer />
    </div>
  );
}

export default App;
