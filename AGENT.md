# Working agreements for the coding agent


## Read first

1. `SPEC.md` is the source of truth for what to build.
2. `TASKS.md` is the ordered task list. Work on **one task at a time**, in order, unless told otherwise.

## How to work

- Before coding a task, restate in two or three lines what you will build and which files you will touch. If anything in the spec is ambiguous, ask one short question instead of guessing.
- Keep it simple. This is a hackathon prototype built by one person who is not an expert coder. Prefer plain, readable code over clever abstractions. No over-engineering, no extra frameworks.
- Do not add a new dependency, change the stack, or rename top-level folders without saying so first and getting a yes.
- After finishing a task: run the code, run the tests, and tell me exactly how to check it myself in the browser (URLs and what to click). If something does not work, say so honestly; never claim it works without running it.
- When an error appears, show me the cause in plain words and fix it. Do not silently swallow errors.
- Keep each change small enough that I can review it. Suggest a one-line git commit message at the end of each task.

## Project layout to use

```
kumbhraksha/
  backend/        FastAPI app, simulator, forecast, tests, seed.py
  frontend/       React + Vite app
  data/           sample_seed.json
  docs/           architecture.md
  SPEC.md  TASKS.md  CLAUDE.md  README.md  LICENSE
```

## Code rules

- Backend: type hints, Pydantic models for request and response bodies, one router file per feature area, small functions that can be unit tested (forecast, nearest responder, chat parser, matching).
- Frontend: functional components, a single `api.js` for all backend calls, all user-visible text in `i18n` files for English, Hindi and Marathi (never hard-code strings in components).
- Names and comments in plain English. Add a short comment only where the reason is not obvious.
- Never commit secrets or real personal data. Use `.env` files and provide `.env.example`.
- Everything must run locally with one command for the backend and one for the frontend. Put both commands in the README.

## Definition of done for every task

- It runs without errors.
- The acceptance check in `TASKS.md` for that task passes.
- Relevant pytest tests exist and pass (for backend logic).
- README or docs updated if setup or behaviour changed.
