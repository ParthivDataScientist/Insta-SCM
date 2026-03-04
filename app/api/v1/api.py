from fastapi import APIRouter
from app.api.v1.endpoints import shipments, auth

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(shipments.router, prefix="/shipments", tags=["shipments"])
