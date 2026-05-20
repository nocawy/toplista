interface PlayTop50Props {
  onPlay: () => void;
}

const PlayTop50: React.FC<PlayTop50Props> = ({ onPlay }) => {
  return (
    <div className="nav-item">
      <button
        type="button"
        className="nav-link"
        onClick={onPlay}
      >
        play <br /> top 50
      </button>
    </div>
  );
};

export default PlayTop50;
