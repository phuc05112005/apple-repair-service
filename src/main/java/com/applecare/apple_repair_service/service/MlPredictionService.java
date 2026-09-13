package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateMlPredictionRequest;
import com.applecare.apple_repair_service.dto.response.MlPredictionResponse;
import com.applecare.apple_repair_service.entity.MlPrediction;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.enums.PredictionType;
import com.applecare.apple_repair_service.exception.ResourceNotFoundException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.MlPredictionRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MlPredictionService {
    private final MlPredictionRepository repository;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;
    private final Clock clock;

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public MlPredictionResponse savePrediction(CreateMlPredictionRequest r) {
        rules.validate(r);
        if (r.predictionType() == PredictionType.REPAIR_DURATION)
            BusinessRules.require(r.predictedDurationMinutes() != null && r.predictedSatisfaction() == null, "Duration prediction must only contain positive duration");
        else
            BusinessRules.require(r.predictedSatisfaction() != null && r.predictedDurationMinutes() == null, "Satisfaction prediction must only contain satisfaction");
        var p = new MlPrediction();
        p.setServiceTicket(access.get(ServiceTicket.class, r.serviceTicketId()));
        p.setPredictionType(r.predictionType());
        p.setPredictedDurationMinutes(r.predictedDurationMinutes());
        p.setPredictedSatisfaction(r.predictedSatisfaction());
        p.setConfidence(r.confidence());
        p.setModelName(r.modelName().trim());
        p.setModelVersion(r.modelVersion().trim());
        p.setPredictedAt(LocalDateTime.now(clock));
        return mapper.map(repository.saveAndFlush(p));
    }

    public MlPredictionResponse getLatestPrediction(Long id, PredictionType type) {
        access.get(ServiceTicket.class, id);
        BusinessRules.require(type != null, "Prediction type required");
        return repository.findFirstByServiceTicket_IdAndPredictionTypeOrderByPredictedAtDescIdDesc(id, type).map(mapper::map).orElseThrow(() -> new ResourceNotFoundException("Prediction not found"));
    }

    public List<MlPredictionResponse> getPredictionHistory(Long id, PredictionType type) {
        access.get(ServiceTicket.class, id);
        BusinessRules.require(type != null, "Prediction type required");
        return repository.findAllByServiceTicket_IdAndPredictionTypeOrderByPredictedAtDesc(id, type).stream()
                .sorted(Comparator.comparing(MlPrediction::getPredictedAt).thenComparing(MlPrediction::getId).reversed()).map(mapper::map).toList();
    }
}
