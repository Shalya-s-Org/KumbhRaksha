# KumbhRaksha: Product Spec

Hack for Social Cause, VBYLD 2027. Theme: Disaster Mitigation, Kumbh Mela & Health Service Delivery.

This file is the single source of truth. Read it fully before writing code. If this file and a prompt disagree, ask which one wins.

## 1. What we are building

KumbhRaksha is a low-bandwidth, multilingual safety platform for the Nashik-Trimbakeshwar Simhastha Kumbh Mela. It has two web interfaces on one backend:

1. **Pilgrim interface** (`/pilgrim`): a mobile-first web page (PWA) that needs no app install. Pilgrims reach it by scanning a QR code. It offers family safety groups, one-tap SOS, local-language alerts, and a lost-person report.
2. **Command dashboard** (`/control`): a laptop/large-screen page for police, medical teams and control-room staff. It shows a live crowd heatmap, surge warnings, incoming SOS incidents with the nearest responder, and lost-and-found matching.
3. **Chat simulator** (`/chat-sim`): a fake WhatsApp/SMS screen that sends text commands to the same backend. It demonstrates the backup channel without needing a paid messaging account.

### Important scope rule

This is a hackathon **prototype**. All crowd data, responders and families are **simulated or fake**. No real personal data is ever stored. Do not build real CCTV, real SMS or real WhatsApp integration unless explicitly asked in a later task. Design the chat code so a Twilio webhook could call the same function later.

## 2. Users

| User | Device | Main needs |
|---|---|---|
| Pilgrim (including elders, low literacy) | Phone browser | Big buttons, local language, audio, works on weak network |
| Volunteer | Phone browser | Scan a wristband QR, see contact and medical note |
| Control-room officer | Laptop | See risk early, dispatch help, match missing persons |

## 3. Tech stack (do not change without asking)

- Frontend: React + Vite, React Router, Leaflet (react-leaflet) for maps, `qrcode.react` for QR generation, a QR scanner library for the volunteer page. Plain CSS or Tailwind, whichever is simpler.
- Backend: Python FastAPI, SQLite (via SQLAlchemy or plain sqlite3), Pydantic models.
- Forecasting: scikit-learn `LinearRegression` on recent readings per zone.
- Text-to-speech: the browser Web Speech API (`speechSynthesis`). No paid service.
- Updates: the frontend polls the backend every 3 seconds. No WebSockets in v1.
- Tests: pytest for the backend. Add a few frontend checks only if time allows.

## 4. Architecture

```
Pilgrim page (/pilgrim) ----\
Volunteer scan (/scan/:t) ---+--> FastAPI backend --> SQLite
Control dashboard (/control) -/        |
Chat simulator (/chat-sim) ---> /chat/message
                                       |
                              Crowd simulator (background task)
                              Forecast (scikit-learn)
```

## 5. Data model (SQLite)

- `zones(id, name, lat, lng, area_m2)`
- `crowd_readings(id, zone_id, ts, count)`
- `alerts(id, zone_id, level, message_en, message_hi, message_mr, suggested_action, created_at, active)`
- `families(id, code, head_name, phone, created_at)`
- `members(id, family_id, name, age, relation, medical_note, qr_token)`
- `responders(id, name, kind, lat, lng, status)` where kind is `medical`, `volunteer` or `police`, status is `available` or `busy`
- `incidents(id, type, source, lat, lng, zone_id, phone, status, responder_id, created_at)` where type is `medical`, `lost` or `crowd`, source is `web` or `chat`, status is `open`, `assigned` or `resolved`
- `missing_reports(id, kind, name, age, description, reporter_phone, member_id, status, created_at)` where kind is `lost` or `found`
- `landmark_codes(code, zone_id, lat, lng, label)`

Seed data is in `data/sample_seed.json`. A script `backend/seed.py` loads it.

## 6. Crowd simulator and forecast

- A background task runs at server start. Every **3 seconds** it adds one reading per zone. One tick represents **1 simulated minute**.
- Each zone has a baseline count that drifts randomly (small noise, slow trend). Density = count / area_m2 (people per square metre).
- Density levels (illustrative thresholds): `safe` below 2, `caution` from 2 to 4, `danger` above 4.
- **Forecast:** for each zone, fit `LinearRegression` on the last 8 readings and predict density 20 ticks (20 simulated minutes) ahead. If the forecast crosses 4 while the current level is not yet `danger`, create an alert with level `warning` and a suggested action (for example "Redirect pedestrians to Route B", "Close inbound lane", "Deploy 10 volunteers"). Do not create duplicate active alerts for the same zone.
- **Demo scenario button:** `POST /simulator/scenario` with `{"scenario": "surge", "zone_id": N}` makes that zone's count rise steadily over the next minute so the warning fires on cue during the demo. Add `{"scenario": "reset"}`.

## 7. Features and acceptance criteria

### P0: must work for the demo

