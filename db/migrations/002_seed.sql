-- 002_seed.sql: Seed realistic Nepali data for eBlood application
-- Locations: Kathmandu, Lalitpur, Bhaktapur, Pokhara
-- Uses IDENTITY columns (no explicit IDs). All test passwords are "password123".
-- Password hash below is the bcrypt cost-12 hash of "password123".

-- ============================================================
-- Users (TEST ACCOUNTS with known passwords)
-- ============================================================

-- Admin user
INSERT INTO users (username, email, phone, password_hash, role, is_active)
VALUES ('admin', 'admin@eblood.gov.np', '9812345678',
    '$2b$12$ozFa6kNdbDPl6m9nBC5pyudscJZpW49t0PiShEvdQ6aYih.cJeShS', 'admin', 1);

-- Bloodbank staff user
INSERT INTO users (username, email, phone, password_hash, role, is_active)
VALUES ('bankstaff1', 'staff@kathmandubloodbank.org', '9823456789',
    '$2b$12$ozFa6kNdbDPl6m9nBC5pyudscJZpW49t0PiShEvdQ6aYih.cJeShS', 'bloodbank_staff', 1);

-- Hospital staff user
INSERT INTO users (username, email, phone, password_hash, role, is_active)
VALUES ('hospitalstaff1', 'staff@civilhospital.gov.np', '9834567890',
    '$2b$12$ozFa6kNdbDPl6m9nBC5pyudscJZpW49t0PiShEvdQ6aYih.cJeShS', 'hospital_staff', 1);

-- Ngo user
INSERT INTO users (username, email, phone, password_hash, role, is_active)
VALUES ('ngo1', 'contact@redcross.org.np', '9845678901',
    '$2b$12$ozFa6kNdbDPl6m9nBC5pyudscJZpW49t0PiShEvdQ6aYih.cJeShS', 'ngo', 1);

-- Donor user (last_donated_at in the past so the 90-day rule applies)
INSERT INTO users (username, email, phone, password_hash, role, is_active, last_donated_at, blood_group, is_available, latitude, longitude)
VALUES ('donor1', 'ram@eblood.np', '9711111111',
    '$2b$12$ozFa6kNdbDPl6m9nBC5pyudscJZpW49t0PiShEvdQ6aYih.cJeShS', 'donor', 1,
    CURRENT_TIMESTAMP - NUMTODSINTERVAL(180, 'DAY'), 'A+', 1, 27.7172, 85.3240);

-- Patient user
INSERT INTO users (username, email, phone, password_hash, role, is_active)
VALUES ('patient1', 'sita@family.np', '9755555555',
    '$2b$12$ozFa6kNdbDPl6m9nBC5pyudscJZpW49t0PiShEvdQ6aYih.cJeShS', 'patient', 1);

-- Additional donor
INSERT INTO users (username, email, phone, password_hash, role, is_active, blood_group, is_available, latitude, longitude)
VALUES ('donor2', 'hari@eblood.np', '9722222222',
    '$2b$12$ozFa6kNdbDPl6m9nBC5pyudscJZpW49t0PiShEvdQ6aYih.cJeShS', 'donor', 1, 'O+', 1, 27.6613, 85.3208);

-- Additional patient
INSERT INTO users (username, email, phone, password_hash, role, is_active)
VALUES ('patient2', 'radha@family.np', '9733333333',
    '$2b$12$ozFa6kNdbDPl6m9nBC5pyudscJZpW49t0PiShEvdQ6aYih.cJeShS', 'patient', 1);

-- ============================================================
-- Blood Banks (Kathmandu Valley + Pokhara)
-- ============================================================

-- Kathmandu Central Blood Bank
INSERT INTO blood_banks (name, latitude, longitude, phone, email, is_verified)
VALUES ('Kathmandu Central Blood Bank', 27.7172, 85.3240, '9851234567', 'contact@kathmandubloodbank.org', 1);

-- Lalitpur Red Cross Blood Bank
INSERT INTO blood_banks (name, latitude, longitude, phone, email, is_verified)
VALUES ('Lalitpur Red Cross Blood Bank', 27.6613, 85.3208, '9852345678', 'contact@lalitpurredcross.org', 1);

-- Bhaktapur Government Hospital Blood Bank
INSERT INTO blood_banks (name, latitude, longitude, phone, email, is_verified)
VALUES ('Bhaktapur Govt. Blood Bank', 27.6608, 85.4420, '9853456789', 'bbhbt@gov.np', 0);

-- Pokhara Zonal Blood Bank
INSERT INTO blood_banks (name, latitude, longitude, phone, email, is_verified)
VALUES ('Pokhara Zonal Blood Bank', 28.2096, 83.9853, '9854567890', 'info@pokharabloodbank.org', 1);

-- ============================================================
-- Hospitals (Kathmandu Valley + Pokhara)
-- ============================================================

