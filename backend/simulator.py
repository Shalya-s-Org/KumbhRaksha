import asyncio
import os
import random
import time
from typing import Dict, List, Optional, Tuple
from backend.database import get_connection

# In-memory simulator state
_zone_counts: Dict[int, int] = {}
_zone_forecasts: Dict[int, Tuple[float, str]] = {}
_active_scenario: Optional[str] = None
_surge_zone_id: Optional[int] = None
_is_running = False
_task: Optional[asyncio.Task] = None

def get_density_level(density: float) -> str:
    """Return density level category according to SPEC.md section 6."""
    if density < 2.0:
        return "safe"
    elif density <= 4.0:
        return "caution"
    else:
        return "danger"

def init_simulator_state() -> None:
    """Initialize in-memory counts from zones table baseline_count if empty."""
    global _zone_counts
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, baseline_count FROM zones")
    rows = cursor.fetchall()
    conn.close()

    for row in rows:
        z_id = row["id"]
        if z_id not in _zone_counts:
            base = row["baseline_count"] if row["baseline_count"] else 3000
            _zone_counts[z_id] = base

def set_scenario(scenario: str, zone_id: Optional[int] = None) -> dict:
    """Set simulator scenario: 'surge' (with zone_id) or 'reset'."""
    global _active_scenario, _surge_zone_id, _zone_counts
    init_simulator_state()

    if scenario == "surge":
        if zone_id is None:
            zone_id = 1
        _active_scenario = "surge"
        _surge_zone_id = zone_id
        return {"status": "ok", "scenario": "surge", "zone_id": zone_id}

    elif scenario == "reset":
        _active_scenario = None
        _surge_zone_id = None

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, area_m2, baseline_count FROM zones")
        rows = cursor.fetchall()
        now_ts = time.time()
        for row in rows:
            z_id = row["id"]
            base = row["baseline_count"] if row["baseline_count"] else 3000
            _zone_counts[z_id] = base
            # Clear historical surge readings and seed baseline reading
            cursor.execute("DELETE FROM crowd_readings WHERE zone_id = ?", (z_id,))
            cursor.execute(
                "INSERT INTO crowd_readings (zone_id, ts, count) VALUES (?, ?, ?)",
                (z_id, now_ts, base),
            )
            area = row["area_m2"] if row["area_m2"] > 0 else 1.0
            base_density = round(base / area, 2)
            _zone_forecasts[z_id] = (base_density, get_density_level(base_density))

        # Mark active alerts inactive on reset
        cursor.execute("UPDATE alerts SET active = 0 WHERE active = 1")
        conn.commit()
        conn.close()

        return {"status": "ok", "scenario": "reset"}

    else:
        return {"status": "error", "message": f"Unknown scenario '{scenario}'"}

