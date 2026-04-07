# Database Sync Guide (Local to Production)

This guide explains how to safely migrate your local Project, Kanban, and Gantt data to your production PostgreSQL database.

## Prerequisites

1.  **Python Installed**: Ensure you have Python 3.10+ installed.
2.  **Dependencies**: Run `pip install -r requirements.txt` to ensure `psycopg2-binary` and `sqlmodel` are installed.
3.  **Production URL**: Obtain your production database URL (e.g., from Vercel, Supabase, or ElephantSQL).

## Step-by-Step Instructions

> [!WARNING]
> **This process will overwrite all data currently in your production database.** Please ensure you have a backup of production before starting.

### 1. Set the Production Environment Variable
Open your terminal (PowerShell or Command Prompt) and set the `PROD_DATABASE_URL` environment variable:

**PowerShell (Recommended):**
```powershell
$env:PROD_DATABASE_URL = "postgresql://user:password@host:port/dbname"
```

**Command Prompt:**
```cmd
set PROD_DATABASE_URL=postgresql://user:password@host:port/dbname
```

### 2. Run the Sync Script
Navigate to your project root directory and run the script:

```bash
python scripts/sync_to_production.py
```

### 3. Verify the Results
Once the script completes, log into your production application and verify:
- All projects are in the correct Kanban columns.
- The Manager Timeline (Gantt chart) shows all assigned projects.
- Your shipment tracking data is up to date.

## Troubleshooting

- **SSL Errors**: The script includes `sslmode=require` by default for PostreSQL. If your provider does not support SSL, you may need to modify `scripts/sync_to_production.py`.
- **Primary Key Violations**: The script uses `TRUNCATE` to clean tables before syncing, ensuring no ID conflicts occur.
