//src/main/java/com/carpool/model/User.java
package com.carpool.model;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fullname;
    @Column(unique = true)
    private String email;
    private String password;
    private String role;
    private String phone;
    private boolean isApproved = true;

    private String gender;

    @Lob
    @Column(length = 1000000)
    private String profilePhotoUrl;

    private double ratingSum = 0.0;
    private int ratingCount = 0;

    public User(){}

    public User(String fullname, String email, String password, String role, String phone, String gender) {
        this.fullname = fullname;
        this.email = email;
        this.password = password;
        this.role = role;
        this.phone = phone;
        this.gender = gender;
        this.isApproved = !"ADMIN".equalsIgnoreCase(role);
    }

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getFullname() { return fullname; }
    public void setFullname(String fullname) { this.fullname = fullname; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public boolean isApproved() { return isApproved; }
    public void setApproved(boolean approved) { isApproved = approved; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public String getProfilePhotoUrl() { return profilePhotoUrl; }
    public void setProfilePhotoUrl(String profilePhotoUrl) { this.profilePhotoUrl = profilePhotoUrl; }

    public double getAverageRating() {
        return ratingCount == 0 ? 0.0 : Math.round((ratingSum / ratingCount) * 10.0) / 10.0;
    }

    public void addRating(double stars) {
        this.ratingSum += stars;
        this.ratingCount++;
    }
}