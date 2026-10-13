import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import get_connection, init_db
from backend.seed import seed_data

client = TestClient(app)

def test_seeded_demo_member_by_token():
    # In sample_seed.json, Sunita Demo has qr_token = 'demo-token-sunita'
    response = client.get("/members/by-token/demo-token-sunita")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Sunita Demo"
    assert data["age"] == 68
    assert "Diabetic" in data["medical_note"]
    assert data["head_phone"] == "9000000000"
    assert data["family_code"] == "DEMO001"

def test_member_by_token_not_found():
    response = client.get("/members/by-token/nonexistent-token-xyz")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

def test_create_family_and_retrieve_members():
    payload = {
        "head_name": "Rajesh Kumar",
        "phone": "9876501234",
        "members": [
            {
                "name": "Kavita Kumar",
                "age": 42,
                "relation": "Wife",
                "medical_note": "Asthma inhaler needed",
            },
            {
                "name": "Rohan Kumar",
                "age": 8,
                "relation": "Son",
                "medical_note": "Allergic to penicillin",
            },
        ],
    }

    create_res = client.post("/families", json=payload)
    assert create_res.status_code == 200
    fam = create_res.json()
    assert fam["head_name"] == "Rajesh Kumar"
    assert fam["phone"] == "9876501234"
    assert fam["code"].startswith("FAM-")
    assert len(fam["members"]) == 2

    kavita = fam["members"][0]
    rohan = fam["members"][1]
    assert kavita["qr_token"].startswith("tok-")
    assert rohan["qr_token"].startswith("tok-")
    assert kavita["qr_token"] != rohan["qr_token"]

    # Test GET /families/{code}
    get_fam_res = client.get(f"/families/{fam['code']}")
    assert get_fam_res.status_code == 200
    fam_data = get_fam_res.json()
    assert fam_data["code"] == fam["code"]
    assert len(fam_data["members"]) == 2

    # Test GET /members/by-token/{token} for Rohan
    member_res = client.get(f"/members/by-token/{rohan['qr_token']}")
    assert member_res.status_code == 200
    member_data = member_res.json()
    assert member_data["name"] == "Rohan Kumar"
    assert member_data["age"] == 8
    assert member_data["head_name"] == "Rajesh Kumar"
    assert member_data["head_phone"] == "9876501234"
    assert member_data["medical_note"] == "Allergic to penicillin"
