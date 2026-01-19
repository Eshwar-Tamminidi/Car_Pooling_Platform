package com.carpool.service;

import com.carpool.model.Booking;
import com.carpool.repository.BookingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class BookingCompletionService {

    private static final Logger log = LoggerFactory.getLogger(BookingCompletionService.class);

    private final BookingRepository bookingRepository;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final com.carpool.repository.RideRepository rideRepository;
    private final com.carpool.repository.UserRepository userRepository;

    public BookingCompletionService(BookingRepository bookingRepository, NotificationService notificationService, EmailService emailService, com.carpool.repository.RideRepository rideRepository, com.carpool.repository.UserRepository userRepository) {
        this.bookingRepository = bookingRepository;
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.rideRepository = rideRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public int completeBookingsForRide(Long rideId) {

        List<Booking.Status> allowedCurrentStatuses =
                List.of(Booking.Status.CONFIRMED, Booking.Status.ACCEPTED, Booking.Status.PAID);

        int updated = 0;
        List<Booking> bookings = bookingRepository.findByRideId(rideId);
        for (Booking b : bookings) {
            if (!allowedCurrentStatuses.contains(b.getStatus())) {
                continue;
            }
            try {
                log.debug("Completing booking id={} currentStatus={}", b.getId(), b.getStatus());

                // Prefer a single-row JPQL update (updates only the status column) to reduce
                // the chance of DB-level constraint problems that can happen when many
                // non-status columns are updated at once via entity save.
                int rows = bookingRepository.updateStatusByIdNative(b.getId(), Booking.Status.COMPLETED.name());
                if (rows == 0) {
                    // As a fallback attempt, try the entity save path for this booking.
                    b.setStatus(Booking.Status.COMPLETED);
                    bookingRepository.save(b);
                    updated++;

                    // Send notifications/emails for this booking
                    trySendCompletionNotificationsAndEmails(b);
                } else {
                    updated += rows;

                    // Load fresh booking entity and send notifications/emails
                    bookingRepository.findById(b.getId()).ifPresent(fresh -> trySendCompletionNotificationsAndEmails(fresh));
                }
            } catch (Exception ex) {
                log.warn("Failed to update booking id={} status={} : {}", b.getId(), b.getStatus(), ex.getMessage(), ex);
                // keep going for other bookings; don't fail the whole ride.
            }
        }
                return updated;
    }

    private void trySendCompletionNotificationsAndEmails(Booking b) {
        try {
            com.carpool.model.Ride ride = rideRepository.findById(b.getRideId()).orElse(null);
            if (ride == null) return;

            // Passenger notification
            if (b.getRequesterId() != null) {
                userRepository.findById(b.getRequesterId()).ifPresent(pass -> {
                    notificationService.create(pass, "Ride Completed", "Your ride is completed — please rate your driver.", "RIDE", "/my-rides");
                });
            }

            // Host notification
            if (ride.getOwnerEmail() != null) {
                userRepository.findByEmail(ride.getOwnerEmail()).ifPresent(host -> {
                    notificationService.create(host, "Ride Completed", "Your ride is completed — please rate your passengers.", "RIDE", "/hosted");
                });
            }

            // Emails to both
            emailService.sendRatingRequestEmails(b, ride);
        } catch (Exception ex) {
            log.warn("Failed to send completion notifications/emails for booking {}: {}", b.getId(), ex.getMessage());
        }
    }
}
