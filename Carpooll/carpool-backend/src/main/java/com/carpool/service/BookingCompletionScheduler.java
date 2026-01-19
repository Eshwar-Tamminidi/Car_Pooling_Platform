package com.carpool.service;

import com.carpool.repository.RideRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service; 

import java.time.LocalDateTime;
import java.util.List;

@Service
public class BookingCompletionScheduler {

    private static final Logger log = LoggerFactory.getLogger(BookingCompletionScheduler.class);

    private final RideRepository rideRepository;
    private final BookingCompletionService bookingCompletionService;

    public BookingCompletionScheduler(RideRepository rideRepository, BookingCompletionService bookingCompletionService) {
        this.rideRepository = rideRepository;
        this.bookingCompletionService = bookingCompletionService;
    }

    @Scheduled(fixedDelay = 300_000)
    public void markCompletedBookings() {

        String now = LocalDateTime.now().toString();
        List<Long> completedRideIds = rideRepository.findEndedRideIds(now);

        for (Long rideId : completedRideIds) {
            try {
                int updated = bookingCompletionService.completeBookingsForRide(rideId);
                log.info("Ride {} → {} bookings marked COMPLETED", rideId, updated);
            } catch (Exception ex) {
                log.warn("Failed to complete bookings for ride {}: {}", rideId, ex.getMessage(), ex);
            }
        }
    }
}
