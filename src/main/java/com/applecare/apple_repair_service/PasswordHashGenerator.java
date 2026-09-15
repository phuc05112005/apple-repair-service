package com.applecare.apple_repair_service;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class PasswordHashGenerator {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);

        String rawPassword = "123456";
        String hash = encoder.encode(rawPassword);

        System.out.println(hash);
    }
}

