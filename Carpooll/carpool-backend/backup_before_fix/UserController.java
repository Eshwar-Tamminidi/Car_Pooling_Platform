package com.carpool.controller;

import com.carpool.model.User;
import com.carpool.repository.UserRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {
    private final UserRepository userRepository;
    public UserController(UserRepository userRepository){
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<User> getAll(){
        return userRepository.findAll();
    }

    @GetMapping("/{id}")
    public Optional<User> getOne(@PathVariable Long id){
        return userRepository.findById(id);
    }

    // endpoint to get current user by token-extracted email (token processed by JwtFilter)
    @GetMapping("/me")
    public User me(javax.servlet.http.HttpServletRequest request){
        String email = (String) request.getAttribute("email");
        if (email == null) return null;
        return userRepository.findByEmail(email).orElse(null);
    }
}
