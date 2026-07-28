/* ============================================================
   HEATMAP DE CONSTANCIA
============================================================ */
import { getState } from '../state.js';
import { parseDate, todayStr, diffDays, formatDate, fmtDateLong } from '../dateUtils.js';
import { getTaskStats, countWorkDays } from '../taskStats.js';

export function renderProgressChart(task){
  if(task.type !== "cantidad") return '';
  console.debug("renderProgressChart", task.id, task.log);
  
  var start = parseDate(task.startDate);
  var end = parseDate(task.endDate);
  if(!start || !end) return '';
  
  var totalUnits = Number(task.totalUnits) || 0;
  if(totalUnits <= 0) return '';
  
  var log = task.log || {};
  var daysTotal = Math.max(1, diffDays(start, end) + 1);
  
  // Calculate cumulative progress for each day
  var cumulative = {};
  var runningTotal = 0;
  var sortedDates = Object.keys(log).sort();
  sortedDates.forEach(function(dateStr){
    runningTotal += Number(log[dateStr]) || 0;
    cumulative[dateStr] = runningTotal;
  });
  
  // Build SVG points
  var width = 400;
  var height = 150;
  var padding = 20;
  var chartWidth = width - padding * 2;
  var chartHeight = height - padding * 2;
  
  // Plan line: straight from (0,0) to (daysTotal, totalUnits)
  var planPoints = '0,' + chartHeight + ' ' + chartWidth + ',0';
  
  // Real line: cumulative progress day by day
  var realPoints = '';
  var prevX = 0;
  var prevY = chartHeight;
  
  for(var i = 0; i <= daysTotal; i++){
    var d = new Date(start);
    d.setDate(d.getDate() + i);
    var dateStr = formatDate(d);
    var cumulativeTotal = cumulative[dateStr] || (i === 0 ? 0 : cumulativeTotal);
    
    var x = (i / daysTotal) * chartWidth;
    var y = chartHeight - (cumulativeTotal / totalUnits) * chartHeight;
    
    if(i === 0){
      realPoints = x + ',' + y;
    } else {
      realPoints += ' ' + x + ',' + y;
    }
  }
  
  var isAhead = runningTotal > (totalUnits * (diffDays(start, parseDate(todayStr())) + 1) / daysTotal);
  
  var html = '<div class="chart-section" id="detailProgressChart">';
  html += '<div class="subsection-title">Progreso: Plan vs Real</div>';
  html += '<div class="chart-container">';
  html += '<svg width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'" class="progress-chart">';
  html += '<line x1="'+padding+'" y1="'+padding+'" x2="'+padding+'" y2="'+(height-padding)+'" stroke="var(--border)" stroke-width="1"/>';
  html += '<line x1="'+padding+'" y1="'+(height-padding)+'" x2="'+(width-padding)+'" y2="'+(height-padding)+'" stroke="var(--border)" stroke-width="1"/>';
  html += '<polyline points="'+planPoints+'" fill="none" stroke="var(--text-faint)" stroke-width="2" stroke-dasharray="4,4" transform="translate('+padding+','+padding+')"/>';
  html += '<polyline points="'+realPoints+'" fill="none" stroke="'+(isAhead?'var(--good)':'var(--accent)')+'" stroke-width="2" transform="translate('+padding+','+padding+')"/>';
  html += '</svg>';
  html += '<div class="chart-legend">';
  html += '<span class="legend-item"><span class="legend-line legend-line-plan"></span>Plan ideal</span>';
  html += '<span class="legend-item"><span class="legend-line legend-line-real"></span>Progreso real</span>';
  html += '</div>';
  html += '</div>';
  html += '</div>';
  
  return html;
}

