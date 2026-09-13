package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.response.TechnicianRecommendationResponse;
import com.applecare.apple_repair_service.entity.Assignment;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.TechnicianSchedule;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.AssignmentStatus;
import com.applecare.apple_repair_service.enums.PredictionType;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Objects;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TechnicianRecommendationService {
    public static final int DEFAULT_JOB_MINUTES = 60;
    private final TechnicianScheduleRepository schedules;
    private final AssignmentRepository assignments;
    private final MlPredictionRepository predictions;
    private final RepairItemRepository items;
    private final DomainAccess access;
    private final Clock clock;

    public List<TechnicianRecommendationResponse> recommend(Long ticketId) {
        var ticket = access.get(ServiceTicket.class, ticketId);
        var now = LocalDateTime.now(clock);
        long newJob = estimate(ticketId);
        var shifts = schedules.findAllByBranch_IdAndWorkDateAndStatus(ticket.getBranch().getId(), now.toLocalDate(), TechnicianScheduleStatus.WORKING);
        var latestEnds = new HashMap<Long, TechnicianSchedule>();
        for (var s : shifts) {
            var user = s.getTechnician();
            if (user.getRole() != UserRole.TECHNICIAN || user.getStatus() != UserStatus.ACTIVE || now.toLocalTime().isBefore(s.getStartTime()) || !now.toLocalTime().isBefore(s.getEndTime()))
                continue;
            latestEnds.merge(user.getId(), s, (a, b) -> a.getEndTime().isAfter(b.getEndTime()) ? a : b);
        }
        var result = new ArrayList<TechnicianRecommendationResponse>();
        for (var s : latestEnds.values()) {
            var user = s.getTechnician();
            long work = assignments.findAllByTechnician_IdAndStatus(user.getId(), AssignmentStatus.ACTIVE).stream()
                    .map(Assignment::getServiceTicket).map(ServiceTicket::getId).distinct().mapToLong(this::estimate).sum();
            long remaining = Duration.between(now, LocalDateTime.of(now.toLocalDate(), s.getEndTime())).toMinutes();
            boolean eligible = work + newJob <= remaining;
            result.add(new TechnicianRecommendationResponse(user.getId(), user.getFullName(), ticket.getBranch().getId(), work, newJob, remaining, now.plusMinutes(work), eligible, eligible ? "Fits current shift" : "Insufficient shift time"));
        }
        result.sort(Comparator.comparing(TechnicianRecommendationResponse::eligible).reversed()
                .thenComparing(TechnicianRecommendationResponse::estimatedAvailableAt)
                .thenComparingLong(TechnicianRecommendationResponse::estimatedWorkloadMinutes).thenComparing(TechnicianRecommendationResponse::technicianId));
        return List.copyOf(result);
    }

    long estimate(Long id) {
        var prediction = predictions.findFirstByServiceTicket_IdAndPredictionTypeOrderByPredictedAtDescIdDesc(id, PredictionType.REPAIR_DURATION);
        if (prediction.isPresent() && prediction.get().getPredictedDurationMinutes() != null && prediction.get().getPredictedDurationMinutes() > 0)
            return prediction.get().getPredictedDurationMinutes();
        long total = items.findAllByServiceTicket_Id(id).stream().filter(i -> i.getApprovalStatus() != ApprovalStatus.REJECTED)
                .map(i -> i.getServiceCatalogItem().getStandardDurationMinutes()).filter(Objects::nonNull).filter(n -> n > 0).mapToLong(Integer::longValue).sum();
        return total > 0 ? total : DEFAULT_JOB_MINUTES;
    }
}
