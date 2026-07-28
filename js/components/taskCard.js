/* ============================================================
   COMPONENTS: TASK CARD
============================================================ */
import { getState, updateTask } from '../state.js';
import { getTaskStats, daysRemainingLabel } from '../taskStats.js';
import { escapeHtml } from '../dateUtils.js';
import { rulerBarHTML } from './progressBar.js';

export function sortedTaskEntries(){
  var state = getState();
  var rank = { overdue:0, critical:1, onattention:2, onyellow:3, ongreen:4, notstarted:5, done:6 };
  return state.tasks.map(function(t){ return { t:t, stats:getTaskStats(t) }; }).sort(function(a,b){
    var r = rank[a.stats.status] - rank[b.stats.status];
    if(r !== 0) return r;
    if(a.stats.status === "critical" || a.stats.status === "overdue" || a.stats.status === "onattention" || a.stats.status === "onyellow"){
      var ratioA = a.stats.ritmoNecesario > 0 ? a.stats.ritmoActual / a.stats.ritmoNecesario : 1;
      var ratioB = b.stats.ritmoNecesario > 0 ? b.stats.ritmoActual / b.stats.ritmoNecesario : 1;
      return ratioA - ratioB;
    }
    return a.stats.daysRemainingDisplay - b.stats.daysRemainingDisplay;
  });
}

export function taskCardHTML(task, stats, index){
  var typeLabel = task.type === "cantidad" ? "Cantidad" : "Checklist";
  var isInactive = task.active === false;
  var statusLabel = isInactive ? "Pausada" : { ongreen:"Al día", onyellow:"Bien", onattention:"Atención", critical:"Crítico", overdue:"Vencida", done:"Completada", notstarted:"Por iniciar" }[stats.status];
  var barId = "cardbar-" + task.id;
  var icon = task.icon || "📋";
  var categoryColor = task.categoryColor || "";
  var categoryColorVar = categoryColor ? "var(--category-" + categoryColor + ")" : "var(--text-faint)";
  var categoryDot = categoryColor ? '<span class="category-dot" style="background:'+categoryColorVar+'"></span>' : '';
  var inactiveClass = isInactive ? ' task-card-inactive' : '';
  var inactiveAttr = isInactive ? ' data-inactive="true"' : '';
  return (
    '<article class="task-card status-border-'+(isInactive?'inactive':stats.status)+inactiveClass+'" data-id="'+task.id+'" tabindex="0" role="button" aria-label="Abrir tarea '+escapeHtml(task.name)+'"'+inactiveAttr+'>' +
      '<div class="task-card-top">' +
        '<span class="type-chip">'+typeLabel+'</span>' +
        '<span class="status-chip status-chip-'+(isInactive?'inactive':stats.status)+'">'+statusLabel+'</span>' +
        '<button class="task-toggle-btn icon-btn btn-ghost" data-id="'+task.id+'" title="'+(isInactive?'Activar':'Pausar')+' tarea">'+(isInactive?'▶':'⏸')+'</button>' +
      '</div>' +
      '<h3 class="task-name"><div class="task-title-with-icon">'+categoryDot+'<span class="task-icon">'+icon+'</span>'+escapeHtml(task.name)+'</div></h3>' +
      (!isInactive ? rulerBarHTML(barId, stats.status, stats.notStarted ? null : stats.timePercent) : '<div class="ruler-track ruler-sm"><div class="ruler-fill status-inactive"></div></div>') +
      '<div class="task-card-meta">' +
        '<span class="mono">'+stats.progressLabel+'</span>' +
        '<span>'+daysRemainingLabel(stats)+'</span>' +
      '</div>' +
    '</article>'
  );
}
