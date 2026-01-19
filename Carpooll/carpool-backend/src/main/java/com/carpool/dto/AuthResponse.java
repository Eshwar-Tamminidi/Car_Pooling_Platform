//src/main/java/com/carpool/dto/AuthResponse.java
package com.carpool.dto;

import com.carpool.model.User;

public class AuthResponse {
    public String token;
    public Long id;
    public String email;
    public String fullname;
    public String role;

    public AuthResponse() {}

    public AuthResponse(String token, User user){
        this.token = token;
        this.id = user.getId();
        this.email = user.getEmail();
        this.fullname = user.getFullname();
        this.role = user.getRole();
    }

    // getters (optional)
    public String getToken() { return token; }
    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getFullname() { return fullname; }
    public String getRole() { return role; }
}
