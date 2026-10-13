import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_connection, init_db
from backend.seed import seed_data

client = TestClient(app)

def test_sqlite_schema_tables_created(tmp_path):
    """Verify all 9 tables from SPEC.md section 5 exist in SQLite."""
    test_db = str(tmp_path / "test_kumbh.db")
    init_db(test_db)
    
    conn = get_connection(test_db)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = {row["name"] for row in cursor.fetchall()}
    conn.close()

    expected_tables = {
        "zones",
        "crowd_readings",
        "alerts",
        "families",
        "members",
        "responders",
        "incidents",
        "missing_reports",
        "landmark_codes",
    }
    assert expected_tables.issubset(tables)

def test_seed_data(tmp_path):
    """Verify seed_data populates zones, responders, and landmark codes."""
    test_db = str(tmp_path / "test_seed.db")
    result = seed_data(test_db)
    assert result["zones_seeded"] == 6
    assert result["responders_seeded"] == 8
    assert result["landmarks_seeded"] == 7

    conn = get_connection(test_db)
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as count FROM zones;")
    assert cursor.fetchone()["count"] == 6

    cursor.execute("SELECT COUNT(*) as count FROM responders;")
    assert cursor.fetchone()["count"] == 8

    cursor.execute("SELECT COUNT(*) as count FROM landmark_codes;")
    assert cursor.fetchone()["count"] == 7

    conn.close()

def test_get_zones_endpoint():
    response = client.get("/zones")
    assert response.status_code == 200
    zones = response.json()
    assert isinstance(zones, list)
    assert len(zones) >= 6
    first_zone = zones[0]
    assert "id" in first_zone
    assert "name" in first_zone
    assert "lat" in first_zone
    assert "lng" in first_zone
    assert "area_m2" in first_zone
    assert first_zone["name"] == "Ramkund Ghat"

def test_get_responders_endpoint():
    response = client.get("/responders")
    assert response.status_code == 200
    responders = response.json()
    assert isinstance(responders, list)
    assert len(responders) >= 8
    first_resp = responders[0]
    assert "id" in first_resp
    assert "name" in first_resp
    assert "kind" in first_resp
    assert "status" in first_resp
    assert first_resp["kind"] in ["medical", "volunteer", "police"]

def test_get_landmarks_endpoint():
    response = client.get("/landmarks")
    assert response.status_code == 200
    landmarks = response.json()
    assert isinstance(landmarks, list)
    assert len(landmarks) >= 7
    first_lm = landmarks[0]
    assert "code" in first_lm
    assert "zone_id" in first_lm
    assert "lat" in first_lm
    assert "lng" in first_lm
    assert "label" in first_lm
