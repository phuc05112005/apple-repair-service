package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TicketCodeGeneratorTest {
    @Test
    void generatesShortReadableCodeAndRetriesCollision() {
        var repository = mock(ServiceTicketRepository.class);
        when(repository.findByTicketCode(anyString()))
                .thenReturn(Optional.of(new ServiceTicket()), Optional.empty());

        var generator = new TicketCodeGenerator(repository, TestData.CLOCK);
        var code = generator.next();

        assertTrue(code.matches("ST-20260911-[0-9A-F]{12}"));
        verify(repository, org.mockito.Mockito.times(2)).findByTicketCode(anyString());
    }

}
