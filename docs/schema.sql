-- FlightPool production schema (PostgreSQL 15+ with PostGIS)
-- Conventions: money in integer paise; timestamps are timestamptz (UTC); UUID primary keys;
-- soft-delete via deleted_at where needed; PII encrypted at the application layer (bytea *_enc columns).
-- Review with your security/legal advisers before storing real passenger data (DPDP Act).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------- ENUMS
CREATE TYPE user_role           AS ENUM ('rider','driver','admin','marshal','support');
CREATE TYPE gender_type         AS ENUM ('female','male','other','prefer_not_to_say');
CREATE TYPE verification_status AS ENUM ('pending','verified','rejected','expired');
CREATE TYPE request_status      AS ENUM ('searching','forming','confirmed','driver_assigned','on_trip','completed','cancelled','expired','solo_fallback');
CREATE TYPE pool_status         AS ENUM ('forming','confirmed','driver_assigned','at_bay','on_trip','completed','cancelled');
CREATE TYPE stop_type           AS ENUM ('pickup','dropoff');
CREATE TYPE payment_status      AS ENUM ('created','authorised','captured','failed','voided','partially_refunded','refunded');
CREATE TYPE incident_severity   AS ENUM ('s1','s2','s3','s4');
CREATE TYPE incident_status     AS ENUM ('open','acknowledged','resolved');
CREATE TYPE ledger_direction    AS ENUM ('debit','credit');

-- ---------------------------------------------------------------- IDENTITY
CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone            text UNIQUE NOT NULL,
  phone_verified_at timestamptz,
  email            text,
  full_name        text NOT NULL,
  role             user_role NOT NULL DEFAULT 'rider',
  gender           gender_type NOT NULL DEFAULT 'prefer_not_to_say',
  gender_verified  boolean NOT NULL DEFAULT false,   -- ID/selfie verified; required for women-only pools
  language         text NOT NULL DEFAULT 'en' CHECK (language IN ('en','hi','mr')),
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned','deleted')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE TABLE devices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_hash  text NOT NULL,
  platform     text,
  push_token   text,
  is_trusted   boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_hash)
);

CREATE TABLE otp_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  code_hash   text NOT NULL,
  purpose     text NOT NULL DEFAULT 'login',
  attempts    int  NOT NULL DEFAULT 0,
  ip          inet,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_phone_created_idx ON otp_requests (phone, created_at DESC);

CREATE TABLE emergency_contacts (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    text NOT NULL,
  phone   text NOT NULL
);

CREATE TABLE consents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    text NOT NULL,                -- e.g. 'boarding_pass_data','location','marketing'
  version    text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  ip         inet
);

CREATE TABLE rider_profiles (
  user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rating_avg     numeric(3,2),
  rating_count   int NOT NULL DEFAULT 0,
  no_show_count  int NOT NULL DEFAULT 0,
  banned_until   timestamptz,
  wallet_paise   bigint NOT NULL DEFAULT 0 CHECK (wallet_paise >= 0)
);

-- ---------------------------------------------------------------- SUPPLY
CREATE TABLE fleet_partners (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name    text NOT NULL,
  gstin   text,
  contact text,
  status  text NOT NULL DEFAULT 'active'
);

CREATE TABLE driver_profiles (
  user_id              uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  fleet_partner_id     uuid REFERENCES fleet_partners(id),
  kyc_status           verification_status NOT NULL DEFAULT 'pending',
  police_verified_at   timestamptz,
  licence_number_enc   bytea,
  licence_expiry       date,
  online               boolean NOT NULL DEFAULT false,
  guarantee_enabled    boolean NOT NULL DEFAULT false,   -- earnings-guarantee top-up
  rating_avg           numeric(3,2),
  rating_count         int NOT NULL DEFAULT 0,
  acceptance_rate      numeric(5,2),
  payout_account_ref   text,                              -- tokenised reference, never raw bank details
  onboarded_at         timestamptz
);

