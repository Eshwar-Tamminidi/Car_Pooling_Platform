//src/main/java/com/carpool/controller/AuthController.java
package com.carpool.controller;

import com.carpool.dto.*;
import com.carpool.model.User;
import com.carpool.repository.UserRepository;
import com.carpool.service.UserService;
import com.carpool.service.EmailService;
import com.carpool.config.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Optional;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final UserService userService;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final EmailService emailService;

    public AuthController(UserService userService, JwtUtil jwtUtil, UserRepository userRepository, EmailService emailService) {
        this.userService = userService;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.emailService = emailService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req){
        if (userRepository.findByEmail(req.email).isPresent()){
            return ResponseEntity.badRequest().body("Email already registered");
        }
        User u = new User();
        u.setFullname(req.fullname);
        u.setEmail(req.email);
        u.setPassword(req.password);
        u.setRole(req.role == null ? "USER" : req.role);
        u.setPhone(req.phone);
        u.setGender(req.gender); // Added Gender

        User saved = userService.register(u);

// ✅ Send account creation email (non-blocking)
        try {
            boolean needsApproval = saved.getRole().toUpperCase().contains("ADMIN") && !saved.isApproved();
            emailService.sendWelcomeEmail(saved.getEmail(), saved.getFullname(), needsApproval);
        } catch (Exception e) {
            System.out.println("Email failed: " + e.getMessage());
        }

// ✅ Admin approval flow remains untouched
        if (saved.getRole().toUpperCase().contains("ADMIN") && !saved.isApproved()) {
            return ResponseEntity.status(202).body("Registration successful. Admin approval required.");
        }

        String token = jwtUtil.generateToken(saved.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, saved));

    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest req){
        Optional<User> opt = userService.findByEmail(req.email);
        if (opt.isEmpty()) return ResponseEntity.status(401).body("Invalid credentials");

        User user = opt.get();
        if (!userService.checkPassword(user, req.password)) return ResponseEntity.status(401).body("Invalid credentials");

        if (!user.isApproved()) {
            return ResponseEntity.status(403).body("Account pending approval. Please contact the Manager.");
        }

        String token = jwtUtil.generateToken(user.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, user));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        if(email == null || email.isEmpty()) return ResponseEntity.badRequest().body("Email required");

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Account not found");
        }

        String token = jwtUtil.generateResetToken(email);
        // Ensure this link matches your frontend port (default 5173 for Vite)
        String resetLink = "http://localhost:5173/reset-password?token=" + token;

        try {
            emailService.sendSimpleEmail(
                    email,
                    "VeloCity Password Reset",
                    "Click the link below to reset your password (Valid for 20 minutes):\n" + resetLink
            );
            return ResponseEntity.ok("Reset link sent");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error sending email: " + e.getMessage());
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> payload) {
        String token = payload.get("token");
        String newPassword = payload.get("password");

        String email = jwtUtil.extractEmail(token);
        if (email == null) {
            return ResponseEntity.status(400).body("Invalid or expired token");
        }

        Optional<User> opt = userRepository.findByEmail(email);
        if(opt.isEmpty()) return ResponseEntity.badRequest().body("User not found");

        User user = opt.get();
        userService.updatePassword(user, newPassword);

        return ResponseEntity.ok("Password updated successfully");
    }
}