def step_simulation() -> List[dict]:
    """Execute one simulation tick: drift counts, fit forecast, check alerts, insert crowd_readings."""
    from backend.forecast import predict_zone_density, evaluate_and_create_alert

    global _zone_counts, _zone_forecasts, _active_scenario, _surge_zone_id
    init_simulator_state()

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, lat, lng, area_m2 FROM zones ORDER BY id ASC")
    zones = cursor.fetchall()

    ts = time.time()
    readings = []

    for z in zones:
        z_id = z["id"]
        current = _zone_counts.get(z_id, 3000)
        area = z["area_m2"] if z["area_m2"] > 0 else 1.0

        # Scenario: steady surge for target zone
        if _active_scenario == "surge" and _surge_zone_id == z_id:
            # Rise steadily: add ~0.35 density equivalent each tick (~1000-2000 pilgrims)
            surge_step = int(area * 0.35)
            new_count = current + max(250, surge_step)
        else:
            # Normal drift: small noise (-25 to +25)
            drift = random.randint(-25, 25)
            new_count = max(50, current + drift)

        _zone_counts[z_id] = new_count

        cursor.execute(
            "INSERT INTO crowd_readings (zone_id, ts, count) VALUES (?, ?, ?)",
            (z_id, ts, new_count),
        )

        density = round(new_count / area, 2)
        level = get_density_level(density)

        # Retrieve recent readings for this zone (up to 8) to fit LinearRegression
        cursor.execute(
            "SELECT count FROM crowd_readings WHERE zone_id = ? ORDER BY id DESC LIMIT 8",
            (z_id,),
        )
        recent_rows = cursor.fetchall()
        # recent_rows are newest first, reverse to chronological order
        recent_counts = [row["count"] for row in reversed(recent_rows)]

        pred_density, pred_level = predict_zone_density(recent_counts, area, lookahead_ticks=20)
        _zone_forecasts[z_id] = (pred_density, pred_level)

        # Check and trigger warning alert if forecast crosses 4 while current level is not danger
        evaluate_and_create_alert(
            conn,
            zone_id=z_id,
            zone_name=z["name"],
            current_level=level,
            forecast_density=pred_density,
            forecast_level=pred_level,
        )

        readings.append({
            "zone_id": z_id,
            "name": z["name"],
            "lat": z["lat"],
            "lng": z["lng"],
            "area_m2": z["area_m2"],
            "count": new_count,
            "density": density,
            "level": level,
            "forecast_density": pred_density,
            "forecast_level": pred_level,
        })

    conn.commit()
    conn.close()
    return readings

def get_current_crowd() -> List[dict]:
    """Return the most recent crowd reading and forecast for every zone."""
    from backend.forecast import predict_zone_density

    init_simulator_state()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, lat, lng, area_m2 FROM zones ORDER BY id ASC")
    zones = cursor.fetchall()

    result = []
    for z in zones:
        z_id = z["id"]
        count = _zone_counts.get(z_id)
        if count is None:
            cursor.execute(
                "SELECT count FROM crowd_readings WHERE zone_id = ? ORDER BY id DESC LIMIT 1",
                (z_id,),
            )
            latest = cursor.fetchone()
            count = latest["count"] if latest else 0
            _zone_counts[z_id] = count

        area = z["area_m2"] if z["area_m2"] > 0 else 1.0
        density = round(count / area, 2)
        level = get_density_level(density)

        forecast = _zone_forecasts.get(z_id)
        if forecast is None:
            cursor.execute(
                "SELECT count FROM crowd_readings WHERE zone_id = ? ORDER BY id DESC LIMIT 8",
                (z_id,),
            )
            rows = cursor.fetchall()
            recent_counts = [r["count"] for r in reversed(rows)] if rows else [count]
            pred_density, pred_level = predict_zone_density(recent_counts, area, lookahead_ticks=20)
            forecast = (pred_density, pred_level)
            _zone_forecasts[z_id] = forecast

        pred_density, pred_level = forecast

        result.append({
            "zone_id": z_id,
            "name": z["name"],
            "lat": z["lat"],
            "lng": z["lng"],
            "area_m2": z["area_m2"],
            "count": count,
            "density": density,
            "level": level,
            "forecast_density": pred_density,
            "forecast_level": pred_level,
        })

    conn.close()
    return result

async def run_simulator_loop():
    """Background loop that ticks every SIM_TICK_SECONDS."""
    tick_seconds = float(os.getenv("SIM_TICK_SECONDS", "3"))
    while _is_running:
        try:
            step_simulation()
        except Exception as e:
            print(f"[Simulator Error] {e}")
        await asyncio.sleep(tick_seconds)

def start_simulator():
    """Start the background simulation loop task."""
    global _is_running, _task
    if not _is_running:
        _is_running = True
        try:
            step_simulation()
        except Exception as e:
            print(f"[Simulator initial tick warning] {e}")
        _task = asyncio.create_task(run_simulator_loop())

def stop_simulator():
    """Stop the background simulation loop task."""
    global _is_running, _task
    _is_running = False
    if _task:
        _task.cancel()
        _task = None
