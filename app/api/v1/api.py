from fastapi import APIRouter
from app.api.v1.endpoints import shipments

api_router = APIRouter()
api_router.include_router(shipments.router, prefix="/shipments", tags=["shipments"])
