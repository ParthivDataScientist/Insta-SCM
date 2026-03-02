#!/usr/bin/env python
"""
Insta-Track — Management CLI
Standard professional launcher.
"""
import os
import sys
import argparse
import subprocess
import shutil
import time

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = sys.executable  # Use current interpreter


def run_server():
    """Start both Backend and Frontend in development mode."""
    print(">>> Starting Insta-Track Services...")

    # 1. Backend
    print("    [1/2] Booting Backend (Port 8001)...")
    backend_cmd = [VENV_PYTHON, "-u", os.path.join(ROOT_DIR, "run.py")]
    backend = subprocess.Popen(backend_cmd, cwd=ROOT_DIR)

    # 2. Frontend
    print("    [2/2] Booting Frontend (Port 5173)...")
    frontend_cmd = "npx vite --host"
    frontend = subprocess.Popen(
        frontend_cmd, cwd=os.path.join(ROOT_DIR, "client"), shell=True
    )

    print("\n>>> ALL SYSTEMS GO. Press Ctrl+C to stop.\n")

    # Check for immediate crash
    time.sleep(3)
    if backend.poll() is not None:
        print(f"❌ BACKEND DIED IMMEDIATELY (Exit Code: {backend.returncode})")
        frontend.terminate()
        sys.exit(1)

    try:
        backend.wait()
        frontend.wait()
    except KeyboardInterrupt:
        print("\n>>> Stopping services...")
        backend.terminate()
        try:
            frontend.terminate()
        except OSError:
            pass
        print(">>> Goodbye.")


def clean():
    """Clean up __pycache__ directories and compiled Python files."""
    print(">>> Cleaning temporary files...")
    removed = 0
    for dirpath, dirnames, filenames in os.walk(ROOT_DIR):
        # Skip node_modules
        dirnames[:] = [d for d in dirnames if d not in ("node_modules", ".git")]
        if os.path.basename(dirpath) == "__pycache__":
            shutil.rmtree(dirpath)
            print(f"    Removed: {os.path.relpath(dirpath, ROOT_DIR)}")
            removed += 1
        for f in filenames:
            if f.endswith((".pyc", ".pyo")):
                fpath = os.path.join(dirpath, f)
                os.remove(fpath)
                print(f"    Removed: {os.path.relpath(fpath, ROOT_DIR)}")
                removed += 1
    print(f">>> Clean complete. {removed} item(s) removed.")


def main():
    parser = argparse.ArgumentParser(description="Insta-Track Management CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    subparsers.add_parser("runserver", help="Start development servers")
    subparsers.add_parser("clean", help="Clean __pycache__ and .pyc files")

    args = parser.parse_args()

    if args.command == "runserver":
        run_server()
    elif args.command == "clean":
        clean()
    else:
        # No command provided — show help and exit with error
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