CREATE TABLE vehicles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         uuid REFERENCES driver_profiles(user_id),
  fleet_partner_id  uuid REFERENCES fleet_partners(id),
  plate             text UNIQUE NOT NULL,
  make              text,
  model             text,
  vehicle_class     text NOT NULL DEFAULT 'sedan' CHECK (vehicle_class IN ('hatch','sedan','suv','van')),
  seats             smallint NOT NULL DEFAULT 4,
  luggage_capacity  smallint NOT NULL DEFAULT 3,
  ac                boolean NOT NULL DEFAULT true,
  permit_expiry     date,
  insurance_expiry  date,
  fitness_expiry    date,
  status            text NOT NULL DEFAULT 'active'
);

CREATE TABLE driver_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    uuid NOT NULL REFERENCES driver_profiles(user_id) ON DELETE CASCADE,
  doc_type     text NOT NULL,       -- licence, rc, permit, insurance, police_verification, photo
  storage_key  text NOT NULL,       -- object-store key (private bucket)
  status       verification_status NOT NULL DEFAULT 'pending',
  expires_at   date,
  reviewed_by  uuid REFERENCES users(id),
  reviewed_at  timestamptz
);

-- ---------------------------------------------------------------- GEOGRAPHY
CREATE TABLE airports (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iata_code char(3) UNIQUE NOT NULL,
  name      text NOT NULL,
  city      text NOT NULL,
  timezone  text NOT NULL DEFAULT 'Asia/Kolkata'
);

CREATE TABLE terminals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id uuid NOT NULL REFERENCES airports(id),
  code       text NOT NULL,
  name       text,
  geom       geography(Point,4326),
  UNIQUE (airport_id, code)
);

CREATE TABLE pickup_bays (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL REFERENCES terminals(id),
  label       text NOT NULL,
  geom        geography(Point,4326),
  active      boolean NOT NULL DEFAULT true,
  UNIQUE (terminal_id, label)
);

CREATE TABLE zones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id uuid NOT NULL REFERENCES airports(id),
  code       text NOT NULL,                -- e.g. THANE, MULUND, POWAI, BANDRA, ANDHERI, NAVI_MUMBAI
  name       text NOT NULL,
  corridor   text NOT NULL,                -- matching cluster, e.g. 'east','west','navi'
  geom       geography(MultiPolygon,4326),
  centroid   geography(Point,4326),
  UNIQUE (airport_id, code)
);
CREATE INDEX zones_geom_idx ON zones USING gist (geom);

-- ---------------------------------------------------------------- FLIGHTS AND VERIFICATION
CREATE TABLE flights (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airline_code       text NOT NULL,
  flight_number      text NOT NULL,
  origin_iata        char(3),
  airport_id         uuid NOT NULL REFERENCES airports(id),
  terminal_id        uuid REFERENCES terminals(id),
  scheduled_arrival  timestamptz NOT NULL,
  estimated_arrival  timestamptz,
  actual_arrival     timestamptz,
  status             text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','delayed','landed','cancelled','diverted')),
  UNIQUE (flight_number, scheduled_arrival)
);
CREATE INDEX flights_window_idx ON flights (airport_id, estimated_arrival);

CREATE TABLE flight_status_events (
  id          bigserial PRIMARY KEY,
  flight_id   uuid NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
  status      text NOT NULL,
  payload     jsonb,
  source      text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE boarding_pass_verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  flight_id   uuid NOT NULL REFERENCES flights(id),
  pnr_hash    text NOT NULL,               -- hash only; raw boarding-pass data is not stored
  method      text NOT NULL CHECK (method IN ('code','scan','airline_api','marshal')),
  status      verification_status NOT NULL DEFAULT 'pending',
  consent_id  uuid REFERENCES consents(id),
  verified_at timestamptz,
  UNIQUE (flight_id, pnr_hash)             -- stops one boarding pass being reused by two accounts
);

