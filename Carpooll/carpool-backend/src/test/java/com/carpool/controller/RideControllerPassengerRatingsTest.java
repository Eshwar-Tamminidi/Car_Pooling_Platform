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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.annotation.Import;
import com.carpool.config.TestMailConfig;
import jakarta.persistence.EntityManager;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.hasItem;

@SpringBootTest
@Import(TestMailConfig.class)
@AutoConfigureMockMvc
@Transactional
public class RideControllerPassengerRatingsTest {
    @Autowired
    private MockMvc mvc;

    @Autowired
    private RideRepository rideRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private RatingReviewRepository ratingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EntityManager em;

    @Test
    public void passengerRatingsAggregatesCorrectly() throws Exception {
        User driver = new User();
        driver.setEmail("driver1@example.com");
        driver.setFullname("Driver1");
        userRepository.save(driver);

        Ride ride = new Ride();
        ride.setOwnerEmail("host@example.com");
        rideRepository.save(ride);

        Booking b1 = new Booking(); b1.setRideId(ride.getId()); b1.setRequesterEmail("p1@example.com"); b1.setStatus(Booking.Status.COMPLETED); bookingRepository.save(b1);
        Booking b2 = new Booking(); b2.setRideId(ride.getId()); b2.setRequesterEmail("p2@example.com"); b2.setStatus(Booking.Status.COMPLETED); bookingRepository.save(b2);

        RatingReview r1 = new RatingReview(); r1.setBookingId(b1.getId()); r1.setReviewerId(driver.getId()); r1.setRevieweeId(b1.getRequesterId()); r1.setReviewerRole(RatingReview.Role.DRIVER); r1.setStars(4); ratingRepository.save(r1);
        RatingReview r2 = new RatingReview(); r2.setBookingId(b2.getId()); r2.setReviewerId(driver.getId()); r2.setRevieweeId(b2.getRequesterId()); r2.setReviewerRole(RatingReview.Role.DRIVER); r2.setStars(5); ratingRepository.save(r2);

        em.flush(); em.clear();

        mvc.perform(get("/api/rides/" + ride.getId() + "/passenger-ratings").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.average").value(4.5))
                .andExpect(jsonPath("$.perBooking." + b1.getId()).value(4.0))
                .andExpect(jsonPath("$.perBooking." + b2.getId()).value(5.0));
    }

    @Test
    public void passengerRatingsRatedByMeShowsMyRatings() throws Exception {
        User driver = new User();
        driver.setEmail("driver2@example.com");
        driver.setFullname("Driver2");
        userRepository.save(driver);

        Ride ride = new Ride();
        ride.setOwnerEmail("host2@example.com");
        rideRepository.save(ride);

        Booking b1 = new Booking(); b1.setRideId(ride.getId()); b1.setRequesterEmail("p3@example.com"); b1.setStatus(Booking.Status.COMPLETED); bookingRepository.save(b1);

        RatingReview r1 = new RatingReview(); r1.setBookingId(b1.getId()); r1.setReviewerId(driver.getId()); r1.setRevieweeId(b1.getRequesterId()); r1.setReviewerRole(RatingReview.Role.DRIVER); r1.setStars(3); ratingRepository.save(r1);

        em.flush(); em.clear();

        mvc.perform(get("/api/rides/" + ride.getId() + "/passenger-ratings").requestAttr("email", "driver2@example.com").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ratedByMe." + b1.getId()).value(3));
    }

    @Test
    public void ignoresMalformedRatings() throws Exception {
        Ride ride = new Ride();
        ride.setOwnerEmail("host3@example.com");
        rideRepository.save(ride);

        Booking b1 = new Booking(); b1.setRideId(ride.getId()); b1.setRequesterEmail("p4@example.com"); b1.setStatus(Booking.Status.COMPLETED); bookingRepository.save(b1);

        // malformed: rating with null bookingId and out-of-range stars
        RatingReview bad1 = new RatingReview(); bad1.setBookingId(null); bad1.setReviewerId(1L); bad1.setReviewerRole(RatingReview.Role.DRIVER); bad1.setStars(10); ratingRepository.save(bad1);
        RatingReview good = new RatingReview(); good.setBookingId(b1.getId()); good.setReviewerId(2L); good.setReviewerRole(RatingReview.Role.DRIVER); good.setStars(4); ratingRepository.save(good);

        em.flush(); em.clear();

        mvc.perform(get("/api/rides/" + ride.getId() + "/passenger-ratings").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.average").value(4.0))
                .andExpect(jsonPath("$.perBooking." + b1.getId()).value(4.0));
    }

    @Test
    public void emptyRatingsReturnsNullAverage() throws Exception {
        Ride ride = new Ride();
        ride.setOwnerEmail("host4@example.com");
        rideRepository.save(ride);

        Booking b1 = new Booking(); b1.setRideId(ride.getId()); b1.setRequesterEmail("p5@example.com"); b1.setStatus(Booking.Status.COMPLETED); bookingRepository.save(b1);

        em.flush(); em.clear();

        mvc.perform(get("/api/rides/" + ride.getId() + "/passenger-ratings").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.average", nullValue()));
    }

    @Test
    public void reviewsEndpointReturnsOnlyTextReviews() throws Exception {
        User driver = new User();
        driver.setEmail("driver3@example.com");
        driver.setFullname("Driver3");
        userRepository.save(driver);

        Ride ride = new Ride();
        ride.setOwnerEmail("host5@example.com");
        rideRepository.save(ride);

        Booking b1 = new Booking(); b1.setRideId(ride.getId()); b1.setRequesterEmail("p6@example.com"); b1.setStatus(Booking.Status.COMPLETED); bookingRepository.save(b1);
        Booking b2 = new Booking(); b2.setRideId(ride.getId()); b2.setRequesterEmail("p7@example.com"); b2.setStatus(Booking.Status.COMPLETED); bookingRepository.save(b2);

        RatingReview r1 = new RatingReview(); r1.setBookingId(b1.getId()); r1.setReviewerId(driver.getId()); r1.setRevieweeId(b1.getRequesterId()); r1.setReviewerRole(RatingReview.Role.DRIVER); r1.setStars(4); r1.setReview("Nice passenger, punctual."); ratingRepository.save(r1);
        RatingReview r2 = new RatingReview(); r2.setBookingId(b2.getId()); r2.setReviewerId(driver.getId()); r2.setRevieweeId(b2.getRequesterId()); r2.setReviewerRole(RatingReview.Role.DRIVER); r2.setStars(5); r2.setReview(""); ratingRepository.save(r2);

        em.flush(); em.clear();

        mvc.perform(get("/api/rides/" + ride.getId() + "/reviews").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].review").value("Nice passenger, punctual."))
                .andExpect(jsonPath("$[0].stars").value(4))
                .andExpect(jsonPath("$[0].reviewerName").value("Driver3"));
    }

    @Test
    public void driverRatingsIncludesStarOnlyAndTextReviews() throws Exception {
        User driver = new User();
        driver.setEmail("driverX@example.com");
        driver.setFullname("DriverX");
        userRepository.save(driver);

        User passenger = new User();
        passenger.setEmail("passenger1@example.com");
        passenger.setFullname("Passenger1");
        userRepository.save(passenger);

        Ride ride = new Ride();
        ride.setOwnerEmail(driver.getEmail());
        rideRepository.save(ride);

        Booking b1 = new Booking(); b1.setRideId(ride.getId()); b1.setRequesterEmail(passenger.getEmail()); b1.setStatus(Booking.Status.COMPLETED); bookingRepository.save(b1);
        Booking b2 = new Booking(); b2.setRideId(ride.getId()); b2.setRequesterEmail(passenger.getEmail()); b2.setStatus(Booking.Status.COMPLETED); bookingRepository.save(b2);

        RatingReview r1 = new RatingReview(); r1.setBookingId(b1.getId()); r1.setReviewerId(passenger.getId()); r1.setRevieweeId(driver.getId()); r1.setReviewerRole(RatingReview.Role.PASSENGER); r1.setStars(5); ratingRepository.save(r1);
        RatingReview r2 = new RatingReview(); r2.setBookingId(b2.getId()); r2.setReviewerId(passenger.getId()); r2.setRevieweeId(driver.getId()); r2.setReviewerRole(RatingReview.Role.PASSENGER); r2.setStars(4); r2.setReview("Nice driver"); ratingRepository.save(r2);

        em.flush(); em.clear();

        mvc.perform(get("/api/rides/" + ride.getId() + "/driver-ratings").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.average").value(4.5))
                .andExpect(jsonPath("$.counts.5").value(1))
                .andExpect(jsonPath("$.counts.4").value(1))
                .andExpect(jsonPath("$.reviews.length()").value(2))
                .andExpect(jsonPath("$.reviews[*].review").value(hasItem("Nice driver")));
    }
}