1. **Crowd heatmap (control).** Map centred on the zones. Each zone is a coloured circle or polygon (green, amber, red) with name, count, density and forecast in a popup. Updates every 3 seconds.
2. **Surge warning (control).** Alert panel lists active warnings with suggested action and a "Broadcast to pilgrims" button that stores the alert so `/pilgrim` shows it.
3. **SOS (pilgrim to control).** Big red SOS button. User picks type (medical, lost, crowd pressure). Location comes from browser geolocation; if denied or unavailable, a dropdown of landmark codes. On submit, an incident is created, the nearest available responder (haversine distance) is assigned, and the pilgrim sees a confirmation screen with the responder type and "help is on the way". The incident appears on `/control` within one polling cycle with a map marker.
4. **Family safety group (pilgrim).** Pilgrim creates a family with head name, phone and members (name, age, relation, optional medical note). Each member gets a QR code encoding a token. A printable page shows all QR codes.
5. **Volunteer scan.** `/scan/:token` (and a camera scanner page) shows the member's name, age, family head phone and medical note.

### P1: should work

6. **Lost-and-found.** Forms to file a `lost` or `found` report. Control dashboard lists reports and shows suggested matches (same or similar name, age within 3 years, or matching description keywords). A "mark reunited" action closes both.
7. **Chat simulator.** Phone-style chat at `/chat-sim` calling `POST /chat/message` with `{from, body}`. Commands: `SOS <landmark code>`, `LOST <name> <age>`, `FOUND <name> <age>`, `JOIN`, `LANG HI|MR|EN`, and numbers `1` medical, `2` lost, `3` crowd danger. Unknown text returns a short menu. SOS from chat creates the same kind of incident as the web button, with source `chat`. Reply messages are under 160 characters.
8. **Languages.** English, Hindi and Marathi for all pilgrim-facing text and alerts. A language switcher on `/pilgrim`. Keep strings in one file per language.
9. **Audio alerts.** A speaker button on each alert reads it aloud in the chosen language using the Web Speech API.

### P2: only if time remains

10. Offline caching of `/pilgrim` with a service worker.
11. Health self-check (a short symptom and heat-risk questionnaire with a risk flag).
12. Incident resolve/close flow with response-time statistics on the dashboard.

## 8. API list (backend)

- `GET /health`
- `GET /zones`, `GET /crowd/current` (all zones with count, density, level, forecast density, forecast level)
- `POST /simulator/scenario`
- `GET /alerts`, `POST /alerts/{id}/broadcast`, `GET /alerts/public?lang=hi`
- `POST /families`, `GET /families/{code}`, `GET /members/by-token/{token}`
- `POST /incidents`, `GET /incidents`, `PATCH /incidents/{id}`
- `GET /responders`
- `POST /reports`, `GET /reports`, `GET /reports/matches`, `PATCH /reports/{id}`
- `GET /landmarks`
- `POST /chat/message`

Return clear JSON and sensible HTTP status codes. Enable CORS for the Vite dev server.

## 9. UI guidelines

- Pilgrim page: mobile first, one task per screen, very large buttons, high contrast, minimal text, icons plus words, language switch always visible. Works on a 360px wide screen.
- Control page: dense and clear; map on the left, alerts and incidents on the right. Use colour plus text labels, never colour alone.
- Keep the design clean and consistent. No placeholder lorem ipsum anywhere.

## 10. Privacy and safety rules

- Use fake sample data only. Never commit real names, phone numbers or locations of real people.
- Collect only what each feature needs. Missing-person matching must be consent-based: show a note on the lost/found forms saying details are shared with authorities for reunification.
- Do not store precise location history for pilgrims. Store a location only on an incident the user submits.
- Never commit secrets. Configuration comes from environment variables.

## 11. Environment variables

Provide `backend/.env.example` with:

```
DATABASE_URL=sqlite:///./kumbhraksha.db
CORS_ORIGINS=http://localhost:5173
SIM_TICK_SECONDS=3
```

Provide `frontend/.env.example` with:

```
VITE_API_BASE_URL=http://localhost:8000
```

## 12. Repository deliverables (required by the submission)

- `README.md` with project description, features, setup steps for backend and frontend, environment variables, how to seed data, how to run tests, and a demo walkthrough.
- `docs/architecture.md` with an architecture diagram (a Mermaid diagram is fine) and a short explanation of each component and the data flow.
- `data/sample_seed.json` (provided) plus the loader script.
- Tests: pytest tests for the forecast logic, nearest-responder selection, incident creation, chat command parsing and lost-and-found matching.
- `LICENSE` (MIT).
- `.gitignore` covering `node_modules`, `.env`, `*.db`, `__pycache__`, `dist`.

## 13. Demo script (what must work live)

1. Open `/control` on a laptop: heatmap updating.
2. Open `/pilgrim` on a phone: create a family and show a member's QR.
3. Scan the QR with `/scan/:token`: see details.
4. Press "Trigger surge" for one zone: the warning appears on `/control`; click Broadcast; the alert shows on the phone in Marathi with audio.
5. Press SOS on the phone: the incident and the assigned responder appear on `/control`.
6. In `/chat-sim` send `LOST Aarav 6`: the report shows on `/control` and matches a found report.
