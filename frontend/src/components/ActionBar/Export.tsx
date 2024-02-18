import { Song } from "../Song";

interface ExportComponentProps {
  songs: Song[];
}

const ExportComponent: React.FC<ExportComponentProps> = ({ songs }) => {
  const escapeCSV = (str: string | number | undefined) =>
    `"${String(str).replace(/"/g, '""')}"`;

  const convertToCSV = (songs: Song[]): string => {
    let csvContent =
      "rank,yt_id,Artist,Title,Album,released,discovered,comment\n";

    songs.forEach((song) => {
      const row = [
        song.r_rank,
        song.s_yt_id,
        escapeCSV(song.s_artist),
        escapeCSV(song.s_title),
        escapeCSV(song.s_album),
        song.s_released,
        song.s_discovered,
        escapeCSV(song.s_comment),
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
  };

  return (
    <div>
      <a className="nav-link" href="#" onClick={downloadCSV}>
        export
      </a>
    </div>
  );
};

export default ExportComponent;
