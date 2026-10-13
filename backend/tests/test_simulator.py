import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_connection, init_db
from backend.seed import seed_data
from backend.simulator import step_simulation, get_current_crowd, get_density_level

client = TestClient(app)

def test_density_level_thresholds():
    assert get_density_level(0.5) == "safe"
    assert get_density_level(1.99) == "safe"
    assert get_density_level(2.0) == "caution"
    assert get_density_level(3.5) == "caution"
    assert get_density_level(4.0) == "caution"
    assert get_density_level(4.01) == "danger"
    assert get_density_level(5.5) == "danger"

def test_simulator_step_inserts_readings(tmp_path):
    test_db = str(tmp_path / "test_sim.db")
    seed_data(test_db)

    # Initial readings count
    conn = get_connection(test_db)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM crowd_readings")
    initial_count = cursor.fetchone()["count"]
    conn.close()

    # Step simulation
    readings = step_simulation()
    assert len(readings) == 6

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM crowd_readings")
    after_count = cursor.fetchone()["count"]
    conn.close()

    assert after_count > initial_count

def test_get_crowd_current_endpoint():
    response = client.get("/crowd/current")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 6

    for zone in data:
        assert "zone_id" in zone
        assert "name" in zone
        assert "lat" in zone
        assert "lng" in zone
        assert "area_m2" in zone
        assert "count" in zone
        assert "density" in zone
        assert "level" in zone
        assert zone["level"] in ["safe", "caution", "danger"]
        assert zone["count"] > 0
        assert zone["density"] >= 0
