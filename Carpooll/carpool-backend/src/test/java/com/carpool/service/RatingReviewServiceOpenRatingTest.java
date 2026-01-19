package com.carpool.service;

import com.carpool.model.Booking;
import com.carpool.model.Ride;
import com.carpool.model.User;
import com.carpool.repository.BookingRepository;
import com.carpool.repository.RideRepository;
import com.carpool.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.assertEquals;
import com.carpool.config.TestMailConfig;

@SpringBootTest
@Import(TestMailConfig.class)
@AutoConfigureTestDatabase
@AutoConfigureMockMvc
@Transactional
public class RatingReviewServiceOpenRatingTest {
    @Autowired
    private RatingReviewService ratingService;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private RideRepository rideRepository;

    @Autowired
    private UserRepository userRepository;

    @Test
    public void passengerCanRateBeforeCompletion() {
        User driver = new User();
        driver.setEmail("driver@example.com"); driver.setFullname("Driver"); driver.setRole("USER");
        userRepository.save(driver);

        User passenger = new User();
        passenger.setEmail("pass@example.com"); passenger.setFullname("Passenger"); passenger.setRole("USER");
        userRepository.save(passenger);

        Ride ride = new Ride();
        ride.setOwnerEmail(driver.getEmail());
        ride.setOwnerId(driver.getId());
        ride.setDateTime(java.time.LocalDateTime.now().minusHours(1).toString());
        rideRepository.save(ride);

        Booking b = new Booking();
        b.setRideId(ride.getId());
        b.setRequesterId(passenger.getId());
        b.setRequesterEmail(passenger.getEmail());
        b.setStatus(Booking.Status.CONFIRMED);
        bookingRepository.save(b);

        ratingService.addRating(b.getId(), passenger.getId(), 5, "Great ride");

        User after = userRepository.findById(driver.getId()).orElseThrow();
        assertEquals(5.0, after.getAverageRating());
    }
}
