package com.carpool.service;

import com.carpool.model.*;
import com.carpool.repository.*;
import org.springframework.stereotype.Service;

@Service
public class RatingReviewService {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(RatingReviewService.class);

    private final RatingReviewRepository ratingRepo;
    private final BookingRepository bookingRepo;
    private final RideRepository rideRepo;
    private final UserRepository userRepo;

    public RatingReviewService(
            RatingReviewRepository ratingRepo,
            BookingRepository bookingRepo,
            RideRepository rideRepo,
            UserRepository userRepo
    ) {
        this.ratingRepo = ratingRepo;
        this.bookingRepo = bookingRepo;
        this.rideRepo = rideRepo;
        this.userRepo = userRepo;
    }

    public RatingReview addRating(
            Long bookingId,
            Long reviewerId,
            int stars,
            String review
    ) {

        if (stars < 1 || stars > 5)
            throw new RuntimeException("Stars must be between 1 and 5");

        Booking booking = bookingRepo.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));



        logger.debug("addRating: booking={}, reviewer={}", bookingId, reviewerId);

        if (ratingRepo.existsByBookingIdAndReviewerId(bookingId, reviewerId)) {
            logger.info("addRating: duplicate rating attempt booking={}, reviewer={}", bookingId, reviewerId);
            throw new RuntimeException("You already rated this ride");
        }

        Ride ride = rideRepo.findById(booking.getRideId())
                .orElseThrow(() -> new RuntimeException("Ride not found"));

        RatingReview rr = new RatingReview();
        rr.setBookingId(bookingId);
        rr.setReviewerId(reviewerId);
        rr.setStars(stars);
        rr.setReview(review);

        // 🔁 ROLE DECISION
        if (booking.getRequesterId().equals(reviewerId)) {
            // Passenger → Driver
            rr.setReviewerRole(RatingReview.Role.PASSENGER);
            rr.setRevieweeId(ride.getOwnerId());
        }
        else if (ride.getOwnerId().equals(reviewerId)) {
            // Driver → Passenger
            rr.setReviewerRole(RatingReview.Role.DRIVER);
            rr.setRevieweeId(booking.getRequesterId());
        }
        else {
            throw new RuntimeException("User not part of this ride");
        }

        // ⭐ Update reviewee rating
        User reviewee = userRepo.findById(rr.getRevieweeId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        reviewee.addRating(stars);
        userRepo.save(reviewee);

        return ratingRepo.save(rr);
    }
}
