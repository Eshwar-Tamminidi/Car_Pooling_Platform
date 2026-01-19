//src/main/java/com/carpool/model/Car.java
package com.carpool.model;

import jakarta.persistence.*;

@Entity
public class Car {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long ownerId;
    private String name;
    private String number;

    // Use LOB (Large Object) to store Base64 image strings
    @Lob
    @Column(length = 1000000)
    private String imageUrl;

    public Car() {}

    public Car(Long ownerId, String name, String number, String imageUrl) {
        this.ownerId = ownerId;
        this.name = name;
        this.number = number;
        this.imageUrl = imageUrl;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
}