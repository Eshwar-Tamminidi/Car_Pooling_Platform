package com.carpool.controller;

import com.carpool.model.Booking;
import com.carpool.model.Ride;
import com.carpool.repository.BookingRepository;
import com.carpool.repository.RideRepository;
import com.carpool.repository.UserRepository;
import com.carpool.service.BookingService;
import com.carpool.service.EmailService;
import com.carpool.service.NotificationService;

import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.UUID;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse.BodyHandlers;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

@RestController
@RequestMapping("/api/bookings")
@CrossOrigin(origins = "*")
public class BookingController {

    private final BookingService bookingService;
    private final RideRepository rideRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final BookingRepository bookingRepository;
    private final EmailService emailService;


    public BookingController(
            BookingService bookingService,
            RideRepository rideRepository,
            UserRepository userRepository,
            NotificationService notificationService,
            BookingRepository bookingRepository,
            EmailService emailService
    ) {
        this.bookingService = bookingService;
        this.rideRepository = rideRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.bookingRepository = bookingRepository;
        this.emailService = emailService;
    }

    @GetMapping("/my")
    public List<Booking> myBookings(HttpServletRequest request) {
        String email = (String) request.getAttribute("email");
        if (email == null) return List.of();
        return userRepository.findByEmail(email)
                .map(u -> bookingService.findByRequesterId(u.getId()))
                .orElse(List.of());
    }

    @GetMapping("/for-host")
    public List<Map<String, Object>> bookingsForHost(HttpServletRequest request) {
        String email = (String) request.getAttribute("email");
        if (email == null) return List.of();

        return rideRepository.findAll().stream()
                .filter(r -> email.equals(r.getOwnerEmail()))
                .flatMap(r -> bookingService.findByRideId(r.getId()).stream())
                .map(b -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", b.getId());
                    map.put("rideId", b.getRideId());
                    map.put("requesterId", b.getRequesterId());
                    map.put("requesterName", b.getRequesterName());
                    map.put("requesterEmail", b.getRequesterEmail());
                    map.put("status", b.getStatus());
                    map.put("seatsRequested", b.getSeatsRequested());
                    map.put("requestedAt", b.getRequestedAt());
                    map.put("transactionId", b.getTransactionId());
                    map.put("paymentInitiatedAt", b.getPaymentInitiatedAt());
                    map.put("paymentCompletedAt", b.getPaymentCompletedAt());
                    map.put("confirmedAt", b.getConfirmedAt());

                    // Attach requester phone from user profile if available
                    String phone = userRepository.findById(b.getRequesterId()).map(u -> u.getPhone()).orElse(null);
                    map.put("requesterPhone", phone);
                    return map;
                })
                .toList();
    }

    // -------------------- PAYMENT FLOW (UNCHANGED) --------------------

    @PostMapping("/{id}/initiate-payment")
    public ResponseEntity<?> initiatePayment(@PathVariable Long id, HttpServletRequest request) {
        String email = (String) request.getAttribute("email");
        Booking b = bookingService.findById(id).orElse(null);
        if (b == null || !email.equals(b.getRequesterEmail()))
            return ResponseEntity.status(403).build();

        b.setPaymentInitiatedAt(LocalDateTime.now());
        bookingService.save(b);

        String stripeKey = System.getenv("STRIPE_SECRET_KEY");
        if (stripeKey != null && !stripeKey.isBlank()) {
            try {
                Ride ride = rideRepository.findById(b.getRideId()).orElse(null);
                if (ride == null) return ResponseEntity.badRequest().body(Map.of("message", "Ride not found"));

                int seats = b.getSeatsRequested() > 0 ? b.getSeatsRequested() : 1;
                double base = ride.getPrice() * seats;
                double platformFeeRupees = base * 0.05; // 5% platform fee
                double subtotal = base + platformFeeRupees;
                double gstRupees = subtotal * 0.036; // 3.6% GST on subtotal (CGST 1.8% + SGST 1.8%)
                long amount = Math.round((subtotal + gstRupees) * 100);

                String form = "amount=" + amount
                        + "&currency=inr"
                        + "&description=" + URLEncoder.encode("Carpool booking: rideId=" + ride.getId(), StandardCharsets.UTF_8)
                        + "&receipt_email=" + URLEncoder.encode(b.getRequesterEmail() == null ? "" : b.getRequesterEmail(), StandardCharsets.UTF_8)
                        + "&metadata[bookingId]=" + b.getId();

                HttpClient client = HttpClient.newHttpClient();
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create("https://api.stripe.com/v1/payment_intents"))
                        .header("Authorization", "Bearer " + stripeKey)
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .POST(BodyPublishers.ofString(form))
                        .build();

                HttpResponse<String> resp = client.send(req, BodyHandlers.ofString());
                if (resp.statusCode() >= 400) {
                    return ResponseEntity.status(502).body(Map.of("message", "Stripe error: " + resp.body()));
                }

                ObjectMapper mapper = new ObjectMapper();
                Map<String, Object> parsed = mapper.readValue(resp.body(), new TypeReference<Map<String, Object>>() {});
                String clientSecret = (String) parsed.get("client_secret");
                String paymentIntentId = (String) parsed.get("id");

                return ResponseEntity.ok(Map.of(
                        "status", "INITIATED",
                        "clientSecret", clientSecret,
                        "paymentIntentId", paymentIntentId
                ));
            } catch (Exception e) {
                return ResponseEntity.status(502).body(Map.of("message", "Stripe error: " + e.getMessage()));
            }
        }

        // Fallback demo behavior (keeps existing demo flow)
        String clientSecret =
                "pi_" + UUID.randomUUID().toString().substring(0, 8)
                        + "_secret_" + UUID.randomUUID().toString().substring(0, 8);

        return ResponseEntity.ok(Map.of(
                "status", "INITIATED",
                "clientSecret", clientSecret
        ));
    }

    @PostMapping("/{id}/verify-payment")
