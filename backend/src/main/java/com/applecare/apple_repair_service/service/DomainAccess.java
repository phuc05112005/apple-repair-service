package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.exception.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Internal entity access only; public application use cases return DTOs.
 */
@Component
@RequiredArgsConstructor
public class DomainAccess {
    private final EntityManager em;

    public <T> T get(Class<T> type, Long id) {
        T entity = id == null ? null : em.find(type, id);
        if (entity == null) throw new ResourceNotFoundException(type.getSimpleName() + " not found: " + id);
        return entity;
    }

    public <T> T lock(Class<T> type, Long id) {
        T entity = get(type, id);
        // Preserve changes from an earlier use case in the same outer transaction.
        em.flush();
        em.refresh(entity, LockModeType.PESSIMISTIC_WRITE);
        return entity;
    }
}
