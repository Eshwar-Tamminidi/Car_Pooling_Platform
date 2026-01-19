// src/main/java/com/carpool/service/DataLoader.java
package com.carpool.service;

import com.carpool.model.Ride;
import com.carpool.model.User;
import com.carpool.repository.RideRepository;
import com.carpool.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Component
public class DataLoader {

    private final UserRepository userRepository;
    private final RideRepository rideRepository;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public DataLoader(UserRepository userRepository, RideRepository rideRepository) {
        this.userRepository = userRepository;
        this.rideRepository = rideRepository;
    }

    @PostConstruct
    public void seed() {
        // 1. Admin/Manager
        if (userRepository.findByEmail("admin@carpool.com").isEmpty()) {
            User manager = new User();
            manager.setFullname("Super Manager");
            manager.setEmail("admin@carpool.com");
            manager.setPassword(encoder.encode("admin123"));
            manager.setRole("MANAGER");
            manager.setApproved(true);
            userRepository.save(manager);
            System.out.println("Admin seeded.");
        }

        // 2. Sample User & Ride
        if (userRepository.findByEmail("user@carpool.com").isEmpty()) {
            User user = new User();
            user.setFullname("John Doe");
            user.setEmail("user@carpool.com");
            user.setPassword(encoder.encode("user123"));
            user.setRole("USER");
            user.setApproved(true);
            userRepository.save(user);

            Ride ride = new Ride();
            ride.setDriverName("John Doe");
            ride.setOwnerEmail("user@carpool.com");
            ride.setOwnerId(user.getId());
            ride.setFromLocation("New York");
            ride.setToLocation("Boston");
            ride.setDateTime("2025-12-20T09:00");
            ride.setSeatsAvailable(3);
            ride.setPrice(45.0);
            
            // Set Coordinates
            ride.setFromLat(40.7128);
            ride.setFromLng(-74.0060);
            ride.setToLat(42.3601);
            ride.setToLng(-71.0589);
            
            ride.setCarName("Toyota Camry");
            ride.setVehicleNumber("AB-123-XY");
            
            rideRepository.save(ride);
            System.out.println("Sample ride created.");
        }
    }
}