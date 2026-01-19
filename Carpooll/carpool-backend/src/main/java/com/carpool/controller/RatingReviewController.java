package com.carpool.controller;

import com.carpool.model.User;
import com.carpool.repository.UserRepository;
import com.carpool.service.RatingReviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

@RestController
@RequestMapping("/api/ratings")
@CrossOrigin(origins = "*")
public class RatingReviewController {

    private final RatingReviewService ratingService;
    private final UserRepository userRepo;

    public RatingReviewController(
            RatingReviewService ratingService,
            UserRepository userRepo
    ) {
        this.ratingService = ratingService;
        this.userRepo = userRepo;
    }

    @PostMapping("/submit")
    public ResponseEntity<?> submitRating(
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request
    ) {
        String email = (String) request.getAttribute("email");
        if (email == null)
            return ResponseEntity.status(401).build();

        User user = userRepo.findByEmail(email).orElse(null);
        if (user == null)
            return ResponseEntity.status(401).build();

        Long bookingId = Long.valueOf(payload.get("bookingId").toString());
        int stars = Integer.parseInt(payload.get("stars").toString());
        String review = payload.getOrDefault("review", "").toString();

        try {
            return ResponseEntity.ok(
                    ratingService.addRating(bookingId, user.getId(), stars, review)
            );
        } catch (RuntimeException ex) {
            // Known business error (e.g., duplicate rating or validation)
            org.slf4j.LoggerFactory.getLogger(RatingReviewController.class).warn("Rating submit failed: {} (booking={}, user={})", ex.getMessage(), bookingId, user.getId());
            return ResponseEntity.badRequest().body(java.util.Map.of("message", ex.getMessage()));
        } catch (Exception ex) {
            org.slf4j.LoggerFactory.getLogger(RatingReviewController.class).error("Unexpected error while submitting rating", ex);
            return ResponseEntity.status(500).body(java.util.Map.of("message", "Internal server error"));
        }
    }
}
