package com.carpool.service;

import java.util.Optional;
import org.springframework.stereotype.Service;
import com.carpool.model.User;
import com.carpool.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public UserService(UserRepository userRepository){
        this.userRepository = userRepository;
    }

    public User register(User u){
        u.setPassword(passwordEncoder.encode(u.getPassword()));
        if (u.getRole() == null) u.setRole("USER");
        return userRepository.save(u);
    }

    public Optional<User> findByEmail(String email){
        return userRepository.findByEmail(email);
    }

    public boolean checkPassword(User user, String rawPassword){
        return passwordEncoder.matches(rawPassword, user.getPassword());
    }
}
