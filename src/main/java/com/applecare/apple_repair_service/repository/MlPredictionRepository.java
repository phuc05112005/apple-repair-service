package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.MlPrediction;
import com.applecare.apple_repair_service.enums.PredictionType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;


public interface MlPredictionRepository extends JpaRepository<MlPrediction, Long> {

    List<MlPrediction> findAllByServiceTicket_IdAndPredictionTypeOrderByPredictedAtDesc(
            Long serviceTicketId, PredictionType predictionType);

    java.util.Optional<MlPrediction> findFirstByServiceTicket_IdAndPredictionTypeOrderByPredictedAtDescIdDesc(Long serviceTicketId, PredictionType predictionType);
}
