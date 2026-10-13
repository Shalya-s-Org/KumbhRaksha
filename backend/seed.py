import os
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from backend.database import get_connection, init_db

def find_seed_file() -> Path:
    """Locate sample_seed.json in standard data locations."""
    candidates = [
        Path("data/sample_seed.json"),
        Path("../data/sample_seed.json"),
        Path(__file__).resolve().parent.parent / "data" / "sample_seed.json",
        Path("sample_seed.json"),
    ]
    for p in candidates:
        if p.is_file():
            return p
    raise FileNotFoundError("Could not find sample_seed.json in expected paths.")

def seed_data(db_path: Optional[str] = None) -> dict:
    """Initialize database schema and seed zones, responders, landmarks, and demo data."""
    init_db(db_path)
    seed_file = find_seed_file()

    with open(seed_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    conn = get_connection(db_path)
    cursor = conn.cursor()

    # 1. Seed Zones
    zones = data.get("zones", [])
    for z in zones:
        cursor.execute(
            """
            INSERT OR REPLACE INTO zones (id, name, lat, lng, area_m2, baseline_count)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                z["id"],
                z["name"],
                z["lat"],
                z["lng"],
                z["area_m2"],
                z.get("baseline_count", 0),
            ),
        )

    # 2. Seed Responders
    responders = data.get("responders", [])
    for r in responders:
        cursor.execute(
            """
            INSERT OR REPLACE INTO responders (id, name, kind, lat, lng, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                r["id"],
                r["name"],
                r["kind"],
                r["lat"],
                r["lng"],
                r.get("status", "available"),
            ),
        )

    # 3. Seed Landmark Codes
    landmarks = data.get("landmark_codes", [])
    for lm in landmarks:
        cursor.execute(
            """
            INSERT OR REPLACE INTO landmark_codes (code, zone_id, lat, lng, label)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                lm["code"],
                lm["zone_id"],
                lm["lat"],
                lm["lng"],
                lm["label"],
            ),
        )

    # 4. Seed Demo Family & Members (if present in seed file)
    demo_fam = data.get("demo_family")
    if demo_fam:
        now_iso = datetime.now(timezone.utc).isoformat()
        cursor.execute("SELECT id FROM families WHERE code = ?", (demo_fam["code"],))
        fam_row = cursor.fetchone()
        if not fam_row:
            cursor.execute(
                """
                INSERT INTO families (code, head_name, phone, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (demo_fam["code"], demo_fam["head_name"], demo_fam["phone"], now_iso),
            )
            family_id = cursor.lastrowid
        else:
            family_id = fam_row["id"]

        for m in demo_fam.get("members", []):
            cursor.execute("SELECT id FROM members WHERE qr_token = ?", (m["qr_token"],))
            if not cursor.fetchone():
                cursor.execute(
                    """
                    INSERT INTO members (family_id, name, age, relation, medical_note, qr_token)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        family_id,
                        m["name"],
                        m["age"],
                        m.get("relation", ""),
                        m.get("medical_note", ""),
                        m["qr_token"],
                    ),
                )

    # 5. Seed Demo Found Report (if present in seed file)
    demo_report = data.get("demo_found_report")
    if demo_report:
        cursor.execute(
            "SELECT id FROM missing_reports WHERE name = ? AND reporter_phone = ?",
            (demo_report["name"], demo_report.get("reporter_phone", "")),
        )
        if not cursor.fetchone():
            now_iso = datetime.now(timezone.utc).isoformat()
            cursor.execute(
                """
                INSERT INTO missing_reports (kind, name, age, description, reporter_phone, status, created_at)
                VALUES (?, ?, ?, ?, ?, 'open', ?)
                """,
                (
                    demo_report["kind"],
                    demo_report["name"],
                    demo_report.get("age"),
                    demo_report.get("description", ""),
                    demo_report.get("reporter_phone", ""),
                    now_iso,
                ),
            )

    conn.commit()
    conn.close()

    summary = {
        "zones_seeded": len(zones),
        "responders_seeded": len(responders),
        "landmarks_seeded": len(landmarks),
    }
    return summary

if __name__ == "__main__":
    result = seed_data()
    print(f"Seed complete: {result}")
