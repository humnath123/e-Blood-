-- Add profile/location columns the application expects on USERS.
-- Safe to re-run: ORA-01430 (column already exists) is ignored by the runner.
ALTER TABLE users ADD (last_donated_at TIMESTAMP);
ALTER TABLE users ADD (latitude NUMBER);
ALTER TABLE users ADD (longitude NUMBER);