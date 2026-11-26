-- Blood transport requests and an append-only operational history.
CREATE TABLE blood_transports (
  transport_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blood_request_id NUMBER,
  requester_id NUMBER NOT NULL,
  source_bank_id NUMBER NOT NULL,
  destination_hospital_id NUMBER NOT NULL,
  assigned_driver_id NUMBER,
  vehicle_identifier VARCHAR2(50),
  blood_group VARCHAR2(5) NOT NULL
    CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  component VARCHAR2(20) DEFAULT 'whole_blood' NOT NULL
    CHECK (component IN ('whole_blood', 'plasma', 'platelets', 'rbc')),
  units NUMBER(5) NOT NULL CHECK (units > 0),
  pickup_address VARCHAR2(500) NOT NULL,
  destination_address VARCHAR2(500) NOT NULL,
  pickup_latitude NUMBER(10, 6),
  pickup_longitude NUMBER(10, 6),
  destination_latitude NUMBER(10, 6),
  destination_longitude NUMBER(10, 6),
  current_latitude NUMBER(10, 6),
  current_longitude NUMBER(10, 6),
  location_updated_at TIMESTAMP,
  estimated_arrival TIMESTAMP,
  status VARCHAR2(20) DEFAULT 'PENDING' NOT NULL
    CHECK (status IN ('PENDING', 'APPROVED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'DELAYED', 'FAILED')),
  delay_reason VARCHAR2(1000),
  delivery_confirmation CLOB,
  delivery_confirmed_by NUMBER,
  delivery_confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT fk_transport_request FOREIGN KEY (blood_request_id)
    REFERENCES blood_requests(request_id) ON DELETE SET NULL,
  CONSTRAINT fk_transport_requester FOREIGN KEY (requester_id)
    REFERENCES users(user_id),
  CONSTRAINT fk_transport_bank FOREIGN KEY (source_bank_id)
    REFERENCES blood_banks(bank_id),
  CONSTRAINT fk_transport_hospital FOREIGN KEY (destination_hospital_id)
    REFERENCES hospitals(hospital_id),
  CONSTRAINT fk_transport_driver FOREIGN KEY (assigned_driver_id)
    REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_transport_confirmed_by FOREIGN KEY (delivery_confirmed_by)
    REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_transport_status ON blood_transports(status, updated_at);
CREATE INDEX idx_transport_requester ON blood_transports(requester_id, created_at);
CREATE INDEX idx_transport_bank ON blood_transports(source_bank_id, status);
CREATE INDEX idx_transport_driver ON blood_transports(assigned_driver_id, status);

CREATE TABLE blood_transport_history (
  history_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transport_id NUMBER NOT NULL,
  actor_id NUMBER,
  action VARCHAR2(30) NOT NULL,
  from_status VARCHAR2(20),
  to_status VARCHAR2(20),
  latitude NUMBER(10, 6),
  longitude NUMBER(10, 6),
  estimated_arrival TIMESTAMP,
  notes CLOB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT fk_transport_history_transport FOREIGN KEY (transport_id)
    REFERENCES blood_transports(transport_id) ON DELETE CASCADE,
  CONSTRAINT fk_transport_history_actor FOREIGN KEY (actor_id)
    REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_transport_history_time ON blood_transport_history(transport_id, created_at);
