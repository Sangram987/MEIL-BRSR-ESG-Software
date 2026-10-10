# Migrations

This folder is intentionally empty of generated Alembic files — they're environment-specific
boilerplate that `flask db init` writes for you, and committing a hand-written copy risks it
drifting from whatever Flask-Migrate/Alembic version you actually install.

One-time setup, after `pip install -r requirements.txt` and with `DATABASE_URL` pointed at your
MySQL instance:

```bash
export FLASK_APP=run.py
flask db init                              # creates migrations/env.py, script.py.mako, versions/
flask db migrate -m "initial schema"       # autogenerates a migration from app/models/*
flask db upgrade                           # applies it
python -m seeds.run_seed                   # BRSR master + org hierarchy + demo users
```

For local development without MySQL, you don't need any of this: leave `DATABASE_URL` unset in
`.env` and `python -m seeds.run_seed` will call `db.create_all()` against the bundled SQLite file
at `instance/meil_esg.db` instead. Switch to real migrations before your first production
deployment so schema changes are tracked and reversible.

After the initial migration exists, every future model change is:

```bash
flask db migrate -m "add xyz column"
flask db upgrade
```