-- ---------------------------------------------------------------- PRICING
CREATE TABLE pricing_rules (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id             uuid NOT NULL REFERENCES airports(id),
  zone_id                uuid REFERENCES zones(id),
  version                int NOT NULL,
  base_fare_paise        int NOT NULL,
  per_km_paise           int NOT NULL,
  per_min_paise          int NOT NULL DEFAULT 0,
  night_multiplier       numeric(4,2) NOT NULL DEFAULT 1.00,
  min_saving_pct         numeric(5,2) NOT NULL DEFAULT 30.00,
  commission_pct         numeric(5,2) NOT NULL DEFAULT 15.00,
  convenience_fee_paise  int NOT NULL DEFAULT 2000,
  effective_from         timestamptz NOT NULL,
  effective_to           timestamptz,
  created_by             uuid REFERENCES users(id),
  UNIQUE (airport_id, zone_id, version)
);

-- ---------------------------------------------------------------- REQUESTS, POOLS, TRIPS
CREATE TABLE ride_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id      uuid NOT NULL REFERENCES users(id),
  flight_id     uuid NOT NULL REFERENCES flights(id),
  verification_id uuid REFERENCES boarding_pass_verifications(id),
  airport_id    uuid NOT NULL REFERENCES airports(id),
  terminal_id   uuid REFERENCES terminals(id),
  dest_zone_id  uuid NOT NULL REFERENCES zones(id),
  dest_point    geography(Point,4326),               -- exact address hidden from co-riders
  party_size    smallint NOT NULL DEFAULT 1 CHECK (party_size BETWEEN 1 AND 4),
  luggage_count smallint NOT NULL DEFAULT 1 CHECK (luggage_count >= 0),
  women_only    boolean NOT NULL DEFAULT false,
  status        request_status NOT NULL DEFAULT 'searching',
  ready_at      timestamptz,
  wait_cap_at   timestamptz,                         -- ready_at + wait cap (default 20 min)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rr_status_cap_idx ON ride_requests (status, wait_cap_at) WHERE status IN ('searching','forming');
CREATE INDEX rr_match_idx ON ride_requests (airport_id, dest_zone_id, status, ready_at);

CREATE TABLE pools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id  uuid NOT NULL REFERENCES airports(id),
  terminal_id uuid REFERENCES terminals(id),
  corridor    text NOT NULL,
  status      pool_status NOT NULL DEFAULT 'forming',
  women_only  boolean NOT NULL DEFAULT false,
  max_parties smallint NOT NULL DEFAULT 4,
  window_start timestamptz NOT NULL,
  window_end   timestamptz NOT NULL,
  vehicle_id  uuid REFERENCES vehicles(id),
  driver_id   uuid REFERENCES driver_profiles(user_id),
  bay_id      uuid REFERENCES pickup_bays(id),
  formed_at   timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  version     int NOT NULL DEFAULT 1               -- optimistic locking for concurrent joins
);
CREATE INDEX pools_open_idx ON pools (airport_id, corridor, status, window_start) WHERE status IN ('forming','confirmed');

CREATE TABLE pool_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id         uuid NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  ride_request_id uuid NOT NULL UNIQUE REFERENCES ride_requests(id),
  rider_id        uuid NOT NULL REFERENCES users(id),
  dropoff_order   smallint,
  detour_minutes  numeric(5,1),
  fare_share_paise int,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','left','no_show','completed')),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  left_at         timestamptz
);
CREATE INDEX pm_pool_idx ON pool_members (pool_id);

CREATE TABLE fare_quotes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id       uuid NOT NULL REFERENCES ride_requests(id),
  pool_id               uuid REFERENCES pools(id),
  pricing_rule_id       uuid NOT NULL REFERENCES pricing_rules(id),
  solo_fare_paise       int NOT NULL,
  pool_total_paise      int,
  rider_share_paise     int NOT NULL,
  convenience_fee_paise int NOT NULL,
  saving_paise          int NOT NULL,
  saving_pct            numeric(5,2) NOT NULL,
  expires_at            timestamptz NOT NULL,
  accepted_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trips (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id       uuid UNIQUE NOT NULL REFERENCES pools(id),
  driver_id     uuid NOT NULL REFERENCES driver_profiles(user_id),
  vehicle_id    uuid NOT NULL REFERENCES vehicles(id),
  status        text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','arrived','on_trip','completed','cancelled')),
  started_at    timestamptz,
  ended_at      timestamptz,
  distance_km   numeric(6,2),
  duration_min  numeric(6,1),
  route_polyline text
);

