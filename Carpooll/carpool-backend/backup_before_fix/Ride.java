package com.carpool.model;

import jakarta.persistence.*;

@Entity
public class Ride {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String driverName;
    private String fromLocation;
    private String toLocation;
    private String dateTime; // iso string or epoch - keep simple for now
    private int seatsAvailable;
    private double price;

    public Ride(){}

    public Ride(String driverName, String fromLocation, String toLocation, String dateTime, int seatsAvailable, double price) {
        this.driverName = driverName;
        this.fromLocation = fromLocation;
        this.toLocation = toLocation;
        this.dateTime = dateTime;
        this.seatsAvailable = seatsAvailable;
        this.price = price;
    }
    // getters & setters
}
