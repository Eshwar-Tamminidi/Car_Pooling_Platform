package com.carpool.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"bookingId", "reviewerId"})
        }
)
public class RatingReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long bookingId;

    private Long reviewerId;   // who gives rating
    private Long revieweeId;   // who receives rating

    public Role getReviewerRole() {
        return reviewerRole;
    }

    public void setReviewerRole(Role reviewerRole) {
        this.reviewerRole = reviewerRole;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @Enumerated(EnumType.STRING)
    private Role reviewerRole; // DRIVER or PASSENGER

    private int stars;

    @Column(length = 1000)
    private String review;

    private LocalDateTime createdAt = LocalDateTime.now();

    public enum Role {
        DRIVER,
        PASSENGER
    }

    // getters & setters


    // Getters & Setters
    public Long getId() { return id; }
    public Long getBookingId() { return bookingId; }
    public void setBookingId(Long bookingId) { this.bookingId = bookingId; }

    public Long getReviewerId() { return reviewerId; }
    public void setReviewerId(Long reviewerId) { this.reviewerId = reviewerId; }

    public Long getRevieweeId() { return revieweeId; }
    public void setRevieweeId(Long revieweeId) { this.revieweeId = revieweeId; }

    public int getStars() { return stars; }
    public void setStars(int stars) { this.stars = stars; }

    public String getReview() { return review; }
    public void setReview(String review) { this.review = review; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
