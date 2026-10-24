package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateTechnicianScheduleRequest;
import com.applecare.apple_repair_service.dto.request.UpdateTechnicianScheduleRequest;
import com.applecare.apple_repair_service.dto.response.TechnicianScheduleResponse;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.entity.TechnicianSchedule;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.enums.TechnicianScheduleStatus;
import com.applecare.apple_repair_service.enums.UserRole;
import com.applecare.apple_repair_service.enums.UserStatus;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.TechnicianScheduleRepository;
import com.applecare.apple_repair_service.exception.ConflictException;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.TreeSet;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TechnicianScheduleService {
    private final TechnicianScheduleRepository repository;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TechnicianScheduleResponse create(CreateTechnicianScheduleRequest r) {
        rules.validate(r);
        access.lock(User.class, r.technicianId());
        var s = new TechnicianSchedule();
        apply(s, new UpdateTechnicianScheduleRequest(r.technicianId(), r.branchId(), r.workDate(), r.startTime(), r.endTime(), r.status()));
        return mapper.map(repository.saveAndFlush(s));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TechnicianScheduleResponse update(Long id, UpdateTechnicianScheduleRequest r) {
        rules.validate(r);
        var initial = access.get(TechnicianSchedule.class, id);
        var ids = new TreeSet<Long>(List.of(initial.getTechnician().getId(), r.technicianId()));
        ids.forEach(userId -> access.lock(User.class, userId));
        var s = access.lock(TechnicianSchedule.class, id);
        apply(s, r);
        return mapper.map(s);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void delete(Long id) {
        var schedule = access.lock(TechnicianSchedule.class, id);
        try {
            repository.delete(schedule);
            repository.flush();
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Không thể xóa lịch kỹ thuật viên vì dữ liệu này đang được sử dụng.", ex);
        }
    }

    public TechnicianScheduleResponse getById(Long id) {
        return mapper.map(access.get(TechnicianSchedule.class, id));
    }

    public List<TechnicianScheduleResponse> listByTechnicianAndDate(Long technicianId, LocalDate date) {
        return repository.findAllByTechnician_IdAndWorkDate(technicianId, date).stream().map(mapper::map).toList();
    }

    private void apply(TechnicianSchedule s, UpdateTechnicianScheduleRequest r) {
        var user = access.get(User.class, r.technicianId());
        BusinessRules.require(user.getRole() == UserRole.RECEPTIONIST || user.getRole() == UserRole.TECHNICIAN,
                "Chỉ nhân viên tiếp nhận và kỹ thuật viên được xếp ca làm.");
        BusinessRules.require(user.getStatus() == UserStatus.ACTIVE, "Nhân viên đã ngừng hoạt động.");
        var branch = access.get(Branch.class, r.branchId());
        BusinessRules.require(branch.getStatus() == ActiveStatus.ACTIVE, "Branch is inactive");
        BusinessRules.require(r.startTime().isBefore(r.endTime()), "Shift start must be before end");
        if (r.status() != TechnicianScheduleStatus.CANCELLED) {
            boolean overlap = repository.findAllByTechnician_IdAndWorkDate(r.technicianId(), r.workDate()).stream()
                    .anyMatch(x -> !Objects.equals(x.getId(), s.getId()) && x.getStatus() != TechnicianScheduleStatus.CANCELLED
                            && r.startTime().isBefore(x.getEndTime()) && r.endTime().isAfter(x.getStartTime()));
            BusinessRules.require(!overlap, "Ca làm của nhân viên bị trùng giờ.");
        }
        s.setTechnician(user);
        s.setBranch(branch);
        s.setWorkDate(r.workDate());
        s.setStartTime(r.startTime());
        s.setEndTime(r.endTime());
        s.setStatus(r.status());
    }
}
