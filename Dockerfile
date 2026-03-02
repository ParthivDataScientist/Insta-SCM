# ─────────────────────────────────────────────────────────
# Insta-Track Backend — Production Dockerfile
# ─────────────────────────────────────────────────────────
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies (needed for pandas/openpyxl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY run.py .

# Expose API port
EXPOSE 8001

# Environment — set to "production" for prod deployments
ENV ENV=production

# Run the server
CMD ["python", "run.py"]
