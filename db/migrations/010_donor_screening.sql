-- 010_donor_screening.sql: Donor health screening criteria

DECLARE
  PROCEDURE add_column_if_missing(p_name VARCHAR2, p_definition VARCHAR2) IS
    column_count PLS_INTEGER;
  BEGIN
    SELECT COUNT(*) INTO column_count
    FROM user_tab_columns
    WHERE table_name = 'USERS' AND column_name = UPPER(p_name);

    IF column_count = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE users ADD (' || p_definition || ')';
    END IF;
  END;
BEGIN
  add_column_if_missing('HAS_HIV', 'has_hiv NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_HIV CHECK (has_hiv IN (0, 1))');
  add_column_if_missing('HAS_HEPATITIS_B', 'has_hepatitis_b NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_HBV CHECK (has_hepatitis_b IN (0, 1))');
  add_column_if_missing('HAS_HEPATITIS_C', 'has_hepatitis_c NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_HCV CHECK (has_hepatitis_c IN (0, 1))');
  add_column_if_missing('HAS_SYPHILIS', 'has_syphilis NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_SYPH CHECK (has_syphilis IN (0, 1))');
  add_column_if_missing('HAS_MALARIA', 'has_malaria NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_MAL CHECK (has_malaria IN (0, 1))');
  add_column_if_missing('HAS_ANAEMIA', 'has_anaemia NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_ANAEMIA CHECK (has_anaemia IN (0, 1))');
  add_column_if_missing('HAS_HIGH_BLOOD_PRESSURE', 'has_high_blood_pressure NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_HBP CHECK (has_high_blood_pressure IN (0, 1))');
  add_column_if_missing('HAS_LOW_BLOOD_PRESSURE', 'has_low_blood_pressure NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_LBP CHECK (has_low_blood_pressure IN (0, 1))');
  add_column_if_missing('HAS_DIABETES', 'has_diabetes NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_DIABETES CHECK (has_diabetes IN (0, 1))');
  add_column_if_missing('HAS_HEART_DISEASE', 'has_heart_disease NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_HEART CHECK (has_heart_disease IN (0, 1))');
  add_column_if_missing('HAS_FEVER', 'has_fever NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_FEVER CHECK (has_fever IN (0, 1))');
  add_column_if_missing('HAS_JAUNDICE', 'has_jaundice NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_JAUNDICE CHECK (has_jaundice IN (0, 1))');
  add_column_if_missing('HAS_TUBERCULOSIS', 'has_tuberculosis NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_TB CHECK (has_tuberculosis IN (0, 1))');
  add_column_if_missing('IS_PREGNANT', 'is_pregnant NUMBER(1) DEFAULT 0 CONSTRAINT CK_U_PREG CHECK (is_pregnant IN (0, 1))');
  add_column_if_missing('LAST_SCREENING_DATE', 'last_screening_date TIMESTAMP');
  add_column_if_missing('DEFERRAL_REASON', 'deferral_reason VARCHAR2(200)');
  add_column_if_missing('ELIGIBILITY_STATUS', 'eligibility_status VARCHAR2(50) DEFAULT ''pending''');
  add_column_if_missing('UPDATED_AT', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
END;
/

-- A donor is not eligible until a real screening has been recorded.
UPDATE users
SET eligibility_status = CASE
      WHEN NVL(is_available, 0) = 0 THEN 'not_available'
      WHEN last_screening_date IS NULL THEN 'pending'
      ELSE NVL(eligibility_status, 'pending')
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE LOWER(role) = 'donor';

DECLARE
  PROCEDURE create_index_if_missing(p_name VARCHAR2, p_statement VARCHAR2) IS
    index_count PLS_INTEGER;
  BEGIN
    SELECT COUNT(*) INTO index_count
    FROM user_indexes
    WHERE table_name = 'USERS' AND index_name = UPPER(p_name);

    IF index_count = 0 THEN
      EXECUTE IMMEDIATE p_statement;
    END IF;
  END;
BEGIN
  create_index_if_missing(
    'IDX_USERS_ELIGIBILITY',
    'CREATE INDEX idx_users_eligibility ON users(eligibility_status, role, is_available)'
  );
  create_index_if_missing(
    'IDX_USERS_SCREENING',
    'CREATE INDEX idx_users_screening ON users(has_hiv, has_hepatitis_b, has_hepatitis_c, has_syphilis, has_fever, has_anaemia)'
  );
END;
/

CREATE OR REPLACE VIEW vw_eligible_donors AS
SELECT
  u.user_id AS "user_id",
  u.username AS "username",
  u.email AS "email",
  u.blood_group AS "blood_group",
  u.is_available AS "is_available",
  u.eligibility_status AS "eligibility_status",
  (SELECT MAX(d.collected_at)
   FROM donations d
   WHERE d.user_id = u.user_id) AS "last_donation_date",
  CASE u.eligibility_status
    WHEN 'eligible' THEN 'Yes - Can Donate'
    WHEN 'pending' THEN 'Pending - Check Criteria'
    WHEN 'not_eligible' THEN 'No - Deferred'
    WHEN 'not_available' THEN 'Not Available'
    ELSE 'Pending - Check Criteria'
  END AS "donation_status",
  CASE
    WHEN u.has_fever = 1 THEN 'Fever/Active Infection'
    WHEN u.has_anaemia = 1 THEN 'Anaemia/Low Hb'
    WHEN u.has_jaundice = 1 THEN 'Jaundice'
    WHEN u.is_pregnant = 1 THEN 'Pregnancy'
    WHEN u.has_heart_disease = 1 THEN 'Heart Disease'
    WHEN u.has_diabetes = 1 THEN 'Diabetes - Requires Assessment'
    ELSE u.deferral_reason
  END AS "deferral_reason_text"
FROM users u
WHERE LOWER(u.role) = 'donor' AND u.is_available = 1;

SELECT 'Donor screening migration applied successfully' AS status FROM dual;
