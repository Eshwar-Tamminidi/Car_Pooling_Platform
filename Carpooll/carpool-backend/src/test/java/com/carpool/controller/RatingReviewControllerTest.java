package com.carpool.controller;

import com.carpool.model.Booking;
import com.carpool.model.RatingReview;
import com.carpool.model.Ride;
import com.carpool.model.User;
import com.carpool.repository.BookingRepository;
import com.carpool.repository.RatingReviewRepository;
import com.carpool.repository.RideRepository;
import com.carpool.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class RatingReviewControllerTest {

    @MockBean
    private org.springframework.mail.javamail.JavaMailSender mailSender;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UserRepository userRepo;

    @Autowired
    private RideRepository rideRepo;

    @Autowired
    private BookingRepository bookingRepo;

    @Autowired
    private RatingReviewRepository ratingRepo;

    @Test
    public void duplicateRatingReturns400() throws Exception {
        User u1 = new User();
        u1.setEmail("ratertest@example.com");
        u1.setFullname("Rater");
        userRepo.save(u1);

        User u2 = new User();
        u2.setEmail("other@example.com");
        u2.setFullname("Other");
        userRepo.save(u2);

        Ride ride = new Ride();
        ride.setOwnerId(u2.getId());
        ride.setSeatsAvailable(2);
        ride.setDateTime("now");
        ride = rideRepo.save(ride);

        Booking booking = new Booking();
        booking.setRideId(ride.getId());
        booking.setRequesterId(u1.getId());
        booking.setStatus(Booking.Status.PAID);
        booking = bookingRepo.save(booking);

        String payload = String.format("{\"bookingId\": %d, \"stars\": 5, \"review\": \"nice\"}", booking.getId());

        // First submit OK
        mvc.perform(post("/api/ratings/submit")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload)
                .requestAttr("email", u1.getEmail())
        ).andExpect(status().isOk());

        assertThat(ratingRepo.count()).isEqualTo(1);

        // Second submit -> 400 with message
        mvc.perform(post("/api/ratings/submit")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload)
                .requestAttr("email", u1.getEmail())
        ).andExpect(status().isBadRequest())
         .andExpect(content().json("{\"message\": \"You already rated this ride\"}"));

        assertThat(ratingRepo.count()).isEqualTo(1);
    }
}
