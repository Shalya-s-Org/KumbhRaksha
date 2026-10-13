# KumbhRaksha: Implementation Tasks

Ordered task list following `SPEC.md` and `AGENT.md`. Work on one task at a time.

- [x] **Task 1: Project Skeleton & Health Check**
  - Layout based on `CLAUDE.md` and `SPEC.md`.
  - FastAPI backend with `GET /health`.
  - React + Vite frontend with routes: `/pilgrim`, `/control`, `/chat-sim`, and `/scan/:token`.
  - `.gitignore`, MIT `LICENSE`, `backend/.env.example`, `frontend/.env.example`, `README.md`.
  - *Acceptance Check:* `GET /health` returns `{"status": "ok"}`, frontend builds and loads routes cleanly, pytest passes.

- [x] **Task 2: Database Schema & Seed Data Loader**
  - SQLite models (zones, crowd readings, alerts, families, members, responders, incidents, missing reports, landmark codes).
  - Loader script `backend/seed.py` importing `data/sample_seed.json`.
  - Endpoints: `GET /zones`, `GET /landmarks`, `GET /responders`.
  - *Acceptance Check:* Seed script populates DB without errors, endpoints return seeded records, pytest verifies DB seed.

- [x] **Task 3: Crowd Simulator & scikit-learn Forecast Engine**
  - Background task ticking every 3 seconds (1 simulated minute).
  - Density drift per zone and `LinearRegression` 20-tick forecast.
  - Automatic surge warning alerts with suggested actions when predicted density crosses 4.
  - `POST /simulator/scenario` (`surge`, `reset`).
  - Endpoints: `GET /crowd/current`, `GET /alerts`, `POST /alerts/{id}/broadcast`, `GET /alerts/public`.
  - *Acceptance Check:* Simulator logs readings; surge scenario raises alert; unit tests verify forecast and alert logic.

- [ ] **Task 4: Control Room Dashboard (/control)**
  - Leaflet crowd map with coloured zones (green, amber, red) and density metrics popup.
  - Active surge alert banner with "Broadcast to pilgrims" button.
  - Polling every 3 seconds for live updates.
  - *Acceptance Check:* `/control` displays map zones with live updating counts, colors reflect density, manual surge scenario reflects in UI.

- [ ] **Task 5: SOS Incident Reporting & Nearest Responder Dispatch**
  - Pilgrim SOS button with type (medical, lost, crowd) and GPS / landmark dropdown.
  - Incident persistence and nearest available responder assignment via haversine distance.
  - Live incident feed and map markers on `/control`.
  - *Acceptance Check:* Submitting SOS assigns nearest responder; incident shows on control dashboard within 1 polling cycle.

- [ ] **Task 6: Family Safety Group & QR Code Generation**
  - Family creation on `/pilgrim` (head name, phone, members, medical notes).
  - Member token and QR code rendering (`qrcode.react`).
  - Printable/viewable cards for all family members.
  - *Acceptance Check:* Creating family yields unique tokens and visible QR codes per member.

- [ ] **Task 7: Volunteer QR Scanner (/scan/:token)**
  - Volunteer view showing member details, age, emergency contact, and medical note by token.
  - Endpoint `GET /members/by-token/{token}`.
  - *Acceptance Check:* Visiting `/scan/:token` displays member details and family phone correctly.

- [ ] **Task 8: Lost-and-Found Matching System**
  - Reporting forms for `lost` and `found` persons.
  - Matching algorithm on `/control` comparing names, ages (within 3 years), and keywords.
  - "Mark Reunited" action closing matched reports.
  - *Acceptance Check:* Filing lost and found reports shows match candidate on `/control` and allows reunion.

- [ ] **Task 9: SMS / WhatsApp Chat Simulator (/chat-sim)**
  - Simulated chat interface calling `POST /chat/message`.
  - Command parsing: `SOS <landmark>`, `LOST <name> <age>`, `FOUND <name> <age>`, `LANG`, numbers `1,2,3`.
  - Creates corresponding incident / reports; replies under 160 characters.
  - *Acceptance Check:* Chat messages trigger backend actions and return proper SMS-length responses.

- [ ] **Task 10: Multilingual Support & Audio Announcements**
  - English, Hindi, and Marathi translations for `/pilgrim`.
  - Language switcher persisting user choice.
  - Web Speech API integration reading alerts aloud.
  - *Acceptance Check:* Toggling language changes text; speaker icon speaks alert in selected language.
