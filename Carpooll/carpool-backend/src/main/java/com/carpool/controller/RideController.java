// src/main/java/com/carpool/controller/RideController.java
package com.carpool.controller;

import com.carpool.model.Ride;
import com.carpool.repository.RideRepository;
import com.carpool.repository.UserRepository;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * REST Controller for Ride-related operations.
 */
@RestController
@RequestMapping("/api/rides")
@CrossOrigin(origins = "*")
public class RideController {
    private static final Logger logger = LoggerFactory.getLogger(RideController.class);

    private final RideRepository rideRepository;
    private final UserRepository userRepository;
    private final com.carpool.repository.BookingRepository bookingRepository;
    private final com.carpool.repository.RatingReviewRepository ratingRepository;
    private final com.carpool.service.NotificationService notificationService;
    private final com.carpool.service.EmailService emailService;

    public RideController(RideRepository rideRepository, UserRepository userRepository, com.carpool.repository.BookingRepository bookingRepository, com.carpool.repository.RatingReviewRepository ratingRepository, com.carpool.service.NotificationService notificationService, com.carpool.service.EmailService emailService){
        this.rideRepository = rideRepository;
        this.userRepository = userRepository;
        this.bookingRepository = bookingRepository;
        this.ratingRepository = ratingRepository;
        this.notificationService = notificationService;
        this.emailService = emailService;
    }

