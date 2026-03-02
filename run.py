import uvicorn
import os
import sys

# Add project root to sys.path so 'app' package is importable
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(ROOT_DIR)

if __name__ == "__main__":
    is_dev = os.getenv("ENV", "development") == "development"
    port = int(os.getenv("PORT", 8001))
    host = "127.0.0.1" if is_dev else "0.0.0.0"
    workers = 1 if is_dev else 4

    print(f"Starting {'development' if is_dev else 'production'} server on {host}:{port}")
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=is_dev,      # reload=True only in development
        workers=workers,    # multiple workers in production
    )
