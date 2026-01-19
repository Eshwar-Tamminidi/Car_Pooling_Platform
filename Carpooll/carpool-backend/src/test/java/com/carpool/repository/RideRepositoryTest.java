package com.carpool.repository;

import com.carpool.model.Ride;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
public class RideRepositoryTest {

    @Autowired
    private RideRepository rideRepository;

    @Test
    @Transactional
    public void deductSeatsIfAvailable_reduces_when_enough() {
        Ride r = new Ride();
        r.setDriverName("Test Driver");
        r.setFromLocation("A");
        r.setToLocation("B");
        r.setDateTime("2025-01-01T10:00:00");
        r.setSeatsAvailable(5);
        r.setPrice(100);
        rideRepository.save(r);

        int updated = rideRepository.deductSeatsIfAvailable(r.getId(), 2);
        assertThat(updated).isEqualTo(1);
        Ride reloaded = rideRepository.findById(r.getId()).orElse(null);
        assertThat(reloaded).isNotNull();
        assertThat(reloaded.getSeatsAvailable()).isEqualTo(3);
    }

    @Test
    @Transactional
    public void deductSeatsIfAvailable_fails_when_not_enough() {
        Ride r = new Ride();
        r.setDriverName("Test Driver");
        r.setFromLocation("A");
        r.setToLocation("B");
        r.setDateTime("2025-01-01T10:00:00");
        r.setSeatsAvailable(1);
        r.setPrice(100);
        rideRepository.save(r);

        int updated = rideRepository.deductSeatsIfAvailable(r.getId(), 2);
        assertThat(updated).isEqualTo(0);
        Ride reloaded = rideRepository.findById(r.getId()).orElse(null);
        assertThat(reloaded).isNotNull();
        assertThat(reloaded.getSeatsAvailable()).isEqualTo(1);
    }
}