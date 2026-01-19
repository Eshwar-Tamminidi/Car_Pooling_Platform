//src/main/java/com/carpool/controller/AdminController.java
package com.carpool.controller;

import com.carpool.model.User;
import com.carpool.model.Ride;
import com.carpool.model.Booking;
import com.carpool.repository.UserRepository;
import com.carpool.repository.RideRepository;
import com.carpool.repository.BookingRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    private final UserRepository userRepository;
    private final RideRepository rideRepository;
    private final BookingRepository bookingRepository;

    public AdminController(UserRepository userRepository, RideRepository rideRepository, BookingRepository bookingRepository) {
        this.userRepository = userRepository;
        this.rideRepository = rideRepository;
        this.bookingRepository = bookingRepository;
    }

    @GetMapping("/users")
    public List<User> getAllUsers() { return userRepository.findAll(); }

    @GetMapping("/rides")
    public List<Ride> getAllRides() { return rideRepository.findAll(); }

    // NEW: Needed for Dashboard statistics (Active users calculation)
    @GetMapping("/bookings")
    public List<Booking> getAllBookings() { return bookingRepository.findAll(); }

    @PostMapping("/approve/{id}")
    public ResponseEntity<?> approveAdmin(@PathVariable Long id) {
        return userRepository.findById(id).map(u -> {
            u.setApproved(true);
            userRepository.save(u);
            return ResponseEntity.ok("User approved successfully");
        }).orElse(ResponseEntity.badRequest().body("User not found"));
    }

    @DeleteMapping("/user/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        userRepository.deleteById(id);
        return ResponseEntity.ok("Deleted");
    }

    @PostMapping("/promote/{id}")
    public ResponseEntity<?> promoteUser(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        String newRole = payload.get("role");
        return userRepository.findById(id).map(u -> {
            u.setRole(newRole);
            u.setApproved(true);
            userRepository.save(u);
            return ResponseEntity.ok("Promoted to " + newRole);
        }).orElse(ResponseEntity.badRequest().body("User not found"));
    }
}