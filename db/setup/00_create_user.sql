-- db/setup/00_create_user.sql: Oracle user creation and grants for eBlood
-- Run this as a DBA (SYSTEM or SYS) user

-- ============================================================
-- Create EBLOOD_APP user
-- ============================================================
CREATE USER EBLOOD_APP IDENTIFIED BY "EbloodDb_26ai_Rotate_7xQ9";

-- Grant basic session and table privileges
GRANT CREATE SESSION TO EBLOID_APP;
GRANT CREATE TABLE TO EBLOID_APP;
GRANT CREATE SEQUENCE TO EBLOID_APP;
GRANT CREATE PROCEDURE TO EBLOID_APP;
GRANT CREATE TRIGGER TO EBLOID_APP;
GRANT CREATE VIEW TO EBLOID_APP;
GRANT UNLIMITED TABLESPACE TO EBLOID_APP;

-- ============================================================
-- Grant access to all tables/views/sequences we'll use
-- ============================================================
-- Grant SELECT on core tables (these would be created by the migrations)
GRANT SELECT, INSERT, UPDATE, DELETE TO EBLOID_APP;

-- Grant on sequences
GRANT SELECT ON seq_users TO EBLOID_APP;
GRANT SELECT ON seq_blood_banks TO EBLOID_APP;
GRANT SELECT ON seq_hospitals TO EBLOID_APP;
GRANT SELECT ON seq_blood_inventory TO EBLOID_APP;
GRANT SELECT ON seq_blood_requests TO EBLOID_APP;
GRANT SELECT ON seq_request_matches TO EBLOID_APP;
GRANT SELECT ON seq_orders TO EBLOID_APP;
GRANT SELECT ON seq_donations TO EBLOID_APP;
GRANT SELECT ON seq_partner_businesses TO EBLOID_APP;
GRANT SELECT ON seq_rewards TO EBLOID_APP;
GRANT SELECT ON seq_reward_redemptions TO EBLOID_APP;
GRANT SELECT ON seq_ngo_campaigns TO EBLOID_APP;
GRANT SELECT ON seq_campaign_participants TO EBLOID_APP;
GRANT SELECT ON seq_notifications TO EBLOID_APP;
GRANT SELECT ON seq_refresh_tokens TO EBLOID_APP;
GRANT SELECT ON seq_audit_log TO EBLOID_APP;

-- ============================================================
-- Grant on procedures/triggers if needed
-- ============================================================

-- ============================================================
-- Grant admin role for the app user (optional)
-- ============================================================
-- CREATE ROLE eblod_admin;
-- GRANT eblod_admin TO EBLOID_APP;
-- GRANT SELECT ANY TABLE TO EBLOID_APP;
-- etc.

-- ============================================================
-- End of user setup
-- ============================================================
EXIT;