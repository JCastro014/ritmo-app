/* ============================================================
   RENDER: PANEL DE SEMESTRE
============================================================ */
import { getState, setActiveWeek } from '../state.js';
import { parseDate, todayStr, diffDays, formatDate, fmtDateLong, escapeHtml, clamp } from '../dateUtils.js';
import { getSemesterStats, getSelectedWeek, getWeekStartDateForWeek } from '../semesterUtils.js';
import { openSemesterModal } from '../modals.js';

// Export color interpolation function for use in calendar
export function getPhaseColorForDate(date, phases){
  if(!phases || phases.length === 0) return null;
  
  var targetDate = parseDate(date);
  if(!targetDate) return null;
  
  for(var i = 0; i < phases.length; i++){
    var phaseStart = parseDate(phases[i].start);
    var phaseEnd = parseDate(phases[i].end);
    if(targetDate >= phaseStart && targetDate <= phaseEnd){
      return interpolatePhaseColor(i, phases.length);
    }
  }
  
  return null;
}

function interpolatePhaseColor(index, total){
  // Interpolate from green to red: green -> yellow -> orange -> red
  var colors = ['#22C55E', '#EAB308', '#F97316', '#EF4444']; // green, yellow, orange, red
  if(total <= 1) return colors[0];
  var position = index / (total - 1);
  var colorIndex = position * (colors.length - 1);
  var lowIndex = Math.floor(colorIndex);
  var highIndex = Math.min(lowIndex + 1, colors.length - 1);
  var t = colorIndex - lowIndex;
  
  if(lowIndex === highIndex) return colors[lowIndex];
  
  var c1 = hexToRgb(colors[lowIndex]);
  var c2 = hexToRgb(colors[highIndex]);
  var r = Math.round(c1.r + (c2.r - c1.r) * t);
  var g = Math.round(c1.g + (c2.g - c1.g) * t);
  var b = Math.round(c1.b + (c2.b - c1.b) * t);
  return 'rgb('+r+','+g+','+b+')';
}

