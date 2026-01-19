package com.carpool.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Enhanced Booking model with multi-stage payment tracking fields.
 */
@Entity
public class Booking {
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long rideId;
    private Long requesterId;
    private String requesterName;
    private String requesterEmail;

    @Enumerated(EnumType.STRING)
    private Status status = Status.PENDING;

    private int seatsRequested = 1;
    private LocalDateTime requestedAt = LocalDateTime.now();

    // Functional Payment Tracking Fields
    private String transactionId; // Stores the 12-digit UTR
    private LocalDateTime paymentInitiatedAt;
    private LocalDateTime paymentCompletedAt;
    private LocalDateTime confirmedAt;

    public static enum Status { 
        PENDING,   // Request sent to host
        ACCEPTED,  // Approved by host, awaiting passenger payment
        REJECTED,  // Declined
        PAID,      // Receipt submitted, awaiting verification (optional step)
        CONFIRMED,  // Verified by system, seats deducted, journey secured
        COMPLETED
        }

    public Booking(){}

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getRideId() { return rideId; }
    public void setRideId(Long rideId) { this.rideId = rideId; }
    public Long getRequesterId() { return requesterId; }
    public void setRequesterId(Long requesterId) { this.requesterId = requesterId; }
    public String getRequesterName() { return requesterName; }
    public void setRequesterName(String requesterName) { this.requesterName = requesterName; }
    public String getRequesterEmail() { return requesterEmail; }
    public void setRequesterEmail(String requesterEmail) { this.requesterEmail = requesterEmail; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public int getSeatsRequested() { return seatsRequested; }
    public void setSeatsRequested(int seatsRequested) { this.seatsRequested = seatsRequested; }
    public LocalDateTime getRequestedAt() { return requestedAt; }
    public void setRequestedAt(LocalDateTime requestedAt) { this.requestedAt = requestedAt; }
    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }
    
    public LocalDateTime getPaymentInitiatedAt() { return paymentInitiatedAt; }
    public void setPaymentInitiatedAt(LocalDateTime paymentInitiatedAt) { this.paymentInitiatedAt = paymentInitiatedAt; }
    public LocalDateTime getPaymentCompletedAt() { return paymentCompletedAt; }
    public void setPaymentCompletedAt(LocalDateTime paymentCompletedAt) { this.paymentCompletedAt = paymentCompletedAt; }
    public LocalDateTime getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(LocalDateTime confirmedAt) { this.confirmedAt = confirmedAt; }
}