# Dynamic Form Builder & Response Management System

A full-stack platform for building forms without writing code. Users design forms with a drag-and-drop builder, share a link, collect responses, and review them with search, filters, edit history, analytics, and Excel/PDF exports.

**Backend:** Python 3.12 · FastAPI · SQLAlchemy · Alembic · Pydantic · JWT · Celery
**Frontend:** React 19 · TypeScript · Vite · Material UI · Axios · React Router · React Hook Form · Chart.js
**Database:** MySQL 8.0  **Tools:** Docker · Swagger/OpenAPI · Postman · Git

---

## Table of contents

1. [Features](#features)
2. [Screenshots](#screenshots)
3. [Architecture](#architecture)
4. [Project structure](#project-structure)
5. [Database schema](#database-schema)
6. [Roles and permissions](#roles-and-permissions)
7. [Getting started (Windows, local)](#getting-started-windows-local)
8. [Running with Docker](#running-with-docker)
9. [Environment variables](#environment-variables)
10. [Using the application](#using-the-application)
11. [API documentation](#api-documentation)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)

---

## Features

| Area | What it does |
|---|---|
| Authentication | Registration, login, JWT access and refresh tokens, password change |
| Role-based access | **Admin** manages everything; **User** manages their own forms |
| Form management | Create, edit, delete, duplicate, enable or disable forms |
| Drag-and-drop builder | Drag fields from a palette onto the form, reorder them, edit properties in a side panel, live preview |
| Field types | Text, Number, Email, Date, Dropdown, Checkbox, Radio button, File upload, Rating |
| Validation | Required fields, min/max values and lengths, regex patterns, date ranges, file type and size limits, checked on both client and server |
| Conditional visibility | Show a field only when other answers match rules (equals, contains, greater than, is empty, and more), with AND/OR logic. Hidden fields are never required |
| Submissions | Public forms (anyone with the link) or authenticated forms (login required) |
| Response editing | Owners and admins can always edit; respondents can edit their own answers when the form allows it |
| Response history | Every edit is recorded with old and new values |
| Search and filtering | Search answers, names and emails; filter by date range, respondent type, or a specific question's answer |
| Dashboard and analytics | Totals, responses per day, most-answered forms, and per-question charts |
| Exports | Excel (.xlsx) and PDF, instantly or in the background through Celery |
| Activity logs | Audit trail of logins, form changes, submissions, edits and exports |

---

## Screenshots

> Add your own screenshots to `docs/screenshots/` with these file names and they will appear here.

| Dashboard | Form builder |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Form builder](docs/screenshots/builder.png) |

| Public form | Responses and history |
|---|---|
| ![Public form](docs/screenshots/public-form.png) | ![Responses](docs/screenshots/responses.png) |

| Analytics | Swagger API |
|---|---|
| ![Analytics](docs/screenshots/analytics.png) | ![Swagger](docs/screenshots/swagger.png) |

---

## Architecture

```mermaid
flowchart LR
    B[Browser<br/>React + MUI] -->|REST + JWT| A[FastAPI backend]
    A -->|SQLAlchemy| M[(MySQL 8.0)]
    A -->|queue export jobs| R[(Redis)]
    R --> W[Celery worker]
    W -->|read responses| M
    W -->|write .xlsx / .pdf| S[(File storage)]
    A -->|uploads, downloads| S
```

- The **React frontend** renders the builder, public forms, and admin screens. It evaluates conditional visibility instantly in the browser.
- The **FastAPI backend** is the source of truth: it re-validates every submission, applies permissions, and records activity.
- **Celery** generates large exports in the background. Small exports can also be downloaded instantly without the worker.

---

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/routes/        # auth, users, forms, submissions, responses, analytics, exports, activity logs
│   │   ├── core/              # settings, JWT and password hashing, permissions
│   │   ├── db/                # database session, seed script (roles + admin)
│   │   ├── models/            # SQLAlchemy models (8 tables)
│   │   ├── schemas/           # Pydantic request/response models
│   │   ├── services/          # form engine (validation + conditions), responses, analytics, exports
│   │   └── worker/            # Celery app and tasks
│   ├── alembic/               # database migrations
│   ├── database/schema.sql    # MySQL schema for MySQL Workbench
│   ├── docs/openapi.json      # exported API specification
│   ├── postman/               # Postman collection and environment
│   ├── tests/                 # pytest suite
│   ├── Dockerfile
│   ├── docker-compose.yml     # backend-only stack
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/               # Axios client with token refresh, typed endpoints
│   │   ├── components/        # builder, form renderer, response drawer, layout
│   │   ├── context/           # authentication, notifications
│   │   ├── lib/               # conditional logic, formatting, downloads
│   │   └── pages/             # one file per screen
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml         # full stack: MySQL, Redis, backend, worker, frontend
└── README.md
```

---

## Database schema

```mermaid
erDiagram
    roles ||--o{ users : has
    users ||--o{ forms : owns
    forms ||--o{ form_fields : contains
    form_fields ||--o{ field_options : has
    forms ||--o{ form_responses : receives
    users |o--o{ form_responses : submits
    form_responses ||--o{ response_details : contains
    form_fields |o--o{ response_details : answers
    users |o--o{ activity_logs : performs
```

| Table | Purpose |
|---|---|
| `roles` | Admin and User |
| `users` | Accounts with hashed passwords, role, active status, last login |
| `forms` | Title, description, public link slug, owner, open/closed, public/private, editing and multiple-submission settings |
| `form_fields` | Label, key, type, required, order, validation config (JSON), visibility rules (JSON) |
| `field_options` | Choices for dropdown, radio and checkbox fields |
| `form_responses` | One submission: form, respondent (empty for anonymous), IP address, version |
| `response_details` | One answer per field. The field label is copied in, so answers survive if a field is deleted |
| `activity_logs` | Audit trail with old and new values. Also stores the response edit history |

The schema is managed with **Alembic** migrations. `backend/database/schema.sql` contains the same schema for MySQL Workbench; use *Database → Reverse Engineer* on it to draw an ER diagram.

---

## Roles and permissions

| Action | Admin | User (owner) | Other user | Anonymous |
|---|:-:|:-:|:-:|:-:|
| Manage users and roles | ✅ | ❌ | ❌ | ❌ |
| Create forms | ✅ | ✅ | ✅ | ❌ |
| Edit, delete, open or close a form | all forms | own forms | ❌ | ❌ |
| Submit a public form | ✅ | ✅ | ✅ | ✅ |
| Submit a private form | ✅ | ✅ | ✅ | ❌ |
| View a form's responses | ✅ | ✅ | own submission only | ❌ |
| Edit a response | ✅ | ✅ | own submission, if the form allows editing and is open | ❌ |
| Delete a response | ✅ | ✅ | ❌ | ❌ |
| Analytics and exports | all forms | own forms | ❌ | ❌ |
| Activity log | everything | own actions | own actions | ❌ |

---

## Getting started (Windows, local)

### Prerequisites

- **Python 3.12**: check with `python --version`
- **Node.js 20 or newer**: check with `node --version`
- **MySQL 8.0** server and MySQL Workbench
- **Git**
- *Optional:* Redis, only for background exports

> **Folder name tip:** keep `&` out of the project's folder path. Windows' command processor treats `&` as a command separator, which breaks `npm run` scripts.

### 1. Clone the repository

```powershell
git clone https://github.com/<your-username>/dynamic-form-builder.git
cd dynamic-form-builder
```

### 2. Create the database

In MySQL Workbench, run:

```sql
CREATE DATABASE form_builder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'formbuilder'@'localhost' IDENTIFIED BY 'choose-a-password';
GRANT ALL PRIVILEGES ON form_builder.* TO 'formbuilder'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Set up the backend

```powershell
py -3.12 -m venv .venv
.venv\Scripts\activate
cd backend
pip install -r requirements-dev.txt
copy .env.example .env
```

Open `backend/.env` and set at least:

```env
SECRET_KEY=paste-a-long-random-string
DATABASE_URL=mysql+pymysql://formbuilder:choose-a-password@localhost:3306/form_builder?charset=utf8mb4
```

Generate a secret key with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. If your password contains special characters, encode them in the URL (`@` → `%40`, `#` → `%23`).

Create the tables and the first admin account:

```powershell
alembic upgrade head
python -m app.db.init_db
```

Start the API (from the `backend` folder):

```powershell
uvicorn app.main:app --reload
```

Check **http://localhost:8000/health**. It should show `"database": true`.

### 4. Set up the frontend

Open a **second terminal**, keeping the backend running:

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** and log in:

| Email | Password |
|---|---|
| `admin@formbuilder.com` | `Admin@123` |

Change this password from **Profile** after the first login.

### 5. Background exports (optional)

With Redis running on port 6379, start a worker in a third terminal:

```powershell
.venv\Scripts\activate
cd backend
celery -A app.worker.celery_app worker --loglevel=info --pool=solo
```

`--pool=solo` is required on Windows. Without a worker, use **Export → Download now**, which works without Redis.

---

## Running with Docker

From the project root:

```powershell
docker compose up --build -d
```

| Service | Address |
|---|---|
| Application | http://localhost:3000 |
| Swagger UI | http://localhost:8000/docs |
| MySQL (Workbench) | `localhost:3307`, user `formbuilder`, password `formbuilder` |

The backend container runs migrations and creates the admin account on first start. Stop everything with `docker compose down`; add `-v` to also delete the database.

---

## Environment variables

Set in `backend/.env` (see `backend/.env.example`):

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Signs login tokens. Use a long random value |
| `DATABASE_URL` | MySQL connection string |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` | Token lifetimes (default 60 minutes / 7 days) |
| `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` | Redis addresses for background exports |
| `CORS_ORIGINS` | Frontend addresses allowed to call the API, comma separated |
| `MAX_UPLOAD_SIZE_MB` | Upload size limit (default 10) |
| `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` | Admin account created by `init_db` |

The frontend reads `VITE_API_URL` from `frontend/.env` (default `http://localhost:8000/api/v1`).

> `.env` files contain passwords and are excluded by `.gitignore`. Never commit them.

---

## Using the application

1. **Create a form.** Go to **Forms → New form**. Drag field types from the left panel onto the sheet, or click one to add it below the selected field.
2. **Configure fields.** Click a field to edit its label, required setting, options, and validation in the right panel.
3. **Add conditions.** Under **Visibility**, choose **Show only when…**, then pick another field, a condition, and a value. For example: show *Current company* only when *Currently employed?* is *Yes*.
4. **Preview and save.** Use the **Preview** tab to try the form, then **Create form** or **Save changes**.
5. **Set access.** In **Settings**, choose whether anyone with the link can respond, whether respondents can edit their answers, and the confirmation message.
6. **Share.** Use **Copy link**. Respondents fill in the form at `/f/<form-link>`.
7. **Review responses.** Open **Responses** to search, filter, open a response, edit it, see its history, or export to Excel or PDF.
8. **Analyse.** Open **Analytics** for the daily trend and per-question charts.
9. **Close the form.** Use the switch in the forms list to stop accepting responses.

---

## API documentation

- **Swagger UI:** http://localhost:8000/docs. Click **Authorize** and log in with your email as the username.
- **ReDoc:** http://localhost:8000/redoc
- **OpenAPI file:** `backend/docs/openapi.json`
- **Postman:** import `backend/postman/Dynamic_Form_Builder.postman_collection.json`. Run **Login (Admin)** first; tokens and IDs are saved automatically for the following requests.

### Main endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/auth/register` | Create an account |
| POST | `/api/v1/auth/login` | Log in (form fields `username`, `password`) |
| GET | `/api/v1/forms` | List forms |
| POST | `/api/v1/forms` | Create a form with fields |
| PUT | `/api/v1/forms/{id}/fields` | Save the builder's full field list |
| PATCH | `/api/v1/forms/{id}/status` | Open or close a form |
| GET | `/api/v1/public/forms/{slug}` | Form definition for respondents |
| POST | `/api/v1/public/forms/{slug}/submit` | Submit answers |
| GET | `/api/v1/forms/{id}/responses` | Responses with search, filters, pagination |
| PUT | `/api/v1/responses/{id}` | Edit a response |
| GET | `/api/v1/responses/{id}/history` | Edit history |
| GET | `/api/v1/analytics/dashboard` | Dashboard statistics |
| GET | `/api/v1/analytics/forms/{id}` | Per-form analytics |
| GET | `/api/v1/exports/forms/{id}/download` | Excel or PDF download |
| GET | `/api/v1/activity-logs` | Activity log |

The full list of 44 endpoints is in Swagger.

---

## Testing

```powershell
cd backend
pytest -q
```

The suite uses a temporary SQLite database, so MySQL and Redis are not needed. It covers the validation and conditional-logic engine, permissions, submissions, file uploads, response editing and history, field reordering, analytics, exports, and activity logs.

Type-check and build the frontend:

```powershell
cd frontend
npm run build
```

---

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| `'Response' is not recognized` when running `npm run dev` | The folder path contains `&`. Rename the folder, or run `node node_modules/vite/bin/vite.js` |
| `/health` shows `"database": false` | The backend can't reach MySQL. Start the MySQL service, check `DATABASE_URL` in `backend/.env`, and start uvicorn from the `backend` folder |
| `Access denied for user` | Wrong username or password in `DATABASE_URL`, or special characters not URL-encoded |
| Changes to `.env` have no effect | An old backend is still running. Stop all Python processes with `Get-Process python \| Stop-Process -Force`, then start one backend |
| Login page says "Can't reach the server" | The backend isn't running, or it is failing; check the uvicorn terminal for errors |
| CORS error in the browser console | Add the frontend address to `CORS_ORIGINS` and restart the backend |
| Background export never finishes | The Celery worker or Redis isn't running. Use **Download now** instead |
| Celery worker fails on Windows | Add `--pool=solo` to the worker command |

---

## License

This project was built for learning and demonstration purposes.
