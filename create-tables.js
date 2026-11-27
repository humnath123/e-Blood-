require('dotenv').config();
const oracledb = require('oracledb');

const schemaSql = `
CREATE TABLE users (
    user_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR2(50) NOT NULL UNIQUE,
    email VARCHAR2(100) NOT NULL UNIQUE,
    phone VARCHAR2(20) NOT NULL UNIQUE,
    password_hash VARCHAR2(255) NOT NULL,
    role VARCHAR2(20) NOT NULL CHECK (role IN ('patient', 'donor', 'bloodbank_staff', 'hospital_staff', 'ngo', 'admin')),
    is_active NUMBER(1) DEFAULT 1 CHECK (is_active IN (0, 1)),
    last_donated_at TIMESTAMP,
    latitude NUMBER(10, 6),
    longitude NUMBER(10, 6),
    blood_group VARCHAR2(5) CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    is_available NUMBER(1) DEFAULT 0 NOT NULL CHECK (is_available IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role ON users(role);

CREATE TABLE blood_banks (
    bank_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR2(100) NOT NULL,
    latitude NUMBER(10, 6) NOT NULL,
    longitude NUMBER(10, 6) NOT NULL,
    address VARCHAR2(200),
    phone VARCHAR2(20),
    email VARCHAR2(100),
    is_verified NUMBER(1) DEFAULT 0 CHECK (is_verified IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bank_lat ON blood_banks(latitude);
CREATE INDEX idx_bank_lon ON blood_banks(longitude);

CREATE TABLE hospitals (
    hospital_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR2(100) NOT NULL,
    latitude NUMBER(10, 6) NOT NULL,
    longitude NUMBER(10, 6) NOT NULL,
    address VARCHAR2(200),
    phone VARCHAR2(20),
    email VARCHAR2(100),
    is_verified NUMBER(1) DEFAULT 0 CHECK (is_verified IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hosp_lat ON hospitals(latitude);
CREATE INDEX idx_hosp_lon ON hospitals(longitude);

CREATE TABLE blood_inventory (
    inventory_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bank_id NUMBER NOT NULL,
    blood_group VARCHAR2(5) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    component VARCHAR2(20) DEFAULT 'whole_blood' NOT NULL CHECK (component IN ('whole_blood', 'plasma', 'platelets', 'rbc')),
    units NUMBER DEFAULT 0 NOT NULL,
    expiry_date TIMESTAMP NOT NULL,
    last_rested DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inventory_bank FOREIGN KEY (bank_id) REFERENCES blood_banks(bank_id) ON DELETE CASCADE
);

CREATE INDEX idx_inventory_bloodgroup ON blood_inventory(blood_group);
CREATE INDEX idx_inventory_expiry ON blood_inventory(expiry_date);
CREATE INDEX idx_inventory_bank ON blood_inventory(bank_id);

CREATE TABLE blood_requests (
    request_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL,
    hospital_id NUMBER,
    blood_group VARCHAR2(5) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    component VARCHAR2(20) DEFAULT 'whole_blood' NOT NULL CHECK (component IN ('whole_blood', 'plasma', 'platelets', 'rbc')),
    units_needed NUMBER DEFAULT 1 NOT NULL,
    urgency VARCHAR2(20) DEFAULT 'normal' NOT NULL CHECK (urgency IN ('normal', 'urgent', 'critical')),
    status VARCHAR2(20) DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'matched', 'fulfilled', 'cancelled', 'expired')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_requests_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_requests_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id) ON DELETE CASCADE
);

CREATE INDEX idx_requests_status ON blood_requests(status);
CREATE INDEX idx_requests_user ON blood_requests(user_id);
CREATE INDEX idx_requests_hospital ON blood_requests(hospital_id);

CREATE TABLE request_matches (
    match_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id NUMBER NOT NULL,
    user_id NUMBER NOT NULL,
    inventory_id NUMBER,
    status VARCHAR2(20) DEFAULT 'matched' NOT NULL CHECK (status IN ('matched', 'fulfilled', 'declined', 'expired')),
    contacted NUMBER(1) DEFAULT 0 CHECK (contacted IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_matches_request FOREIGN KEY (request_id) REFERENCES blood_requests(request_id) ON DELETE CASCADE,
    CONSTRAINT fk_matches_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_matches_inventory FOREIGN KEY (inventory_id) REFERENCES blood_inventory(inventory_id)
);

CREATE INDEX idx_matches_request ON request_matches(request_id);
CREATE INDEX idx_matches_status ON request_matches(status);

CREATE TABLE orders (
    order_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL,
    inventory_id NUMBER NOT NULL,
    units_ordered NUMBER DEFAULT 1 NOT NULL,
    discount_applied NUMBER(5) DEFAULT 0 CHECK (discount_applied >= 0 AND discount_applied <= 5),
    total_amount NUMBER DEFAULT 0 NOT NULL,
    status VARCHAR2(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    payment_status VARCHAR2(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_inventory FOREIGN KEY (inventory_id) REFERENCES blood_inventory(inventory_id)
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE donations (
    donation_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL,
    bank_id NUMBER,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    components VARCHAR2(100) DEFAULT 'whole_blood' CHECK (components IN ('whole_blood', 'plasma', 'platelets', 'rbc')),
    units NUMBER DEFAULT 1 NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_donations_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_donations_bank FOREIGN KEY (bank_id) REFERENCES blood_banks(bank_id)
);

CREATE INDEX idx_donations_user ON donations(user_id);
CREATE INDEX idx_donations_collected ON donations(collected_at);

CREATE TABLE partner_businesses (
    business_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR2(100) NOT NULL,
    category VARCHAR2(50),
    address VARCHAR2(200),
    latitude NUMBER(10, 6),
    longitude NUMBER(10, 6),
    discount_percent NUMBER DEFAULT 5 CHECK (discount_percent >= 0 AND discount_percent <= 50),
    is_active NUMBER(1) DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rewards (
    reward_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL,
    points NUMBER DEFAULT 0 NOT NULL,
    tier VARCHAR2(20) DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rewards_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_rewards_user ON rewards(user_id);

CREATE TABLE reward_redemptions (
    redemption_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL,
    reward_id NUMBER NOT NULL,
    redemption_type VARCHAR2(50) NOT NULL,
    points_spent NUMBER NOT NULL,
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_redemptions_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_redemptions_reward FOREIGN KEY (reward_id) REFERENCES rewards(reward_id)
);

CREATE INDEX idx_redemptions_user ON reward_redemptions(user_id);
CREATE INDEX idx_redemptions_reward ON reward_redemptions(reward_id);

CREATE TABLE ngo_campaigns (
    campaign_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR2(100) NOT NULL,
    description CLOB,
    target_blood_group VARCHAR2(5) CHECK (target_blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    target_units NUMBER DEFAULT 0 NOT NULL,
    target_date TIMESTAMP NOT NULL,
    created_by NUMBER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_campaigns_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE INDEX idx_campaigns_target ON ngo_campaigns(target_blood_group);
CREATE INDEX idx_campaigns_date ON ngo_campaigns(target_date);

CREATE TABLE campaign_participants (
    participant_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    campaign_id NUMBER NOT NULL,
    user_id NUMBER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_participants_campaign FOREIGN KEY (campaign_id) REFERENCES ngo_campaigns(campaign_id) ON DELETE CASCADE,
    CONSTRAINT fk_participants_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_participants_campaign ON campaign_participants(campaign_id);
CREATE INDEX idx_participants_user ON campaign_participants(user_id);

CREATE TABLE notifications (
    notification_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipient_id NUMBER NOT NULL,
    type VARCHAR2(50) NOT NULL,
    title VARCHAR2(200) NOT NULL,
    message CLOB,
    is_read NUMBER(1) DEFAULT 0 CHECK (is_read IN (0, 1)),
    related_id NUMBER,
    related_type VARCHAR2(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (recipient_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

CREATE TABLE refresh_tokens (
    token_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL,
    token_hash VARCHAR2(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

CREATE TABLE audit_log (
    log_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER,
    action VARCHAR2(100) NOT NULL,
    entity_type VARCHAR2(50),
    entity_id NUMBER,
    old_values CLOB,
    new_values CLOB,
    ip_address VARCHAR2(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

CREATE SEQUENCE seq_users MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUENCE seq_blood_banks MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUENCE seq_hospitals MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUENCE seq_blood_inventory MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUENCE seq_blood_requests MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUence seq_request_matches MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUence seq_orders MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUence seq_donations MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUence seq_partner_businesses MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUence seq_rewards MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUence seq_reward_redemptions MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUence seq_ngo_campaigns MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUence seq_campaign_participants MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUence seq_notifications MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUence seq_refresh_tokens MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
CREATE SEQUence seq_audit_log MINVALUE 1 MAXVALUE 999999999999999999999999999 START WITH 1 CACHE 20;
`;

async function main() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    });
    
    // Split statements and execute
    const statements = schemaSql.split(';');
    let ok = 0, skip = 0;
    
    for (const stmt of statements) {
      const s = stmt.trim();
      if (s.length > 0 && !s.startsWith('--')) {
        try {
          await conn.execute(s, [], { autoCommit: true });
          ok++;
          // console.log('OK:', s.substring(0, 50));
        } catch (e) {
          skip++;
          // console.log('SKIP:', e.message.substring(0, 50));
        }
      }
    }
    
    console.log(`Executed: ${ok}, Skipped: ${skip}`);
    await conn.close();
    console.log('Schema created successfully!');
  } catch (err) {
    console.error('Error creating schema:', err);
  }
}

main();