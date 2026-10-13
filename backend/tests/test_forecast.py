import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_connection, init_db
from backend.seed import seed_data
from backend.forecast import predict_zone_density, evaluate_and_create_alert
from backend.simulator import step_simulation, set_scenario

client = TestClient(app)

def test_predict_zone_density_empty_and_single():
    dens, level = predict_zone_density([], 1000)
    assert dens == 0.0
    assert level == "safe"

    dens, level = predict_zone_density([2500], 1000)
    assert dens == 2.5
    assert level == "caution"

def test_predict_zone_density_steady_trend():
    # Area = 1000 m2. Counts steadily increasing: 1000, 1100, 1200, 1300... (delta = +100/tick = +0.1 density/tick)
    counts = [1000 + i * 100 for i in range(8)]
    dens, level = predict_zone_density(counts, area_m2=1000, lookahead_ticks=20)
    # At tick 7, density is 1.7. + 20 ticks at 0.1/tick -> ~3.7
    assert 3.5 <= dens <= 3.9
    assert level == "caution"

def test_predict_zone_density_surge_crosses_danger():
    # Rapid surge: delta = +300/tick on 1000m2 (+0.3 density/tick)
    counts = [1000 + i * 300 for i in range(8)]
    dens, level = predict_zone_density(counts, area_m2=1000, lookahead_ticks=20)
    # Prediction should easily cross 4.0 (danger)
    assert dens >= 4.0
    assert level == "danger"

def test_alert_creation_and_no_duplicates(tmp_path):
    test_db = str(tmp_path / "test_alerts.db")
    seed_data(test_db)
    conn = get_connection(test_db)

    # 1. No alert when forecast is safe
    alert_id = evaluate_and_create_alert(
        conn, zone_id=1, zone_name="Ramkund Ghat", current_level="safe", forecast_density=1.5, forecast_level="safe"
    )
    assert alert_id is None

    # 2. No warning alert when current level is already danger
    alert_id = evaluate_and_create_alert(
        conn, zone_id=1, zone_name="Ramkund Ghat", current_level="danger", forecast_density=4.5, forecast_level="danger"
    )
    assert alert_id is None

    # 3. Create alert when current is safe and forecast crosses 4.0
    alert_id = evaluate_and_create_alert(
        conn, zone_id=1, zone_name="Ramkund Ghat", current_level="safe", forecast_density=4.5, forecast_level="danger"
    )
    assert alert_id is not None

    # Verify alert record in database
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
    alert = cursor.fetchone()
    assert alert["zone_id"] == 1
    assert alert["level"] == "warning"
    assert "Ramkund" in alert["message_en"]
    assert "4.5" in alert["message_en"]
    assert alert["message_hi"] is not None
    assert alert["message_mr"] is not None
    assert alert["suggested_action"] is not None
    assert alert["active"] == 1

    # 4. Duplicate prevention: second call must not create a duplicate
    dup_id = evaluate_and_create_alert(
        conn, zone_id=1, zone_name="Ramkund Ghat", current_level="safe", forecast_density=4.8, forecast_level="danger"
    )
    assert dup_id is None

    cursor.execute("SELECT COUNT(*) as count FROM alerts WHERE zone_id = 1 AND active = 1")
    assert cursor.fetchone()["count"] == 1
    conn.close()

def test_scenario_endpoint_and_surge_flow():
    # Trigger surge on zone 2 (Gandhi Talao Approach)
    resp = client.post("/simulator/scenario", json={"scenario": "surge", "zone_id": 2})
    assert resp.status_code == 200
    assert resp.json()["scenario"] == "surge"

    # Step simulation multiple times to drive surge
    for _ in range(6):
        step_simulation()

    # Verify alerts endpoint shows an active alert
    alerts_resp = client.get("/alerts")
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()
    assert any(a["zone_id"] == 2 for a in alerts)

    # Verify reset clears scenario and deactivates alerts
    reset_resp = client.post("/simulator/scenario", json={"scenario": "reset"})
    assert reset_resp.status_code == 200
    assert reset_resp.json()["scenario"] == "reset"

    # Active alerts should now be empty
    after_reset_alerts = client.get("/alerts?active_only=true").json()
    assert len(after_reset_alerts) == 0
