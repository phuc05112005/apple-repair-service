package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.MlPrediction;
import com.applecare.apple_repair_service.enums.PredictionType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MlPredictionRepository extends JpaRepository<MlPrediction, Long> {

    List<MlPrediction> findAllByServiceTicket_IdAndPredictionTypeOrderByPredictedAtDesc(
            Long serviceTicketId, PredictionType predictionType);

    Optional<MlPrediction> findFirstByServiceTicket_IdAndPredictionTypeOrderByPredictedAtDescIdDesc(
            Long serviceTicketId, PredictionType predictionType);

    Optional<MlPrediction> findFirstByServiceTicket_IdAndTechnician_IdAndPredictionTypeOrderByPredictedAtDescIdDesc(
            Long serviceTicketId, Long technicianId, PredictionType predictionType);

    Optional<MlPrediction> findFirstByServiceTicket_IdAndTechnicianIsNullAndPredictionTypeOrderByPredictedAtDescIdDesc(
            Long serviceTicketId, PredictionType predictionType);
}
