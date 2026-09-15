package com.applecare.apple_repair_service.controller;

import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminConfigurationController {
    private final SystemSettingService settings;
    private final AppointmentSlotService slots;
    private final TechnicianScheduleService schedules;
    private final StatisticsService statistics;

    @GetMapping("/system-settings")
    public List<SystemSettingResponse> settings() { return settings.list(); }
    @PutMapping("/system-settings/{key}")
    public SystemSettingResponse setting(@PathVariable String key, @Valid @RequestBody UpdateSystemSettingRequest request) {
        return settings.update(key, request);
    }
    @PostMapping("/appointment-slots")
    @ResponseStatus(HttpStatus.CREATED)
    public SlotAvailabilityResponse createSlot(@Valid @RequestBody SaveAppointmentSlotRequest request) { return slots.create(request); }
    @PutMapping("/appointment-slots/{id}")
    public SlotAvailabilityResponse updateSlot(@PathVariable @Positive Long id, @Valid @RequestBody SaveAppointmentSlotRequest request) {
        return slots.update(id, request);
    }
    @GetMapping("/appointment-slots")
    public List<SlotAvailabilityResponse> slots(@RequestParam @Positive Long branchId, @RequestParam LocalDate date) {
        return slots.list(branchId, date);
    }
    @GetMapping("/appointment-slots/{id}")
    public SlotAvailabilityResponse slot(@PathVariable @Positive Long id) { return slots.getById(id); }
    @DeleteMapping("/appointment-slots/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSlot(@PathVariable @Positive Long id) { slots.delete(id); }
    @PostMapping("/appointment-slots/{id}/open")
    public SlotAvailabilityResponse open(@PathVariable @Positive Long id) { return slots.open(id); }
    @PostMapping("/appointment-slots/{id}/close")
    public SlotAvailabilityResponse close(@PathVariable @Positive Long id) { return slots.close(id); }
    @PostMapping("/technician-schedules")
    @ResponseStatus(HttpStatus.CREATED)
    public TechnicianScheduleResponse createSchedule(@Valid @RequestBody CreateTechnicianScheduleRequest request) { return schedules.create(request); }
    @PutMapping("/technician-schedules/{id}")
    public TechnicianScheduleResponse updateSchedule(@PathVariable @Positive Long id, @Valid @RequestBody UpdateTechnicianScheduleRequest request) {
        return schedules.update(id, request);
    }
    @GetMapping("/technician-schedules")
    public List<TechnicianScheduleResponse> schedules(@RequestParam @Positive Long technicianId, @RequestParam LocalDate date) {
        return schedules.listByTechnicianAndDate(technicianId, date);
    }
    @DeleteMapping("/technician-schedules/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSchedule(@PathVariable @Positive Long id) { schedules.delete(id); }
    @GetMapping("/statistics/overview")
    public StatisticsOverviewResponse statistics(@RequestParam LocalDate from, @RequestParam LocalDate to,
            @RequestParam(required=false) @Positive Long branchId, @RequestParam(required=false) @Positive Long deviceTypeId) {
        return statistics.overview(from, to, branchId, deviceTypeId);
    }
}
