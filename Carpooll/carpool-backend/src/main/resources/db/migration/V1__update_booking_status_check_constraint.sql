-- Ensure booking.status allows COMPLETED
-- This migration is idempotent: it drops previous constraint (if any) and re-adds a constraint including COMPLETED
ALTER TABLE BOOKING DROP CONSTRAINT IF EXISTS CONSTRAINT_2;
ALTER TABLE BOOKING ADD CONSTRAINT CONSTRAINT_2 CHECK (
  STATUS IN ('PENDING','ACCEPTED','REJECTED','PAID','CONFIRMED','COMPLETED')
);
