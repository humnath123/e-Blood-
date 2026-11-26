-- 003_contract_alignment.sql
-- Adds contract-alignment columns. Fully idempotent: each ALTER is wrapped in a
-- PL/SQL block that no-ops when the column already exists (ORA-01430 / ORA-00955).
-- Safe to run repeatedly; errors are ignored by the migration runner.

DECLARE
  v NUMBER;
BEGIN
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'USERS' AND column_name = 'FIRST_NAME';
  IF v = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE users ADD first_name VARCHAR2(50)';
  END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'USERS' AND column_name = 'LAST_NAME';
  IF v = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE users ADD last_name VARCHAR2(50)';
  END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'USERS' AND column_name = 'IS_EMAIL_VERIFIED';
  IF v = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE users ADD is_email_verified NUMBER(1) DEFAULT 0';
  END IF;
END;
/

DECLARE
  v NUMBER;
BEGIN
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'BLOOD_REQUESTS' AND column_name = 'REQUEST_TYPE';
  IF v = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE blood_requests ADD request_type VARCHAR2(20) DEFAULT ''blood''';
  END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'BLOOD_REQUESTS' AND column_name = 'NOTES';
  IF v = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE blood_requests ADD notes CLOB';
  END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'BLOOD_REQUESTS' AND column_name = 'IS_ACTIVE';
  IF v = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE blood_requests ADD is_active NUMBER(1) DEFAULT 1';
  END IF;
END;
/

DECLARE
  v NUMBER;
BEGIN
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'BLOOD_BANKS' AND column_name = 'ORGANIZATION_CODE';
  IF v = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE blood_banks ADD organization_code VARCHAR2(50)'; END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'BLOOD_BANKS' AND column_name = 'STREET';
  IF v = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE blood_banks ADD street VARCHAR2(200)'; END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'BLOOD_BANKS' AND column_name = 'CITY';
  IF v = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE blood_banks ADD city VARCHAR2(100)'; END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'BLOOD_BANKS' AND column_name = 'STATE';
  IF v = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE blood_banks ADD state VARCHAR2(100)'; END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'BLOOD_BANKS' AND column_name = 'PIN_CODE';
  IF v = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE blood_banks ADD pin_code VARCHAR2(20)'; END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'BLOOD_BANKS' AND column_name = 'COUNTRY';
  IF v = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE blood_banks ADD country VARCHAR2(100) DEFAULT ''Nepal'''; END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'BLOOD_BANKS' AND column_name = 'LICENSE_NUMBER';
  IF v = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE blood_banks ADD license_number VARCHAR2(100)'; END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'BLOOD_BANKS' AND column_name = 'STORAGE_CAPACITY';
  IF v = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE blood_banks ADD storage_capacity NUMBER'; END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'BLOOD_BANKS' AND column_name = 'CURRENT_STOCK';
  IF v = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE blood_banks ADD current_stock NUMBER DEFAULT 0'; END IF;
END;
/

DECLARE
  v NUMBER;
BEGIN
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'DONATIONS' AND column_name = 'BLOOD_GROUP';
  IF v = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE donations ADD blood_group VARCHAR2(5)'; END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'DONATIONS' AND column_name = 'DONATION_CAMP_ID';
  IF v = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE donations ADD donation_camp_id NUMBER'; END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'DONATIONS' AND column_name = 'DONATION_LOCATION';
  IF v = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE donations ADD donation_location VARCHAR2(200)'; END IF;
  SELECT COUNT(*) INTO v FROM user_tab_columns WHERE table_name = 'DONATIONS' AND column_name = 'STATUS';
  IF v = 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE donations ADD status VARCHAR2(20) DEFAULT ''completed'''; END IF;
END;
/
