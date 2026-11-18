package com.applecare.apple_repair_service.controller;

import com.applecare.apple_repair_service.entity.SystemSetting;
import com.applecare.apple_repair_service.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class SystemSettingPublicController {

    private static final String SETTINGS_KEY = "taocare_system_settings";
    private final SystemSettingRepository settingRepository;

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getPublicSettings() {
        return settingRepository.findBySettingKey(SETTINGS_KEY)
                .map(s -> ResponseEntity.ok(s.getSettingValue()))
                .orElseGet(() -> ResponseEntity.ok("{}"));
    }

    @PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> updatePublicSettings(@RequestBody String rawJson) {
        SystemSetting setting = settingRepository.findBySettingKey(SETTINGS_KEY)
                .orElseGet(() -> {
                    SystemSetting s = new SystemSetting();
                    s.setSettingKey(SETTINGS_KEY);
                    return s;
                });
        setting.setSettingValue(rawJson);
        settingRepository.save(setting);
        return ResponseEntity.ok(rawJson);
    }
}