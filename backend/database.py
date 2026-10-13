import os
import sqlite3
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

DEFAULT_DB_FILE = "kumbhraksha.db"

def get_db_path() -> str:
    """Resolve database file path from DATABASE_URL or default."""
    db_url = os.getenv("DATABASE_URL", f"sqlite:///./{DEFAULT_DB_FILE}")
    if db_url.startswith("sqlite:///"):
        path = db_url.replace("sqlite:///", "", 1)
        # Handle relative path with ./
        if path.startswith("./"):
            path = path[2:]
        return path
    return DEFAULT_DB_FILE

def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Return a sqlite3 connection with Row factory enabled."""
    target_path = db_path or get_db_path()
    conn = sqlite3.connect(target_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db(db_path: Optional[str] = None) -> None:
    """Create all SQLite tables specified in SPEC.md section 5 if they do not exist."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # 1. zones
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS zones (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        area_m2 REAL NOT NULL,
        baseline_count INTEGER DEFAULT 0
    );
    """)

    # 2. crowd_readings
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS crowd_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_id INTEGER NOT NULL,
        ts REAL NOT NULL,
        count INTEGER NOT NULL,
        FOREIGN KEY (zone_id) REFERENCES zones(id)
    );
    """)

    # 3. alerts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_id INTEGER NOT NULL,
        level TEXT NOT NULL,
        message_en TEXT,
        message_hi TEXT,
        message_mr TEXT,
        suggested_action TEXT,
        created_at TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        broadcasted INTEGER DEFAULT 0,
        FOREIGN KEY (zone_id) REFERENCES zones(id)
    );
    """)

    # Ensure broadcasted column exists if table was created previously
    try:
        cursor.execute("ALTER TABLE alerts ADD COLUMN broadcasted INTEGER DEFAULT 0;")
    except sqlite3.OperationalError:
        pass  # Column already exists

    # 4. families
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS families (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        head_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    # 5. members
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        relation TEXT,
        medical_note TEXT,
        qr_token TEXT UNIQUE NOT NULL,
        FOREIGN KEY (family_id) REFERENCES families(id)
    );
    """)

    # 6. responders
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS responders (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        status TEXT NOT NULL
    );
    """)

    # 7. incidents
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        lat REAL,
        lng REAL,
        zone_id INTEGER,
        phone TEXT,
        status TEXT NOT NULL,
        responder_id INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY (responder_id) REFERENCES responders(id),
        FOREIGN KEY (zone_id) REFERENCES zones(id)
    );
    """)

    # 8. missing_reports
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS missing_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        age INTEGER,
        description TEXT,
        reporter_phone TEXT,
        member_id INTEGER,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        FOREIGN KEY (member_id) REFERENCES members(id)
    );
    """)

    # 9. landmark_codes
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS landmark_codes (
        code TEXT PRIMARY KEY,
        zone_id INTEGER NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        label TEXT NOT NULL,
        FOREIGN KEY (zone_id) REFERENCES zones(id)
    );
    """)

    conn.commit()
    conn.close()
