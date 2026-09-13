package com.applecare.apple_repair_service.service;
import com.applecare.apple_repair_service.dto.request.SaveAppointmentSlotRequest;
import com.applecare.apple_repair_service.dto.response.SlotAvailabilityResponse;
import com.applecare.apple_repair_service.entity.AppointmentSlot;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.enums.AppointmentSlotStatus;
import com.applecare.apple_repair_service.enums.AppointmentStatus;
import com.applecare.apple_repair_service.exception.DuplicateResourceException;
import com.applecare.apple_repair_service.repository.AppointmentRepository;
import com.applecare.apple_repair_service.repository.AppointmentSlotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AppointmentSlotService {
    private final AppointmentSlotRepository slots;
    private final AppointmentRepository appointments;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final Clock clock;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public SlotAvailabilityResponse create(SaveAppointmentSlotRequest request) {
        rules.validate(request);
        var slot = new AppointmentSlot();
        apply(slot, request);
        return save(slot);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public SlotAvailabilityResponse update(Long id, SaveAppointmentSlotRequest request) {
        rules.validate(request);
        var slot = access.lock(AppointmentSlot.class, id);
        boolean moved = !slot.getBranch().getId().equals(request.branchId())
                || !slot.getAppointmentDate().equals(request.slotDate())
                || !slot.getStartTime().equals(request.startTime()) || !slot.getEndTime().equals(request.endTime());
        BusinessRules.require(!moved || !appointments.existsByAppointmentSlot_Id(id), "A slot with booking history cannot be moved");
        apply(slot, request);
        return save(slot);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public SlotAvailabilityResponse open(Long id) {
        var slot = access.lock(AppointmentSlot.class, id);
        BusinessRules.require(slot.getBranch().getStatus() == ActiveStatus.ACTIVE, "Branch is inactive");
        slot.setStatus(AppointmentSlotStatus.OPEN);
        return response(slot);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public SlotAvailabilityResponse close(Long id) {
        var slot = access.lock(AppointmentSlot.class, id);
        slot.setStatus(AppointmentSlotStatus.CLOSED);
        return response(slot);
    }

    public SlotAvailabilityResponse getById(Long id) { return response(access.get(AppointmentSlot.class, id)); }

    public List<SlotAvailabilityResponse> list(Long branchId, LocalDate date) {
        access.get(Branch.class, branchId);
        BusinessRules.require(date != null, "Slot date is required");
        return slots.findAllByBranch_IdAndAppointmentDateOrderByStartTime(branchId, date).stream().map(this::response).toList();
    }

    public List<SlotAvailabilityResponse> availability(Long branchId, LocalDate date) {
        var branch = access.get(Branch.class, branchId);
        BusinessRules.require(date != null, "Slot date is required");
        if (branch.getStatus() != ActiveStatus.ACTIVE) return List.of();
        var now = LocalDateTime.now(clock);
        return slots.findAllByBranch_IdAndAppointmentDateAndStatusOrderByStartTime(branchId, date, AppointmentSlotStatus.OPEN)
                .stream().filter(s -> !LocalDateTime.of(s.getAppointmentDate(), s.getStartTime()).isBefore(now))
                .map(this::response).toList();
    }

    private void apply(AppointmentSlot slot, SaveAppointmentSlotRequest request) {
        BusinessRules.require(request.startTime().isBefore(request.endTime()), "Slot start must precede end");
        var branch = access.get(Branch.class, request.branchId());
        BusinessRules.require(branch.getStatus() == ActiveStatus.ACTIVE, "Branch is inactive");
        var duplicate = slots.findByBranch_IdAndAppointmentDateAndStartTimeAndEndTime(
                request.branchId(), request.slotDate(), request.startTime(), request.endTime());
        if (duplicate.isPresent() && !java.util.Objects.equals(duplicate.get().getId(), slot.getId()))
            throw new DuplicateResourceException("Slot already exists");
        slot.setBranch(branch);
        slot.setAppointmentDate(request.slotDate());
        slot.setStartTime(request.startTime());
        slot.setEndTime(request.endTime());
    }

    private SlotAvailabilityResponse save(AppointmentSlot slot) {
        try { return response(slots.saveAndFlush(slot)); }
        catch (DataIntegrityViolationException ex) { throw new DuplicateResourceException("Slot already exists"); }
    }

    private SlotAvailabilityResponse response(AppointmentSlot slot) {
        return new SlotAvailabilityResponse(slot.getId(), slot.getBranch().getId(), slot.getAppointmentDate(),
                slot.getStartTime(), slot.getEndTime(), slot.getStatus(),
                appointments.countByAppointmentSlot_IdAndStatusNotIn(slot.getId(), List.of(AppointmentStatus.CANCELLED, AppointmentStatus.EXPIRED)));
    }
}

