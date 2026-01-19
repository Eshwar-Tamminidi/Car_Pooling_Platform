package com.carpool.repository;

import com.carpool.model.RatingReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RatingReviewRepository extends JpaRepository<RatingReview, Long> {

    boolean existsByBookingIdAndReviewerId(Long bookingId, Long reviewerId);

    List<RatingReview> findByRevieweeId(Long userId);

    // Find ratings for a set of booking ids
    List<RatingReview> findByBookingIdIn(java.util.List<Long> bookingIds);

}