export function calculateStreak(){
  var totals = getDailyTotals(365);
  var today = parseDate(todayStr());
  var streak = 0;
  var checkToday = true;
  
  // Check if today has any activity
  var todayTotal = totals[todayStr()] || 0;
  if(todayTotal === 0){
    // Today doesn't have activity yet, don't break streak
    checkToday = false;
  }
  
  // Count consecutive days backwards
  for(var i = checkToday ? 0 : 1; i < 365; i++){
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    var dateStr = formatDate(d);
    var total = totals[dateStr] || 0;
    
    if(total > 0){
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

export function getDailyTotals(daysBack){
  var state = getState();
  var totals = {};
  var today = parseDate(todayStr());
  
  // Initialize all days with 0
  for(var i = 0; i < daysBack; i++){
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    var dateStr = formatDate(d);
    totals[dateStr] = 0;
  }
  
  // Sum units from all cantidad tasks
  (state.tasks || []).forEach(function(task){
    if(task.type !== "cantidad") return;
    if(task.active === false) return;
    var log = task.log || {};
    Object.keys(log).forEach(function(dateStr){
      if(totals.hasOwnProperty(dateStr)){
        totals[dateStr] += Number(log[dateStr]) || 0;
      }
    });
  });
  
  return totals;
}

export function renderHeatmap(daysBack){
  daysBack = daysBack || 90;
  var totals = getDailyTotals(daysBack);
  var today = parseDate(todayStr());
  var maxTotal = Math.max(1, Math.max.apply(Math, Object.values(totals)));
  
  var html = '<div class="heatmap-section">';
  html += '<div class="heatmap-header"><h3>🔥 Constancia</h3></div>';
  html += '<div class="heatmap-grid">';
  
  // Build grid from oldest to newest
  for(var i = daysBack - 1; i >= 0; i--){
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    var dateStr = formatDate(d);
    var total = totals[dateStr] || 0;
    var intensity = 0;
    if(total > 0){
      if(total >= maxTotal * 0.75) intensity = 4;
      else if(total >= maxTotal * 0.5) intensity = 3;
      else if(total >= maxTotal * 0.25) intensity = 2;
      else intensity = 1;
    }
    
    var dayOfWeek = d.getDay();
    var isToday = dateStr === todayStr();
    
    html += '<div class="heatmap-cell heatmap-level-'+intensity+(isToday?' heatmap-today':'')+'" data-date="'+dateStr+'" data-total="'+total+'" title="'+fmtDateLong(dateStr)+': '+total+' unidades">';
    html += '</div>';
  }
  
  html += '</div>';
  html += '<div class="heatmap-legend">';
  html += '<span class="legend-label">Menos</span>';
  html += '<div class="legend-squares">';
  for(var l = 0; l <= 4; l++){
    html += '<div class="legend-square heatmap-level-'+l+'"></div>';
  }
  html += '</div>';
  html += '<span class="legend-label">Más</span>';
  html += '</div>';
  html += '</div>';
  
  return html;
}

export function getProjectedCantidadNecesitasHoy(task, referenceDateStr){
  var taskStats = getTaskStats(task);
  if(taskStats.isDone || taskStats.isOverdue) return 0;
  var remaining = taskStats.remaining;
  var startDate = parseDate(task.startDate);
  var endDate = parseDate(task.endDate);
  var referenceDate = parseDate(referenceDateStr);
  if(!startDate || !endDate || !referenceDate) return 0;
  if(referenceDate < startDate || referenceDate > endDate) return 0;

  var workDays = task.workDays || [1,2,3,4,5];
  var workDaysRemainingFromFuture = countWorkDays(referenceDateStr, task.endDate, workDays);
  return Math.ceil(remaining / Math.max(1, workDaysRemainingFromFuture));
}

export function getWeeklySummary(){
  var state = getState();
  var summary = [];
  var today = parseDate(todayStr());
  var dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  
  for(var i = 0; i < 7; i++){
    var d = new Date(today);
    d.setDate(d.getDate() + i);
    var dateStr = formatDate(d);
    var dayName = i === 0 ? 'Hoy' : dayNames[d.getDay()];
    
    var totalPending = 0;
    (state.tasks || []).forEach(function(task){
      if(task.type !== "cantidad") return;
      if(task.active === false) return;
      var taskEnd = parseDate(task.endDate);
      var taskStart = parseDate(task.startDate);
      if(!taskEnd || !taskStart) return;
      if(taskEnd < d || taskStart > d) return;
      totalPending += getProjectedCantidadNecesitasHoy(task, dateStr);
    });
    
    summary.push({
      date: dateStr,
      dayName: dayName,
      total: totalPending
    });
  }
  
  return summary;
}

export function renderWeeklySummary(){
  var summary = getWeeklySummary();
  var maxTotal = Math.max(1, Math.max.apply(Math, summary.map(function(s){ return s.total; })));
  
  var html = '<div class="weekly-summary-section">';
  html += '<div class="weekly-summary-header"><h3>📅 Próximos 7 días</h3></div>';
  html += '<div class="weekly-summary-grid">';
  
  summary.forEach(function(day, i){
    var intensity = 0;
    if(day.total > 0){
      if(day.total >= maxTotal * 0.75) intensity = 4;
      else if(day.total >= maxTotal * 0.5) intensity = 3;
      else if(day.total >= maxTotal * 0.25) intensity = 2;
      else intensity = 1;
    }
    
    var isToday = i === 0;
    
    html += '<div class="summary-day summary-level-'+intensity+(isToday?' summary-today':'')+'">';
    html += '<div class="summary-day-name">'+day.dayName+'</div>';
    html += '<div class="summary-day-total">'+day.total+'</div>';
    html += '</div>';
  });
  
  html += '</div>';
  html += '</div>';
  
  return html;
}
