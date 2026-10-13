import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_connection, init_db
from backend.seed import seed_data
from backend.forecast import evaluate_and_create_alert

client = TestClient(app)

def test_broadcast_and_public_alerts_flow(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test_broadcast.db")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{test_db}")
    seed_data(test_db)
    conn = get_connection(test_db)

    # 1. Create a warning alert
    alert_id = evaluate_and_create_alert(
        conn=conn,
        zone_id=1,
        zone_name="Ramkund Ghat",
        current_level="safe",
        forecast_density=4.6,
        forecast_level="danger",
    )
    assert alert_id is not None
    conn.close()

    # 2. Before broadcast, public endpoint should return empty for this alert
    res_before = client.get("/alerts/public?lang=en")
    assert res_before.status_code == 200
    public_before = [a for a in res_before.json() if a["id"] == alert_id]
    assert len(public_before) == 0

    # 3. Broadcast the alert
    b_res = client.post(f"/alerts/{alert_id}/broadcast")
    assert b_res.status_code == 200
    assert b_res.json()["broadcasted"] is True

    # 4. Check public alerts in English
    res_en = client.get("/alerts/public?lang=en")
    assert res_en.status_code == 200
    pub_en = [a for a in res_en.json() if a["id"] == alert_id]
    assert len(pub_en) == 1
    assert "Crowd surge predicted" in pub_en[0]["message"]
    assert pub_en[0]["lang"] == "en"

    # 5. Check public alerts in Marathi
    res_mr = client.get("/alerts/public?lang=mr")
    assert res_mr.status_code == 200
    pub_mr = [a for a in res_mr.json() if a["id"] == alert_id]
    assert len(pub_mr) == 1
    assert "गर्दी वाढण्याची शक्यता" in pub_mr[0]["message"]
    assert pub_mr[0]["lang"] == "mr"

    # 6. Check public alerts in Hindi
    res_hi = client.get("/alerts/public?lang=hi")
    assert res_hi.status_code == 200
    pub_hi = [a for a in res_hi.json() if a["id"] == alert_id]
    assert len(pub_hi) == 1
    assert "भीड़ बढ़ने की आशंका" in pub_hi[0]["message"]
    assert pub_hi[0]["lang"] == "hi"
