-- Persist one stable certificate ID and the most recent successful email date per donation.
DECLARE
  v NUMBER;
BEGIN
  SELECT COUNT(*) INTO v
  FROM user_tab_columns
  WHERE table_name = 'DONATIONS' AND column_name = 'CERTIFICATE_ID';
  IF v = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE donations ADD certificate_id VARCHAR2(64)';
  END IF;

  SELECT COUNT(*) INTO v
  FROM user_tab_columns
  WHERE table_name = 'DONATIONS' AND column_name = 'CERTIFICATE_SENT_AT';
  IF v = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE donations ADD certificate_sent_at TIMESTAMP';
  END IF;

  SELECT COUNT(*) INTO v
  FROM user_indexes
  WHERE index_name = 'UQ_DONATIONS_CERTIFICATE_ID';
  IF v = 0 THEN
    EXECUTE IMMEDIATE 'CREATE UNIQUE INDEX uq_donations_certificate_id ON donations(certificate_id)';
  END IF;
END;
/
