//src/main/java/com/carpool/service/UserService.java
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

        // Admins created via registration require approval
        if (u.getRole().toUpperCase().contains("ADMIN")) {
            u.setApproved(false);
        } else {
            u.setApproved(true);
        }

        return userRepository.save(u);
    }

    public User update(User u) {
        return userRepository.save(u);
    }

    public void delete(Long id) {
        userRepository.deleteById(id);
    }

    public Optional<User> findByEmail(String email){
        return userRepository.findByEmail(email);
    }

    public boolean checkPassword(User user, String rawPassword){
        return passwordEncoder.matches(rawPassword, user.getPassword());
    }

    public void updatePassword(User user, String newPassword) {
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }
}