-- Optional: create a least-privilege runtime role for the API (not for alembic).
-- Run as a Postgres superuser / database owner after migrations.
-- Replace passwords and database name before use.
--
-- Migrator (CI / deploy) keeps a role that can DDL.
-- Runtime (uvicorn / Celery) uses nsa_connect_app with DML only.

-- CREATE ROLE nsa_connect_migrator LOGIN PASSWORD 'change-me-migrator';
-- CREATE ROLE nsa_connect_app LOGIN PASSWORD 'change-me-runtime';
-- CREATE DATABASE nsa_connect OWNER nsa_connect_migrator;

GRANT CONNECT ON DATABASE nsa_connect TO nsa_connect_app;
GRANT USAGE ON SCHEMA public TO nsa_connect_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nsa_connect_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nsa_connect_app;

ALTER DEFAULT PRIVILEGES FOR ROLE nsa_connect_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nsa_connect_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nsa_connect_migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO nsa_connect_app;

-- Do NOT grant CREATEDB / SUPERUSER / BYPASSRLS to nsa_connect_app.
-- Point DATABASE_URL for API + Celery at nsa_connect_app.
-- Point alembic / migration jobs at nsa_connect_migrator.
