import logging
import sys
from sqlmodel import SQLModel, create_engine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("check_models")

try:
    logger.info("Importing models...")
    from app.models.user import User
    from app.models.dashboard_project import DashboardProject, Client, ProjectAuditLog, ProjectLink, ProjectResource
    from app.models.shipment import Shipment
    
    logger.info("Initializing SQLModel registry mapping...")
    # This will trigger mapper initialization and configure_mappers()
    # If there are NoForeignKeysError or InvalidRequestError, it will raise them here
    SQLModel.metadata.clear()
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    
    logger.info("✅ All SQLModel mappers compiled and initialized perfectly!")
    sys.exit(0)
except Exception as e:
    logger.exception("❌ SQLModel mapper configuration failed!")
    sys.exit(1)
