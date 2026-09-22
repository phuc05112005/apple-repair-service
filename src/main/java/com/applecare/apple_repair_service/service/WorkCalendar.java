package com.applecare.apple_repair_service.service;
import java.time.*;
import java.util.*;
/** Calendar arithmetic only; breaks are elapsed allowance, not repair time. */
public final class WorkCalendar {
 private WorkCalendar() {}
 public record Window(LocalDateTime start,LocalDateTime end) {}
 public record Estimate(LocalDateTime start,LocalDateTime completion) {}
 public static Estimate allocate(LocalDateTime earliest,long minutes,List<Window> input) {
  var windows=new ArrayList<Window>();
  for(var w:input.stream().sorted(Comparator.comparing(Window::start)).toList()) {
   if(!w.end().isAfter(w.start()))continue;
   if(!windows.isEmpty() && !w.start().isAfter(windows.getLast().end())) {
    var last=windows.removeLast();windows.add(new Window(last.start(),last.end().isAfter(w.end())?last.end():w.end()));
   } else windows.add(w);
  }
  LocalDateTime start=null;long seconds=Math.multiplyExact(Math.max(0,minutes),60L);
  for(var w:windows) {
   var cursor=earliest.isAfter(w.start())?earliest:w.start();if(!cursor.isBefore(w.end()))continue;
   if(start==null)start=cursor;
   long available=Duration.between(cursor,w.end()).getSeconds();
   if(seconds<=available)return new Estimate(start,cursor.plusSeconds(seconds));
   seconds-=available;
  }
  return new Estimate(start,null);
 }
}
