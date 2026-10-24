package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.TechnicianScheduleStatus;
import com.applecare.apple_repair_service.enums.UserRole;
import com.applecare.apple_repair_service.enums.UserStatus;
import com.applecare.apple_repair_service.repository.TechnicianScheduleRepository;

import java.time.Clock;
import java.time.LocalDateTime;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TechnicianEligibility {
    private final DomainAccess access;
    private final TechnicianScheduleRepository schedules;
    private final Clock clock;

    User technician(Long id) {
        var user = access.get(User.class, id);
        BusinessRules.require(user.getRole() == UserRole.TECHNICIAN, "User is not a technician");
        BusinessRules.require(user.getStatus() == UserStatus.ACTIVE, "Technician is inactive");
        return user;
    }

    User available(Long id, Long branchId) {
        var user = technician(id);
        var now = LocalDateTime.now(clock);
        BusinessRules.require(schedules.findAllByTechnician_IdAndWorkDate(id, now.toLocalDate()).stream()
                .anyMatch(s -> s.getStatus() == TechnicianScheduleStatus.WORKING && s.getBranch().getId().equals(branchId)
                        && !now.toLocalTime().isBefore(s.getStartTime()) && now.toLocalTime().isBefore(s.getEndTime())), "Technician has no current working shift at ticket branch");
        return user;
    }
}
