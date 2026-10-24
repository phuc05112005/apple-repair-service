package com.applecare.apple_repair_service.service;
import com.applecare.apple_repair_service.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
@Component @RequiredArgsConstructor
public class TimingSettings {
 public static final String BREAK="TECHNICIAN_BREAK_BETWEEN_JOBS_MINUTES", ASSIGNMENT="UNASSIGNED_TICKET_TARGET_MINUTES";
 public static final int SCHEDULE_HORIZON_DAYS=90;
 private final SystemSettingRepository settings;
 public record Values(int breakMinutes,int assignmentMinutes) {}
 public Values values() {
  var map=new java.util.HashMap<String,String>();settings.findAll().forEach(s->map.put(s.getSettingKey(),s.getSettingValue()));
  return new Values(value(map,BREAK,10),value(map,ASSIGNMENT,15));
 }
 private int value(java.util.Map<String,String> values,String key,int fallback) {
  if(!values.containsKey(key))return fallback;
  try {int n=Integer.parseInt(values.get(key).trim());BusinessRules.require(n>=0 && n<=10080,"Cấu hình thời gian không hợp lệ: "+key);return n;}
  catch(NumberFormatException ex){throw new com.applecare.apple_repair_service.exception.BusinessRuleViolationException("Cấu hình thời gian phải là số phút nguyên: "+key);}
 }
}
