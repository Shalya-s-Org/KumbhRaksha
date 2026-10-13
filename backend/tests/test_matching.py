import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.seed import seed_data
from backend.matching import (
    calculate_name_similarity,
    extract_keywords,
    evaluate_match,
    find_suggested_matches,
)

client = TestClient(app)

def test_extract_keywords():
    text = "Wearing a blue shirt with red sandals near Ramkund ghat"
    kw = extract_keywords(text)
    # Stop words like 'a', 'with', 'near', 'wearing' should be filtered out
    assert "blue" in kw
    assert "shirt" in kw
    assert "red" in kw
    assert "sandals" in kw
    assert "ramkund" in kw
    assert "ghat" in kw
    assert "with" not in kw
    assert "a" not in kw

def test_calculate_name_similarity():
    # Exact match
    assert calculate_name_similarity("Aarav Sharma", "Aarav Sharma") == 1.0
    # Case insensitive
    assert calculate_name_similarity("aarav", "AARAV") == 1.0
    # Substring / partial
    assert calculate_name_similarity("Aarav", "Aarav Sharma") >= 0.85
    # Close typo
    assert calculate_name_similarity("Aarav", "Arav") >= 0.80
    # Completely different
    assert calculate_name_similarity("Aarav", "Suresh") < 0.50

def test_evaluate_match_exact_name_and_close_age():
    lost = {
        "id": 1,
        "name": "Aarav",
        "age": 6,
        "description": "Wearing blue t-shirt and slippers near north ghat steps",
    }
    found = {
        "id": 2,
        "name": "Aarav",
        "age": 7, # within 3 years
        "description": "Little boy in blue shirt found near north ghat steps",
    }

    score, reasons = evaluate_match(lost, found)
    assert score >= 75
    assert any("Exact name match" in r for r in reasons)
    assert any("Age within" in r or "Exact age" in r for r in reasons)
    assert any("Matching keywords" in r for r in reasons)

def test_evaluate_match_different_name_and_age():
    lost = {
        "id": 1,
        "name": "Pooja Verma",
        "age": 28,
        "description": "Yellow saree with brown handbag",
    }
    found = {
        "id": 2,
        "name": "Karan Malhotra",
        "age": 8,
        "description": "Blue shorts playing with ball",
    }

    score, reasons = evaluate_match(lost, found)
    assert score < 30

def test_find_suggested_matches_filters_by_min_score():
    lost_list = [
        {"id": 1, "name": "Aarav", "age": 6, "description": "Blue shirt"},
        {"id": 2, "name": "Geeta", "age": 70, "description": "White saree"},
    ]
    found_list = [
        {"id": 3, "name": "Aarav", "age": 6, "description": "Blue shirt found"},
        {"id": 4, "name": "Vikram", "age": 30, "description": "Green jacket"},
    ]

    matches = find_suggested_matches(lost_list, found_list, min_score=40)
    assert len(matches) == 1
    assert matches[0]["lost"]["name"] == "Aarav"
    assert matches[0]["found"]["name"] == "Aarav"
    assert matches[0]["score"] >= 75

def test_reports_api_flow(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test_reports.db")
    seed_data(test_db)
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{test_db}")

    # 1. File a 'lost' report
    lost_payload = {
        "kind": "lost",
        "name": "Aarav Demo",
        "age": 6,
        "description": "Wearing blue shirt near Ramkund steps",
        "reporter_phone": "9876543210",
    }
    res_lost = client.post("/reports", json=lost_payload)
    assert res_lost.status_code == 200
    lost_data = res_lost.json()
    assert lost_data["id"] is not None
    assert lost_data["status"] == "open"

    # 2. File a 'found' report
    found_payload = {
        "kind": "found",
        "name": "Aarav",
        "age": 6,
        "description": "Crying boy in blue shirt found near Ramkund steps",
        "reporter_phone": "9123456789",
    }
    res_found = client.post("/reports", json=found_payload)
    assert res_found.status_code == 200
    found_data = res_found.json()
    assert found_data["id"] is not None
    assert found_data["status"] == "open"

    # 3. GET /reports
    res_list = client.get("/reports?kind=lost&status=open")
    assert res_list.status_code == 200
    open_lost = res_list.json()
    assert any(r["id"] == lost_data["id"] for r in open_lost)

    # 4. Check matching endpoint GET /reports/matches
    res_matches = client.get("/reports/matches")
    assert res_matches.status_code == 200
    match_list = res_matches.json()
    assert len(match_list) >= 1
    target_match = next((m for m in match_list if m["lost"]["id"] == lost_data["id"] and m["found"]["id"] == found_data["id"]), None)
    assert target_match is not None
    assert target_match["score"] >= 70

    # 5. Mark reunited via POST /reports/reunite
    reunite_payload = {
        "lost_id": lost_data["id"],
        "found_id": found_data["id"],
    }
    res_reunite = client.post("/reports/reunite", json=reunite_payload)
    assert res_reunite.status_code == 200
    assert res_reunite.json()["status"] == "ok"

    # 6. Verify status updated to 'reunited'
    res_lost_after = client.get(f"/reports?status=reunited")
    assert res_lost_after.status_code == 200
    reunited_ids = [r["id"] for r in res_lost_after.json()]
    assert lost_data["id"] in reunited_ids
    assert found_data["id"] in reunited_ids

    # 7. Verify no longer returned in open matches
    res_matches_after = client.get("/reports/matches")
    assert res_matches_after.status_code == 200
    assert not any(m["lost"]["id"] == lost_data["id"] for m in res_matches_after.json())
