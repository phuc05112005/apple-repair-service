package com.applecare.apple_repair_service.config;

import java.text.Normalizer;
import java.util.Locale;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Backfills the pre-existing global issue catalog once the join table exists. */
@Component
@RequiredArgsConstructor
public class LegacyServiceIssueMapping implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void run(ApplicationArguments args) {
        var types = jdbc.query("select id, name from device_types", (rs, row) -> new NamedId(rs.getLong(1), normalize(rs.getString(2))));
        var issues = jdbc.query("select id, name from service_issues where mapping_initialized = false",
                (rs, row) -> new NamedId(rs.getLong(1), normalize(rs.getString(2))));
        for (var issue : issues) {
            var hasMapping = jdbc.queryForObject("select count(*) from service_issue_device_types where service_issue_id = ?",
                    Integer.class, issue.id()) > 0;
            for (var type : types) {
                if (!hasMapping && applies(issue.name(), type.name())) {
                    jdbc.update("insert into service_issue_device_types (service_issue_id, device_type_id) values (?, ?)", issue.id(), type.id());
                }
            }
            jdbc.update("update service_issues set mapping_initialized = true where id = ?", issue.id());
        }
    }

    private static boolean applies(String issue, String type) {
        if (issue.contains("camera")) return !type.contains("airpod") && !type.contains("watch");
        if (issue.contains("man hinh") || issue.contains("screen")) return !type.contains("airpod");
        return true;
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replace('đ', 'd').toLowerCase(Locale.ROOT);
    }

    private record NamedId(Long id, String name) { }
}
