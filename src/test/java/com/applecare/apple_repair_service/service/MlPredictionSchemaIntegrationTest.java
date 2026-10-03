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
class MlPredictionSchemaIntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void schemaKeepsThirtyThreeTablesAndOptionalTechnicianForeignKeyWithoutCascade() {
        String schema = jdbc.queryForObject("select database()", String.class);
        assertEquals(33, jdbc.queryForObject("""
                select count(*) from information_schema.tables
                where table_schema = ? and table_type = 'BASE TABLE'
                """, Integer.class, schema));
        assertEquals("YES", jdbc.queryForObject("""
                select is_nullable from information_schema.columns
                where table_schema = ? and table_name = 'ml_predictions'
                  and column_name = 'technician_id'
                """, String.class, schema));
        assertEquals("technician_id,prediction_type,predicted_at", jdbc.queryForObject("""
                select group_concat(column_name order by seq_in_index separator ',')
                from information_schema.statistics
                where table_schema = ? and table_name = 'ml_predictions'
                  and index_name = 'idx_ml_predictions_technician_type_predicted_at'
                """, String.class, schema));
        assertEquals("users.id", jdbc.queryForObject("""
                select concat(kcu.referenced_table_name, '.', kcu.referenced_column_name)
                from information_schema.key_column_usage kcu
                where kcu.table_schema = ? and kcu.table_name = 'ml_predictions'
                  and kcu.constraint_name = 'fk_ml_predictions_technician'
                """, String.class, schema));
        String deleteRule = jdbc.queryForObject("""
                select delete_rule from information_schema.referential_constraints
                where constraint_schema = ? and table_name = 'ml_predictions'
                  and constraint_name = 'fk_ml_predictions_technician'
                """, String.class, schema);
        assertTrue(Set.of("RESTRICT", "NO ACTION").contains(deleteRule));
    }
}