@Transactional
public ResponseEntity<?> verifyPayment(
        @PathVariable Long id,
        @RequestBody Map<String, String> payload,
        HttpServletRequest request
) {
    String email = (String) request.getAttribute("email");
    Booking b = bookingService.findById(id).orElse(null);

    if (b == null || !email.equals(b.getRequesterEmail())) {
        return ResponseEntity.status(403).build();
    }

    if (b.getStatus() == Booking.Status.CONFIRMED) {
        return ResponseEntity.ok(Map.of("status", "CONFIRMED"));
    }

    String txId = payload.get("transactionId");
    if (txId == null || txId.isBlank()) {
        return ResponseEntity.badRequest().body(Map.of("message", "Transaction ID required"));
    }

    // ✅ Stripe transaction validation
    if (!txId.startsWith("pi_")) {
        // notify requester about failed payment attempt
        try {
            userRepository.findByEmail(email).ifPresent(u -> {
                notificationService.create(u, "Payment Failed", "Invalid transaction ID provided.", "PAYMENT", "/my-bookings");
            });
        } catch (Exception ignore) {}
        return ResponseEntity.badRequest()
                .body(Map.of("message", "Invalid Stripe transaction"));
    }

    if (bookingRepository.existsByTransactionId(txId)) {
        try {
            userRepository.findByEmail(email).ifPresent(u -> {
                notificationService.create(u, "Payment Failed", "Duplicate transaction detected.", "PAYMENT", "/my-bookings");
            });
        } catch (Exception ignore) {}
        return ResponseEntity.badRequest()
                .body(Map.of("message", "Duplicate transaction"));
    }

    Ride ride = rideRepository.findById(b.getRideId()).orElse(null);
    if (ride == null) {
        return ResponseEntity.badRequest().body(Map.of("message", "Ride not found"));
    }

    int updated = rideRepository.deductSeatsIfAvailable(
            ride.getId(), b.getSeatsRequested());

    if (updated == 0) {
        try {
            userRepository.findByEmail(email).ifPresent(u -> {
                notificationService.create(u, "Payment Failed", "Seats unavailable at the time of confirmation.", "PAYMENT", "/my-bookings");
            });
        } catch (Exception ignore) {}
        return ResponseEntity.badRequest().body(Map.of("message", "Seats unavailable"));
    }

        b.setTransactionId(txId);
        b.setPaymentCompletedAt(LocalDateTime.now());
        b.setConfirmedAt(LocalDateTime.now());
        b.setStatus(Booking.Status.CONFIRMED);
        bookingService.save(b);

// 📧 SEND EMAILS AFTER CONFIRMATION AND CREATE NOTIFICATIONS
        try {
            Ride rideObj = rideRepository.findById(b.getRideId()).orElse(null);
            if (rideObj != null) {
                emailService.sendRideConfirmedEmail(b, rideObj);
                emailService.sendInvoiceEmail(b, rideObj);   // ✅ THIS LINE IS REQUIRED

                // notify requester
                if (b.getRequesterEmail() != null && !b.getRequesterEmail().isBlank()) {
                    userRepository.findByEmail(b.getRequesterEmail()).ifPresent(user -> {
                        try {
                            notificationService.create(user, "Payment Successful", "Your payment was successful and booking is confirmed.", "PAYMENT", "/my-bookings");
                        } catch (Exception ignore) {}
                    });
                }

                // notify driver/host
                if (rideObj.getOwnerEmail() != null && !rideObj.getOwnerEmail().isBlank()) {
                    userRepository.findByEmail(rideObj.getOwnerEmail()).ifPresent(host -> {
                        try {
                            notificationService.create(host, "Passenger Paid", "A passenger has paid for a booking on your ride.", "PAYMENT", "/hosted");
                        } catch (Exception ignore) {}
                    });

                    // send driver email informing passenger payment received
                    emailService.sendPassengerPaidEmail(b, rideObj);
                }

            }
        } catch (Exception e) {
            e.printStackTrace(); // IMPORTANT for debugging
        }



        return ResponseEntity.ok(Map.of("status", "CONFIRMED"));
}


    @PostMapping("/{id}/create-checkout-session")
    public ResponseEntity<?> createCheckoutSession(@PathVariable Long id, HttpServletRequest request) {
        String email = (String) request.getAttribute("email");
        Booking b = bookingService.findById(id).orElse(null);
        if (b == null || !email.equals(b.getRequesterEmail()))
            return ResponseEntity.status(403).build();

        String stripeKey = System.getenv("STRIPE_SECRET_KEY");
        if (stripeKey == null || stripeKey.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "Stripe not configured"));

        try {
            Ride ride = rideRepository.findById(b.getRideId()).orElse(null);
            if (ride == null) return ResponseEntity.badRequest().body(Map.of("message", "Ride not found"));

            int seats = b.getSeatsRequested() > 0 ? b.getSeatsRequested() : 1;
            double base = ride.getPrice() * seats;
            double platformFeeRupees = base * 0.05; // 5% platform fee
            double subtotal = base + platformFeeRupees;
            double gstRupees = subtotal * 0.036; // 3.6% GST on subtotal (CGST 1.8% + SGST 1.8%)
            long amount = Math.round((subtotal + gstRupees) * 100);

            String form = "line_items[0][price_data][currency]=inr"
                    + "&line_items[0][price_data][unit_amount]=" + amount
                    + "&line_items[0][price_data][product_data][name]=" + URLEncoder.encode("Carpool booking for ride " + ride.getId(), StandardCharsets.UTF_8)
                    + "&line_items[0][quantity]=1"
                    + "&mode=payment"
                    + "&success_url=" + URLEncoder.encode("http://localhost:3000/payment-success?session_id={CHECKOUT_SESSION_ID}", StandardCharsets.UTF_8)
                    + "&cancel_url=" + URLEncoder.encode("http://localhost:3000/payment-cancel", StandardCharsets.UTF_8);

            HttpClient client = HttpClient.newHttpClient();
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.stripe.com/v1/checkout/sessions"))
                    .header("Authorization", "Bearer " + stripeKey)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(BodyPublishers.ofString(form))
                    .build();

            HttpResponse<String> resp = client.send(req, BodyHandlers.ofString());
            if (resp.statusCode() >= 400) {
                return ResponseEntity.status(502).body(Map.of("message", "Stripe error: " + resp.body()));
            }

            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> parsed = mapper.readValue(resp.body(), new TypeReference<Map<String, Object>>() {});
            String url = (String) parsed.get("url");
            String sessionId = (String) parsed.get("id");
            return ResponseEntity.ok(Map.of("url", url, "sessionId", sessionId));
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("message", "Stripe error: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/confirm-checkout")
    public ResponseEntity<?> confirmCheckout(@PathVariable Long id, @RequestBody Map<String, String> body, HttpServletRequest request) {
        String email = (String) request.getAttribute("email");
        Booking b = bookingService.findById(id).orElse(null);
        if (b == null || !email.equals(b.getRequesterEmail()))
            return ResponseEntity.status(403).build();

        String sessionId = body.get("sessionId");
        if (sessionId == null || sessionId.isBlank()) return ResponseEntity.badRequest().body(Map.of("message", "sessionId required"));

        String stripeKey = System.getenv("STRIPE_SECRET_KEY");
        if (stripeKey == null || stripeKey.isBlank()) return ResponseEntity.badRequest().body(Map.of("message", "Stripe not configured"));

        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.stripe.com/v1/checkout/sessions/" + URLEncoder.encode(sessionId, StandardCharsets.UTF_8)))
                    .header("Authorization", "Bearer " + stripeKey)
                    .GET()
                    .build();
            HttpResponse<String> resp = client.send(req, BodyHandlers.ofString());
            if (resp.statusCode() >= 400) return ResponseEntity.status(502).body(Map.of("message", "Stripe error: " + resp.body()));

            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> parsed = mapper.readValue(resp.body(), new TypeReference<Map<String, Object>>() {});
            String paymentIntentId = (String) parsed.get("payment_intent");
            if (paymentIntentId == null) return ResponseEntity.badRequest().body(Map.of("message", "Payment not completed"));

            // Reuse verify flow by calling verifyPayment-like logic
            Map<String, String> payload = Map.of("transactionId", paymentIntentId);
            return verifyPayment(id, payload, request);
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("message", "Stripe error: " + e.getMessage()));
        }
    }

    // -------------------- CONFIG / BOOKING REQUEST --------------------

    @GetMapping("/config/stripe")
    public ResponseEntity<?> stripeConfig() {
        String pk = System.getenv("STRIPE_PUBLISHABLE_KEY");
        return ResponseEntity.ok(Map.of("publishableKey", pk == null ? "" : pk));
    }

    @PostMapping("/request")
