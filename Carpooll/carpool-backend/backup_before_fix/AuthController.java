package com.carpool.controller;

import com.carpool.dto.*;
import com.carpool.model.User;
import com.carpool.repository.UserRepository;
import com.carpool.service.UserService;
import com.carpool.config.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final UserService userService;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    public AuthController(UserService userService, JwtUtil jwtUtil, UserRepository userRepository) {
        this.userService = userService;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
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
        User saved = userService.register(u);
        String token = jwtUtil.generateToken(saved.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, saved));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest req){
        Optional<User> opt = userService.findByEmail(req.email);
        if (opt.isEmpty()) return ResponseEntity.status(401).body("Invalid credentials");
        User user = opt.get();
        if (!userService.checkPassword(user, req.password)) return ResponseEntity.status(401).body("Invalid credentials");
        String token = jwtUtil.generateToken(user.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, user));
    }
}
