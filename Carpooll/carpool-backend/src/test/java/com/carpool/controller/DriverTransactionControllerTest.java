package com.carpool.controller;

import com.carpool.model.Booking;
import com.carpool.model.Ride;
import com.carpool.repository.BookingRepository;
import com.carpool.repository.RideRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import com.carpool.config.TestMailConfig;
import java.time.LocalDateTime;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Import(TestMailConfig.class)
public class DriverTransactionControllerTest {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private RideRepository rideRepository;

    @Test
    public void computesFeesAndTaxesCorrectly() {
        Ride ride = new Ride();
        ride.setOwnerEmail("driver@example.com");
        ride.setFromLocation("A");
        ride.setToLocation("B");
        ride.setPrice(100.0);
        ride.setDateTime(LocalDateTime.now().toString());
        rideRepository.save(ride);

        Booking b = new Booking();
        b.setRideId(ride.getId());
        b.setRequesterName("Passenger");
        b.setSeatsRequested(2);
        b.setTransactionId("tx_1");
        b.setStatus(Booking.Status.CONFIRMED);
        b.setPaymentCompletedAt(LocalDateTime.now());
        bookingRepository.save(b);

        DriverTransactionController ctrl = new DriverTransactionController(bookingRepository, rideRepository);
        var txs = ctrl.getDriverTransactions("driver@example.com");
        assertEquals(1, txs.size());

        var t = txs.get(0);
        assertEquals(200.0, t.getGrossFare()); // 100 * 2
        assertEquals(10.0, t.getPlatformFee()); // 5% of 200
        assertEquals(3.78, t.getCgst(), 0.0001);
        assertEquals(3.78, t.getSgst(), 0.0001);
        assertEquals(190.0, t.getNetAmount()); // 200 - 10
    }
}