public ResponseEntity<?> requestBooking(@RequestBody Booking payload, HttpServletRequest request) {
    String email = (String) request.getAttribute("email");
    if (email == null)
        return ResponseEntity.status(401).body("Unauthorized");

    return userRepository.findByEmail(email).map(u -> {
        Ride ride = rideRepository.findById(payload.getRideId()).orElse(null);
        if (ride == null)
            return ResponseEntity.badRequest().body("Ride not found");

        Booking b = new Booking();
        b.setRideId(ride.getId());
        b.setRequesterId(u.getId());
        b.setRequesterName(u.getFullname());
        b.setRequesterEmail(u.getEmail());
        b.setSeatsRequested(payload.getSeatsRequested() > 0 ? payload.getSeatsRequested() : 1);
        b.setStatus(Booking.Status.PENDING);

        Booking saved = bookingService.create(b);

        // 🔔 Notification: Booking Requested to requester (wrap in try-catch to not break the flow)
        try {
            notificationService.create(
                    u,
                    "Booking Requested",
                    "Your booking request has been sent to the ride host.",
                    "BOOKING",
                    "/my-bookings"
            );
        } catch (Exception e) {
            // Log but don't fail the request
            System.err.println("Failed to create requester notification: " + e.getMessage());
        }

        // 🔔 Notify host (driver) by notification + email
        try {
            if (ride.getOwnerEmail() != null) {
                userRepository.findByEmail(ride.getOwnerEmail()).ifPresent(host -> {
                    notificationService.create(
                            host,
                            "New Booking Request",
                            "You have a new booking request for your ride.",
                            "BOOKING",
                            "/hosted"
                    );
                });
                // Fire-and-forget email to host
                emailService.sendBookingRequestedToHostEmail(saved, ride);
            }
        } catch (Exception e) {
            System.err.println("Failed to notify host: " + e.getMessage());
        }

        return ResponseEntity.ok(saved);
    }).orElse(ResponseEntity.status(401).body("Unauthorized"));
}

