/* ============================================================
   RENDER: GRID DE TAREAS
============================================================ */
import { getState, updateTask } from '../state.js';
import { sortedTaskEntries, taskCardHTML } from '../components/taskCard.js';
import { mountRulerFill } from '../components/progressBar.js';
import { openTaskDetail } from '../modals.js';
import { renderTodayView } from './todayView.js';
import { renderTableView } from './tableView.js';

export function renderTaskGrid(){
  var grid = document.getElementById("tasksView");
  if(!grid) return;
  var entries = sortedTaskEntries();

  if(entries.length === 0){
    grid.innerHTML =
      '<div class="task-grid">' +
        '<div class="empty-state">' +
          '<div class="glyph">◧</div>' +
          '<h3>Todavía no tienes tareas</h3>' +
          '<p class="muted">Crea tu primera tarea con el botón + de la esquina.</p>' +
        '</div>' +
      '</div>';
    return;
  }

  var existingGrid = grid.querySelector('.task-grid');
  if(!existingGrid){
    grid.innerHTML = '<div class="task-grid">' + entries.map(function(entry, i){ return taskCardHTML(entry.t, entry.stats, i); }).join("") + '</div>';
  } else {
    // Renderizado incremental: actualizar solo las tarjetas que cambiaron
    var existingCards = {};
    existingGrid.querySelectorAll('.task-card').forEach(function(card){
      existingCards[card.getAttribute('data-id')] = card;
    });

    var newHTML = entries.map(function(entry, i){ return taskCardHTML(entry.t, entry.stats, i); }).join("");
    existingGrid.innerHTML = newHTML;
  }

  entries.forEach(function(entry){
    var fillEl = document.getElementById("cardbar-" + entry.t.id);
    mountRulerFill(fillEl, entry.stats.progressPercent);
  });

  Array.prototype.forEach.call(grid.querySelectorAll(".task-card"), function(card){
    card.addEventListener("click", function(){ openTaskDetail(card.getAttribute("data-id")); });
    card.addEventListener("keydown", function(e){
      if(e.key === "Enter" || e.key === " "){ e.preventDefault(); openTaskDetail(card.getAttribute("data-id")); }
    });
  });

  Array.prototype.forEach.call(grid.querySelectorAll(".task-toggle-btn"), function(btn){
    btn.addEventListener("click", function(e){
      e.stopPropagation();
      var taskId = btn.getAttribute("data-id");
      var state = getState();
      var task = state.tasks.find(function(t){ return t.id === taskId; });
      if(task){
        task.active = task.active === false ? true : false;
        
        // Renderizar UI inmediatamente
        renderTaskGrid();
        renderTodayView();
        renderTableView();
        
        // Guardar en background
        updateTask(taskId, { active: task.active }).catch(function(e){
          console.error('[TaskGrid] Error al guardar:', e);
        });
      }
    });
  });
}
