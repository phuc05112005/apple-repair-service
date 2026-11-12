package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ServiceTicketRepository extends JpaRepository<ServiceTicket, Long> {

   @Query("select t from ServiceTicket t join fetch t.branch where t.status=com.applecare.apple_repair_service.enums.ServiceTicketStatus.WAITING_ASSIGNMENT order by t.receivedAt,t.id")
   List<ServiceTicket> findUnassignedForTiming();

   @Query("select new com.applecare.apple_repair_service.dto.response.StatusCountResponse(t.status, count(t)) from ServiceTicket t where t.receivedAt >= :from and t.receivedAt < :until and (:branchId is null or t.branch.id = :branchId) and (:deviceTypeId is null or t.customerDevice.deviceModel.deviceType.id = :deviceTypeId) group by t.status")
   List<com.applecare.apple_repair_service.dto.response.StatusCountResponse> countCurrentStatuses(@Param("from") LocalDateTime from,
                                                                                                  @Param("until") LocalDateTime until,
                                                                                                  @Param("branchId") Long branchId,
                                                                                                  @Param("deviceTypeId") Long deviceTypeId);

   @Query("select coalesce(sum(i.finalPrice), 0) from RepairItem i join i.serviceTicket t where i.approvalStatus = com.applecare.apple_repair_service.enums.ApprovalStatus.APPROVED and t.paymentStatus = com.applecare.apple_repair_service.enums.PaymentStatus.PAID and t.paidAt >= :from and t.paidAt < :until and (:branchId is null or t.branch.id = :branchId) and (:deviceTypeId is null or t.customerDevice.deviceModel.deviceType.id = :deviceTypeId)")
   BigDecimal sumPaidRevenue(@Param("from") LocalDateTime from,
                             @Param("until") LocalDateTime until,
                             @Param("branchId") Long branchId,
                             @Param("deviceTypeId") Long deviceTypeId);

   @Query("select count(distinct t.id) from RepairItem i join i.serviceTicket t where i.warrantySourceItem is not null and t.receivedAt >= :from and t.receivedAt < :until and (:branchId is null or t.branch.id = :branchId) and (:deviceTypeId is null or t.customerDevice.deviceModel.deviceType.id = :deviceTypeId)")
   long countWarrantyReturnTickets(@Param("from") LocalDateTime from,
                                   @Param("until") LocalDateTime until,
                                   @Param("branchId") Long branchId,
                                   @Param("deviceTypeId") Long deviceTypeId);

   Optional<ServiceTicket> findByTicketCode(String ticketCode);

   Optional<ServiceTicket> findByAppointmentDevice_Id(Long appointmentDeviceId);

   List<ServiceTicket> findAllByCustomerDevice_Customer_PhoneOrderByReceivedAtDesc(String phone);

   @Query("""
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
   @EntityGraph(attributePaths={"customerDevice.customer","customerDevice.deviceModel","branch"})
   List<ServiceTicket> findOperationalTickets(
           @Param("branchId") Long branchId,
           @Param("status") ServiceTicketStatus status,
           @Param("term") String term);

   @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
   @Query("select t from ServiceTicket t where t.id = :id")
   Optional<ServiceTicket> findByIdForUpdate(@Param("id") Long id);


   @EntityGraph(attributePaths = {
           "customerDevice.customer",
           "customerDevice.deviceModel",
           "customerDevice.deviceModel.deviceType",
           "branch",
           "appointmentDevice",
           "createdBy",
           "handedOverBy"
   })
   @Query("""
            select distinct t from ServiceTicket t
            where (:technicianId is null or t.createdBy.id = :technicianId)
            order by t.receivedAt desc, t.id desc
            """)
   List<ServiceTicket> findTechnicianHistory(@Param("technicianId") Long technicianId);
   Optional<ServiceTicket> findDetailById(Long id);
}