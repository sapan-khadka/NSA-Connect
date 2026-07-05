from fastapi import APIRouter

from app.api.v1.announcements import router as announcements_router
from app.api.v1.ai import router as ai_router
from app.api.v1.auth import router as auth_router
from app.api.v1.constitution import router as constitution_router
from app.api.v1.event_tasks import router as event_tasks_router
from app.api.v1.events import router as events_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.dues import router as dues_router
from app.api.v1.finance import router as finance_router
from app.api.v1.me import router as me_router
from app.api.v1.members import router as members_router
from app.api.v1.slots import router as slots_router
from app.api.v1.tasks import router as tasks_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(ai_router)
api_router.include_router(announcements_router)
api_router.include_router(constitution_router)
api_router.include_router(me_router)
api_router.include_router(members_router)
api_router.include_router(events_router)
api_router.include_router(event_tasks_router)
api_router.include_router(slots_router)
api_router.include_router(tasks_router)
api_router.include_router(finance_router)
api_router.include_router(dues_router)
api_router.include_router(notifications_router)
