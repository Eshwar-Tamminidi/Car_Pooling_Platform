Migration notes

This file documents a small schema migration relevant to the local file-backed H2 database.

- Migration: V2__update_booking_status_check_constraint.sql
- Purpose: Ensure the BOOKING.STATUS check constraint includes the 'COMPLETED' value so scheduler-driven updates to COMPLETED do not fail due to a check-constraint violation.
- Why baseline-on-migrate is enabled: Some developers run the backend against an existing file-backed H2 database (./data/carpooldb). Enabling `spring.flyway.baseline-on-migrate=true` prevents Flyway from failing when an older DB (without schema history table) is migrated — it baselines at version 1 and applies subsequent migrations (including V2).

Notes for contributors:
- Unit tests disable Flyway by default (`src/test/resources/application.properties` sets `spring.flyway.enabled=false`) so in-memory tests use Hibernate for schema creation.
- The repository includes a small programmatic migration test (`BookingStatusConstraintMigrationTest`) that baselines and applies V2; CI runs this test to detect schema drift early.

If you maintain the schema or add new migrations, please update this document and consider adding a migration verification test if the change affects an existing table's constraints or data.
