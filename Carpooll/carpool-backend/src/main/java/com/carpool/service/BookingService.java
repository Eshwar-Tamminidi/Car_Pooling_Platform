// src/main/java/com/carpool/service/BookingService.java
package com.carpool.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.carpool.model.Booking;
import com.carpool.repository.BookingRepository;

import java.util.List;
import java.util.Optional;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final NotificationService notificationService;

    public BookingService(
            BookingRepository bookingRepository,
            NotificationService notificationService
    ) {
        this.bookingRepository = bookingRepository;
        this.notificationService = notificationService;
    }

    /* ==========================
       EXISTING METHODS (UNCHANGED)
       ========================== */

    public Booking create(Booking b) {
        return bookingRepository.save(b);
    }

    public Optional<Booking> findById(Long id) {
        return bookingRepository.findById(id);
    }

    public List<Booking> findByRequesterId(Long id) {
        return bookingRepository.findByRequesterId(id);
    }

    public List<Booking> findByRideId(Long id) {
        return bookingRepository.findByRideId(id);
    }

    public List<Booking> findAll() {
        return bookingRepository.findAll();
    }

    public Booking save(Booking b) {
        return bookingRepository.save(b);
    }



}
