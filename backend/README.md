# Backend update (required for "My submissions" editing)

Responses now include `form_slug`, which lets respondents edit their own answers from the
"My submissions" page.

Copy these two files over the ones in your `backend/` folder:

    backend_updates/app/schemas/response.py           ->  backend/app/schemas/response.py
    backend_updates/app/services/response_service.py  ->  backend/app/services/response_service.py

No database migration is needed. Restart uvicorn afterwards.
