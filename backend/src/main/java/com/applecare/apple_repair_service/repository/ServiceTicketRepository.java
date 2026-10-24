package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;


public interface ServiceTicketRepository extends JpaRepository<ServiceTicket, Long> {
 @org.springframework.data.jpa.repository.Query("select t from ServiceTicket t join fetch t.branch where t.status=com.applecare.apple_repair_service.enums.ServiceTicketStatus.WAITING_ASSIGNMENT order by t.receivedAt,t.id")
 List<ServiceTicket> findUnassignedForTiming();


    @org.springframework.data.jpa.repository.Query("select new com.applecare.apple_repair_service.dto.response.StatusCountResponse(t.status, count(t)) from ServiceTicket t where t.receivedAt >= :from and t.receivedAt < :until and (:branchId is null or t.branch.id = :branchId) and (:deviceTypeId is null or t.customerDevice.deviceModel.deviceType.id = :deviceTypeId) group by t.status")
    java.util.List<com.applecare.apple_repair_service.dto.response.StatusCountResponse> countCurrentStatuses(@org.springframework.data.repository.query.Param("from") java.time.LocalDateTime from,
            @org.springframework.data.repository.query.Param("until") java.time.LocalDateTime until,
            @org.springframework.data.repository.query.Param("branchId") Long branchId,
            @org.springframework.data.repository.query.Param("deviceTypeId") Long deviceTypeId);

    @org.springframework.data.jpa.repository.Query("select coalesce(sum(i.finalPrice), 0) from RepairItem i join i.serviceTicket t where i.approvalStatus = com.applecare.apple_repair_service.enums.ApprovalStatus.APPROVED and t.paymentStatus = com.applecare.apple_repair_service.enums.PaymentStatus.PAID and t.paidAt >= :from and t.paidAt < :until and (:branchId is null or t.branch.id = :branchId) and (:deviceTypeId is null or t.customerDevice.deviceModel.deviceType.id = :deviceTypeId)")
    java.math.BigDecimal sumPaidRevenue(@org.springframework.data.repository.query.Param("from") java.time.LocalDateTime from,
            @org.springframework.data.repository.query.Param("until") java.time.LocalDateTime until,
            @org.springframework.data.repository.query.Param("branchId") Long branchId,
            @org.springframework.data.repository.query.Param("deviceTypeId") Long deviceTypeId);

    @org.springframework.data.jpa.repository.Query("select count(distinct t.id) from RepairItem i join i.serviceTicket t where i.warrantySourceItem is not null and t.receivedAt >= :from and t.receivedAt < :until and (:branchId is null or t.branch.id = :branchId) and (:deviceTypeId is null or t.customerDevice.deviceModel.deviceType.id = :deviceTypeId)")
    long countWarrantyReturnTickets(@org.springframework.data.repository.query.Param("from") java.time.LocalDateTime from,
            @org.springframework.data.repository.query.Param("until") java.time.LocalDateTime until,
            @org.springframework.data.repository.query.Param("branchId") Long branchId,
            @org.springframework.data.repository.query.Param("deviceTypeId") Long deviceTypeId);


    Optional<ServiceTicket> findByTicketCode(String ticketCode);

    Optional<ServiceTicket> findByAppointmentDevice_Id(Long appointmentDeviceId);

    List<ServiceTicket> findAllByCustomerDevice_Customer_PhoneOrderByReceivedAtDesc(String phone);

    @org.springframework.data.jpa.repository.Query("""
            select t from ServiceTicket t
            where (:branchId is null or t.branch.id = :branchId)
              and (:status is null or t.status = :status)
              and (:term is null
                   or lower(t.ticketCode) like lower(concat('%', :term, '%'))
                   or lower(t.customerDevice.customer.fullName) like lower(concat('%', :term, '%'))
                   or lower(t.customerDevice.customer.phone) like lower(concat('%', :term, '%'))
                   or lower(t.customerDevice.deviceModel.name) like lower(concat('%', :term, '%')))
            order by t.receivedAt desc, t.id desc
            """)
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths={"customerDevice.customer","customerDevice.deviceModel","branch"})
    List<ServiceTicket> findOperationalTickets(
            @org.springframework.data.repository.query.Param("branchId") Long branchId,
            @org.springframework.data.repository.query.Param("status") ServiceTicketStatus status,
            @org.springframework.data.repository.query.Param("term") String term);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select t from ServiceTicket t where t.id = :id")
    Optional<ServiceTicket> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);
}
