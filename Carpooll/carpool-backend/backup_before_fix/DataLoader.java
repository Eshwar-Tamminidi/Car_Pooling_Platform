package com.carpool.service;

import com.carpool.model.Ride;
import com.carpool.model.User;
import com.carpool.repository.RideRepository;
import com.carpool.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

@Component
public class DataLoader {
    private final UserRepository userRepository;
    private final RideRepository rideRepository;
    private final UserService userService;

    public DataLoader(UserRepository userRepository, RideRepository rideRepository, UserService userService){
        this.userRepository = userRepository;
        this.rideRepository = rideRepository;
        this.userService = userService;
    }

    @PostConstruct
    public void seed(){
        if (userRepository.findByEmail("admin@example.com").isEmpty()){
            User admin = new User();
            admin.setFullname("Admin");
            admin.setEmail("admin@example.com");
            admin.setPassword("adminpass");
            admin.setRole("ADMIN");
            userService.register(admin);
        }
        if (userRepository.findByEmail("user@example.com").isEmpty()){
            User u = new User();
            u.setFullname("Test User");
            u.setEmail("user@example.com");
            u.setPassword("userpass");
            u.setRole("USER");
            userService.register(u);
        }

        if (rideRepository.count() == 0){
            rideRepository.save(new Ride("Ramesh", "Hyderabad", "Vijayawada", "2025-12-08T09:00", 3, 300.0));
            rideRepository.save(new Ride("Sita", "Hyderabad", "Bangalore", "2025-12-12T06:00", 2, 1200.0));
            rideRepository.save(new Ride("Rahul", "Hyderabad", "Chennai", "2025-12-15T07:30", 4, 700.0));
        }
    }
}
