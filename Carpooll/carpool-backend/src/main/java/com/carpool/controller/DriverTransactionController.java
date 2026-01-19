package com.carpool.controller;
import com.carpool.dto.DriverTransactionDTO;
import com.carpool.model.Booking;
import com.carpool.model.Ride;
import com.carpool.repository.BookingRepository;
import com.carpool.repository.RideRepository;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/driver")
@CrossOrigin
public class DriverTransactionController {

    private final BookingRepository bookingRepository;
    private final RideRepository rideRepository;

    public DriverTransactionController(
            BookingRepository bookingRepository,
            RideRepository rideRepository
    ) {
        this.bookingRepository = bookingRepository;
        this.rideRepository = rideRepository;
    }

    /**
     * DRIVER TRANSACTION HISTORY
     * Shows only CONFIRMED + PAID bookings for driver's rides
     */
    @GetMapping("/transactions")
    public List<DriverTransactionDTO> getDriverTransactions(
            @RequestParam String driverEmail
    ) {

        List<Ride> driverRides = rideRepository.findByOwnerEmail(driverEmail);
        List<DriverTransactionDTO> transactions = new ArrayList<>();

        for (Ride ride : driverRides) {

            List<Booking> bookings = bookingRepository.findByRideId(ride.getId());

            for (Booking booking : bookings) {

                // Include bookings that have a transaction (transactionId) and are either CONFIRMED or PAID or have paymentCompletedAt set
                if (booking.getTransactionId() != null && (
                        booking.getStatus() == Booking.Status.CONFIRMED ||
                        booking.getStatus() == Booking.Status.PAID ||
                        booking.getPaymentCompletedAt() != null
                )) {

                    int seats = booking.getSeatsRequested() > 0 ? booking.getSeatsRequested() : 1;
                    double base = ride.getPrice() * seats;
                    double platformFee = base * 0.05; // 5% of base fare
                    double subtotal = base + platformFee;
                    double gstTotal = subtotal * 0.036; // 3.6% GST on subtotal (CGST 1.8% + SGST 1.8%)
                    double cgst = subtotal * 0.018;
                    double sgst = subtotal * 0.018;
                    double netToDriver = base - platformFee;

                    transactions.add(
                            new DriverTransactionDTO(
                                    booking.getId(),
                                    booking.getRequesterName(),        // Passenger
                                    ride.getFromLocation(),            // Source
                                    ride.getToLocation(),              // Destination
                                    booking.getPaymentCompletedAt(),   // Date (IMPORTANT)
                                    booking.getSeatsRequested(),
                                    base,
                                    platformFee,
                                    cgst,
                                    sgst,
                                    netToDriver,
                                    booking.getTransactionId()
                            )
                    );

                }
            }
        }

        return transactions;
    }
}

