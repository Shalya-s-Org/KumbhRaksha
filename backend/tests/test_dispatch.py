import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_connection, init_db
from backend.seed import seed_data
from backend.dispatch import haversine_distance, find_nearest_responder, create_incident

client = TestClient(app)

def test_haversine_distance_same_point():
    # Distance between same coordinates should be zero
    dist = haversine_distance(20.0067, 73.7915, 20.0067, 73.7915)
    assert dist == 0.0

def test_haversine_distance_known_distance():
    # Distance between Ramkund Ghat (20.0067, 73.7915) and Kapaleshwar Gate (20.0078, 73.7935)
    # Approx 240 meters
    dist = haversine_distance(20.0067, 73.7915, 20.0078, 73.7935)
    assert 200 < dist < 300

def test_find_nearest_responder_matching_kind(tmp_path):
    test_db = str(tmp_path / "test_dispatch.db")
    seed_data(test_db)
    conn = get_connection(test_db)

    # At Ramkund Ghat: lat=20.0067, lng=73.7915
    # Responders in seed:
    # id=1: Medical Team A at 20.0060, 73.7910 (very close ~90m)
    # id=2: Medical Team B at 20.0090, 73.7940 (farther)
    # id=4: Volunteer Group 1 at 20.0070, 73.7920
    # For medical type: should choose Medical Team A
    resp_med = find_nearest_responder(conn, 20.0067, 73.7915, incident_type="medical")
    assert resp_med is not None
    assert resp_med["name"] == "Medical Team A"
    assert resp_med["kind"] == "medical"

    # For crowd type: should prioritize police patrol
    resp_crowd = find_nearest_responder(conn, 20.0067, 73.7915, incident_type="crowd")
    assert resp_crowd is not None
    assert resp_crowd["kind"] == "police"

    conn.close()

def test_create_incident_with_geolocation(tmp_path):
    test_db = str(tmp_path / "test_geo.db")
    seed_data(test_db)
    conn = get_connection(test_db)

    incident = create_incident(
        conn=conn,
        incident_type="medical",
        source="web",
        lat=20.0067,
        lng=73.7915,
        phone="9876543210",
    )
    assert incident["id"] is not None
    assert incident["status"] == "assigned"
    assert incident["responder"] is not None
    assert incident["responder"]["name"] == "Medical Team A"

    # Verify responder status is now busy in DB
    cursor = conn.cursor()
    cursor.execute("SELECT status FROM responders WHERE id = ?", (incident["responder_id"],))
    row = cursor.fetchone()
    assert row["status"] == "busy"
    conn.close()

def test_create_incident_with_landmark_fallback(tmp_path):
    test_db = str(tmp_path / "test_landmark.db")
    seed_data(test_db)
    conn = get_connection(test_db)

    # Landmark G1A is Ramkund Ghat, north steps (20.0069, 73.7913)
    incident = create_incident(
        conn=conn,
        incident_type="lost",
        source="web",
        landmark_code="G1A",
        phone="9123456789",
    )
    assert incident["id"] is not None
    assert incident["lat"] == pytest.approx(20.0069, 0.0001)
    assert incident["lng"] == pytest.approx(73.7913, 0.0001)
    assert incident["zone_id"] == 1
    assert incident["status"] == "assigned"
    assert incident["responder"]["kind"] == "volunteer"
    conn.close()

def test_api_report_incident_and_list():
    # Test POST /incidents
    payload = {
        "type": "crowd",
        "source": "web",
        "landmark_code": "G4A",  # Kapaleshwar Gate
        "phone": "9998887776",
    }
    post_res = client.post("/incidents", json=payload)
    assert post_res.status_code == 200
    data = post_res.json()
    assert data["type"] == "crowd"
    assert data["status"] in ["assigned", "open"]
    assert data["responder_kind"] in ["police", "volunteer", "medical"]

    # Test GET /incidents
    get_res = client.get("/incidents")
    assert get_res.status_code == 200
    incidents = get_res.json()
    assert len(incidents) >= 1
    assert any(i["id"] == data["id"] for i in incidents)

    # Test PATCH /incidents/{id}
    patch_res = client.patch(f"/incidents/{data['id']}", json={"status": "resolved"})
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "resolved"
