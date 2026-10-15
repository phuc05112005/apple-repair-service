package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreatePartRequest;
import com.applecare.apple_repair_service.dto.request.UpdatePartRequest;
import com.applecare.apple_repair_service.entity.Part;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.repository.PartRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {"spring.jpa.hibernate.ddl-auto=validate", "spring.jpa.open-in-view=false"})
@Transactional
class PartOriginManufacturerIntegrationTest {
    @Autowired PartService parts;
    @Autowired PartRepository repository;
    @Autowired EntityManager em;
    @Autowired Clock clock;

    @Test
    void createAndReadBackWithOriginAndManufacturer() {
        String code = "ORIGIN-" + System.nanoTime();
        var created = parts.create(new CreatePartRequest(code, "Pin test", "Pisen", null,
                new BigDecimal("150000"), "Trung Quốc", "Shenzhen Example Co.", "Nhà cung cấp A"));
        em.flush(); em.clear();
        var reread = parts.getById(created.id());
        assertEquals("Trung Quốc", reread.origin());
        assertEquals("Shenzhen Example Co.", reread.manufacturer());
        assertEquals("Nhà cung cấp A", reread.supplier());
    }

    @Test
    void createWithoutOriginAndManufacturerStoresNull() {
        String code = "NOORIGIN-" + System.nanoTime();
        var created = parts.create(new CreatePartRequest(code, "Pin test", null, null, new BigDecimal("1000")));
        em.flush(); em.clear();
        var reread = parts.getById(created.id());
        assertNull(reread.origin());
        assertNull(reread.manufacturer());
        assertNull(reread.supplier());
    }

    @Test
    void updatingOneFieldKeepsTheOther() {
        String code = "UPD-" + System.nanoTime();
        var created = parts.create(new CreatePartRequest(code, "Pin test", null, null, new BigDecimal("1000"),
                "Việt Nam", "Nhà SX A"));
        // Update only the manufacturer; origin is re-sent with its current value, as the form does.
        parts.update(created.id(), new UpdatePartRequest(code, "Pin test", null, null, new BigDecimal("1000"),
                "Việt Nam", "Nhà SX B"));
        em.flush(); em.clear();
        var reread = parts.getById(created.id());
        assertEquals("Việt Nam", reread.origin());
        assertEquals("Nhà SX B", reread.manufacturer());
    }

    @Test
    void legacyRowWithoutNewColumnsStillReadsCleanly() {
        String code = "LEGACY-" + System.nanoTime();
        var legacy = new Part();
        legacy.setPartCode(code);
        legacy.setName("Linh kiện cũ");
        legacy.setSalePrice(new BigDecimal("500"));
        repository.saveAndFlush(legacy);
        em.clear();
        var reread = parts.getById(legacy.getId());
        assertNull(reread.origin());
        assertNull(reread.manufacturer());
        assertEquals("Linh kiện cũ", reread.name());
    }
}
