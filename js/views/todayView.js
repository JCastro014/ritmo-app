/* ============================================================
   RENDER: VISTA HOY
============================================================ */
import { getState } from '../state.js';
import { getTaskStats } from '../taskStats.js';
import { todayStr, escapeHtml } from '../dateUtils.js';
import { renderWeeklySummary, renderHeatmap } from '../components/heatmap.js';
import { openTaskDetail } from '../modals.js';

export function renderTodayView(){
  var el = document.getElementById("todayView");
  if(!el) return;

  var state = getState();
  var activeTasks = (state.tasks || []).filter(function(task){
    if(task.active === false) return false;
    var stats = getTaskStats(task);
    return !stats.isDone && !stats.isOverdue;
  });

  if(activeTasks.length === 0){
    el.innerHTML =
      '<div class="today-empty">' +
        '<div class="glyph">🎉</div>' +
        '<h3>¡Todo al día!</h3>' +
        '<p class="muted">No tienes tareas pendientes para hoy.</p>' +
      '</div>';
    return;
  }

  // Order by urgency: critical > onattention > onyellow > ongreen
  var rank = { critical:0, onattention:1, onyellow:2, ongreen:3, notstarted:4 };
  var sorted = activeTasks.map(function(t){ return { t:t, stats:getTaskStats(t) }; }).sort(function(a,b){
    return rank[a.stats.status] - rank[b.stats.status];
  });

  var html = '<div class="today-container">';
  html += '<div class="today-header"><h2>📋 Tareas para hoy</h2></div>';
  html += renderWeeklySummary();
  html += '<div class="today-list">';

  sorted.forEach(function(entry, i){
    var task = entry.t;
    var stats = entry.stats;
    var statusLabel = { ongreen:"Al día", onyellow:"Bien", onattention:"Atención", critical:"Crítico", notstarted:"Por iniciar" }[stats.status];
    var icon = task.icon || "📋";
    var categoryColor = task.categoryColor || "";
    var categoryColorVar = categoryColor ? "var(--category-" + categoryColor + ")" : "var(--text-faint)";
    var categoryDot = categoryColor ? '<span class="category-dot" style="background:'+categoryColorVar+'"></span>' : '';

    html += '<div class="today-item status-border-'+stats.status+'" data-id="'+task.id+'" tabindex="0" role="button" style="animation-delay:'+(i*0.03)+'s">';
    html += '<div class="today-item-left">';
    html += '<span class="task-icon">'+icon+'</span>';
    html += '<div class="today-item-info">';
    html += '<div class="today-item-title">'+categoryDot+escapeHtml(task.name)+'</div>';
    html += '<span class="status-chip status-chip-'+stats.status+'">'+statusLabel+'</span>';
    html += '</div>';
    html += '</div>';
    html += '<div class="today-item-right">';
    if(stats.type === "cantidad"){
      var doneToday = Number((task.log||{})[todayStr()]) || 0;
      var todayIndicator = doneToday > 0
        ? '<div class="today-progress-indicator today-progress-done">✓ Hecho hoy: '+doneToday+'</div>'
        : '<div class="today-progress-indicator today-progress-none">○ Sin avance hoy</div>';
      html += '<div class="today-metric">';
      html += '<span class="metric-label">Necesitás hoy</span>';
      html += '<span class="metric-value">'+stats.necesitasHoy+'</span>';
      html += '</div>';
      html += '<div class="today-metric">';
      html += '<span class="metric-label">Recomendado</span>';
      html += '<span class="metric-value metric-value-yellow">'+stats.recomendado+'</span>';
      html += '</div>';
      html += todayIndicator;
    } else {
      html += '<div class="today-metric">';
      html += '<span class="metric-label">Progreso</span>';
      html += '<span class="metric-value">'+stats.doneSub+'/'+stats.totalSub+'</span>';
      html += '</div>';
    }
    html += '</div>';
    html += '</div>';
  });

  html += '</div>';
  html += renderHeatmap(120);
  html += '</div>';

  el.innerHTML = html;

  el.querySelectorAll('.today-item').forEach(function(item){
    item.addEventListener('click', function(){
      openTaskDetail(item.getAttribute('data-id'));
    });
    item.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openTaskDetail(item.getAttribute('data-id')); }
    });
  });
}