-- Civil Service Hospital
INSERT INTO hospitals (name, latitude, longitude, phone, email, is_verified)
VALUES ('Civil Service Hospital', 27.7169, 85.3222, '9815555555', 'info@civilhospital.gov.np', 1);

-- Patan Hospital
INSERT INTO hospitals (name, latitude, longitude, phone, email, is_verified)
VALUES ('Patan Hospital', 27.6667, 85.3333, '9825555555', 'admin@patanhospital.org', 1);

-- Bhaktapur District Hospital
INSERT INTO hospitals (name, latitude, longitude, phone, email, is_verified)
VALUES ('Bhaktapur District Hospital', 27.6608, 85.4420, '9835555555', 'bdh@gov.np', 0);

-- Pokhara Academy of Health Sciences
INSERT INTO hospitals (name, latitude, longitude, phone, email, is_verified)
VALUES ('Pokhara Academy of Health Sciences', 28.2123, 83.9870, '9845555555', 'contact@pahs.edu.np', 1);

-- ============================================================
-- Blood Inventory (with realistic Nepali data, expiry in the future)
-- ============================================================

-- Kathmandu Central - A+ whole blood
INSERT INTO blood_inventory (bank_id, blood_group, component, units, expiry_date)
SELECT bank_id, 'A+', 'whole_blood', 5, CURRENT_TIMESTAMP + NUMTODSINTERVAL(120, 'DAY')
FROM blood_banks WHERE name = 'Kathmandu Central Blood Bank';

-- Kathmandu Central - B+ whole blood
INSERT INTO blood_inventory (bank_id, blood_group, component, units, expiry_date)
SELECT bank_id, 'B+', 'whole_blood', 3, CURRENT_TIMESTAMP + NUMTODSINTERVAL(150, 'DAY')
FROM blood_banks WHERE name = 'Kathmandu Central Blood Bank';

-- Kathmandu Central - AB+ plasma
INSERT INTO blood_inventory (bank_id, blood_group, component, units, expiry_date)
SELECT bank_id, 'AB+', 'plasma', 2, CURRENT_TIMESTAMP + NUMTODSINTERVAL(200, 'DAY')
FROM blood_banks WHERE name = 'Kathmandu Central Blood Bank';

-- Lalitpur Red Cross - O+ whole blood
INSERT INTO blood_inventory (bank_id, blood_group, component, units, expiry_date)
SELECT bank_id, 'O+', 'whole_blood', 8, CURRENT_TIMESTAMP + NUMTODSINTERVAL(90, 'DAY')
FROM blood_banks WHERE name = 'Lalitpur Red Cross Blood Bank';

-- Lalitpur Red Cross - A- rbc
INSERT INTO blood_inventory (bank_id, blood_group, component, units, expiry_date)
SELECT bank_id, 'A-', 'rbc', 1, CURRENT_TIMESTAMP + NUMTODSINTERVAL(100, 'DAY')
FROM blood_banks WHERE name = 'Lalitpur Red Cross Blood Bank';

-- Bhaktapur - B- platelets
INSERT INTO blood_inventory (bank_id, blood_group, component, units, expiry_date)
SELECT bank_id, 'B-', 'platelets', 1, CURRENT_TIMESTAMP + NUMTODSINTERVAL(70, 'DAY')
FROM blood_banks WHERE name = 'Bhaktapur Govt. Blood Bank';

-- Pokhara Zonal - AB- plasma
INSERT INTO blood_inventory (bank_id, blood_group, component, units, expiry_date)
SELECT bank_id, 'AB-', 'plasma', 1, CURRENT_TIMESTAMP + NUMTODSINTERVAL(210, 'DAY')
FROM blood_banks WHERE name = 'Pokhara Zonal Blood Bank';

-- Pokhara Zonal - O+ whole blood
INSERT INTO blood_inventory (bank_id, blood_group, component, units, expiry_date)
SELECT bank_id, 'O+', 'whole_blood', 6, CURRENT_TIMESTAMP + NUMTODSINTERVAL(130, 'DAY')
FROM blood_banks WHERE name = 'Pokhara Zonal Blood Bank';

-- ============================================================
-- Blood Requests (open requests from patients)
-- ============================================================

-- Patient 1 requests A+ whole blood at a verified hospital
INSERT INTO blood_requests (user_id, hospital_id, blood_group, component, units_needed, urgency, status)
SELECT u.user_id, h.hospital_id, 'A+', 'whole_blood', 2, 'urgent', 'open'
FROM users u, hospitals h
WHERE u.username = 'patient1' AND h.name = 'Pokhara Academy of Health Sciences';

-- Patient 2 requests O+ whole blood
INSERT INTO blood_requests (user_id, hospital_id, blood_group, component, units_needed, urgency, status)
SELECT u.user_id, h.hospital_id, 'O+', 'whole_blood', 1, 'normal', 'open'
FROM users u, hospitals h
WHERE u.username = 'patient2' AND h.name = 'Bhaktapur District Hospital';

