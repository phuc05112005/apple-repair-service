package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;

import java.time.Clock;
import java.time.format.DateTimeFormatter;
import java.time.LocalDate;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TicketCodeGenerator {
    private final ServiceTicketRepository tickets;
    private final Clock clock;

    public String next() {
        for (int i = 0; i < 5; i++) {
            String code = "ST-" + LocalDate.now(clock).format(DateTimeFormatter.BASIC_ISO_DATE) + "-" + UUID.randomUUID().toString().replace("-", "");
            if (tickets.findByTicketCode(code).isEmpty()) return code;
        }
        throw new ConflictException("Unable to allocate a unique ticket code");
    }
}