function hexToRgb(hex){
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function renderSemesterPanel(){
  var el = document.getElementById("semesterPanel");
  var activeTab = document.querySelector('.topbar-tab.active');
  var mobileActiveTab = document.querySelector('.bottom-nav-item.active');
  var tabName = activeTab ? activeTab.getAttribute('data-tab') : (mobileActiveTab ? mobileActiveTab.getAttribute('data-tab') : 'table');
  
  if(tabName !== 'table'){
    el.style.display = 'none';
    return;
  }
  
  el.style.display = 'block';
  var stats = getSemesterStats();
  var isCollapsed = el.classList.contains('collapsed');
  
  if(!stats){
    el.innerHTML =
      '<div class="semester-empty">' +
        '<div><strong>Configura tu semestre</strong><p class="muted" style="margin-top:4px;">Define fecha de inicio y fin para ver tu progreso general.</p></div>' +
        '<button class="btn btn-primary" id="setupSemesterBtn">Configurar</button>' +
      '</div>';
    document.getElementById("setupSemesterBtn").addEventListener("click", openSemesterModal);
    return;
  }
  // Build phases segments with interpolated colors
  var state = getState();
  var phases = state.semester.phases || [];
  var currentPhaseIndex = -1;
  var phasesHTML = '';
  
  var label;
  var phaseLabel = '';
  var progressColor = '#22C55E'; // Default green
  if(stats.today < stats.start){ label = "Aún no inicia"; }
  else if(stats.today > stats.end){ label = "Semestre finalizado"; }
  else {
    label = "Semana " + clamp(stats.currentWeek,1,stats.totalWeeks) + " de " + stats.totalWeeks;
    if(currentPhaseIndex >= 0 && phases.length > 0){
      phaseLabel = ' — Fase ' + (currentPhaseIndex + 1) + ': ' + escapeHtml(phases[currentPhaseIndex].name);
    }
    // Calculate progress color based on percentage
    progressColor = interpolatePhaseColor(Math.floor((stats.pct / 100) * (phases.length || 1)), phases.length || 1);
  }

  if(phases.length > 0){
    var startDate = parseDate(state.semester.start);
    var endDate = parseDate(state.semester.end);
    var totalDays = diffDays(startDate, endDate) + 1;
    
    phases.forEach(function(phase, i){
      var phaseStart = parseDate(phase.start);
      var phaseEnd = parseDate(phase.end);
      var phaseDays = diffDays(phaseStart, phaseEnd) + 1;
      var phasePct = (phaseDays / totalDays) * 100;
      var phaseLeftPct = (diffDays(startDate, phaseStart) / totalDays) * 100;
      
      var isCurrent = stats.today >= phase.start && stats.today <= phase.end;
      if(isCurrent) currentPhaseIndex = i;
      
      var phaseColor = interpolatePhaseColor(i, phases.length);
      phasesHTML += '<div class="phase-segment '+(isCurrent?'phase-current':'')+'" style="left:'+phaseLeftPct+'%;width:'+phasePct+'%;background:'+phaseColor+';" title="Fase '+(i+1)+': '+escapeHtml(phase.name)+'"></div>';
    });
  }
  
  var ticks = "";
  for(var i=1;i<stats.totalWeeks;i++){
    ticks += '<div class="ruler-tick" style="left:'+ (i/stats.totalWeeks*100) +'%"></div>';
  }

  // Add week context for mobile
  var selectedWeek = getSelectedWeek();
  var weekStart = getWeekStartDateForWeek(selectedWeek);
  var weekEnd = weekStart ? new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6) : null;
  var rangeLabel = weekStart && weekEnd ? fmtDateLong(formatDate(weekStart)) + ' – ' + fmtDateLong(formatDate(weekEnd)) : 'Semana ' + selectedWeek;
  var weekContextHTML = 
    '<div class="mobile-week-context" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 12px;margin-bottom:12px;border:1px solid var(--border);border-radius:999px;background:var(--bg-alt);">' +
      '<span style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);">Semana '+selectedWeek+'</span>' +
      '<span style="font-size:11px;color:var(--text-soft);">'+rangeLabel+'</span>' +
      '<div style="display:flex;gap:4px;margin-left:8px;">' +
        '<button class="icon-btn mobile-week-btn" data-step="-1" style="width:28px;height:28px;font-size:12px;" aria-label="Semana anterior">←</button>' +
        '<button class="icon-btn mobile-week-btn" data-step="1" style="width:28px;height:28px;font-size:12px;" aria-label="Semana siguiente">→</button>' +
      '</div>' +
    '</div>';

  el.innerHTML =
    weekContextHTML +
    '<div class="semester-toggle" id="semesterToggle">' +
      '<div><div class="semester-title">Progreso del semestre</div><div class="semester-week">'+label+phaseLabel+'</div></div>' +
      '<div class="semester-pct" style="color:'+progressColor+';font-size:24px;font-weight:700;">'+Math.round(stats.pct)+'% <span class="semester-toggle-icon" style="font-size:16px;color:var(--text-soft);">▼</span></div>' +
    '</div>' +
    '<div class="semester-body">' +
      '<div class="ruler-track ruler-lg" style="height:12px;position:relative;">' +
        '<div class="ruler-fill" id="semesterFill" style="background:'+progressColor+';"></div>' +
        phasesHTML +
        ticks +
      '</div>' +
      '<div class="semester-dates"><span>'+fmtDateLong(state.semester.start)+'</span><span>'+fmtDateLong(state.semester.end)+'</span></div>' +
    '</div>';

  if(isCollapsed){
    el.classList.add('collapsed');
  }

  setTimeout(function(){
    document.getElementById("semesterFill").style.width = stats.pct + "%";
  }, 50);
  
  document.getElementById("semesterToggle").addEventListener("click", function(){
    el.classList.toggle('collapsed');
  });
  
  // Mobile week navigation
  el.querySelectorAll('.mobile-week-btn').forEach(function(btn){
    btn.addEventListener('click', async function(){
      var step = parseInt(btn.getAttribute('data-step'), 10);
      await setActiveWeek(getSelectedWeek() + step);
      renderSemesterPanel();
    });
  });
}