-- ============================================================
-- Request Matches (initial matches)
-- ============================================================

-- Match the first open request with the first donor, linked to an A+ inventory
INSERT INTO request_matches (request_id, user_id, inventory_id, status, contacted)
SELECT
  (SELECT request_id FROM blood_requests WHERE blood_group = 'A+' AND status = 'open' AND ROWNUM = 1),
  (SELECT user_id FROM users WHERE username = 'donor1'),
  (SELECT inventory_id FROM blood_inventory WHERE blood_group = 'A+' AND component = 'whole_blood' AND ROWNUM = 1),
  'matched', 0
FROM dual;

-- ============================================================
-- Partner Businesses (for discounts)
-- ============================================================

INSERT INTO partner_businesses (name, category, latitude, longitude, discount_percent, is_active)
VALUES ('Cafe Nectar', 'cafe', 27.7175, 85.3242, 5, 1);

INSERT INTO partner_businesses (name, category, latitude, longitude, discount_percent, is_active)
VALUES ('PharmEasy', 'pharmacy', 27.7180, 85.3250, 10, 1);

INSERT INTO partner_businesses (name, category, latitude, longitude, discount_percent, is_active)
VALUES ('RideEasy', 'transport', 27.7200, 85.3300, 5, 1);

-- ============================================================
-- Rewards (for donors)
-- ============================================================

INSERT INTO rewards (user_id, points, tier)
SELECT user_id, 150, 'silver' FROM users WHERE username = 'donor1';

INSERT INTO rewards (user_id, points, tier)
SELECT user_id, 80, 'bronze' FROM users WHERE username = 'donor2';

-- ============================================================
-- NGO Campaigns (blood donation drives)
-- ============================================================

INSERT INTO ngo_campaigns (title, description, target_blood_group, target_units, target_date, created_by)
SELECT 'Kathmandu Summer Blood Drive', 'Summer blood donation campaign to replenish stocks', 'O+', 100,
       CURRENT_TIMESTAMP + NUMTODSINTERVAL(120, 'DAY'), u.user_id
FROM users u WHERE u.username = 'ngo1';

INSERT INTO ngo_campaigns (title, description, target_blood_group, target_units, target_date, created_by)
SELECT 'Pokhara Winter Blood Drive', 'Winter donation drive for rare blood groups', 'B-', 20,
       CURRENT_TIMESTAMP - NUMTODSINTERVAL(30, 'DAY'), u.user_id
FROM users u WHERE u.username = 'ngo1';

INSERT INTO ngo_campaigns (title, description, target_blood_group, target_units, target_date, created_by)
SELECT 'AB Emergency Campaign', 'Urgent campaign for AB blood group patients', 'AB-', 10,
       CURRENT_TIMESTAMP + NUMTODSINTERVAL(20, 'DAY'), u.user_id
FROM users u WHERE u.username = 'ngo1';

-- ============================================================
-- Campaign Participants
-- ============================================================

INSERT INTO campaign_participants (campaign_id, user_id)
SELECT c.campaign_id, u.user_id FROM ngo_campaigns c, users u
WHERE c.title = 'Kathmandu Summer Blood Drive' AND u.username = 'patient1';

INSERT INTO campaign_participants (campaign_id, user_id)
SELECT c.campaign_id, u.user_id FROM ngo_campaigns c, users u
WHERE c.title = 'Pokhara Winter Blood Drive' AND u.username = 'donor1';

-- ============================================================
-- Notifications (system notifications)
-- ============================================================

INSERT INTO notifications (recipient_id, type, title, message, is_read)
SELECT u.user_id, 'request', 'New blood request', 'Your blood request has been created', 0
FROM users u WHERE u.username = 'patient1';

INSERT INTO notifications (recipient_id, type, title, message, is_read)
SELECT u.user_id, 'match', 'New match found', 'You are a match for a blood request', 0
FROM users u WHERE u.username = 'donor1';

-- ============================================================
-- Triggers for automatic updated_at
-- ============================================================

-- Users trigger
CREATE OR REPLACE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

-- Blood Banks trigger
CREATE OR REPLACE TRIGGER trg_blood_banks_updated_at
BEFORE UPDATE ON blood_banks
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

-- Hospitals trigger
CREATE OR REPLACE TRIGGER trg_hospitals_updated_at
BEFORE UPDATE ON hospitals
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

-- Blood Inventory trigger
CREATE OR REPLACE TRIGGER trg_blood_inventory_updated_at
BEFORE UPDATE ON blood_inventory
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

-- Blood Requests trigger
CREATE OR REPLACE TRIGGER trg_blood_requests_updated_at
BEFORE UPDATE ON blood_requests
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

-- Orders trigger
CREATE OR REPLACE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/
