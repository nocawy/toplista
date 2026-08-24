import { Song } from "../Song";
import { serializeCSVField } from "../../utils/csv";

interface ExportComponentProps {
  songs: Song[];
}

const ExportComponent: React.FC<ExportComponentProps> = ({ songs }) => {
  const convertToCSV = (songs: Song[]): string => {
    let csvContent =
      "rank,yt_id,Artist,Title,Album,released,discovered,comment\n";

    songs.forEach((song) => {
      const row = [
        serializeCSVField(song.r_rank),
        serializeCSVField(song.s_yt_id),
        serializeCSVField(song.s_artist),
        serializeCSVField(song.s_title),
        serializeCSVField(song.s_album),
        serializeCSVField(song.s_released),
        serializeCSVField(song.s_discovered),
        serializeCSVField(song.s_comment),
      ].join(",");
      csvContent += row + "\n";
    });

    return csvContent;
  };

  const downloadCSV = () => {
    const csvContent = convertToCSV(songs);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "songs.csv";
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <button type="button" className="nav-link" onClick={downloadCSV}>
        export
      </button>
    </div>
  );
};

export default ExportComponent;