    @GetMapping
    public List<Ride> listAll(@RequestParam(required = false) String from,
                              @RequestParam(required = false) String to,
                              @RequestParam(required = false) Double fromLat,
                              @RequestParam(required = false) Double fromLng,
                              @RequestParam(required = false) Double toLat,
                              @RequestParam(required = false) Double toLng) {
        
        List<Ride> all = rideRepository.findAll();
        
        if (fromLat != null && fromLng != null && toLat != null && toLng != null) {
            return all.stream().filter(r -> {
                double distPickup = calculateDistance(r.getFromLat(), r.getFromLng(), fromLat, fromLng);
                double distDrop = calculateDistance(r.getToLat(), r.getToLng(), toLat, toLng);
                return distPickup <= 30.0 && distDrop <= 30.0;
            }).collect(Collectors.toList());
        }

        return all.stream().filter(r -> {
            boolean ok = true;
            if (from != null && !from.isBlank()) ok = r.getFromLocation().toLowerCase().contains(from.toLowerCase());
            if (ok && to != null && !to.isBlank()) ok = r.getToLocation().toLowerCase().contains(to.toLowerCase());
            return ok;
        }).collect(Collectors.toList());
    }

    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        if ((lat1 == lat2) && (lon1 == lon2)) {
            return 0;
        } else {
            double theta = lon1 - lon2;
            double dist = Math.sin(Math.toRadians(lat1)) * Math.sin(Math.toRadians(lat2)) + 
                          Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.cos(Math.toRadians(theta));
            dist = Math.acos(dist);
            dist = Math.toDegrees(dist);
            dist = dist * 60 * 1.1515;
            dist = dist * 1.609344;
            return (dist);
        }
    }

    private Optional<LocalDateTime> parseDateTime(String s) {
        if (s == null) return Optional.empty();
        try {
            return Optional.of(LocalDateTime.parse(s));
        } catch (Exception e) {
            try {
                return Optional.of(OffsetDateTime.parse(s).toLocalDateTime());
            } catch (Exception ex) {
                return Optional.empty();
            }
        }
    }

    @PostMapping
    public Ride create(@RequestBody Ride r){
        Ride saved = rideRepository.save(r);

        // Notify host that their ride is live (in-app + email)
        try {
            if (saved.getOwnerEmail() != null) {
                userRepository.findByEmail(saved.getOwnerEmail()).ifPresent(host -> {
                    try {
                        notificationService.create(host, "Ride Hosted", "Your ride is now live and visible to passengers.", "RIDE", "/hosted");
                    } catch (Exception e) {
                        // don't fail ride creation for notification/email issues
                        logger.warn("Failed to create ride-hosted notification for {}: {}", saved.getOwnerEmail(), e.getMessage());
                    }
                });
                // Send email to host
                emailService.sendRideHostedEmail(saved, userRepository.findByEmail(saved.getOwnerEmail()).orElse(new com.carpool.model.User()));
            }
        } catch (Exception ignored) {}

        return saved;
    }

    @GetMapping("/hosted")
    public List<Ride> hosted(HttpServletRequest request){
        String email = (String) request.getAttribute("email");
        if (email == null) {
            logger.warn("RideController.hosted: unauthenticated access");
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED);
        }

        // Fetch only rides owned by this user
        List<Ride> rides = rideRepository.findByOwnerEmail(email);

        // If ride time (or estimated completion) is in past, proactively mark eligible bookings as COMPLETED
        LocalDateTime now = LocalDateTime.now();
        java.util.List<com.carpool.model.Booking.Status> currentStatuses = java.util.Arrays.asList(
                com.carpool.model.Booking.Status.CONFIRMED,
                com.carpool.model.Booking.Status.ACCEPTED,
                com.carpool.model.Booking.Status.PAID
        );

        for (Ride r : rides) {
            Optional<LocalDateTime> maybeDt = parseDateTime(r.getEstimatedCompletionDateTime() != null && !r.getEstimatedCompletionDateTime().isBlank() ? r.getEstimatedCompletionDateTime() : r.getDateTime());
            if (maybeDt.isPresent() && maybeDt.get().isBefore(now)) {
                // Collect bookings that will be affected (based on current statuses) so we can notify/ email them after the update
                java.util.List<com.carpool.model.Booking> toNotify = bookingRepository.findByRideId(r.getId()).stream().filter(b -> currentStatuses.contains(b.getStatus())).toList();
                try {
                    int rows = bookingRepository.updateStatusByRideIdAndCurrentStatuses(r.getId(), com.carpool.model.Booking.Status.COMPLETED, currentStatuses);
                    if (rows > 0) {
                        logger.info("RideController.hosted: ride {} - marked {} bookings as COMPLETED", r.getId(), rows);

                        // Send notifications / emails for those previously collected bookings
                        for (com.carpool.model.Booking b : toNotify) {
                            bookingRepository.findById(b.getId()).ifPresent(fresh -> {
                                try {
                                    if (fresh.getRequesterId() != null) {
                                        userRepository.findById(fresh.getRequesterId()).ifPresent(pass -> {
                                            notificationService.create(pass, "Ride Completed", "Your ride is completed — please rate your driver.", "RIDE", "/my-rides");
                                        });
                                    }
                                    if (r.getOwnerEmail() != null) {
                                        userRepository.findByEmail(r.getOwnerEmail()).ifPresent(host -> {
                                            notificationService.create(host, "Ride Completed", "Your ride is completed — please rate your passengers.", "RIDE", "/hosted");
                                        });
                                    }
                                    emailService.sendRatingRequestEmails(fresh, r);
                                } catch (Exception ex) {
                                    logger.warn("RideController.hosted: notify/email failed for booking {}", fresh.getId(), ex);
                                }
                            });
                        }

                    } else {
                        logger.debug("RideController.hosted: ride {} - no bookings required update", r.getId());
                    }
                } catch (Exception ex) {
                    logger.warn("RideController.hosted: failed to update bookings for ride {}", r.getId(), ex);
                }
            }
        }

        return rides;
    }

    @GetMapping("/{id}")
    public Ride get(@PathVariable Long id){ return rideRepository.findById(id).orElse(null); }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (rideRepository.existsById(id)) {
            rideRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    // Allow host or admin to mark ALL CONFIRMED bookings for a ride as COMPLETED
    @PostMapping("/{id}/complete")
    public ResponseEntity<?> completeRideBookings(@PathVariable Long id, HttpServletRequest request) {
        String email = (String) request.getAttribute("email");
        if (email == null) return ResponseEntity.status(401).build();

        Ride ride = rideRepository.findById(id).orElse(null);
        if (ride == null) return ResponseEntity.notFound().build();

        // Permission check: owner or admin/manager/assistant
        var userOpt = userRepository.findByEmail(email);
        boolean allowed = false;
        if (userOpt.isPresent()) {
            String role = userOpt.get().getRole();
            if (role != null && (role.equalsIgnoreCase("ADMIN") || role.equalsIgnoreCase("MANAGER") || role.equalsIgnoreCase("ASSISTANT"))) allowed = true;
        }
        if (email.equals(ride.getOwnerEmail())) allowed = true;
        if (!allowed) return ResponseEntity.status(403).build();

        // Bulk update to mark eligible bookings as COMPLETED
        java.util.List<com.carpool.model.Booking.Status> currentStatuses = java.util.Arrays.asList(
                com.carpool.model.Booking.Status.CONFIRMED,
                com.carpool.model.Booking.Status.ACCEPTED,
                com.carpool.model.Booking.Status.PAID
        );
        int updated = bookingRepository.updateStatusByRideIdAndCurrentStatuses(ride.getId(), com.carpool.model.Booking.Status.COMPLETED, currentStatuses);

        return ResponseEntity.ok(Map.of("updated", updated));
    }

    // Idempotent endpoint: ensure bookings are marked COMPLETED when the ride's end time is in the past
    @PostMapping("/{id}/ensure-completed")
    public ResponseEntity<?> ensureCompleted(@PathVariable Long id, HttpServletRequest request) {
        String email = (String) request.getAttribute("email");
        if (email == null) return ResponseEntity.status(401).build();

        Ride ride = rideRepository.findById(id).orElse(null);
        if (ride == null) return ResponseEntity.notFound().build();

        // Permission check: owner or admin/manager/assistant
        var userOpt = userRepository.findByEmail(email);
        boolean allowed = false;
        if (userOpt.isPresent()) {
            String role = userOpt.get().getRole();
            if (role != null && (role.equalsIgnoreCase("ADMIN") || role.equalsIgnoreCase("MANAGER") || role.equalsIgnoreCase("ASSISTANT"))) allowed = true;
        }
        if (email.equals(ride.getOwnerEmail())) allowed = true;
        if (!allowed) return ResponseEntity.status(403).build();

        // Verify ride end time has passed
        Optional<LocalDateTime> maybeDt = parseDateTime(ride.getEstimatedCompletionDateTime() != null && !ride.getEstimatedCompletionDateTime().isBlank() ? ride.getEstimatedCompletionDateTime() : ride.getDateTime());
        if (maybeDt.isEmpty() || maybeDt.get().isAfter(LocalDateTime.now())) {
            return ResponseEntity.status(400).body(Map.of("message", "Ride end time has not passed yet"));
        }

        java.util.List<com.carpool.model.Booking.Status> currentStatuses = java.util.Arrays.asList(
                com.carpool.model.Booking.Status.CONFIRMED,
                com.carpool.model.Booking.Status.ACCEPTED,
                com.carpool.model.Booking.Status.PAID
        );

        // Defensive approach: try bulk update, but fall back to per-booking updates on failure
        int updated = 0;
        try {
            logger.debug("RideController.ensureCompleted: attempting bulk update for ride {}", ride.getId());
            int rows = bookingRepository.updateStatusByRideIdAndCurrentStatuses(ride.getId(), com.carpool.model.Booking.Status.COMPLETED, currentStatuses);
            updated += rows;
            logger.info("RideController.ensureCompleted: ride {} - bulk update marked {} bookings as COMPLETED", ride.getId(), rows);
        } catch (Exception ex) {
            logger.warn("RideController.ensureCompleted: bulk update failed for ride {}", ride.getId(), ex);
            try {
                java.util.List<com.carpool.model.Booking> bookings = bookingRepository.findByRideId(ride.getId());
                logger.debug("RideController.ensureCompleted: ride {} has {} bookings, details: {}", ride.getId(), bookings.size(), bookings.stream().map(b -> b.getId() + ":" + b.getStatus()).collect(java.util.stream.Collectors.joining(",")));
                for (com.carpool.model.Booking b : bookings) {
                    if (currentStatuses.contains(b.getStatus())) {
                        try {
                            int r = bookingRepository.updateStatusById(b.getId(), com.carpool.model.Booking.Status.COMPLETED);
                            if (r > 0) updated += r;
                        } catch (Exception ex2) {
                            logger.warn("RideController.ensureCompleted: failed updating booking {}", b.getId(), ex2);
                        }
                    }
                }
            } catch (Exception ex2) {
                logger.error("RideController.ensureCompleted: fallback per-booking update failed for ride {}", ride.getId(), ex2);
                return ResponseEntity.status(500).body(Map.of("message", "Failed to mark bookings as COMPLETED", "error", ex2.getMessage()));
            }
        }

        logger.info("RideController.ensureCompleted: ride {} - total bookings marked COMPLETED: {}", ride.getId(), updated);
        return ResponseEntity.ok(Map.of("updated", updated));
    }

    // Returns aggregate passenger ratings for a ride and per-booking ratings, and which bookings were rated by current user
    @GetMapping("/{id}/passenger-ratings")
    public ResponseEntity<?> passengerRatings(@PathVariable Long id, HttpServletRequest request) {
        try {
            java.util.List<com.carpool.model.Booking> bookings = bookingRepository.findByRideId(id);
            java.util.List<Long> bookingIds = bookings.stream()
                    .map(b -> b.getId())
                    .filter(java.util.Objects::nonNull)
                    .collect(java.util.stream.Collectors.toList());

            if (bookingIds.isEmpty()) {
                return ResponseEntity.ok(Map.of("average", null, "perBooking", Map.of(), "ratedByMe", Map.of()));
            }

            java.util.List<com.carpool.model.RatingReview> ratings = java.util.Collections.emptyList();
            try {
                ratings = ratingRepository.findByBookingIdIn(bookingIds);
            } catch (Exception dbEx) {
                logger.warn("passengerRatings: ratingRepository lookup failed for ride {}", id, dbEx);
                return ResponseEntity.ok(Map.of("average", null, "perBooking", Map.of(), "ratedByMe", Map.of()));
            }

            if (ratings == null) ratings = java.util.Collections.emptyList();

            // defensive filter and collect into a typed list
            java.util.List<com.carpool.model.RatingReview> cleaned = new java.util.ArrayList<>();
            for (com.carpool.model.RatingReview r : ratings) {
                if (r == null) continue;
                if (r.getBookingId() == null) continue;
                int stars = r.getStars();
                if (stars < 0 || stars > 5) continue;
                cleaned.add(r);
            }

            // average where reviewerRole == DRIVER
            double sum = 0.0;
            int count = 0;
            for (com.carpool.model.RatingReview r : cleaned) {
                if (r.getReviewerRole() == com.carpool.model.RatingReview.Role.DRIVER) {
                    sum += r.getStars();
                    count++;
                }
            }
            Double avg = null;
            if (count > 0) avg = Math.round((sum / count) * 10.0) / 10.0;

            // per-booking averages
            java.util.Map<Long, java.util.List<Integer>> perBookingAcc = new java.util.HashMap<>();
            for (com.carpool.model.RatingReview r : cleaned) {
                perBookingAcc.computeIfAbsent(r.getBookingId(), k -> new java.util.ArrayList<>()).add(r.getStars());
            }
            java.util.Map<Long, Double> perBooking = new java.util.HashMap<>();
            for (var e : perBookingAcc.entrySet()) {
                java.util.List<Integer> vals = e.getValue();
                double s = 0.0; for (int v : vals) s += v;
                perBooking.put(e.getKey(), Math.round((s / vals.size()) * 10.0) / 10.0);
            }

            // which bookings were rated by current user
            String email = (String) request.getAttribute("email");
            java.util.Map<Long, Integer> ratedByMe = new java.util.HashMap<>();
            if (email != null) {
                java.util.Optional<com.carpool.model.User> userOpt = userRepository.findByEmail(email);
                if (userOpt.isPresent()) {
                    Long me = userOpt.get().getId();
                    for (com.carpool.model.RatingReview r : cleaned) {
                        if (me.equals(r.getReviewerId())) ratedByMe.put(r.getBookingId(), r.getStars());
                    }
                }
            }

            java.util.Map<String,Object> resp = new java.util.HashMap<>();
            resp.put("average", avg);
            resp.put("perBooking", perBooking);
            resp.put("ratedByMe", ratedByMe);
            return ResponseEntity.ok(resp);
        } catch (Exception ex) {
            logger.error("passengerRatings: failed to compute passenger ratings for ride {}", id, ex);
            return ResponseEntity.status(500).body(Map.of("message", "Failed to compute passenger ratings", "error", ex.getMessage()));
        }
    }

    // Returns aggregate ratings for the driver on this ride (ratings given by passengers), including star counts and reviews (including star-only entries)
    @GetMapping("/{id}/driver-ratings")
    public ResponseEntity<?> driverRatings(@PathVariable Long id) {
        try {
            java.util.List<com.carpool.model.Booking> bookings = bookingRepository.findByRideId(id);
            java.util.List<Long> bookingIds = bookings.stream()
                    .map(b -> b.getId())
                    .filter(java.util.Objects::nonNull)
                    .collect(java.util.stream.Collectors.toList());
            if (bookingIds.isEmpty()) return ResponseEntity.ok(Map.of("average", null, "counts", Map.of(), "reviews", java.util.Collections.emptyList()));

            java.util.List<com.carpool.model.RatingReview> ratings = java.util.Collections.emptyList();
            try {
                ratings = ratingRepository.findByBookingIdIn(bookingIds);
            } catch (Exception dbEx) {
                logger.warn("driverRatings: ratingRepository lookup failed for ride {}", id, dbEx);
                return ResponseEntity.ok(java.util.Map.of("average", null, "counts", java.util.Collections.emptyMap(), "reviews", java.util.Collections.emptyList()));
            }

            if (ratings == null) ratings = java.util.Collections.emptyList();

            // defensive filtering: ignore malformed entries and keep only PASSENGER authored ratings
            java.util.List<com.carpool.model.RatingReview> cleaned = new java.util.ArrayList<>();
            for (com.carpool.model.RatingReview r : ratings) {
                if (r == null) continue;
                if (r.getReviewerRole() != com.carpool.model.RatingReview.Role.PASSENGER) continue;
                int stars = r.getStars(); if (stars < 0 || stars > 5) continue;
                cleaned.add(r);
            }

            double sum = 0.0; int cnt = 0;
            java.util.Map<Integer, Integer> counts = new java.util.HashMap<>();
            for (int s = 1; s <= 5; s++) counts.put(s, 0);
            for (com.carpool.model.RatingReview r : cleaned) {
                sum += r.getStars(); cnt++;
                counts.put(r.getStars(), counts.getOrDefault(r.getStars(), 0) + 1);
            }
            Double avg = (cnt > 0) ? Math.round((sum / cnt) * 10.0) / 10.0 : null;

            java.util.List<java.util.Map<String,Object>> reviews = new java.util.ArrayList<>();
            for (com.carpool.model.RatingReview r : cleaned) {
                java.util.Map<String,Object> map = new java.util.HashMap<>();
                map.put("bookingId", r.getBookingId());
                map.put("stars", r.getStars());
                map.put("review", r.getReview());
                map.put("reviewerRole", r.getReviewerRole() != null ? r.getReviewerRole().name() : null);
                var reviewer = userRepository.findById(r.getReviewerId()).orElse(null);
                map.put("reviewerName", reviewer != null ? (reviewer.getFullname() != null ? reviewer.getFullname() : reviewer.getEmail()) : null);
                reviews.add(map);
            }

            java.util.Map<String,Object> resp2 = new java.util.HashMap<>();
            resp2.put("average", avg);
            resp2.put("counts", counts);
            resp2.put("reviews", reviews);
            return ResponseEntity.ok(resp2);
        } catch (Exception ex) {
            logger.error("driverRatings: failed to compute driver ratings for ride {}", id, ex);
            return ResponseEntity.status(500).body(Map.of("message", "Failed to compute driver ratings", "error", ex.getMessage()));
        }
    }

    // Returns textual reviews (comments) for a ride, with reviewer name, role and stars
    @GetMapping("/{id}/reviews")
    public ResponseEntity<?> reviews(@PathVariable Long id) {
        try {
            var bookings = bookingRepository.findByRideId(id);
            var bookingIds = bookings.stream().map(b -> b.getId()).filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toList());
            if (bookingIds.isEmpty()) return ResponseEntity.ok(java.util.Collections.emptyList());

            java.util.List<com.carpool.model.RatingReview> ratings = ratingRepository.findByBookingIdIn(bookingIds);
            var filtered = ratings.stream()
                    .filter(r -> r != null && r.getReview() != null && !r.getReview().trim().isEmpty())
                    .map(r -> {
                        var map = new java.util.HashMap<String,Object>();
                        map.put("bookingId", r.getBookingId());
                        map.put("stars", r.getStars());
                        map.put("review", r.getReview());
                        map.put("reviewerRole", r.getReviewerRole() != null ? r.getReviewerRole().name() : null);
                        var reviewer = userRepository.findById(r.getReviewerId()).orElse(null);
                        map.put("reviewerName", reviewer != null ? (reviewer.getFullname() != null ? reviewer.getFullname() : reviewer.getEmail()) : null);
                        return map;
                    })
                    .collect(java.util.stream.Collectors.toList());

            return ResponseEntity.ok(filtered);
        } catch (Exception ex) {
            logger.error("reviews: failed to fetch reviews for ride {}", id, ex);
            return ResponseEntity.status(500).body(Map.of("message", "Failed to fetch reviews", "error", ex.getMessage()));
        }
    }
}


