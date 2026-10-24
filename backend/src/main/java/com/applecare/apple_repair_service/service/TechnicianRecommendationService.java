package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.response.TechnicianRecommendationResponse;
import com.applecare.apple_repair_service.entity.Assignment;
import com.applecare.apple_repair_service.entity.MlPrediction;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.TechnicianSchedule;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.AssignmentStatus;
import com.applecare.apple_repair_service.enums.PredictionType;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.enums.TechnicianScheduleStatus;
import com.applecare.apple_repair_service.enums.UserRole;
import com.applecare.apple_repair_service.enums.UserStatus;
import com.applecare.apple_repair_service.repository.AssignmentRepository;
import com.applecare.apple_repair_service.repository.MlPredictionRepository;
import com.applecare.apple_repair_service.repository.RepairItemRepository;
import com.applecare.apple_repair_service.repository.TechnicianScheduleRepository;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TechnicianRecommendationService {
    private final TechnicianScheduleRepository schedules;
    private final AssignmentRepository assignments;
    private final MlPredictionRepository predictions;
    private final RepairItemRepository items;
    private final DomainAccess access;
    private final MlCandidateEstimateService candidateEstimates;
    private final TimingSettings timingSettings;
    private final Clock clock;

    public List<TechnicianRecommendationResponse> recommend(Long ticketId) {
        var ticket = access.get(ServiceTicket.class, ticketId);
        var now = LocalDateTime.now(clock);
        var shifts = schedules.findAllByBranch_IdAndWorkDateAndStatus(ticket.getBranch().getId(), now.toLocalDate(), TechnicianScheduleStatus.WORKING);
        var latestEnds = new HashMap<Long, TechnicianSchedule>();
        for (var s : shifts) {
            var user = s.getTechnician();
            if (user.getRole() != UserRole.TECHNICIAN || user.getStatus() != UserStatus.ACTIVE || now.toLocalTime().isBefore(s.getStartTime()) || !now.toLocalTime().isBefore(s.getEndTime()))
                continue;
            latestEnds.merge(user.getId(), s, (a, b) -> a.getEndTime().isAfter(b.getEndTime()) ? a : b);
        }
        var evaluationTimestamp = OffsetDateTime.ofInstant(clock.instant(), clock.getZone());
        var candidateIds = latestEnds.keySet().stream().sorted().toList();
        var technicalEstimates = candidateIds.isEmpty() ? java.util.Map.<Long, MlCandidateEstimateService.TechnicalEstimate>of()
                : candidateEstimates.estimate(ticket, candidateIds, evaluationTimestamp);
        var timingShifts = schedules.findTimingSchedules(now.toLocalDate(), now.toLocalDate().plusDays(TimingSettings.SCHEDULE_HORIZON_DAYS));
        var breakMinutes = timingSettings.values().breakMinutes();
        var lastCompletions = new HashMap<Long, LocalDateTime>();
        for (var row : assignments.latestTechnicalCompletions())
            lastCompletions.put((Long) row[0], (LocalDateTime) row[1]);
        var result = new ArrayList<TechnicianRecommendationResponse>();
        for (var s : latestEnds.values()) {
            var user = s.getTechnician();
            var estimate = technicalEstimates.get(user.getId());
            long newJob = estimate.durationMinutes();
            var queue = assignments.findAllByTechnician_IdAndStatus(user.getId(), AssignmentStatus.ACTIVE).stream()
                    .filter(assignment -> occupiesQueue(assignment.getServiceTicket())).sorted(Comparator
                            .comparing(Assignment::getAssignedAt).thenComparing(Assignment::getId)).toList();
            long work = queue.stream().map(Assignment::getServiceTicket).map(ServiceTicket::getId).distinct()
                    .mapToLong(id -> estimate(id, user.getId())).sum();
            var cursor = now;
            var latest = lastCompletions.get(user.getId());
            if (latest != null && latest.plusMinutes(breakMinutes).isAfter(cursor)) cursor = latest.plusMinutes(breakMinutes);
            for (var assignment : queue) {
                var queued = assignment.getServiceTicket();
                if (queued.getEstimatedCompletionAt() != null) {
                    if (queued.getEstimatedCompletionAt().isAfter(cursor)) cursor = queued.getEstimatedCompletionAt();
                    cursor = cursor.plusMinutes(breakMinutes);
                } else {
                    var allocated = WorkCalendar.allocate(cursor, estimate(queued.getId(), user.getId()),
                            windows(timingShifts, user.getId(), ticket.getBranch().getId()));
                    if (allocated.completion() == null) { cursor = null; break; }
                    cursor = allocated.completion().plusMinutes(breakMinutes);
                }
            }
            var candidateRange = cursor == null ? new WorkCalendar.Estimate(null, null)
                    : WorkCalendar.allocate(cursor, newJob, windows(timingShifts, user.getId(), ticket.getBranch().getId()));
            long remaining = Duration.between(now, LocalDateTime.of(now.toLocalDate(), s.getEndTime())).toMinutes();
            boolean eligible = candidateRange.completion() != null;
            result.add(new TechnicianRecommendationResponse(user.getId(), user.getFullName(), ticket.getBranch().getId(),
                    work, newJob, remaining, candidateRange.start(), eligible,
                    eligible ? "Có thể xếp lịch theo ca làm việc hiện tại" : "Không tìm thấy đủ thời gian trong lịch làm việc",
                    queue.size(), estimate.predictedTechnicalMinutes(), estimate.source(), estimate.warnings(),
                    candidateRange.start(), candidateRange.completion(), estimate.modelStatus(),
                    estimate.syntheticData(), estimate.productionValidated()));
        }
        result.sort(Comparator.comparing(TechnicianRecommendationResponse::eligible).reversed()
                .thenComparing(TechnicianRecommendationResponse::estimatedCompletionAt,
                        Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparingLong(TechnicianRecommendationResponse::estimatedWorkloadMinutes).thenComparing(TechnicianRecommendationResponse::technicianId));
        return List.copyOf(result);
    }

    long estimate(Long id) {
        return estimate(id, null);
    }

    long estimate(Long id, Long technicianId) {
        var prediction = technicianId == null
                ? Optional.<MlPrediction>empty()
                : predictions.findFirstByServiceTicket_IdAndTechnician_IdAndPredictionTypeOrderByPredictedAtDescIdDesc(
                        id, technicianId, PredictionType.REPAIR_DURATION);
        if (prediction.isEmpty())
            prediction = predictions.findFirstByServiceTicket_IdAndTechnicianIsNullAndPredictionTypeOrderByPredictedAtDescIdDesc(
                    id, PredictionType.REPAIR_DURATION);
        if (prediction.isPresent() && prediction.get().getPredictedDurationMinutes() != null && prediction.get().getPredictedDurationMinutes() > 0)
            return prediction.get().getPredictedDurationMinutes();
        long total = items.findAllByServiceTicket_Id(id).stream().filter(i -> i.getApprovalStatus() != ApprovalStatus.REJECTED)
                .map(i -> i.getServiceCatalogItem().getStandardDurationMinutes()).filter(Objects::nonNull).filter(n -> n > 0).mapToLong(Integer::longValue).sum();
        BusinessRules.require(total > 0, "Phiếu dịch vụ chưa có thời lượng tiêu chuẩn hợp lệ.");
        return total;
    }

    private static boolean occupiesQueue(ServiceTicket ticket) {
        return ticket.getStatus() != ServiceTicketStatus.WAITING_PART
                && ticket.getStatus() != ServiceTicketStatus.WAITING_APPROVAL
                && ticket.getStatus() != ServiceTicketStatus.WAITING_HANDOVER
                && ticket.getStatus() != ServiceTicketStatus.HANDED_OVER
                && ticket.getStatus() != ServiceTicketStatus.CANCELLED;
    }

    private static List<WorkCalendar.Window> windows(List<TechnicianSchedule> shifts, long technicianId, long branchId) {
        return shifts.stream().filter(shift -> shift.getTechnician().getId() == technicianId
                        && shift.getBranch().getId() == branchId)
                .map(shift -> new WorkCalendar.Window(shift.getWorkDate().atTime(shift.getStartTime()),
                        shift.getWorkDate().atTime(shift.getEndTime()))).toList();
    }
}
