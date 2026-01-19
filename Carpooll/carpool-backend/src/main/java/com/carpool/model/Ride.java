// src/main/java/com/carpool/model/Ride.java
package com.carpool.model;

import jakarta.persistence.*;
import java.util.List;
import java.util.ArrayList;

@Entity
public class Ride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String driverName;
    private String ownerEmail;
    private Long ownerId;

    @Lob
    @Column(length = 1000000)
    private String driverPhotoUrl;

    private String fromLocation;
    private String toLocation;
    private String dateTime;

    // Optional: estimated completion (drop-off) date time to indicate when journey is expected to end
    private String estimatedCompletionDateTime;

    private int seatsAvailable;
    private double price;

    @Version
    private Integer version;

    // --- NEW FIELDS FOR MAPS & FARE ---
    private double distanceKm;
    
    // Coordinates (Lat/Lng)
    private double fromLat;
    private double fromLng;
    private double toLat;
    private double toLng;

    private String carName;
    private String vehicleNumber;

    @Lob
    @Column(length = 1000000)
    private String carImageUrl;

    @ElementCollection
    private List<String> pickupPoints = new ArrayList<>();

    @ElementCollection
    private List<String> dropoffPoints = new ArrayList<>();

    @ElementCollection
    private List<String> features = new ArrayList<>();

    @Column(length = 1000)
    private String description;

    public Ride() {}

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDriverName() { return driverName; }
    public void setDriverName(String driverName) { this.driverName = driverName; }
    public String getOwnerEmail() { return ownerEmail; }
    public void setOwnerEmail(String ownerEmail) { this.ownerEmail = ownerEmail; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public String getDriverPhotoUrl() { return driverPhotoUrl; }
    public void setDriverPhotoUrl(String driverPhotoUrl) { this.driverPhotoUrl = driverPhotoUrl; }
    public String getFromLocation() { return fromLocation; }
    public void setFromLocation(String fromLocation) { this.fromLocation = fromLocation; }
    public String getToLocation() { return toLocation; }
    public void setToLocation(String toLocation) { this.toLocation = toLocation; }
    public String getDateTime() { return dateTime; }
    public void setDateTime(String dateTime) { this.dateTime = dateTime; }

    public String getEstimatedCompletionDateTime() { return estimatedCompletionDateTime; }
    public void setEstimatedCompletionDateTime(String estimatedCompletionDateTime) { this.estimatedCompletionDateTime = estimatedCompletionDateTime; }
    public int getSeatsAvailable() { return seatsAvailable; }
    public void setSeatsAvailable(int seatsAvailable) { this.seatsAvailable = seatsAvailable; }
    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }

    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(double distanceKm) { this.distanceKm = distanceKm; }

    public double getFromLat() { return fromLat; }
    public void setFromLat(double fromLat) { this.fromLat = fromLat; }
    public double getFromLng() { return fromLng; }
    public void setFromLng(double fromLng) { this.fromLng = fromLng; }
    public double getToLat() { return toLat; }
    public void setToLat(double toLat) { this.toLat = toLat; }
    public double getToLng() { return toLng; }
    public void setToLng(double toLng) { this.toLng = toLng; }

    public String getCarName() { return carName; }
    public void setCarName(String carName) { this.carName = carName; }
    public String getVehicleNumber() { return vehicleNumber; }
    public void setVehicleNumber(String vehicleNumber) { this.vehicleNumber = vehicleNumber; }
    public String getCarImageUrl() { return carImageUrl; }
    public void setCarImageUrl(String carImageUrl) { this.carImageUrl = carImageUrl; }

    public List<String> getPickupPoints() { return pickupPoints; }
    public void setPickupPoints(List<String> pickupPoints) { this.pickupPoints = pickupPoints; }
    public List<String> getDropoffPoints() { return dropoffPoints; }
    public void setDropoffPoints(List<String> dropoffPoints) { this.dropoffPoints = dropoffPoints; }
    public List<String> getFeatures() { return features; }
    public void setFeatures(List<String> features) { this.features = features; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}