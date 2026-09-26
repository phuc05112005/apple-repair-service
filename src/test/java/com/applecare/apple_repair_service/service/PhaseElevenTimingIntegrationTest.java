package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import com.applecare.apple_repair_service.repository.ServiceTimeEstimateHistoryRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Import(PhaseElevenTimingIntegrationTest.Time.class)
@Transactional
class PhaseElevenTimingIntegrationTest {
 static class MutableClock extends Clock {
  Instant instant;
  void at(String time) { instant=LocalDate.of(2026,9,22).atTime(LocalTime.parse(time)).atZone(getZone()).toInstant(); }
  public ZoneId getZone(){return ZoneId.of("Asia/Ho_Chi_Minh");}
  public Clock withZone(ZoneId zone){return Clock.fixed(instant,zone);}
  public Instant instant(){return instant;}
 }
 @TestConfiguration static class Time { @Bean @Primary MutableClock testClock(){var c=new MutableClock();c.at("09:00");return c;} }
 @Autowired MutableClock clock;
 @Autowired EntityManager em;
 @Autowired ServiceStatusService statuses;
 @Autowired ServiceTimingService timing;
 @Autowired TimingMetricsService metrics;
 @Autowired ServiceTimeEstimateHistoryRepository histories;
 ApiFixture f;
 @BeforeEach void setup(){clock.at("09:00");f=new ApiFixture(em,clock);f.create();shift(f.technician);}
 void shift(User tech){var s=new TechnicianSchedule();s.setTechnician(tech);s.setBranch(f.branch);s.setWorkDate(LocalDate.now(clock));s.setStartTime(LocalTime.of(8,0));s.setEndTime(LocalTime.of(20,0));em.persist(s);em.flush();}
 LocalDateTime at(String time){return LocalDate.now(clock).atTime(LocalTime.parse(time));}
 ServiceTicket create(int duration){f.catalog.setStandardDurationMinutes(duration);var t=f.ticket(ServiceTicketStatus.WAITING_ASSIGNMENT);f.item(t);em.flush();statuses.initialize(t,f.receptionist);return t;}
 void assign(ServiceTicket t){var a=new Assignment();a.setServiceTicket(t);a.setTechnician(f.technician);a.setAssignedBy(f.receptionist);a.setSource(AssignmentSource.MANUAL_OVERRIDE);a.setAssignedAt(LocalDateTime.now(clock));em.persist(a);em.flush();statuses.changeStatus(t,ServiceTicketStatus.ASSIGNED,f.receptionist,"Assign");}
 void start(ServiceTicket t){statuses.changeStatus(t,ServiceTicketStatus.INSPECTING,f.technician,"Inspect");statuses.changeStatus(t,ServiceTicketStatus.REPAIRING,f.technician,"Start");}
 void finish(ServiceTicket t){statuses.changeStatus(t,ServiceTicketStatus.WAITING_HANDOVER,f.technician,"Complete");}
 void pause(int value){var rows=em.createQuery("select s from SystemSetting s where s.settingKey=:key",SystemSetting.class).setParameter("key",TimingSettings.BREAK).getResultList();var s=rows.isEmpty()?new SystemSetting():rows.getFirst();s.setSettingKey(TimingSettings.BREAK);s.setSettingValue(""+value);if(s.getId()==null)em.persist(s);em.flush();}
 @Test void creationHasProvisionalEtaDeadlineHistoryWithoutAssignment(){var t=create(40);assertEquals(at("09:00"),t.getInitialEstimatedStartAt());assertEquals(at("09:40"),t.getInitialEstimatedCompletionAt());assertEquals(at("09:15"),t.getAssignmentDueAt());assertEquals(1,histories.findAllByServiceTicket_IdOrderByCreatedAtAscIdAsc(t.getId()).size());clock.at("09:16");assertEquals(1,Duration.between(t.getAssignmentDueAt(),LocalDateTime.now(clock)).toMinutes());assertEquals(ServiceTicketStatus.WAITING_ASSIGNMENT,t.getStatus());assertEquals(0,em.createQuery("select count(a) from Assignment a where a.serviceTicket.id=:id",Long.class).setParameter("id",t.getId()).getSingleResult());}
 @Test void lateActualStartMovesCurrentEtaButPreservesInitialAndExcludesQueueWait(){clock.at("10:30");var t=create(40);assign(t);clock.at("10:40");start(t);assertEquals(at("11:10"),t.getInitialEstimatedCompletionAt());assertEquals(at("11:20"),t.getEstimatedCompletionAt());assertEquals(at("10:40"),t.getActualRepairStartedAt());clock.at("10:45");var m=metrics.calculate(t.getId());assertEquals(10,m.startDelayMinutes());assertEquals(10,m.queueWaitMinutes());assertEquals(5,m.actualActiveRepairMinutes());}
 @Test void completionPreservesOverdueEtaAndCascadesQueue(){var a=create(90);assign(a);start(a);var b=create(90);assign(b);var initial=b.getInitialEstimatedStartAt();assertEquals(at("10:40"),b.getEstimatedStartAt());clock.at("10:45");finish(a);assertEquals(at("10:30"),a.getEstimatedCompletionAt());assertEquals(15,metrics.calculate(a.getId()).currentEtaCompletionDelayMinutes());assertEquals(at("10:55"),b.getEstimatedStartAt());assertEquals(initial,b.getInitialEstimatedStartAt());}
 @Test void earlyCompletionPullsQueueForwardAndBreakIsNotAnEnforcedTimer(){var a=create(60);assign(a);start(a);var b=create(60);assign(b);assertEquals(at("10:10"),b.getEstimatedStartAt());clock.at("09:50");finish(a);assertEquals(at("10:00"),b.getEstimatedStartAt());clock.at("09:53");start(b);assertEquals(at("09:53"),b.getActualRepairStartedAt());assertEquals(at("10:53"),b.getEstimatedCompletionAt());assertEquals(0,metrics.calculate(b.getId()).actualActiveRepairMinutes());}
 @Test void laterThanBreakStartHasTenMinuteDelay(){var a=create(60);assign(a);start(a);var b=create(60);assign(b);clock.at("10:00");finish(a);clock.at("10:20");start(b);assertEquals(10,metrics.calculate(b.getId()).startDelayMinutes());assertEquals(at("11:20"),b.getEstimatedCompletionAt());}
 @Test void waitingPartIsExcludedAndResumeUsesRemainingWork(){var t=create(40);assign(t);start(t);clock.at("09:20");statuses.changeStatus(t,ServiceTicketStatus.WAITING_PART,f.technician,"Wait");assertNull(t.getEstimatedCompletionAt());clock.at("10:20");statuses.changeStatus(t,ServiceTicketStatus.REPAIRING,f.technician,"Resume");assertEquals(at("10:40"),t.getEstimatedCompletionAt());clock.at("10:35");finish(t);var m=metrics.calculate(t.getId());assertEquals(35,m.actualActiveRepairMinutes());assertEquals(60,m.waitingPartMinutes());assertEquals(at("09:00"),t.getActualRepairStartedAt());assertEquals(35,m.activeRepairMinutesByTechnician().get(f.technician.getId()));}
 @Test void handoverDoesNotExtendTechnicalDuration(){clock.at("13:00");var t=create(60);assign(t);start(t);clock.at("14:00");finish(t);clock.at("18:00");statuses.changeStatus(t,ServiceTicketStatus.HANDED_OVER,f.receptionist,"Handover");assertEquals(at("14:00"),t.getActualRepairCompletedAt());assertEquals(60,metrics.calculate(t.getId()).actualActiveRepairMinutes());assertEquals(0,metrics.calculate(t.getId()).currentEtaCompletionDelayMinutes());}
 @Test void settingChangeOnlyAffectsNextCalculationAndPreservesSnapshots(){var a=create(60);assign(a);start(a);var b=create(60);assign(b);var old=histories.findAllByServiceTicket_IdOrderByCreatedAtAscIdAsc(b.getId());pause(5);assertEquals(at("10:10"),b.getEstimatedStartAt());timing.planChanged(a,f.technician);assertEquals(at("10:05"),b.getEstimatedStartAt());assertTrue(old.stream().allMatch(h->h.getBreakMinutesSnapshot()==10));assertEquals(5,histories.findAllByServiceTicket_IdOrderByCreatedAtAscIdAsc(b.getId()).getLast().getBreakMinutesSnapshot());}
 @Test void noScheduleIsGracefulAndEmptyTicketUsesCentralDefault(){em.createQuery("delete from TechnicianSchedule s where s.branch.id=:id").setParameter("id",f.branch.getId()).executeUpdate();var t=f.ticket(ServiceTicketStatus.WAITING_ASSIGNMENT);em.flush();statuses.initialize(t,f.receptionist);assertNull(t.getEstimatedCompletionAt());assertEquals(30,t.getEstimatedDurationMinutes());assertNotNull(t.getAssignmentDueAt());assertEquals(1,histories.findAllByServiceTicket_IdOrderByCreatedAtAscIdAsc(t.getId()).size());}
 @Test void transferPreservesFirstStartAndAttributesActiveIntervals(){shift(f.otherTechnician);var t=create(60);assign(t);start(t);clock.at("09:20");var old=em.createQuery("select a from Assignment a where a.serviceTicket.id=:id",Assignment.class).setParameter("id",t.getId()).getSingleResult();old.setStatus(AssignmentStatus.ENDED);old.setEndedAt(at("09:20"));var next=new Assignment();next.setServiceTicket(t);next.setTechnician(f.otherTechnician);next.setAssignedBy(f.receptionist);next.setSource(AssignmentSource.TRANSFER);next.setAssignedAt(at("09:20"));em.persist(next);em.flush();timing.transferred(t,f.receptionist);clock.at("09:35");finish(t);var m=metrics.calculate(t.getId());assertEquals(at("09:00"),t.getActualRepairStartedAt());assertEquals(20,m.activeRepairMinutesByTechnician().get(f.technician.getId()));assertEquals(15,m.activeRepairMinutesByTechnician().get(f.otherTechnician.getId()));}
 @Test void waitingApprovalFreesQueueAndDoesNotCountAsActiveRepair(){var a=create(60);assign(a);start(a);var b=create(60);assign(b);clock.at("09:20");statuses.changeStatus(a,ServiceTicketStatus.WAITING_APPROVAL,f.technician,"Contact customer");assertEquals(at("09:20"),b.getEstimatedStartAt());clock.at("10:20");statuses.changeStatus(a,ServiceTicketStatus.REPAIRING,f.technician,"Consent recorded");assertEquals(at("11:00"),a.getEstimatedCompletionAt());clock.at("10:35");finish(a);assertEquals(35,metrics.calculate(a.getId()).actualActiveRepairMinutes());assertEquals(60,metrics.calculate(a.getId()).waitingApprovalMinutes());}
 @Test void remainingWorkDoesNotRecountClosedAndOpenRepairIntervals(){var a=create(60);assign(a);start(a);clock.at("09:20");statuses.changeStatus(a,ServiceTicketStatus.WAITING_PART,f.technician,"Wait");clock.at("10:20");statuses.changeStatus(a,ServiceTicketStatus.REPAIRING,f.technician,"Resume");clock.at("10:45");var b=create(60);assertEquals(at("11:10"),b.getEstimatedStartAt());assertEquals(45,metrics.calculate(a.getId()).actualActiveRepairMinutes());}
 @Test void workingCalendarSpansShiftGapsWithoutTreatingThemAsRepairMinutes(){var day=LocalDate.of(2026,9,22);var result=WorkCalendar.allocate(day.atTime(11,50),40,java.util.List.of(new WorkCalendar.Window(day.atTime(8,0),day.atTime(12,0)),new WorkCalendar.Window(day.atTime(13,0),day.atTime(17,0))));assertEquals(day.atTime(13,30),result.completion());}

}
