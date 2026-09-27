package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.AppointmentSlotStatus;
import com.applecare.apple_repair_service.repository.*;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import com.applecare.apple_repair_service.exception.AppointmentSlotConflictException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AppointmentScheduleService {
    private final AppointmentWeeklyScheduleRepository weekly;
    private final AppointmentDateOverrideRepository overrides;
    private final AppointmentSlotRepository slots;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final ObjectMapper json;
    private final Clock clock;

    public List<WeeklyScheduleResponse> week(Long branchId) {
        access.get(Branch.class, branchId);
        var byDay = new HashMap<Integer, AppointmentWeeklySchedule>();
        weekly.findAllByBranch_IdOrderByWeekday(branchId).forEach(item -> byDay.put(item.getWeekday(), item));
        var result = new ArrayList<WeeklyScheduleResponse>();
        for (int day = 1; day <= 7; day++) {
            var item = byDay.get(day);
            result.add(item == null ? new WeeklyScheduleResponse(branchId, day, false, List.of())
                    : new WeeklyScheduleResponse(branchId, day, item.isEnabled(), decode(item.getSlotsJson())));
        }
        return result;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public WeeklyScheduleResponse saveWeekday(SaveWeeklyScheduleRequest request) {
        return saveWeekdays(List.of(request)).getFirst();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public List<WeeklyScheduleResponse> saveWeekdays(List<SaveWeeklyScheduleRequest> requests) {
        BusinessRules.require(requests != null && !requests.isEmpty() && requests.size() <= 7,
                "Cần chọn từ một đến bảy ngày trong tuần.");
        var distinct = new HashSet<Integer>();
        Long branchId = requests.getFirst().branchId();
        for (var request : requests) {
            rules.validate(request);
            BusinessRules.require(Objects.equals(branchId, request.branchId()), "Các ngày phải thuộc cùng chi nhánh.");
            BusinessRules.require(distinct.add(request.weekday()), "Ngày trong tuần bị trùng.");
            BusinessRules.require(request.weekday() >= 1 && request.weekday() <= 7, "Ngày trong tuần không hợp lệ.");
            BusinessRules.require(!request.enabled() || !request.slots().isEmpty(), "Ngày đang mở phải có ít nhất một khung giờ.");
            validate(request.slots());
        }
        var branch = access.lock(Branch.class, branchId);
        var result = new ArrayList<WeeklyScheduleResponse>();
        for (var request : requests) result.add(upsertWeekday(branch, request));
        weekly.flush();
        return result;
    }

    private WeeklyScheduleResponse upsertWeekday(Branch branch, SaveWeeklyScheduleRequest request) {
        var item = weekly.findByBranch_IdAndWeekday(request.branchId(), request.weekday()).orElseGet(AppointmentWeeklySchedule::new);
        item.setBranch(branch);
        item.setWeekday(request.weekday());
        item.setEnabled(request.enabled());
        item.setSlotsJson(encode(request.slots()));
        weekly.save(item);
        return new WeeklyScheduleResponse(request.branchId(), request.weekday(), request.enabled(), request.slots());
    }

    public DateOverrideResponse override(Long branchId, LocalDate date) {
        access.get(Branch.class, branchId);
        BusinessRules.require(date != null, "Cần chọn ngày.");
        return overrides.findByBranch_IdAndAppointmentDate(branchId, date)
                .map(item -> new DateOverrideResponse(branchId, date, item.getMode(), decode(item.getSlotsJson())))
                .orElse(new DateOverrideResponse(branchId, date, "INHERIT", List.of()));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public DateOverrideResponse saveOverride(SaveDateOverrideRequest request) {
        rules.validate(request);
        BusinessRules.require(Set.of("INHERIT", "DISABLED", "REPLACE").contains(request.mode()), "Kiểu điều chỉnh ngày không hợp lệ.");
        BusinessRules.require(!request.mode().equals("REPLACE") || !request.slots().isEmpty(), "Cần ít nhất một khung giờ thay thế.");
        validate(request.slots());
        var branch = access.lock(Branch.class, request.branchId());
        var existing = overrides.findByBranch_IdAndAppointmentDate(request.branchId(), request.date());
        if (request.mode().equals("INHERIT")) {
            existing.ifPresent(overrides::delete);
            overrides.flush();
            materializeLocked(branch, request.date());
            return new DateOverrideResponse(request.branchId(), request.date(), "INHERIT", List.of());
        }
        var item = existing.orElseGet(AppointmentDateOverride::new);
        item.setBranch(branch);
        item.setAppointmentDate(request.date());
        item.setMode(request.mode());
        item.setSlotsJson(encode(request.slots()));
        overrides.saveAndFlush(item);
        materializeLocked(branch, request.date());
        return new DateOverrideResponse(request.branchId(), request.date(), item.getMode(), request.slots());
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void materialize(Long branchId, LocalDate date) {
        BusinessRules.require(date != null, "Cần chọn ngày.");
        var branch = access.lock(Branch.class, branchId);
        materializeLocked(branch, date);
    }

    private void materializeLocked(Branch branch, LocalDate date) {
        if (date.isBefore(LocalDate.now(clock))) return;
        var override = overrides.findByBranch_IdAndAppointmentDate(branch.getId(), date);
        var template = weekly.findByBranch_IdAndWeekday(branch.getId(), date.getDayOfWeek().getValue());
        if (override.isEmpty() && template.isEmpty()) return; // Untouched legacy dates retain their manual slots.
        List<SlotRule> effective = override.isPresent()
                ? override.get().getMode().equals("DISABLED") ? List.of() : decode(override.get().getSlotsJson())
                : template.get().isEnabled() ? decode(template.get().getSlotsJson()) : List.of();
        var desired = new HashMap<String, SlotRule>();
        effective.forEach(rule -> desired.put(key(rule), rule));
        var existing = slots.findAllByBranch_IdAndAppointmentDateOrderByStartTime(branch.getId(), date);
        for (var slot : existing) {
            var rule = desired.remove(key(slot));
            slot.setStatus(rule != null && rule.enabled() ? AppointmentSlotStatus.OPEN : AppointmentSlotStatus.CLOSED);
        }
        for (var rule : desired.values()) {
            var slot = new AppointmentSlot();
            slot.setBranch(branch);
            slot.setAppointmentDate(date);
            slot.setStartTime(rule.startTime());
            slot.setEndTime(rule.endTime());
            slot.setStatus(rule.enabled() ? AppointmentSlotStatus.OPEN : AppointmentSlotStatus.CLOSED);
            slots.save(slot);
        }
        slots.flush();
    }

    private static String key(SlotRule rule) { return rule.startTime() + "/" + rule.endTime(); }
    private static String key(AppointmentSlot slot) { return slot.getStartTime() + "/" + slot.getEndTime(); }

    private static void validate(List<SlotRule> rules) {
        BusinessRules.require(rules != null, "Danh sách khung giờ không được để trống.");
        BusinessRules.require(rules.size() <= 48, "Một ngày không thể có quá 48 khung giờ.");
        var unique = new HashSet<String>();
        for (var rule : rules) {
            BusinessRules.require(rule != null && rule.startTime() != null && rule.endTime() != null
                    && rule.startTime().isBefore(rule.endTime()), "Giờ bắt đầu phải trước giờ kết thúc.");
            if (!unique.add(key(rule)))
                throw new AppointmentSlotConflictException("Khung giờ " + display(rule) + " bị trùng.");
        }
        var enabled = rules.stream().filter(SlotRule::enabled)
                .sorted(Comparator.comparing(SlotRule::startTime).thenComparing(SlotRule::endTime)).toList();
        for (int index = 1; index < enabled.size(); index++) {
            var previous = enabled.get(index - 1);
            var current = enabled.get(index);
            if (current.startTime().isBefore(previous.endTime()))
                throw new AppointmentSlotConflictException("Khung giờ " + display(current)
                        + " chồng lấn với " + display(previous) + ".");
        }
    }

    private static String display(SlotRule rule) {
        return rule.startTime() + "–" + rule.endTime();
    }

    private String encode(List<SlotRule> rules) {
        try { return json.writeValueAsString(rules); }
        catch (Exception ex) { throw new IllegalStateException("Cannot encode appointment schedule", ex); }
    }
    private List<SlotRule> decode(String value) {
        try { return List.of(json.readValue(value, SlotRule[].class)); }
        catch (Exception ex) { throw new IllegalStateException("Cannot decode appointment schedule", ex); }
    }
}
