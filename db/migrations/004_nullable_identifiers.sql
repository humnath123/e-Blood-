-- 004_nullable_identifiers.sql
-- The auth flow stores either email or phone (the other is NULL), so both
-- columns must be nullable. Idempotent: MODIFY ... NULL is safe to re-run.

ALTER TABLE users MODIFY phone NULL;
ALTER TABLE users MODIFY email NULL;