CREATE TABLE trip_stops (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  pool_member_id uuid NOT NULL REFERENCES pool_members(id),
  stop_type      stop_type NOT NULL,
  seq            smallint NOT NULL,
  geom           geography(Point,4326),
  eta            timestamptz,
  arrived_at     timestamptz,
  completed_at   timestamptz,
  UNIQUE (trip_id, seq)
);

-- High-volume driver telemetry: partition by month; keep hot data short-lived (see retention job).
CREATE TABLE driver_locations (
  id          bigserial,
  driver_id   uuid NOT NULL,
  geom        geography(Point,4326) NOT NULL,
  speed_kmh   real,
  heading     real,
  accuracy_m  real,
  trip_id     uuid,
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);
CREATE TABLE driver_locations_2026_10 PARTITION OF driver_locations
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE INDEX dl_driver_time_idx ON driver_locations (driver_id, recorded_at DESC);

-- ---------------------------------------------------------------- PAYMENTS AND LEDGER
CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id uuid NOT NULL REFERENCES ride_requests(id),
  rider_id        uuid NOT NULL REFERENCES users(id),
  amount_paise    int NOT NULL CHECK (amount_paise >= 0),
  currency        char(3) NOT NULL DEFAULT 'INR',
  status          payment_status NOT NULL DEFAULT 'created',
  provider        text NOT NULL,                     -- razorpay | cashfree | mock
  provider_ref    text,
  idempotency_key text UNIQUE NOT NULL,
  authorised_at   timestamptz,
  captured_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refunds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   uuid NOT NULL REFERENCES payments(id),
  amount_paise int NOT NULL CHECK (amount_paise > 0),
  reason       text NOT NULL,                        -- pool_collapsed, flight_cancelled, driver_no_show, dispute
  status       text NOT NULL DEFAULT 'pending',
  provider_ref text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ledger_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type   text NOT NULL CHECK (owner_type IN ('platform','rider','driver','fleet','tax')),
  owner_id     uuid,
  account_type text NOT NULL,                        -- cash, receivable, payable, commission, gst, incentives
  currency     char(3) NOT NULL DEFAULT 'INR',
  UNIQUE (owner_type, owner_id, account_type)
);

-- Double-entry: every txn_id must have debits = credits (enforce in app transaction and nightly reconciliation job).
CREATE TABLE ledger_entries (
  id           bigserial PRIMARY KEY,
  txn_id       uuid NOT NULL,
  account_id   uuid NOT NULL REFERENCES ledger_accounts(id),
  direction    ledger_direction NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  ref_type     text,
  ref_id       uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX le_txn_idx ON ledger_entries (txn_id);

CREATE TABLE payouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        uuid NOT NULL REFERENCES driver_profiles(user_id),
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  gross_paise      bigint NOT NULL,
  commission_paise bigint NOT NULL,
  incentives_paise bigint NOT NULL DEFAULT 0,
  net_paise        bigint NOT NULL,
  status           text NOT NULL DEFAULT 'pending',
  provider_ref     text,
  paid_at          timestamptz,
  UNIQUE (driver_id, period_start, period_end)
);

CREATE TABLE driver_incentives (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    uuid NOT NULL REFERENCES driver_profiles(user_id),
  trip_id      uuid REFERENCES trips(id),
  type         text NOT NULL,                        -- guarantee_topup, peak_bonus, streak
  amount_paise int NOT NULL CHECK (amount_paise > 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE promo_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('flat','percent')),
  value           int NOT NULL,
  max_redemptions int,
  per_user_limit  smallint NOT NULL DEFAULT 1,
  valid_from      timestamptz NOT NULL,
  valid_to        timestamptz NOT NULL,
  active          boolean NOT NULL DEFAULT true
);

CREATE TABLE promo_redemptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id     uuid NOT NULL REFERENCES promo_codes(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  payment_id   uuid REFERENCES payments(id),
  amount_paise int NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE referrals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  uuid NOT NULL REFERENCES users(id),
  referee_id   uuid NOT NULL UNIQUE REFERENCES users(id),
  status       text NOT NULL DEFAULT 'pending',      -- pending, qualified, rewarded
  reward_paise int
);

