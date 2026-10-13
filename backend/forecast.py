import numpy as np
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sklearn.linear_model import LinearRegression

from backend.simulator import get_density_level

SUGGESTED_ACTIONS = {
    1: "Redirect pedestrians to Route B and open auxiliary exits at Ramkund.",
    2: "Close inbound lane to Gandhi Talao and deploy marshals.",
    3: "Redirect traffic away from Panchavati Main Road to bypass corridor.",
    4: "Hold incoming crowd at Kapaleshwar Outer Gate.",
    5: "Divert flow from Tapovan Bridge to alternate footbridge.",
    6: "Clear emergency lane on Medical Camp Road for ambulances.",
}

def predict_zone_density(
    counts: List[int],
    area_m2: float,
    lookahead_ticks: int = 20,
) -> Tuple[float, str]:
    """
    Fit LinearRegression on recent readings (up to last 8) and predict density lookahead_ticks ahead.
    Returns (predicted_density, predicted_level).
    """
    if not counts:
        return 0.0, "safe"

    area = max(1.0, float(area_m2))
    # Convert counts to densities
    densities = [float(c) / area for c in counts]

    # If only 1 reading, cannot fit slope; return current density
    if len(densities) == 1:
        pred_density = round(densities[0], 2)
        return pred_density, get_density_level(pred_density)

    # Use the last 8 readings at most
    recent_densities = densities[-8:]
    n_points = len(recent_densities)

    X = np.arange(n_points).reshape(-1, 1)
    y = np.array(recent_densities)

    model = LinearRegression()
    model.fit(X, y)

    target_tick = (n_points - 1) + lookahead_ticks
    pred_val = float(model.predict(np.array([[target_tick]]))[0])
    pred_density = round(max(0.0, pred_val), 2)
    pred_level = get_density_level(pred_density)

    return pred_density, pred_level

def evaluate_and_create_alert(
    conn,
    zone_id: int,
    zone_name: str,
    current_level: str,
    forecast_density: float,
    forecast_level: str,
) -> Optional[int]:
    """
    If forecast crosses 4 (danger) while current level is not danger,
    create an alert with level 'warning' if an active alert doesn't already exist.
    """
    # Trigger condition: forecast crosses 4 while current is not yet danger
    if forecast_density < 4.0 or current_level == "danger":
        return None

    cursor = conn.cursor()
    # Check for existing active alert for this zone
    cursor.execute(
        "SELECT id FROM alerts WHERE zone_id = ? AND active = 1",
        (zone_id,),
    )
    existing = cursor.fetchone()
    if existing:
        return None

    # Suggested action based on zone
    suggested_action = SUGGESTED_ACTIONS.get(
        zone_id,
        f"Deploy 10 volunteers to {zone_name} and regulate inbound pedestrian flow.",
    )

    msg_en = f"Crowd surge predicted in {zone_name}. Expected density {forecast_density} people/m² in 20 min."
    msg_hi = f"{zone_name} में भीड़ बढ़ने की आशंका है। 20 मिनट में अनुमानित घनत्व {forecast_density} लोग/मी²।"
    msg_mr = f"{zone_name} येथे गर्दी वाढण्याची शक्यता आहे. 20 मिनिटांत अंदाजित घनता {forecast_density} लोक/मी²."

    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute(
        """
        INSERT INTO alerts (zone_id, level, message_en, message_hi, message_mr, suggested_action, created_at, active)
        VALUES (?, 'warning', ?, ?, ?, ?, ?, 1)
        """,
        (zone_id, msg_en, msg_hi, msg_mr, suggested_action, now_iso),
    )
    alert_id = cursor.lastrowid
    conn.commit()
    return alert_id
