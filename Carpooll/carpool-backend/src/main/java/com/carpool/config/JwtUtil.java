// src/main/java/com/carpool/config/JwtUtil.java
package com.carpool.config;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {
    private final Key key = Keys.hmacShaKeyFor("verysecretkeyforcarpoolapp-please-change-this!!!".getBytes());
    private final long validity = 1000L * 60 * 60 * 24; // 24 hours

    public String generateToken(String email){
        return Jwts.builder()
                .setSubject(email)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + validity))
                .signWith(key)
                .compact();
    }

    // New: Generate token valid for only 20 minutes
    public String generateResetToken(String email){
        long resetValidity = 1000L * 60 * 20; // 20 Minutes
        return Jwts.builder()
                .setSubject(email)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + resetValidity))
                .signWith(key)
                .compact();
    }

    public String extractEmail(String token){
        try {
            return Jwts.parserBuilder().setSigningKey(key).build()
                    .parseClaimsJws(token).getBody().getSubject();
        } catch (Exception e){
            return null;
        }
    }
}