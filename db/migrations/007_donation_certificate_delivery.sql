-- Track certificate email delivery attempts independently from the stable certificate ID.
DECLARE
  v NUMBER;
BEGIN
  SELECT COUNT(*) INTO v
  FROM user_tab_columns
  WHERE table_name = 'DONATIONS' AND column_name = 'CERTIFICATE_DELIVERY_STATUS';
  IF v = 0 THEN
    EXECUTE IMMEDIATE
      'ALTER TABLE donations ADD certificate_delivery_status VARCHAR2(20) DEFAULT ''pending'' NOT NULL';
  END IF;

  SELECT COUNT(*) INTO v
  FROM user_tab_columns
  WHERE table_name = 'DONATIONS' AND column_name = 'CERTIFICATE_DELIVERY_ATTEMPTED_AT';
  IF v = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE donations ADD certificate_delivery_attempted_at TIMESTAMP';
  END IF;

  UPDATE donations
  SET certificate_delivery_status = 'sent'
  WHERE certificate_sent_at IS NOT NULL
    AND certificate_delivery_status <> 'sent';

  SELECT COUNT(*) INTO v
  FROM user_constraints
  WHERE table_name = 'DONATIONS' AND constraint_name = 'CK_DONATIONS_CERT_DELIVERY';
  IF v = 0 THEN
    EXECUTE IMMEDIATE
      'ALTER TABLE donations ADD CONSTRAINT ck_donations_cert_delivery CHECK (certificate_delivery_status IN (''pending'', ''sending'', ''sent'', ''failed''))';
  END IF;
END;
/
