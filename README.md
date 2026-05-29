# EduGuard — Student Dropout Risk AI Agent

EduGuard is a full‑stack demo web app that trains an ML model on a real student dataset and visualizes **dropout risk (0–100%)** across role-based dashboards: **Student**, **Admin**, and **Faculty**.

This project supports **SDG 4 (Quality Education)** and aligns with **Vision 2030 / Vision 2035** by enabling early interventions for students who may be at risk.

## Project structure

```
EduGuard/
  frontend/    # React + Tailwind UI
  backend/     # FastAPI + ML APIs
  model/       # Saved model artifact (dropout_model.pkl)
  data/        # Dataset CSV (student-mat.csv)
```

## Dataset

Your real CSV is loaded from:

- `data/student-mat.csv`

Note: the file you provided contains a `Target` column with values like `Dropout`, `Enrolled`, `Graduate`. EduGuard treats **Dropout** as the positive class and uses the rest as not-dropout.

## Backend (FastAPI + Scikit-learn)

### Setup

```bash
cd EduGuard
python -m venv .venv
.\.venv\Scripts\activate
pip install -r backend/requirements.txt
```

### Run

```bash
uvicorn backend.main:app --reload --port 8000
```

The first API request will train (or load) the model:

- Saved to `model/dropout_model.pkl`

### API endpoints (used by the frontend)

- `GET /api/health`
- `POST /api/auth/login` (demo login)
- `GET /api/students?risk=Low|Medium|High&limit=250`
- `GET /api/students/{studentId}` (e.g. `S00001`)
- `GET /api/admin/overview`
- `GET /api/faculty/{facultyId}/class`
- `POST /api/faculty/note` (demo “send note”)

### “Why at risk” explanations

To keep dependencies lightweight, EduGuard uses an interpretable heuristic:

- Global RandomForest feature importances
- Combined with how far a student’s numeric values deviate from the dataset average (and rarity for categorical values)

This produces a short list of the most influential factors for a student profile.

## Frontend (React + Tailwind)

### Install dependencies (required)

Your machine currently has Node installed, but no package manager (`npm`/`yarn`/`pnpm`) available in PATH.

Install Node.js **including npm** (or enable it in PATH), then:

```bash
cd EduGuard/frontend
npm install
npm run dev
```

The dev server proxies `/api/*` to `http://127.0.0.1:8000`.

### Accounts (SQLite database)

User accounts are stored in `data/eduguard.db`.

1. Open http://localhost:5173/register
2. Create an account (email + password + role)
3. **Students** must enter a dataset ID like `S00001` (row 1 in the CSV). Each ID can only be registered once.
4. Sign in at http://localhost:5173/login

Install new backend packages after pulling updates:

```bash
pip install -r backend/requirements.txt
```

## Deployment notes

- **Frontend**: Vercel (build command `npm run build`, output `dist`)
- **Backend**: Render/Railway (start command `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`)

