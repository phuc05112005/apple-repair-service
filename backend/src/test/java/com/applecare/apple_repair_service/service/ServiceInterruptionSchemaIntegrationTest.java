package com.applecare.apple_repair_service.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(properties = {
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.jpa.open-in-view=false",
        "spring.jpa.show-sql=false"
})
class ServiceInterruptionSchemaIntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void schemaAddsOnlyExpectedInterruptionStructure() {
        String schema = jdbc.queryForObject("select database()", String.class);
        assertEquals(33, jdbc.queryForObject("""
                select count(*) from information_schema.tables
                where table_schema = ? and table_type = 'BASE TABLE'
                """, Integer.class, schema));
        assertEquals(1, jdbc.queryForObject("""
                select count(*) from information_schema.tables
                where table_schema = ? and table_name = 'service_interruptions'
                """, Integer.class, schema));
        assertEquals(0, jdbc.queryForObject("""
                select count(*) from information_schema.tables
                where table_schema = ? and table_name in ('branch_incidents', 'ml_model_versions')
                """, Integer.class, schema));
        assertEquals(0, jdbc.queryForObject("""
                select count(*) from information_schema.columns
                where table_schema = ? and table_name = 'service_interruptions'
                  and column_name in ('service_ticket_id', 'technician_id', 'branch_id')
                """, Integer.class, schema));
    }

    @Test
    void schemaDefinesEnumsIndexesForeignKeysAndTimeConstraint() {
        String schema = jdbc.queryForObject("select database()", String.class);
        assertEquals("enum('TECHNICIAN_PERSONAL','SUPPORTING_OTHER_JOB','EQUIPMENT_FAILURE','POWER_OUTAGE','SYSTEM_OUTAGE','OTHER')",
                columnType(schema, "reason"));
        assertEquals("enum('TECHNICIAN','BRANCH','SYSTEM','EXTERNAL','OTHER')",
                columnType(schema, "responsibility_scope"));
        assertEquals("enum('SYSTEM','TECHNICIAN','ADMIN','BRANCH_EVENT')",
                columnType(schema, "source"));

        assertEquals("assignment_id,started_at", indexColumns(schema,
                "idx_service_interruptions_assignment_started"));
        assertEquals("incident_group_code", indexColumns(schema,
                "idx_service_interruptions_incident_group"));
        assertEquals("verified,started_at", indexColumns(schema,
                "idx_service_interruptions_verified_started"));

        assertEquals("assignments.id", foreignKeyTarget(schema,
                "fk_service_interruptions_assignment"));
        assertEquals("users.id", foreignKeyTarget(schema,
                "fk_service_interruptions_recorded_by"));
        for (String constraint : Set.of("fk_service_interruptions_assignment",
                "fk_service_interruptions_recorded_by")) {
            String deleteRule = jdbc.queryForObject("""
                    select delete_rule from information_schema.referential_constraints
                    where constraint_schema = ? and table_name = 'service_interruptions'
                      and constraint_name = ?
                    """, String.class, schema, constraint);
            assertTrue(Set.of("RESTRICT", "NO ACTION").contains(deleteRule));
        }
        assertEquals(1, jdbc.queryForObject("""
                select count(*)
                from information_schema.table_constraints
                where constraint_schema = ? and table_name = 'service_interruptions'
                  and constraint_name = 'ck_service_interruptions_time_order'
                  and constraint_type = 'CHECK'
                """, Integer.class, schema));
    }

    private String columnType(String schema, String column) {
        return jdbc.queryForObject("""
                select column_type from information_schema.columns
                where table_schema = ? and table_name = 'service_interruptions'
                  and column_name = ?
                """, String.class, schema, column);
    }

    private String indexColumns(String schema, String index) {
        return jdbc.queryForObject("""
                select group_concat(column_name order by seq_in_index separator ',')
                from information_schema.statistics
                where table_schema = ? and table_name = 'service_interruptions'
                  and index_name = ?
                """, String.class, schema, index);
    }

    private String foreignKeyTarget(String schema, String constraint) {
        return jdbc.queryForObject("""
                select concat(referenced_table_name, '.', referenced_column_name)
                from information_schema.key_column_usage
                where table_schema = ? and table_name = 'service_interruptions'
                  and constraint_name = ?
                """, String.class, schema, constraint);
    }
}
