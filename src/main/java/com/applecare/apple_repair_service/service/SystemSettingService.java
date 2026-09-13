package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.UpdateSystemSettingRequest;
import com.applecare.apple_repair_service.dto.response.SystemSettingResponse;
import com.applecare.apple_repair_service.entity.SystemSetting;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.exception.ResourceNotFoundException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.SystemSettingRepository;

import java.math.BigDecimal;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SystemSettingService {
    private final SystemSettingRepository repository;
    private final BusinessRules rules;
    private final EntityResponses mapper;

    public String getString(String key) {
        return repository.findBySettingKey(BusinessRules.required(key, "Setting key")).orElseThrow(() -> new ResourceNotFoundException("Missing setting: " + key)).getSettingValue();
    }

    public BigDecimal getDecimal(String key) {
        try {
            return new BigDecimal(getString(key).trim());
        } catch (NumberFormatException ex) {
            throw new BusinessRuleViolationException("Invalid decimal setting: " + key);
        }
    }

    public BigDecimal getDecimal(String key, BigDecimal fallback) {
        return repository.existsBySettingKey(key) ? getDecimal(key) : fallback;
    }

    public int getInteger(String key) {
        try {
            return Integer.parseInt(getString(key).trim());
        } catch (NumberFormatException ex) {
            throw new BusinessRuleViolationException("Invalid integer setting: " + key);
        }
    }

    public List<SystemSettingResponse> list() {
        return repository.findAll().stream().map(mapper::map).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public SystemSettingResponse update(String key, UpdateSystemSettingRequest r) {
        rules.validate(r);
        key = BusinessRules.required(key, "Setting key");
        BusinessRules.require(key.length() <= 255, "Setting key too long");
        if (key.equals("ONLINE_DISCOUNT_PERCENT")) {
            try {
                var n = new BigDecimal(r.settingValue().trim());
                PricePolicy.discounted(null, n);
            } catch (NumberFormatException e) {
                throw new BusinessRuleViolationException("Invalid discount");
            }
        }
        if (key.equals("APPOINTMENT_GRACE_MINUTES")) {
            try {
                BusinessRules.require(Integer.parseInt(r.settingValue().trim()) >= 0, "Grace must not be negative");
            } catch (NumberFormatException e) {
                throw new BusinessRuleViolationException("Invalid grace minutes");
            }
        }
        var e = repository.findBySettingKey(key).orElseGet(SystemSetting::new);
        e.setSettingKey(key);
        e.setSettingValue(r.settingValue());
        try {
            return mapper.map(repository.saveAndFlush(e));
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Setting was created concurrently; retry");
        }
    }
}
