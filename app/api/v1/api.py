from fastapi import APIRouter
from app.api.v1.endpoints import shipments, auth, dashboard_projects_v2 as dashboard_projects

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(shipments.router, prefix="/shipments", tags=["shipments"])
api_router.include_router(dashboard_projects.router, prefix="/projects", tags=["projects"])
