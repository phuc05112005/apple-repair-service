package com.applecare.apple_repair_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class AppleRepairServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(AppleRepairServiceApplication.class, args);
	}

}
