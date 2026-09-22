package com.applecare.apple_repair_service.entity;
import com.applecare.apple_repair_service.enums.DefectivePartStatus;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import java.time.LocalDateTime;
@Entity @Getter @Setter @NoArgsConstructor
@Table(name="defective_part_returns", uniqueConstraints=@UniqueConstraint(name="uk_defective_source_usage",columnNames="source_part_usage_id"),
 indexes=@Index(name="idx_defective_branch_part_status",columnList="branch_id,part_id,status"))
public class DefectivePartReturn {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @NotNull @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="branch_id",nullable=false,foreignKey=@ForeignKey(name="fk_defective_branch")) private Branch branch;
 @NotNull @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="part_id",nullable=false,foreignKey=@ForeignKey(name="fk_defective_part")) private Part part;
 @NotNull @OneToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="source_part_usage_id",nullable=false,foreignKey=@ForeignKey(name="fk_defective_usage")) private PartUsage sourcePartUsage;
 @NotNull @Positive @Column(nullable=false) private Integer quantity;
 @NotNull @Enumerated(EnumType.STRING) @Column(nullable=false) private DefectivePartStatus status=DefectivePartStatus.IN_STOCK;
 @NotBlank @Column(nullable=false,columnDefinition="TEXT") private String reason;
 @Column(columnDefinition="TEXT") private String note;
 @NotNull @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="recorded_by",nullable=false,foreignKey=@ForeignKey(name="fk_defective_recorder")) private User recordedBy;
 @NotNull @Column(name="received_at",nullable=false) private LocalDateTime receivedAt;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="status_changed_by",foreignKey=@ForeignKey(name="fk_defective_status_actor")) private User statusChangedBy;
 @Column(name="status_changed_at") private LocalDateTime statusChangedAt;
}
