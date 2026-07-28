/* ============================================================
   RENDER: TABLA DE SEMANAS
============================================================ */
import { getState, removeCourse, setActiveWeek } from '../state.js';
import { escapeHtml, fmtDateLong, formatDate } from '../dateUtils.js';
import { getSemesterStats, getSelectedWeek, getWeekStartDateForWeek, getTasksForWeekAndCourse } from '../semesterUtils.js';
import { openModal, closeModal, openCellEditor, openFlagPicker, openAddCourseModal } from '../modals.js';

export function renderTableView(){
  var el = document.getElementById("tableView");
  if(!el) return;
  el.innerHTML = '';
  var stats = getSemesterStats();
  if(!stats){
    el.innerHTML = '<p class="muted">Configura el semestre para ver la tabla.</p>';
    return;
  }

  var state = getState();
  var selectedWeek = getSelectedWeek();
  var weekStart = getWeekStartDateForWeek(selectedWeek);
  var weekEnd = weekStart ? new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6) : null;
  var rangeLabel = weekStart && weekEnd ? fmtDateLong(formatDate(weekStart)) + ' – ' + fmtDateLong(formatDate(weekEnd)) : 'Semana ' + selectedWeek;
  
  // Week navigation header
  var html = '<div class="table-week-nav">';
  html += '<button class="icon-btn table-week-btn" data-step="-1" aria-label="Semana anterior">←</button>';
  html += '<div class="table-week-info">';
  html += '<span class="table-week-label">Semana '+selectedWeek+'</span>';
  html += '<span class="table-week-range">'+rangeLabel+'</span>';
  html += '</div>';
  html += '<button class="icon-btn table-week-btn" data-step="1" aria-label="Semana siguiente">→</button>';
  html += '</div>';
  
  html += '<div class="table-container"><table class="weekly-table"><thead><tr>';
  html += '<th class="week-col">Semana</th>';
  
  state.courses.forEach(function(c){
    html += '<th class="course-header-cell"><span class="course-header-name">'+escapeHtml(c.name)+'</span>';
    html += '<button class="course-header-remove" data-course-id="'+c.id+'" title="Eliminar curso">×</button></th>';
  });
  
  html += '<th style="width:40px;"></th></tr></thead><tbody>';

  for(var w=1; w<=stats.totalWeeks; w++){
    var isCurrent = w === stats.currentWeek && stats.today >= stats.start && stats.today <= stats.end;
    var isPast = w < stats.currentWeek && stats.today >= stats.start;
    var flag = state.weekFlags[w] || 'none';
    var flagClass = flag !== 'none' ? 'flag-'+flag : '';
    var flagIcon = { 'red':'🚩', 'yellow':'⚠', 'green':'✓', 'blue':'★', 'none':'' }[flag] || '';

    var rowClass = '';
    if(isCurrent) rowClass = 'current-week-row';
    else if(isPast) rowClass = 'past-week-row';
    if(w === selectedWeek) rowClass += (rowClass ? ' ' : '') + 'selected-week-row';

    html += '<tr class="'+rowClass+'">';
    html += '<td class="week-col'+(isCurrent?' current':'')+'">';
    html += '<div class="week-header week-selector" data-week="'+w+'" role="button" tabindex="0">';
    html += '<span class="week-number">'+w+'</span>';
    html += '<span class="week-flag '+flagClass+'" data-week="'+w+'" title="Click para cambiar bandera">'+flagIcon+'</span>';
    html += '</div></td>';

    state.courses.forEach(function(c){
      var cellKey = c.id + '_' + w;
      var content = state.cells[cellKey] || '';
      var hasContent = content.trim() !== '';
      var details = state.cellDetails[cellKey] || {};
      var color = details.color || 'default';
      var priority = details.priority || 'medium';
      var colorStyle = '';
      var colorMap = { 'red':'#EF4444', 'orange':'#F97316', 'yellow':'#EAB308', 'green':'#22C55E', 'blue':'#3B82F6', 'purple':'#8B5CF6', 'pink':'#EC4899' };
      if(hasContent && color !== 'default'){
        colorStyle = 'style="background:'+colorMap[color]+';border-color:'+colorMap[color]+';color:#fff;"';
      }

      var priorityClass = hasContent ? 'priority-' + priority : '';
      html += '<td><div class="table-cell'+(hasContent?' has-content':'')+' '+priorityClass+'" data-cell="'+cellKey+'" tabindex="0" '+colorStyle+'>';
      html += '<span class="cell-content">'+escapeHtml(content)+'</span>';
      var taskPills = getTasksForWeekAndCourse(c.id, w).map(function(task){
        return '<span class="week-task-pill">'+escapeHtml(task.name)+'</span>';
      }).join('');
      if(taskPills){ html += '<div>'+taskPills+'</div>'; }
      html += '</div></td>';
    });

    html += '<td></td></tr>';
  }

  html += '</tbody></table>';
  html += '<button class="fullscreen-btn" id="fullscreenBtn" title="Pantalla completa">⛶</button>';
  html += '</div>';
  html += '<button class="btn-add-course" id="addCourseBtn">+ Agregar curso</button>';

  el.innerHTML = html;

  // Week navigation event listeners
  el.querySelectorAll('.table-week-btn').forEach(function(btn){
    btn.addEventListener('click', async function(){
      var step = parseInt(btn.getAttribute('data-step'), 10);
      await setActiveWeek(getSelectedWeek() + step);
      renderTableView();
    });
  });

  // Event listeners
  el.querySelectorAll('.course-header-remove').forEach(function(btn){
    btn.addEventListener('click', async function(){
      var courseId = btn.getAttribute('data-course-id');
      await removeCourse(courseId);
      renderTableView();
    });
  });

  el.querySelectorAll('.week-selector').forEach(function(weekEl){
    weekEl.addEventListener('click', async function(){
      await setActiveWeek(parseInt(weekEl.getAttribute('data-week')));
      renderTableView();
    });
    weekEl.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); setActiveWeek(parseInt(weekEl.getAttribute('data-week'))); }
    });
  });

  el.querySelectorAll('.week-flag').forEach(function(flag){
    flag.addEventListener('click', function(e){
      e.stopPropagation();
      var week = parseInt(flag.getAttribute('data-week'));
      openFlagPicker(week, flag);
    });
  });

  el.querySelectorAll('.table-cell').forEach(function(cell){
    cell.addEventListener('click', function(){
      var cellKey = cell.getAttribute('data-cell');
      openCellEditor(cellKey, cell);
    });
    cell.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); cell.click(); }
    });
  });

  document.getElementById('addCourseBtn').addEventListener('click', openAddCourseModal);

  document.getElementById('fullscreenBtn').addEventListener('click', function(){
    var tableHTML = el.querySelector('.weekly-table').outerHTML;
    openModal(
      '<div class="modal-head"><h2>Tabla Completa</h2>' +
        '<button class="icon-btn btn-ghost" id="closeFullscreen" aria-label="Cerrar">✕</button></div>' +
      '<div class="modal-body" style="padding:0;overflow:auto;" id="fullscreenTableBody">' + tableHTML + '</div>',
      {}
    );
    document.getElementById("modalOverlay").classList.add('fullscreen');
    document.getElementById("closeFullscreen").addEventListener("click", closeModal);

    // Reconectar eventos en la tabla fullscreen
    var fsBody = document.getElementById('fullscreenTableBody');
    fsBody.querySelectorAll('.course-header-remove').forEach(function(btn){
      btn.addEventListener('click', async function(){
        var courseId = btn.getAttribute('data-course-id');
        await removeCourse(courseId);
        closeModal();
        renderTableView();
      });
    });

    fsBody.querySelectorAll('.week-selector').forEach(function(weekEl){
      weekEl.addEventListener('click', async function(){
        await setActiveWeek(parseInt(weekEl.getAttribute('data-week')));
        renderTableView();
      });
      weekEl.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); setActiveWeek(parseInt(weekEl.getAttribute('data-week'))); }
      });
    });

    fsBody.querySelectorAll('.week-flag').forEach(function(flag){
      flag.addEventListener('click', function(e){
        e.stopPropagation();
        var week = parseInt(flag.getAttribute('data-week'));
        openFlagPicker(week, flag);
      });
    });

    fsBody.querySelectorAll('.table-cell').forEach(function(cell){
      cell.addEventListener('click', function(){
        var cellKey = cell.getAttribute('data-cell');
        openCellEditor(cellKey, cell);
      });
      cell.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); cell.click(); }
      });
    });
  });
}
