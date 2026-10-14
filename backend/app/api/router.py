from fastapi import APIRouter

from app.api.routes import activity_logs, analytics, auth, exports, forms, responses, submissions, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(forms.router)
api_router.include_router(submissions.router)
api_router.include_router(responses.router)
api_router.include_router(analytics.router)
api_router.include_router(exports.router)
api_router.include_router(activity_logs.router)
