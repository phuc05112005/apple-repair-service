package com.applecare.apple_repair_service.config;

import java.time.Clock;
import java.time.ZoneId;
import java.util.TimeZone;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TimeConfig {
    public static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Bean
    public static org.springframework.beans.factory.config.BeanFactoryPostProcessor businessTimeZone() {
        // Run before Hibernate constructs its timestamp generators, even on a UTC host.
        return beanFactory -> TimeZone.setDefault(TimeZone.getTimeZone(BUSINESS_ZONE));
    }

    @Bean
    public Clock clock() {
        return Clock.system(BUSINESS_ZONE);
    }
}
