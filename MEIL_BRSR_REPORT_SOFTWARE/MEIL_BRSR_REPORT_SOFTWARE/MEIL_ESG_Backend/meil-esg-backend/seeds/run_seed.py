"""
Usage:
    python -m seeds.run_seed

Creates tables if they don't exist (via db.create_all() — fine for the SQLite dev default; a
real MySQL deployment should use `flask db upgrade` against the Alembic migrations instead and
skip create_all, which this script does automatically by checking for an existing `users` table)
then seeds, in dependency order: BRSR master -> organization hierarchy -> reporting periods ->
demo users/vendors/submissions/risks/disclosures/opinions.

Idempotent: safe to run again after new code adds more seed rows — existing rows are matched by
their natural key (email, code, etc.) and left alone.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db


def main():
    app = create_app()
    with app.app_context():
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        if "users" not in inspector.get_table_names():
            print("No tables found — running db.create_all() (dev convenience; use `flask db upgrade` in production).")
            db.create_all()

        from seeds import seed_brsr, seed_org, seed_demo
        seed_brsr.run()
        seed_org.run()
        seed_org.seed_reporting_periods()
        seed_demo.run()
        print("\nSeed complete. Demo accounts (password 'Password123' for all):")
        for email, _, _, title, role in seed_demo.DEMO_USERS:
            print(f"  {email:<38} {role:<16} {title}")


if __name__ == "__main__":
    main()
