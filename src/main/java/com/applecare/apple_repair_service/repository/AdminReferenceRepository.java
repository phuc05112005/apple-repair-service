package com.applecare.apple_repair_service.repository;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class AdminReferenceRepository {
    private final EntityManager entityManager;

    public boolean branchIsReferenced(Long id) {
        return exists("select count(d) from DefectivePartReturn d where d.branch.id = :id", id)
                || exists("select count(s) from AppointmentSlot s where s.branch.id = :id", id)
                || exists("select count(s) from TechnicianSchedule s where s.branch.id = :id", id)
                || exists("select count(i) from BranchInventory i where i.branch.id = :id", id)
                || exists("select count(l) from InventoryLot l where l.branch.id = :id", id)
                || exists("select count(t) from InventoryTransaction t where t.sourceBranch.id = :id or t.destinationBranch.id = :id", id)
                || exists("select count(t) from ServiceTicket t where t.branch.id = :id", id);
    }

    public boolean deviceTypeIsReferenced(Long id) {
        return exists("select count(m) from DeviceModel m where m.deviceType.id = :id", id);
    }

    public boolean deviceModelIsReferenced(Long id) {
        return exists("select count(c) from ServiceCatalogItem c where c.deviceModel.id = :id", id)
                || exists("select count(d) from AppointmentDevice d where d.deviceModel.id = :id", id)
                || exists("select count(d) from CustomerDevice d where d.deviceModel.id = :id", id);
    }

    public boolean serviceIssueIsReferenced(Long id) {
        return exists("select count(c) from ServiceCatalogItem c where c.serviceIssue.id = :id", id);
    }

    public boolean serviceTypeIsReferenced(Long id) {
        return exists("select count(c) from ServiceCatalogItem c where c.serviceType.id = :id", id);
    }

    public boolean serviceCatalogItemIsReferenced(Long id) {
        return exists("select count(i) from AppointmentServiceItem i where i.serviceCatalogItem.id = :id", id)
                || exists("select count(i) from RepairItem i where i.serviceCatalogItem.id = :id", id)
                || exists("select count(i) from RepairItem i where i.warrantyReplacementCatalog.id = :id", id)
                || exists("select count(c) from ServiceCatalogItem c where c.warrantyReplacementCatalog.id = :id and c.id <> :id", id);
    }

    public boolean partIsReferenced(Long id) {
        return exists("select count(d) from DefectivePartReturn d where d.part.id = :id", id)
                || exists("select count(c) from ServiceCatalogItem c where c.part.id = :id", id)
                || exists("select count(i) from BranchInventory i where i.part.id = :id", id)
                || exists("select count(l) from InventoryLot l where l.part.id = :id", id)
                || exists("select count(u) from PartUsage u where u.part.id = :id", id)
                || exists("select count(t) from InventoryTransaction t where t.part.id = :id", id);
    }

    private boolean exists(String query, Long id) {
        return entityManager.createQuery(query, Long.class).setParameter("id", id).getSingleResult() > 0;
    }
}
