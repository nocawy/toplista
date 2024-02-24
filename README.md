# TopList

TopList is a web application designed to be a personal music ranking.

[https://nocawy.pl/toplista/](https://nocawy.pl/toplista/)

## Features

- Interactive Song Ranking with a drag-and-drop interface
- CSV Import/Export
- CRUD Operations (create, read, update, and delete)
- YouTube Playlist Creation

## Technologies

- **Frontend:** React + TypeScript
- **Backend:** Django REST Framework
- **Database:** SQLite

## Installation (Local Setup)

### Prerequisites

- Node.js
- Python 3.x

### Cloning the Repository

```bash
git clone https://github.com/nocawy/toplista.git
cd toplista
```

### Backend Setup

Before starting, it's recommended to create a virtual environment to isolate project dependencies:

```bash
python -m venv --prompt="toplista" .venv
source .venv/bin/activate  # On Unix/macOS
.venv\Scripts\activate  # On Windows
```

Switch to the backend directory, install required packages, and apply migrations to create the database:

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
```

Installing packages and applying migrations are typically one-time actions.
However, you'll need to start the server every time you work on the project:

```bash
python manage.py runserver
```

Optionally, import songs from a CSV file into the database.
The CSV file must include the following headers: `yt_id, Artist, Title, Album, released, discovered, comment, rank.`

```bash
python manage.py import_songs path/to/songs.csv
```

### Frontend Setup

Navigate to the frontend directory, install dependencies, and launch the application:

```bash
cd frontend
npm install
npm start
```

### Usage

After starting the backend server and frontend client, the application will be available at `http://localhost:3000/`.

## Author

Nocawy

[github.com/nocawy/toplista/](https://github.com/nocawy/toplista/)
