-- Donation events are distinct from NGO campaigns and inventory orders.
CREATE TABLE donation_events (
  event_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR2(150) NOT NULL,
  description CLOB,
  banner_url VARCHAR2(1000),
  organizer_name VARCHAR2(150) NOT NULL,
  organizer_contact VARCHAR2(200),
  location VARCHAR2(500) NOT NULL,
  latitude NUMBER(10, 6),
  longitude NUMBER(10, 6),
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  registration_deadline TIMESTAMP NOT NULL,
  max_participants NUMBER(6),
  status VARCHAR2(30) DEFAULT 'DRAFT' NOT NULL
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'POSTPONED')),
  created_by NUMBER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT ck_donation_event_dates CHECK (ends_at > starts_at),
  CONSTRAINT ck_event_capacity CHECK (max_participants IS NULL OR max_participants > 0),
  CONSTRAINT fk_donation_event_creator FOREIGN KEY (created_by)
    REFERENCES users(user_id)
);

CREATE INDEX idx_donation_events_status ON donation_events(status, starts_at);
CREATE INDEX idx_donation_events_creator ON donation_events(created_by);

CREATE TABLE event_registrations (
  registration_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id NUMBER NOT NULL,
  user_id NUMBER NOT NULL,
  registration_status VARCHAR2(20) DEFAULT 'REGISTERED' NOT NULL
    CHECK (registration_status IN ('REGISTERED', 'CANCELLED', 'ATTENDED', 'NO_SHOW')),
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  attendance_at TIMESTAMP,
  donation_id NUMBER,
  donation_confirmed_at TIMESTAMP,
  CONSTRAINT uq_event_registration UNIQUE (event_id, user_id),
  CONSTRAINT uq_event_donation UNIQUE (donation_id),
  CONSTRAINT fk_event_registration_event FOREIGN KEY (event_id)
    REFERENCES donation_events(event_id) ON DELETE CASCADE,
  CONSTRAINT fk_event_registration_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_event_registration_donation FOREIGN KEY (donation_id)
    REFERENCES donations(donation_id) ON DELETE SET NULL
);

CREATE INDEX idx_event_registrations_user ON event_registrations(user_id, registration_status);
