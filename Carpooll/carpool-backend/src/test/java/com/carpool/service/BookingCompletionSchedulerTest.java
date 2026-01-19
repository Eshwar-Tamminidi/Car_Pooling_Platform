package com.carpool.service;

import com.carpool.model.Booking;
import com.carpool.model.Ride;
import com.carpool.repository.BookingRepository;
import com.carpool.repository.RideRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager; 
import org.springframework.context.annotation.Import;
import com.carpool.config.TestMailConfig; 

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(properties = {"BOOKING_COMPLETION_BUFFER_MINUTES=0"})
@Import(TestMailConfig.class)
@Transactional
public class BookingCompletionSchedulerTest {

    @Autowired
    private BookingCompletionScheduler scheduler;

    @Autowired
    private RideRepository rideRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private EntityManager em;

    @Test
    public void schedulerMarksConfirmedBookingsCompleted() {
        Ride r = new Ride();
        r.setDateTime(LocalDateTime.now().minusMinutes(1).toString());
        r.setOwnerEmail("host@example.com");
        Ride savedRide = rideRepository.save(r);

        Booking b = new Booking();
        b.setRideId(savedRide.getId());
        b.setRequesterId(999L);
        b.setRequesterEmail("pass@example.com");
        b.setStatus(Booking.Status.CONFIRMED);
        Booking savedBooking = bookingRepository.save(b);

        scheduler.markCompletedBookings();
        // Ensure test's persistence context sees DB updates done in scheduler's transaction
        em.flush();
        em.clear();

        Booking after = bookingRepository.findById(savedBooking.getId()).orElse(null);
        assertEquals(Booking.Status.COMPLETED, after.getStatus());
    }

    @Test
    public void schedulerUsesEstimatedCompletionIfPresent() {
        Ride r = new Ride();
        // dateTime in future, but estimatedCompletion in past - scheduler should use estimated
        r.setDateTime(LocalDateTime.now().plusDays(1).toString());
        r.setEstimatedCompletionDateTime(LocalDateTime.now().minusMinutes(1).toString());
        r.setOwnerEmail("host2@example.com");
        Ride savedRide = rideRepository.save(r);

        Booking b = new Booking();
        b.setRideId(savedRide.getId());
        b.setRequesterId(1000L);
        b.setRequesterEmail("pass2@example.com");
        b.setStatus(Booking.Status.CONFIRMED);
        Booking savedBooking = bookingRepository.save(b);

        scheduler.markCompletedBookings();

        Booking after = bookingRepository.findById(savedBooking.getId()).orElse(null);
        assertEquals(Booking.Status.COMPLETED, after.getStatus());
    }

    @Test
    public void schedulerAlsoMarksAcceptedAndPaidBookingsCompleted() {
        Ride r = new Ride();
        r.setDateTime(LocalDateTime.now().minusMinutes(1).toString());
        r.setOwnerEmail("host3@example.com");
        Ride savedRide = rideRepository.save(r);

        Booking bAccepted = new Booking();
        bAccepted.setRideId(savedRide.getId());
        bAccepted.setRequesterId(2000L);
        bAccepted.setRequesterEmail("accepted@example.com");
        bAccepted.setStatus(Booking.Status.ACCEPTED);
        Booking savedAccepted = bookingRepository.save(bAccepted);

        Booking bPaid = new Booking();
        bPaid.setRideId(savedRide.getId());
        bPaid.setRequesterId(2001L);
        bPaid.setRequesterEmail("paid@example.com");
        bPaid.setStatus(Booking.Status.PAID);
        Booking savedPaid = bookingRepository.save(bPaid);

        scheduler.markCompletedBookings();

        Booking afterA = bookingRepository.findById(savedAccepted.getId()).orElse(null);
        Booking afterP = bookingRepository.findById(savedPaid.getId()).orElse(null);
        assertEquals(Booking.Status.COMPLETED, afterA.getStatus());
        assertEquals(Booking.Status.COMPLETED, afterP.getStatus());
    }
}
