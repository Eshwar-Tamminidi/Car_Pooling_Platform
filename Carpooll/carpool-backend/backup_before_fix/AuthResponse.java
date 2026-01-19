package com.carpool.dto;

import com.carpool.model.User;

public class AuthResponse {
    public String token;
    public Long id;
    public String email;
    public String fullname;
    public String role;

    public AuthResponse(String token, User user){
        this.token = token;
        this.id = user.getId();
        this.email = user.getEmail();
        this.fullname = user.getFullname();
        this.role = user.getRole();
    }
}
