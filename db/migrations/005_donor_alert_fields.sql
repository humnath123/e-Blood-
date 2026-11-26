-- Data needed to target nearby blood-request alerts.
DECLARE
  v NUMBER;
BEGIN
  SELECT COUNT(*) INTO v FROM user_tab_columns
  WHERE table_name = 'USERS' AND column_name = 'BLOOD_GROUP';
  IF v = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE users ADD blood_group VARCHAR2(5) CHECK (blood_group IN (''A+'', ''A-'', ''B+'', ''B-'', ''AB+'', ''AB-'', ''O+'', ''O-''))';
  END IF;

  SELECT COUNT(*) INTO v FROM user_tab_columns
  WHERE table_name = 'USERS' AND column_name = 'IS_AVAILABLE';
  IF v = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE users ADD is_available NUMBER(1) DEFAULT 0 NOT NULL CHECK (is_available IN (0, 1))';
  END IF;
END;
/

ALTER TABLE blood_requests MODIFY hospital_id NULL;

DECLARE
  v NUMBER;
BEGIN
  SELECT COUNT(*) INTO v FROM user_indexes
  WHERE index_name = 'IDX_USERS_BLOOD_ALERTS';
  IF v = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX idx_users_blood_alerts ON users(role, blood_group, is_available, is_active)';
  END IF;
END;
/
