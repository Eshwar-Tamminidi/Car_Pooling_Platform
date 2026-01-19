package com.carpool.controller;

import com.carpool.model.Booking;
import com.carpool.model.Ride;
import com.carpool.model.User;
import com.carpool.repository.BookingRepository;
import com.carpool.repository.RideRepository;
import com.carpool.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.annotation.Import;
import com.carpool.config.TestMailConfig;
import jakarta.persistence.EntityManager;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Import(TestMailConfig.class)
@AutoConfigureMockMvc
@Transactional
public class RideControllerEnsureCompletedTest {
    @Autowired
    private MockMvc mvc;

    @Autowired
    private RideRepository rideRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EntityManager em;

    @Test
    public void ensureCompletedForPastRide() throws Exception {
        User host = new User();
        host.setEmail("host3@example.com");
        host.setFullname("Host3");
        host.setRole("USER");
        userRepository.save(host);

        Ride ride = new Ride();
        ride.setOwnerEmail("host3@example.com");
        ride.setDateTime(java.time.LocalDateTime.now().minusMinutes(10).toString());
        rideRepository.save(ride);

        Booking b1 = new Booking();
        b1.setRideId(ride.getId()); b1.setRequesterEmail("p1@example.com"); b1.setStatus(Booking.Status.CONFIRMED); bookingRepository.save(b1);
        Booking b2 = new Booking();
        b2.setRideId(ride.getId()); b2.setRequesterEmail("p2@example.com"); b2.setStatus(Booking.Status.ACCEPTED); bookingRepository.save(b2);

        mvc.perform(post("/api/rides/" + ride.getId() + "/ensure-completed").requestAttr("email", "host3@example.com").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updated").value(2));

        em.flush();
        em.clear();

        Booking after1 = bookingRepository.findById(b1.getId()).orElse(null);
        Booking after2 = bookingRepository.findById(b2.getId()).orElse(null);
        assertEquals(Booking.Status.COMPLETED, after1.getStatus());
        assertEquals(Booking.Status.COMPLETED, after2.getStatus());
    }

    @Test
    public void ensureCompletedRejectsIfNotPast() throws Exception {
        User host = new User();
        host.setEmail("host4@example.com");
        host.setFullname("Host4");
        host.setRole("USER");
        userRepository.save(host);

        Ride ride = new Ride();
        ride.setOwnerEmail("host4@example.com");
        ride.setDateTime(java.time.LocalDateTime.now().plusHours(1).toString());
        rideRepository.save(ride);

        mvc.perform(post("/api/rides/" + ride.getId() + "/ensure-completed").requestAttr("email", "host4@example.com").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
    }
}
