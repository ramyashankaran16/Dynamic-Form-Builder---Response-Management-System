# Form Builder — React Frontend

React 19 + TypeScript (Vite) frontend for the Dynamic Form Builder & Response Management System.
Uses Material UI, Axios, React Router, React Hook Form, Chart.js and dnd-kit for drag and drop.

## Run it locally

Requirements: **Node.js 20 or newer** and the FastAPI backend running on `http://localhost:8000`.

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** and log in with the admin account (`admin@formbuilder.com` / `Admin@123` unless you changed it).

The API address comes from `VITE_API_URL`. The default is `http://localhost:8000/api/v1`, so no `.env` is needed for local work. To change it, copy `.env.example` to `.env`, edit it, and restart `npm run dev`.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload on port 5173 |
| `npm run build` | Type-check, then production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript check only |

## Pages

| Route | Page | Who |
|---|---|---|
| `/login`, `/register` | Log in, create an account | Everyone |
| `/` | Dashboard: totals, responses per day, most-answered forms, recent responses | Logged in |
| `/forms` | All forms with search, open/closed switch, duplicate, copy link, delete | Logged in (admins see every form) |
| `/forms/new`, `/forms/:id/edit` | **Drag-and-drop builder** with live preview and form settings | Form owner, admin |
| `/forms/:id/responses` | Search and filter responses, view, edit, history, Excel/PDF export | Form owner, admin |
| `/forms/:id/analytics` | Trend and per-question charts | Form owner, admin |
| `/f/:slug` | **Public form page** that respondents fill in | Anyone (or logged-in users for private forms) |
| `/my-submissions` | Your own responses; edit them when the form allows it | Logged in |
| `/activity` | Activity log (admins see everything, users see their own actions) | Logged in |
| `/users` | Change roles, block access, delete users | Admin |
| `/profile` | Change name and password | Logged in |

## How the builder works

- **Add fields** by dragging from the left panel onto the sheet, or by clicking a field type (it is added below the selected field).
- **Reorder** by dragging the handle on the left of each field. Keyboard users can focus the handle, press Space, use the arrow keys, and press Space again.
- **Edit** a field by clicking it: label, key, placeholder, help text, required, options, validation and visibility appear in the right panel.
- **Conditional visibility**: under *Visibility*, choose *Show only when…* and pick another field, a condition and a value. Fields that would create a loop are left out of the list. The canvas shows a summary such as *Shown when Currently employed? is "Yes"*.
- **Preview** checks the form with the same validation respondents see, without saving anything.
- **Save changes** sends the whole field list in one request (`PUT /forms/{id}/fields`).

The visibility rules are evaluated in the browser by `src/lib/visibility.ts`, a direct port of the backend's `form_engine.py`, so fields show and hide instantly. The backend re-checks everything when the form is submitted.

## Project structure

```
src/
├── api/            client.ts (Axios + JWT refresh), endpoints.ts (typed API calls)
├── context/        AuthContext (login state), NotifyContext (toasts + confirm dialogs)
├── components/
│   ├── builder/    canvas, palette, field properties, settings dialog, builder state helpers
│   ├── renderer/   FormRenderer + FieldControl (used by the public page, preview and edit dialog)
│   ├── responses/  response drawer (answers + history) and edit dialog
│   └── ...         layout, page header, stats, charts
├── lib/            visibility engine, field type metadata, formatting, downloads, errors
├── pages/          one file per route
├── theme.ts        palette, typography (Public Sans), component defaults
└── types.ts        TypeScript types matching the API
```

Login tokens are kept in `localStorage`. When the access token expires, the Axios interceptor uses the refresh token once and retries the request; if that fails, you are sent back to the login page.

## Exports

On the responses page, **Export → Download now** generates the Excel or PDF file immediately and applies the current filters. **Prepare in background** uses the Celery worker, so Redis and the worker must be running; if no worker picks up the job within 20 seconds, the page tells you to use *Download now*.

## Docker

`frontend/Dockerfile` builds the app and serves it with nginx, which also forwards `/api` to the backend container, so the browser talks to a single origin and no CORS setup is needed. The `docker-compose.yml` in the project root starts the whole stack:

```bash
# from the project root (the folder that contains backend/ and frontend/)
docker compose up --build -d
```

Then open **http://localhost:3000**. Swagger is still at http://localhost:8000/docs.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Can't reach the server" on login | Start the backend (`uvicorn app.main:app --reload`) and check http://localhost:8000/health |
| CORS error in the browser console | Add your frontend address to `CORS_ORIGINS` in the backend `.env` and restart the backend |
| Uploads fail on a form | The form must be open (accepting responses), and the file must match the allowed types and size |
| Fonts look different | Public Sans loads from Google Fonts; without internet the system font is used |
