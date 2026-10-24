package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.PartUsage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PartUsageRepository extends JpaRepository<PartUsage, Long> {

    List<PartUsage> findAllByRepairItem_Id(Long repairItemId);
}
