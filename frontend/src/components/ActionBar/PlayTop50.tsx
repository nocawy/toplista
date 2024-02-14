interface PlayTop50Props {
  link: string;
}

const PlayTop50: React.FC<PlayTop50Props> = ({ link }) => {
  return (
    <div className="nav-item">
      <a
        className="nav-link"
        href={link}
        target="_blank"
        rel="noopener noreferrer"
      >
        play <br /> top 50
      </a>
    </div>
  );
};

export default PlayTop50;