-- ---------------------------------------------------------------- TRUST AND SAFETY
CREATE TABLE ratings (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id   uuid NOT NULL REFERENCES trips(id),
  rater_id  uuid NOT NULL REFERENCES users(id),
  ratee_id  uuid NOT NULL REFERENCES users(id),
  score     smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  tags      text[],
  comment   text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, rater_id, ratee_id)
);

CREATE TABLE sos_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id),
  trip_id         uuid REFERENCES trips(id),
  geom            geography(Point,4326),
  status          incident_status NOT NULL DEFAULT 'open',
  triggered_at    timestamptz NOT NULL DEFAULT now(),
  acknowledged_by uuid REFERENCES users(id),
  acknowledged_at timestamptz,
  resolved_at     timestamptz
);

CREATE TABLE incidents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid REFERENCES trips(id),
  sos_event_id    uuid REFERENCES sos_events(id),
  reporter_id     uuid REFERENCES users(id),
  against_user_id uuid REFERENCES users(id),
  severity        incident_severity NOT NULL,
  category        text NOT NULL,
  description     text,
  status          incident_status NOT NULL DEFAULT 'open',
  assigned_to     uuid REFERENCES users(id),
  resolution      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);
CREATE INDEX incidents_open_idx ON incidents (status, severity, created_at) WHERE status <> 'resolved';

CREATE TABLE share_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid NOT NULL REFERENCES trips(id),
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES users(id)
);

-- ---------------------------------------------------------------- SUPPORT, COMMS, OPS
CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id),
  channel      text NOT NULL CHECK (channel IN ('push','sms','whatsapp','email','inapp')),
  template     text NOT NULL,
  payload      jsonb,
  status       text NOT NULL DEFAULT 'queued',
  provider_ref text,
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id),
  trip_id     uuid REFERENCES trips(id),
  category    text NOT NULL,
  priority    text NOT NULL DEFAULT 'normal',
  status      text NOT NULL DEFAULT 'open',
  assignee_id uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ticket_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES users(id),
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES users(id),
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feature_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  rollout_pct smallint NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  rules       jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Product analytics (mirror to PostHog/warehouse; keep a raw copy for KPIs).
CREATE TABLE analytics_events (
  id              bigserial PRIMARY KEY,
  event_name      text NOT NULL,   -- requested, verified, ready, matched, paid, picked_up, completed, cancelled, sos
  user_id         uuid,
  session_id      text,
  ride_request_id uuid,
  properties      jsonb,
  occurred_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ae_name_time_idx ON analytics_events (event_name, occurred_at DESC);

-- ---------------------------------------------------------------- KPI VIEW (replaces hard-coded admin numbers)
CREATE MATERIALIZED VIEW kpi_daily AS
SELECT
  date_trunc('day', rr.created_at)                                              AS day,
  count(*) FILTER (WHERE rr.ready_at IS NOT NULL)                               AS ready_requests,
  count(*) FILTER (WHERE pm.id IS NOT NULL)                                     AS pooled_requests,
  round(100.0 * count(*) FILTER (WHERE pm.id IS NOT NULL)
        / NULLIF(count(*) FILTER (WHERE rr.ready_at IS NOT NULL),0), 1)         AS match_rate_pct,
  round(avg(extract(epoch FROM (p.confirmed_at - rr.ready_at))/60)::numeric, 1) AS avg_wait_min,
  round(avg(pm.detour_minutes)::numeric, 1)                                     AS avg_detour_min
FROM ride_requests rr
LEFT JOIN pool_members pm ON pm.ride_request_id = rr.id AND pm.status <> 'left'
LEFT JOIN pools p         ON p.id = pm.pool_id
GROUP BY 1;
-- Refresh on a schedule (e.g., every minute): REFRESH MATERIALIZED VIEW CONCURRENTLY needs a unique index.
CREATE UNIQUE INDEX kpi_daily_day_idx ON kpi_daily (day);
