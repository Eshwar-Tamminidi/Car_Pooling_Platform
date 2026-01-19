package com.carpool.tools;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;

public class BookingStatusConstraintMigrationTest {

    @Test
    public void constraintIncludesCompleted() throws Exception {
        String url = "jdbc:h2:mem:booking-migration;DB_CLOSE_DELAY=-1";
        String user = "sa";
        String pwd = "";

        // Set up a minimal BOOKING table so the migration can safely run in a fresh DB
        try (Connection c = DriverManager.getConnection(url, user, pwd);
             Statement s = c.createStatement()) {
            s.execute("CREATE TABLE IF NOT EXISTS BOOKING (ID BIGINT PRIMARY KEY, STATUS VARCHAR(255))");
        }

        // Apply migrations programmatically to an isolated in-memory DB
        Flyway flyway = Flyway.configure().dataSource(url, user, pwd).baselineOnMigrate(true).load();
        flyway.migrate();

        try (Connection c = DriverManager.getConnection(url, user, pwd);
             Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("SELECT cc.CHECK_CLAUSE FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc ON cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME WHERE tc.TABLE_NAME='BOOKING'")) {
            boolean found = false;
            while (rs.next()) {
                String clause = rs.getString(1);
                if (clause != null && clause.toUpperCase().contains("COMPLETED")) {
                    found = true;
                    break;
                }
            }
            assertThat(found).isTrue();
        }
    }
}
