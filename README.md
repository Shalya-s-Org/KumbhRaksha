# KumbhRaksha (कुंभ रक्षा)

> **Low-Bandwidth, Multilingual Safety Platform for Nashik-Trimbakeshwar Simhastha Kumbh Mela**  
> *Hack for Social Cause — Disaster Mitigation, Kumbh Mela & Health Service Delivery*

KumbhRaksha provides a no-install pilgrim interface (mobile PWA), a real-time command & control dashboard for authorities, and a low-bandwidth SMS/WhatsApp fallback simulator.

---

## Project Structure

```
KumbhRaksha/
├── backend/                  # FastAPI backend application
│   ├── tests/                # Pytest test suite
│   │   ├── __init__.py
│   │   └── test_health.py    # Health check tests
│   ├── .env.example          # Backend environment template
│   ├── main.py               # FastAPI application entry point
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React + Vite frontend application
│   ├── src/
│   │   ├── pages/            # Page components (/pilgrim, /control, /chat-sim, /scan/:token)
│   │   ├── api.js            # Unified backend API client
│   │   ├── App.jsx           # Routing configuration
│   │   └── main.jsx          # Frontend entry point
│   ├── .env.example          # Frontend environment template
│   └── package.json
├── data/
│   └── sample_seed.json      # Illustrative Kumbh Mela seed data
├── docs/                     # Documentation & architecture specifications
├── .gitignore
├── CLAUDE.md                 # Working agreements & agent instructions
├── AGENT.md
├── LICENSE                   # MIT License
├── README.md
└── SPEC.md                   # Single source of truth specification
```

---

## Routes & Interfaces

| Route | Interface | Description |
|---|---|---|
| `/` | Landing Navigation | Quick links to all platform interfaces and backend health status |
| `/pilgrim` | Pilgrim Interface | Mobile-first safety hub: SOS, family groups, audio announcements, and missing reports |
| `/control` | Command Dashboard | Police & control-room dashboard: live heatmap, surge forecasts, SOS triage, responder dispatch |
| `/chat-sim` | Chat Simulator | Offline/SMS/WhatsApp chat simulator demonstrating keyword commands (`SOS`, `LOST`, `FOUND`) |
| `/scan/:token` | Volunteer Scan | QR wristband scanner displaying pilgrim details, emergency contact, and medical alerts |

---

## Prerequisites

- **Python**: 3.10+ (Python 3.13 tested)
- **Node.js**: v18+ (Node v24 tested) & **npm**: v9+
- Optional: `uv` for fast Python dependency installation

---

## Setup & Run Instructions

### 1. Backend Setup

```bash
# Navigate to project root (or backend folder)
cd KumbhRaksha

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
# (or with uv: uv pip install -r backend/requirements.txt)

# Configure environment variables
cp backend/.env.example backend/.env
```

#### Run Backend Server

```bash
uvicorn backend.main:app --reload --port 8000
```

Verify backend is healthy:
- Open [http://localhost:8000/health](http://localhost:8000/health) -> `{"status": "ok"}`
- Interactive API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

#### Run Backend Tests

```bash
pytest
```

---

### 2. Frontend Setup

```bash
# Navigate to frontend folder
cd frontend

# Install npm dependencies
npm install

# Configure environment variables
cp .env.example .env

# Run development server
npm run dev
```

The frontend will run on [http://localhost:5173](http://localhost:5173).

---

## Environment Variables

### Backend (`backend/.env.example`)

```ini
DATABASE_URL=sqlite:///./kumbhraksha.db
CORS_ORIGINS=http://localhost:5173
SIM_TICK_SECONDS=3
```

### Frontend (`frontend/.env.example`)

```ini
VITE_API_BASE_URL=http://localhost:8000
```

---

## License

This project is open-source under the [MIT License](LICENSE).
