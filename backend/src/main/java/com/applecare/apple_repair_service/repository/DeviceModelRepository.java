package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.DeviceModel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeviceModelRepository extends JpaRepository<DeviceModel, Long> {
    @org.springframework.data.jpa.repository.Query("select m from DeviceModel m where m.status = com.applecare.apple_repair_service.enums.ActiveStatus.ACTIVE and m.deviceType.status = com.applecare.apple_repair_service.enums.ActiveStatus.ACTIVE and (:deviceTypeId is null or m.deviceType.id = :deviceTypeId) order by m.name, m.id")
    List<DeviceModel> findPublicModels(@org.springframework.data.repository.query.Param("deviceTypeId") Long deviceTypeId);

    List<DeviceModel> findAllByDeviceType_Id(Long deviceTypeId);

    boolean existsByDeviceType_IdAndNameIgnoreCase(Long deviceTypeId, String name);
}