@PostMapping("/{id}/decide")
public ResponseEntity<?> decideBooking(
        @PathVariable Long id,
        @RequestParam("action") String action,
        HttpServletRequest request
) {
    String email = (String) request.getAttribute("email");
    Booking b = bookingService.findById(id).orElse(null);
    if (b == null || email == null)
        return ResponseEntity.badRequest().body("Not found");

    Ride ride = rideRepository.findById(b.getRideId()).orElse(null);
    if (ride == null || !email.equals(ride.getOwnerEmail()))
        return ResponseEntity.status(403).body("Forbidden");

    if (b.getStatus() == Booking.Status.CONFIRMED)
        return ResponseEntity.badRequest().body("Confirmed booking cannot be changed");

    if ("accept".equalsIgnoreCase(action)) {

        if (ride.getSeatsAvailable() < b.getSeatsRequested()) {
            return ResponseEntity.badRequest().body("Not enough seats available to accept this request");
        }

        b.setStatus(Booking.Status.ACCEPTED);

        try {
            if (b.getRequesterId() != null) {
                userRepository.findById(b.getRequesterId()).ifPresent(requester -> {
                    notificationService.create(
                            requester,
                            "Booking Accepted",
                            "Your booking has been accepted by the host.",
                            "BOOKING",
                            "/my-bookings"
                    );
                });
            }


            // 📧 EMAIL: Driver accepted
            emailService.sendBookingAcceptedEmail(b, ride);

        } catch (Exception e) {
            System.err.println("Accept notification/email failed: " + e.getMessage());
        }
    }
    else {
        b.setStatus(Booking.Status.REJECTED);

        try {
            userRepository.findById(b.getRequesterId()).ifPresent(requester -> {
                notificationService.create(
                        requester,
                        "Booking Rejected",
                        "Unfortunately, your booking was rejected by the host.",
                        "BOOKING",
                        "/my-bookings"
                );
            });


            // 📧 EMAIL: Driver rejected
            emailService.sendBookingRejectedEmail(b, ride);

        } catch (Exception e) {
            System.err.println("Reject notification/email failed: " + e.getMessage());
        }
    }


    Booking saved = bookingService.save(b);
    return ResponseEntity.ok(saved);
}
    // -------------------- MARK BOOKING COMPLETED (MANUAL) --------------------

    @PostMapping("/{id}/complete")
    public ResponseEntity<?> completeBooking(
            @PathVariable Long id,
            HttpServletRequest request
    ) {
        String email = (String) request.getAttribute("email");
        if (email == null)
            return ResponseEntity.status(401).build();

        Booking b = bookingService.findById(id).orElse(null);
        if (b == null)
            return ResponseEntity.notFound().build();

        // Only confirmed bookings can be marked completed
        if (b.getStatus() != Booking.Status.CONFIRMED)
            return ResponseEntity.badRequest().body("Booking is not confirmed yet");

        // Permission: host (ride owner) or admin/manager/assistant
        Ride ride = rideRepository.findById(b.getRideId()).orElse(null);
        if (ride == null) return ResponseEntity.badRequest().body("Ride not found");

        var userOpt = userRepository.findByEmail(email);
        boolean allowed = false;
        if (userOpt.isPresent()) {
            String role = userOpt.get().getRole();
            if (role != null && (role.equalsIgnoreCase("ADMIN") || role.equalsIgnoreCase("MANAGER") || role.equalsIgnoreCase("ASSISTANT"))) allowed = true;
        }
        if (email.equals(ride.getOwnerEmail())) allowed = true;
        if (!allowed) return ResponseEntity.status(403).build();

        b.setStatus(Booking.Status.COMPLETED);
        bookingService.save(b);

        // Notify both passenger and host and send rating-request emails
        try {
            Ride rideObj = rideRepository.findById(b.getRideId()).orElse(null);
            if (rideObj != null) {
                // Passenger notification
                if (b.getRequesterId() != null) {
                    userRepository.findById(b.getRequesterId()).ifPresent(pass -> {
                        notificationService.create(pass, "Ride Completed", "Your ride is completed — please rate your driver.", "RIDE", "/my-rides");
                    });
                }
                // Host notification
                if (rideObj.getOwnerEmail() != null) {
                    userRepository.findByEmail(rideObj.getOwnerEmail()).ifPresent(host -> {
                        notificationService.create(host, "Ride Completed", "Your ride is completed — please rate your passengers.", "RIDE", "/hosted");
                    });
                }

                // Send rating request emails to both
                emailService.sendRatingRequestEmails(b, rideObj);
            }
        } catch (Exception e) {
            System.err.println("Failed to send completion notifications/emails: " + e.getMessage());
        }

        return ResponseEntity.ok(Map.of("status", "COMPLETED"));
    }

}
