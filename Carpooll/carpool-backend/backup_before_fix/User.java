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
    private String role; // "USER" or "ADMIN"
    private String phone;

    // constructors, getters/setters
    public User(){}

    public User(String fullname, String email, String password, String role) {
        this.fullname = fullname;
        this.email = email;
        this.password = password;
        this.role = role;
    }
    // getters + setters...
    // (omit for brevity here; include them in your file or use Lombok's @Data)
}
