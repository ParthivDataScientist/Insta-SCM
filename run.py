import logging
import os
import sys

import uvicorn

# Add project root to sys.path so 'app' package is importable
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(ROOT_DIR)

if __name__ == "__main__":
    from app.core.logging_config import configure_logging

    configure_logging()
    log = logging.getLogger("run")

    is_dev = os.getenv("ENV", "development") == "development"
    port = int(os.getenv("PORT", 8001))
    host = "0.0.0.0"
    workers = 1 if is_dev else 4

    log.info(
        "uvicorn_starting",
        extra={
            "event": "uvicorn_starting",
            "mode": "development" if is_dev else "production",
            "host": host,
            "port": port,
        },
    )
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=is_dev,
        reload_dirs=[os.path.join(ROOT_DIR, "app")],  # Only watch the 'app' directory
        workers=workers,
    )
