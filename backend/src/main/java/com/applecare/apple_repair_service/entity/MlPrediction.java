package com.applecare.apple_repair_service.entity;

import com.applecare.apple_repair_service.enums.PredictionType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ml_predictions", indexes = {
        @Index(name = "idx_ml_predictions_ticket_type_predicted_at",
                columnList = "service_ticket_id, prediction_type, predicted_at"),
        @Index(name = "idx_ml_predictions_technician_type_predicted_at",
                columnList = "technician_id, prediction_type, predicted_at")
})
@Getter
@Setter
@NoArgsConstructor
public class MlPrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_ticket_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_ml_predictions_service_ticket"))
    private ServiceTicket serviceTicket;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "technician_id",
            foreignKey = @ForeignKey(name = "fk_ml_predictions_technician"))
    private User technician;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "prediction_type", nullable = false)
    private PredictionType predictionType;

    @Column(name = "predicted_duration_minutes")
    private Integer predictedDurationMinutes;

    @Column(name = "predicted_satisfaction")
    private Boolean predictedSatisfaction;

    @DecimalMin("0.0000")
    @DecimalMax("1.0000")
    @Column(name = "confidence", precision = 5, scale = 4)
    private BigDecimal confidence;

    @NotBlank
    @Column(name = "model_name", nullable = false)
    private String modelName;

    @NotBlank
    @Column(name = "model_version", nullable = false)
    private String modelVersion;

    @NotNull
    @Column(name = "predicted_at", nullable = false)
    private LocalDateTime predictedAt;
}
