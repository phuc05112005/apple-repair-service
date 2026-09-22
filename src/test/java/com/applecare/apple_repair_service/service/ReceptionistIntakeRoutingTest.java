package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.controller.ReceptionistController;
import com.applecare.apple_repair_service.security.CurrentActor;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ReceptionistIntakeRoutingTest {
    @Test
    void emptyIntakeListRequiresNoParametersAndDoesNotResolveAsAppointmentId() throws Exception {
        var appointments = mock(AppointmentService.class);
        when(appointments.readyForIntake()).thenReturn(List.of());
        var controller = new ReceptionistController(appointments, mock(ServiceTicketService.class),
                mock(AssignmentService.class), mock(TechnicianRecommendationService.class),
                mock(RepairItemService.class), mock(PaymentService.class), mock(CurrentActor.class));
        var mvc = MockMvcBuilders.standaloneSetup(controller).build();

        mvc.perform(get("/api/v1/internal/appointments/ready-for-intake"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        verify(appointments).readyForIntake();
        verifyNoMoreInteractions(appointments);
    }
}
