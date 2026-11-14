package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceCatalogItem;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.PredictionSource;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.integration.ml.MlPredictionClient;
import com.applecare.apple_repair_service.integration.ml.MlServiceUnavailableException;
import com.applecare.apple_repair_service.repository.RepairItemRepository;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class MlCandidateEstimateService {
    private final MlPredictionClient client;
    private final RepairItemRepository items;
    private final DomainAccess access;

    public Map<Long, TechnicalEstimate> estimate(ServiceTicket ticket, List<Long> candidateIds,
                                                 OffsetDateTime evaluationTimestamp) {
        return estimateForCatalogItems(ticket, candidateIds, null, evaluationTimestamp);
    }

    public Map<Long, TechnicalEstimate> estimateForCatalogItems(ServiceTicket ticket, List<Long> candidateIds,
                                                                List<Long> serviceCatalogItemIds,
                                                                OffsetDateTime evaluationTimestamp) {
        boolean hasOverride = serviceCatalogItemIds != null && !serviceCatalogItemIds.isEmpty();
        long fallbackMinutes = hasOverride
                ? standardDurationForCatalogItems(serviceCatalogItemIds)
                : standardDuration(ticket.getId());
        if (!supported(ticket, hasOverride))
            return fallback(candidateIds, fallbackMinutes, "UNSUPPORTED_PREDICTION_CONTEXT");
        try {
            var response = client.predictCandidates(ticket.getId(), candidateIds, serviceCatalogItemIds, evaluationTimestamp);
            var byTechnician = response.predictions().stream().collect(Collectors.toMap(
                    MlPredictionClient.CandidatePrediction::technicianId, Function.identity()));
            var result = new LinkedHashMap<Long, TechnicalEstimate>();
            for (var candidateId : candidateIds) {
                var prediction = byTechnician.get(candidateId);
                if (prediction == null) {
                    result.put(candidateId, fallback(candidateId, fallbackMinutes, "MISSING_ML_CANDIDATE"));
                    continue;
                }

                var warnings = safeWarnings(prediction.warnings());
                boolean isColdStartOrOutOfBounds = warnings.contains("UNKNOWN_TECHNICIAN")
                        || warnings.contains("UNKNOWN_SERVICE_ISSUE")
                        || warnings.contains("UNKNOWN_DEVICE_MODEL")
                        || warnings.contains("TOO_MANY_SERVICES")
                        || warnings.contains("CATALOG_OUT_OF_BOUNDS")
                        || warnings.contains("NO_REPAIR_ITEMS");

                if (isColdStartOrOutOfBounds) {
                    result.put(candidateId, new TechnicalEstimate(candidateId,
                            (double) fallbackMinutes, fallbackMinutes,
                            PredictionSource.STANDARD_DURATION_FALLBACK, warnings, response.model().name(),
                            response.model().version(), response.model().status(), response.model().featureContractVersion(),
                            Boolean.TRUE.equals(response.model().syntheticData()),
                            Boolean.TRUE.equals(response.model().productionValidated()), evaluationTimestamp));
                } else {
                    result.put(candidateId, new TechnicalEstimate(candidateId,
                            prediction.predictedTechnicalMinutes(), rounded(prediction.predictedTechnicalMinutes()),
                            PredictionSource.ML, warnings, response.model().name(),
                            response.model().version(), response.model().status(), response.model().featureContractVersion(),
                            Boolean.TRUE.equals(response.model().syntheticData()),
                            Boolean.TRUE.equals(response.model().productionValidated()), evaluationTimestamp));
                }
            }
            log.info("Candidate duration estimates ready ticketId={} candidateCount={} catalogOverrideCount={} predictionSource=ML modelVersion={}",
                    ticket.getId(), candidateIds.size(), hasOverride ? serviceCatalogItemIds.size() : 0, response.model().version());
            return java.util.Collections.unmodifiableMap(result);
        } catch (MlServiceUnavailableException exception) {
            log.warn("Candidate duration fallback ticketId={} candidateCount={} predictionSource=STANDARD_DURATION_FALLBACK reason={}",
                    ticket.getId(), candidateIds.size(), exception.reasonCode());
            return fallback(candidateIds, fallbackMinutes, exception.reasonCode());
        }
    }

    public long standardDurationForCatalogItems(List<Long> catalogItemIds) {
        long total = catalogItemIds.stream()
                .map(id -> access.get(ServiceCatalogItem.class, id))
                .filter(catalog -> catalog != null && catalog.getStatus() == ActiveStatus.ACTIVE)
                .map(ServiceCatalogItem::getStandardDurationMinutes)
                .filter(minutes -> minutes != null && minutes > 0)
                .mapToLong(Integer::longValue)
                .sum();
        BusinessRules.require(total > 0, "Dịch vụ được chọn chưa có thời lượng tiêu chuẩn hợp lệ.");
        return total;
    }

    public long standardDuration(Long ticketId) {
        long total = items.findAllByServiceTicket_Id(ticketId).stream()
                .filter(item -> item.getApprovalStatus() != ApprovalStatus.REJECTED)
                .map(this::effectiveCatalog).filter(catalog -> catalog != null && catalog.getStatus() == ActiveStatus.ACTIVE)
                .map(ServiceCatalogItem::getStandardDurationMinutes).filter(minutes -> minutes != null && minutes > 0)
                .mapToLong(Integer::longValue).sum();
        BusinessRules.require(total > 0, "Phiếu dịch vụ chưa có thời lượng tiêu chuẩn hợp lệ.");
        return total;
    }

    private boolean supported(ServiceTicket ticket, boolean hasCatalogOverride) {
        if (ticket.getStatus() == ServiceTicketStatus.CANCELLED || ticket.getStatus() == ServiceTicketStatus.HANDED_OVER) {
            return false;
        }
        if (hasCatalogOverride) return true;
        var approved = items.findAllByServiceTicket_Id(ticket.getId()).stream()
                .filter(item -> item.getApprovalStatus() == ApprovalStatus.APPROVED).toList();
        return !approved.isEmpty() && approved.stream().allMatch(item -> effectiveCatalog(item) != null);
    }

    private ServiceCatalogItem effectiveCatalog(RepairItem item) {
        return item.getWarrantyReplacementCatalog() != null
                ? item.getWarrantyReplacementCatalog() : item.getServiceCatalogItem();
    }

    private Map<Long, TechnicalEstimate> fallback(List<Long> candidateIds, long minutes, String reason) {
        log.info("Candidate duration fallback ticketIdContext=unsupported candidateCount={} predictionSource=STANDARD_DURATION_FALLBACK reason={}",
                candidateIds.size(), reason);
        var result = new LinkedHashMap<Long, TechnicalEstimate>();
        candidateIds.forEach(id -> result.put(id, fallback(id, minutes, reason)));
        return java.util.Collections.unmodifiableMap(result);
    }

    private TechnicalEstimate fallback(Long candidateId, long minutes, String reason) {
        return new TechnicalEstimate(candidateId, (double) minutes, minutes,
                PredictionSource.STANDARD_DURATION_FALLBACK, List.of(reason),
                null, null, null, null, false, false, null);
    }

    private static long rounded(double value) {
        return Math.max(1, Math.round(value));
    }

    private static List<String> safeWarnings(List<String> warnings) {
        return warnings == null ? List.of() : List.copyOf(warnings);
    }

    public record TechnicalEstimate(Long technicianId, double predictedTechnicalMinutes, long durationMinutes,
                                    PredictionSource source, List<String> warnings, String modelName,
                                    String modelVersion, String modelStatus, String featureContractVersion,
                                    boolean syntheticData, boolean productionValidated,
                                    OffsetDateTime evaluationTimestamp) {}
}