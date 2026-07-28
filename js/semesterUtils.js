/* ============================================================
   SEMESTRE
============================================================ */
import { getState } from './state.js';
import { parseDate, todayStr, diffDays, clamp, formatDate } from './dateUtils.js';

export function getSemesterStats(){
  var state = getState();
  if(!state.semester) return null;
  var s = state.semester;
  var start = parseDate(s.start), end = parseDate(s.end), today = parseDate(todayStr());
  var totalWeeks = Math.max(1, Math.ceil((diffDays(start,end)+1)/7));
  var rawWeek = Math.floor(diffDays(start,today)/7) + 1;
  var currentWeek = clamp(rawWeek, 0, totalWeeks);
  var pct = clamp(((diffDays(start,today)+1)/(diffDays(start,end)+1))*100, 0, 100);
  return { totalWeeks, currentWeek, pct, start, end, today };
}

export function getWeekStartDateForWeek(week){
  var state = getState();
  if(!state.semester) return null;
  var start = parseDate(state.semester.start);
  var weekStart = new Date(start);
  var day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - day);
  weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
  return weekStart;
}

export function getSelectedWeek(){
  var stats = getSemesterStats();
  if(!stats) return 1;
  var state = getState();
  if(typeof state.activeWeek === 'number' && state.activeWeek >= 1){
    return clamp(state.activeWeek, 1, stats.totalWeeks);
  }
  return clamp(stats.currentWeek || 1, 1, stats.totalWeeks);
}

export function getWeekNumberForDate(dateStr){
  var state = getState();
  if(!state.semester) return null;
  var weekStart = getWeekStartDateForWeek(1);
  if(!weekStart) return null;
  var targetDate = parseDate(dateStr);
  var diffDaysCount = Math.floor((targetDate - weekStart) / 86400000);
  var stats = getSemesterStats();
  return clamp(Math.floor(diffDaysCount / 7) + 1, 1, stats ? stats.totalWeeks : 1);
}

export function getTasksForWeekAndCourse(courseId, week){
  var state = getState();
  return (state.tasks || []).filter(function(task){
    if(task.active === false) return false;
    return task.courseId === courseId && task.endDate && getWeekNumberForDate(task.endDate) === week;
  });
}

export function getCalendarEvents(){
  var state = getState();
  var events = [];
  Object.keys(state.cells || {}).forEach(function(cellKey){
    var content = state.cells[cellKey] || '';
    if(!content || !content.trim()) return;
    var underScore = cellKey.lastIndexOf('_');
    if(underScore <= 0) return;
    var week = parseInt(cellKey.slice(underScore + 1), 10);
    if(!week) return;
    var weekStart = getWeekStartDateForWeek(week);
    if(!weekStart) return;
    var semStart = parseDate(state.semester.start);
    var semEnd = parseDate(state.semester.end);
    if(weekStart < semStart) weekStart = new Date(semStart);
    if(weekStart > semEnd) weekStart = new Date(semEnd);
    var details = state.cellDetails[cellKey] || {};
    var eventDateValue = details.eventDate;
    var parsedEventDate = eventDateValue ? parseDate(eventDateValue) : null;
    events.push({
      id: cellKey,
      title: content,
      date: parsedEventDate ? formatDate(parsedEventDate) : formatDate(weekStart),
      color: details.color && details.color !== 'default' ? details.color : null,
      type: 'cell'
    });
  });
  (state.tasks || []).forEach(function(task){
    if(!task.endDate) return;
    events.push({
      id: task.id,
      title: task.name,
      date: task.endDate,
      color: task.courseId ? 'purple' : 'blue',
      type: 'task'
    });
  });
  return events;
}
