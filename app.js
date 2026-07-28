(function(){
"use strict";

/* ============================================================
   ESTADO Y PERSISTENCIA
============================================================ */
var STORAGE_KEY = "ritmo_academic_v2";

function loadState(){
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { semester: null, courses: [], cells: {}, weekFlags: {}, calendarChecks: {}, tasks: [], cellDetails: {}, activeWeek: null };
    var parsed = JSON.parse(raw);
    return {
      semester: parsed.semester || null,
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
      cells: parsed.cells || {},
      weekFlags: parsed.weekFlags || {},
      calendarChecks: parsed.calendarChecks || {},
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      cellDetails: parsed.cellDetails || {},
      activeWeek: typeof parsed.activeWeek === 'number' ? parsed.activeWeek : null
    };
  }catch(e){
    console.error("No se pudo leer el almacenamiento local:", e);
    return { semester: null, courses: [], cells: {}, weekFlags: {}, calendarChecks: {}, tasks: [], cellDetails: {}, activeWeek: null };
  }
}

function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){
    console.error("No se pudo guardar:", e);
    alert("No se pudieron guardar los datos en este navegador.");
  }
}

var state = loadState();

/* ============================================================
   UTILIDADES
============================================================ */
function uid(){
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}
function clamp(n, min, max){ return Math.min(max, Math.max(min, n)); }
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, function(s){
    return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[s];
  });
}
function parseDate(str){
  if(!str) return null;
  if(str instanceof Date){
    return new Date(str.getFullYear(), str.getMonth(), str.getDate());
  }
  var value = String(str).trim();
  if(/^-?\d{4}-\d{2}-\d{2}$/.test(value)){
    return new Date(value + "T00:00:00");
  }
  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}
function formatDate(d){
  var y = d.getFullYear();
  var m = String(d.getMonth()+1).padStart(2,"0");
  var day = String(d.getDate()).padStart(2,"0");
  return y + "-" + m + "-" + day;
}
function todayStr(){ return formatDate(new Date()); }
function diffDays(a,b){ return Math.round((b - a) / 86400000); }
function fmtDateLong(str){
  var d = parseDate(str);
  return d.toLocaleDateString("es-ES", { day:"numeric", month:"short", year:"numeric" });
}
function pluralDias(n){ return Math.abs(n) === 1 ? "día" : "días"; }

/* ============================================================
   SEMESTRE
============================================================ */
function getSemesterStats(){
  if(!state.semester) return null;
  var s = state.semester;
  var start = parseDate(s.start), end = parseDate(s.end), today = parseDate(todayStr());
  var totalWeeks = Math.max(1, Math.ceil((diffDays(start,end)+1)/7));
  var rawWeek = Math.floor(diffDays(start,today)/7) + 1;
  var currentWeek = clamp(rawWeek, 0, totalWeeks);
  var pct = clamp(((diffDays(start,today)+1)/(diffDays(start,end)+1))*100, 0, 100);
  return { totalWeeks, currentWeek, pct, start, end, today };
}

function getWeekStartDateForWeek(week){
  if(!state.semester) return null;
  var start = parseDate(state.semester.start);
  var weekStart = new Date(start);
  var day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - day);
  weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
  return weekStart;
}

function getSelectedWeek(){
  var stats = getSemesterStats();
  if(!stats) return 1;
  if(typeof state.activeWeek === 'number' && state.activeWeek >= 1){
    return clamp(state.activeWeek, 1, stats.totalWeeks);
  }
  return clamp(stats.currentWeek || 1, 1, stats.totalWeeks);
}

function setActiveWeek(week, persist){
  var stats = getSemesterStats();
  if(!stats) return;
  state.activeWeek = clamp(week, 1, stats.totalWeeks);
  if(persist !== false) saveState();
  renderViewContext();
  renderTableView();
  renderCalendarView();
  if(document.querySelector('.tab.active') && document.querySelector('.tab.active').getAttribute('data-tab') === 'tasks'){ renderTaskGrid(); }
}

function getWeekNumberForDate(dateStr){
  if(!state.semester) return null;
  var weekStart = getWeekStartDateForWeek(1);
  if(!weekStart) return null;
  var targetDate = parseDate(dateStr);
  var diffDaysCount = Math.floor((targetDate - weekStart) / 86400000);
  var stats = getSemesterStats();
  return clamp(Math.floor(diffDaysCount / 7) + 1, 1, stats ? stats.totalWeeks : 1);
}

function getTasksForWeekAndCourse(courseId, week){
  return (state.tasks || []).filter(function(task){
    if(task.active === false) return false;
    return task.courseId === courseId && task.endDate && getWeekNumberForDate(task.endDate) === week;
  });
}

function renderViewContext(){
  var el = document.getElementById('viewContextBar');
  if(!el) return;
  var stats = getSemesterStats();
  if(!stats || !state.semester){ el.innerHTML=''; return; }
  var week = getSelectedWeek();
  var weekStart = getWeekStartDateForWeek(week);
  var weekEnd = weekStart ? new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6) : null;
  var rangeLabel = weekStart && weekEnd ? fmtDateLong(formatDate(weekStart)) + ' – ' + fmtDateLong(formatDate(weekEnd)) : 'Semana ' + week;
  el.innerHTML =
    '<div class="view-context-pill">' +
      '<span class="view-context-label">Semana activa</span>' +
      '<strong>Semana '+week+'</strong>' +
      '<span class="view-context-range">'+rangeLabel+'</span>' +
    '</div>' +
    '<div class="view-context-actions">' +
      '<button class="icon-btn view-context-btn" data-step="-1" title="Semana anterior" aria-label="Semana anterior">←</button>' +
      '<button class="icon-btn view-context-btn" data-step="1" title="Semana siguiente" aria-label="Semana siguiente">→</button>' +
    '</div>';
  el.querySelectorAll('.view-context-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var step = parseInt(btn.getAttribute('data-step'), 10);
      setActiveWeek(getSelectedWeek() + step);
    });
  });
}

function getCalendarEvents(){
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

/* ============================================================
   RENDER: PANEL DE SEMESTRE
============================================================ */
function renderSemesterPanel(){
  var el = document.getElementById("semesterPanel");
  var activeTab = document.querySelector('.topbar-tab.active');
  var tabName = activeTab ? activeTab.getAttribute('data-tab') : 'table';
  
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
  var label;
  if(stats.today < stats.start){ label = "Aún no inicia"; }
  else if(stats.today > stats.end){ label = "Semestre finalizado"; }
  else { label = "Semana " + clamp(stats.currentWeek,1,stats.totalWeeks) + " de " + stats.totalWeeks; }

  // Build phases segments with interpolated colors
  var phases = state.semester.phases || [];
  var currentPhaseIndex = -1;
  var phasesHTML = '';
  
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

  el.innerHTML =
    '<div class="semester-toggle" id="semesterToggle">' +
      '<div><div class="semester-title">Progreso del semestre</div><div class="semester-week">'+label+'</div></div>' +
      '<div class="semester-pct">'+Math.round(stats.pct)+'% <span class="semester-toggle-icon">▼</span></div>' +
    '</div>' +
    '<div class="semester-body">' +
      '<div class="ruler-track ruler-lg" style="height:12px;position:relative;">' +
        '<div class="ruler-fill status-ongreen" id="semesterFill"></div>' +
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
}

/* ============================================================
   EXPORTAR/IMPORTAR
============================================================ */
function exportData(){
  var data = JSON.stringify(state, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'ritmo_backup_' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(){
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(e){
      try{
        var imported = JSON.parse(e.target.result);
        state = {
          semester: imported.semester || null,
          courses: Array.isArray(imported.courses) ? imported.courses : [],
          cells: imported.cells || {},
          weekFlags: imported.weekFlags || {},
          calendarChecks: imported.calendarChecks || {},
          tasks: Array.isArray(imported.tasks) ? imported.tasks : [],
          cellDetails: imported.cellDetails || {},
          activeWeek: typeof imported.activeWeek === 'number' ? imported.activeWeek : null
        };
        saveState();
        renderAll();
        alert('Datos importados correctamente.');
      } catch(err){
        alert('Error al importar: archivo inválido.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ============================================================
   RENDER: TABLA DE SEMANAS
============================================================ */
function renderTableView(){
  var el = document.getElementById("tableView");
  if(!el) return;
  el.innerHTML = '';
  var stats = getSemesterStats();
  if(!stats){
    el.innerHTML = '<p class="muted">Configura el semestre para ver la tabla.</p>';
    return;
  }

  var selectedWeek = getSelectedWeek();
  var html = '<div class="table-container"><table class="weekly-table"><thead><tr>';
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

  // Event listeners
  el.querySelectorAll('.course-header-remove').forEach(function(btn){
    btn.addEventListener('click', function(){
      var courseId = btn.getAttribute('data-course-id');
      removeCourse(courseId);
    });
  });

  el.querySelectorAll('.week-selector').forEach(function(weekEl){
    weekEl.addEventListener('click', function(){
      setActiveWeek(parseInt(weekEl.getAttribute('data-week')));
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
    document.getElementById('modalOverlay').classList.add('fullscreen');
    document.getElementById('closeFullscreen').addEventListener('click', closeModal);

    // Reconectar eventos en la tabla fullscreen
    var fsBody = document.getElementById('fullscreenTableBody');
    fsBody.querySelectorAll('.course-header-remove').forEach(function(btn){
      btn.addEventListener('click', function(){
        var courseId = btn.getAttribute('data-course-id');
        removeCourse(courseId);
        closeModal();
        renderAll();
      });
    });

    fsBody.querySelectorAll('.week-selector').forEach(function(weekEl){
      weekEl.addEventListener('click', function(){
        setActiveWeek(parseInt(weekEl.getAttribute('data-week')));
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

/* ============================================================
   RENDER: CALENDARIO
============================================================ */
function renderCalendarView(){
  var el = document.getElementById("calendarView");
  if(!el) return;
  el.innerHTML = '';
  var stats = getSemesterStats();
  if(!stats){
    el.innerHTML = '<p class="muted">Configura el semestre para ver el calendario.</p>';
    return;
  }

  var dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  var html = '<div class="calendar-grid">';
  var selectedWeek = getSelectedWeek();
  var selectedWeekStart = getWeekStartDateForWeek(selectedWeek);
  var selectedWeekEnd = selectedWeekStart ? new Date(selectedWeekStart.getFullYear(), selectedWeekStart.getMonth(), selectedWeekStart.getDate() + 6) : null;
  var eventsByDate = {};
  getCalendarEvents().forEach(function(event){
    if(!eventsByDate[event.date]) eventsByDate[event.date] = [];
    eventsByDate[event.date].push(event);
  });

  dayNames.forEach(function(d){ html += '<div class="calendar-day-header">'+d+'</div>'; });

  var current = new Date(stats.start);
  var today = parseDate(todayStr());
  var end = parseDate(stats.end);

  while(current <= end){
    var dateStr = formatDate(current);
    var isToday = dateStr === todayStr();
    var isPast = current < today;
    var isSelectedWeek = selectedWeekStart && selectedWeekEnd && current >= selectedWeekStart && current <= selectedWeekEnd;
    var checks = state.calendarChecks[dateStr] || [];
    var dayEvents = eventsByDate[dateStr] || [];

    html += '<div class="calendar-day'+(isToday?' today':'')+(isPast?' past':'')+(isSelectedWeek?' selected-week':'')+'" data-date="'+dateStr+'">';
    html += '<span class="calendar-day-number">'+current.getDate()+'</span>';
    html += '<div class="calendar-checks">';
    for(var i=0; i<5; i++){
      var checked = checks[i] || false;
      html += '<span class="calendar-check'+(checked?' checked':'')+'" data-date="'+dateStr+'" data-index="'+i+'"></span>';
    }
    html += '</div>';
    if(dayEvents.length){
      html += '<div class="calendar-events">';
      dayEvents.forEach(function(event){
        var colorStyle = event.color ? 'style="border-left-color:'+({red:'#EF4444',orange:'#F97316',yellow:'#EAB308',green:'#22C55E',blue:'#3B82F6',purple:'#8B5CF6',pink:'#EC4899'}[event.color] || 'var(--accent)')+';"' : '';
        html += '<span class="calendar-event'+(event.type === 'task' ? ' task' : '')+'" '+colorStyle+'>'+escapeHtml(event.title)+'</span>';
      });
      html += '</div>';
    }
    html += '</div>';

    current.setDate(current.getDate() + 1);
  }

  html += '</div>';
  el.innerHTML = html;

  el.querySelectorAll('.calendar-check').forEach(function(check){
    check.addEventListener('click', function(e){
      e.stopPropagation();
      var dateStr = check.getAttribute('data-date');
      var idx = parseInt(check.getAttribute('data-index'));
      toggleCalendarCheck(dateStr, idx);
    });
  });
}

function toggleCalendarCheck(dateStr, idx){
  if(!state.calendarChecks[dateStr]) state.calendarChecks[dateStr] = [];
  state.calendarChecks[dateStr][idx] = !state.calendarChecks[dateStr][idx];
  saveState();
  renderCalendarView();
}

/* ============================================================
   CURSOS
============================================================ */
function addCourse(name){
  state.courses.push({ id: uid(), name: name });
  saveState();
  renderAll();
}

function removeCourse(courseId){
  state.courses = state.courses.filter(function(c){ return c.id !== courseId; });
  // Remove cells for this course
  Object.keys(state.cells).forEach(function(key){
    if(key.startsWith(courseId + '_')) delete state.cells[key];
  });
  saveState();
  renderAll();
}

/* ============================================================
   CELDAS
============================================================ */
function updateCell(cellKey, content, color, priority, description, subtasks, eventDate){
  if(!content || content.trim() === ''){
    delete state.cells[cellKey];
    if(state.cellColors) delete state.cellColors[cellKey];
    if(state.cellDetails) delete state.cellDetails[cellKey];
  } else {
    state.cells[cellKey] = content;
    if(!state.cellColors) state.cellColors = {};
    state.cellColors[cellKey] = color || 'default';
    if(!state.cellDetails) state.cellDetails = {};
    state.cellDetails[cellKey] = {
      color: color || 'default',
      priority: priority || 'medium',
      description: description || '',
      subtasks: subtasks || [],
      eventDate: eventDate || ''
    };
  }
  saveState();
  renderAll();
}

/* ============================================================
   BANDERAS
============================================================ */
function setWeekFlag(week, flag){
  if(flag === 'none'){
    delete state.weekFlags[week];
  } else {
    state.weekFlags[week] = flag;
  }
  saveState();
  renderAll();
}

/* ============================================================
   SISTEMA DE TAREAS
============================================================ */
function countWorkDays(startStr, endStr, workDays){
  var start = parseDate(startStr);
  var end = parseDate(endStr);
  if(!start || !end || !workDays || workDays.length === 0) return 0;
  var count = 0;
  var current = new Date(start);
  while(current <= end){
    if(workDays.indexOf(current.getDay()) !== -1){
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return Math.max(1, count);
}

function baseTimeStats(startStr, endStr){
  var start = parseDate(startStr);
  var end = parseDate(endStr);
  var today = parseDate(todayStr());
  var daysTotal = Math.max(1, diffDays(start, end) + 1);
  var daysElapsedRaw = diffDays(start, today) + 1;
  var timePercent = clamp((daysElapsedRaw / daysTotal) * 100, 0, 100);
  var notStarted = today < start;
  var isOverdue = today > end;
  var daysRemainingInclusive = diffDays(today, end) + 1;
  return {
    daysTotal: daysTotal,
    timePercent: timePercent,
    notStarted: notStarted,
    isOverdue: isOverdue,
    daysRemainingRaw: daysRemainingInclusive,
    daysRemainingDisplay: Math.max(0, daysRemainingInclusive)
  };
}

function statusFromProgress(stats){
  if(stats.isDone) return "done";
  if(stats.notStarted) return "notstarted";
  if(stats.isOverdue) return "overdue";
  if(stats.daysRemainingDisplay <= 2 && stats.remaining > 0) return "critical";
  
  if(stats.remaining > 0 && stats.ritmoActual === 0 && stats.daysRemainingDisplay > 2) return "notstarted";
  
  var ratio = stats.ritmoNecesario > 0 ? stats.ritmoActual / stats.ritmoNecesario : 1;
  if(ratio >= 0.9) return "ongreen";
  if(ratio >= 0.7) return "onyellow";
  if(ratio >= 0.5) return "onattention";
  return "critical";
}

function computeCantidadStats(task){
  var bt = baseTimeStats(task.startDate, task.endDate);
  var log = task.log || {};
  var totalUnits = Number(task.totalUnits) || 0;
  var totalDone = 0;
  Object.keys(log).forEach(function(k){ totalDone += Number(log[k]) || 0; });
  var progressPercent = totalUnits > 0 ? clamp((totalDone/totalUnits)*100, 0, 100) : 0;
  var isDone = totalUnits > 0 && totalDone >= totalUnits;
  var remaining = Math.max(0, totalUnits - totalDone);
  var tKey = todayStr();
  var doneToday = Number(log[tKey]) || 0;
  var doneBeforeToday = totalDone - doneToday;
  var remainingBeforeToday = Math.max(0, totalUnits - doneBeforeToday);

  var workDays = task.workDays || [1,2,3,4,5];
  var workDaysTotal = countWorkDays(task.startDate, task.endDate, workDays);
  var workDaysRemaining = countWorkDays(tKey, task.endDate, workDays);
  var workDaysElapsed = countWorkDays(task.startDate, tKey, workDays);

  var metaDiariaOriginal = Math.ceil(totalUnits / Math.max(1, workDaysTotal));
  var necesitasHoy = Math.ceil(remaining / Math.max(1, workDaysRemaining));
  var recomendado = Math.ceil(necesitasHoy * 1.15);
  var exigencia = metaDiariaOriginal > 0 ? necesitasHoy / metaDiariaOriginal : 1;

  var metaHoy;
  if(isDone){ metaHoy = 0; }
  else if(bt.isOverdue){ metaHoy = remainingBeforeToday; }
  else{ metaHoy = Math.ceil(remaining / Math.max(1, workDaysRemaining)); }

  var daysElapsedForPace = workDaysElapsed > 0 ? workDaysElapsed : 1;
  var ritmoActual = workDaysElapsed > 0 ? totalDone / workDaysElapsed : totalDone;
  var ritmoNecesario;
  if(isDone){ ritmoNecesario = 0; }
  else if(bt.isOverdue){ ritmoNecesario = remaining; }
  else{ ritmoNecesario = remaining / Math.max(1, workDaysRemaining); }

  var statsForStatus = {
    isDone: isDone,
    notStarted: bt.notStarted,
    isOverdue: bt.isOverdue,
    daysRemainingDisplay: Math.max(0, workDaysRemaining),
    remaining: remaining,
    ritmoActual: ritmoActual,
    ritmoNecesario: ritmoNecesario,
    exigencia: exigencia
  };
  var status = statusFromProgress(statsForStatus);

  return {
    type: "cantidad",
    status: status,
    progressPercent: progressPercent,
    timePercent: bt.timePercent,
    daysTotal: workDaysTotal,
    daysRemainingDisplay: Math.max(0, workDaysRemaining),
    notStarted: bt.notStarted,
    isOverdue: bt.isOverdue,
    isDone: isDone,
    totalUnits: totalUnits,
    totalDone: totalDone,
    remaining: remaining,
    doneToday: doneToday,
    metaHoy: metaHoy,
    necesitasHoy: necesitasHoy,
    recomendado: recomendado,
    ritmoActual: ritmoActual,
    ritmoNecesario: ritmoNecesario,
    unitLabel: "unidades",
    progressLabel: totalDone + "/" + totalUnits + " unidades"
  };
}

function computeChecklistStats(task){
  var bt = baseTimeStats(task.startDate, task.endDate);
  var subtasks = task.subtasks || [];
  var totalSub = subtasks.length;
  var doneSub = subtasks.filter(function(s){ return s.done; }).length;
  var progressPercent = totalSub > 0 ? (doneSub/totalSub)*100 : 0;
  var isDone = totalSub > 0 && doneSub === totalSub;
  var remaining = Math.max(0, totalSub - doneSub);
  
  var workDays = task.workDays || [1,2,3,4,5];
  var workDaysTotal = countWorkDays(task.startDate, task.endDate, workDays);
  var workDaysRemaining = countWorkDays(todayStr(), task.endDate, workDays);
  var workDaysElapsed = workDaysTotal - workDaysRemaining;
  
  var ritmoActual = workDaysElapsed > 0 ? doneSub / Math.max(1, workDaysElapsed) : 0;
  var ritmoNecesario;
  if(isDone){ ritmoNecesario = 0; }
  else if(bt.isOverdue){ ritmoNecesario = remaining; }
  else{ ritmoNecesario = remaining / Math.max(1, workDaysRemaining); }
  
  var statsForStatus = {
    isDone: isDone,
    notStarted: bt.notStarted,
    isOverdue: bt.isOverdue,
    daysRemainingDisplay: Math.max(0, workDaysRemaining),
    remaining: remaining,
    ritmoActual: ritmoActual,
    ritmoNecesario: ritmoNecesario
  };
  var status = statusFromProgress(statsForStatus);
  
  return {
    type: "checklist",
    status: status,
    progressPercent: progressPercent,
    timePercent: bt.timePercent,
    daysTotal: workDaysTotal,
    daysRemainingDisplay: Math.max(0, workDaysRemaining),
    notStarted: bt.notStarted,
    isOverdue: bt.isOverdue,
    isDone: isDone,
    totalSub: totalSub,
    doneSub: doneSub,
    ritmoActual: ritmoActual,
    ritmoNecesario: ritmoNecesario,
    progressLabel: doneSub + "/" + totalSub + " subtareas"
  };
}

function getTaskStats(task){
  return task.type === "cantidad" ? computeCantidadStats(task) : computeChecklistStats(task);
}

function daysRemainingLabel(stats){
  if(stats.isDone) return "Completada";
  if(stats.notStarted) return "Aún no inicia";
  if(stats.isOverdue) return "Venció";
  if(stats.daysRemainingDisplay === 0) return "Vence hoy";
  return stats.daysRemainingDisplay + " " + pluralDias(stats.daysRemainingDisplay) + " restantes";
}

function mountRulerFill(el, targetPercent){
  el.style.width = "0%";
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      el.style.width = clamp(targetPercent,0,100) + "%";
    });
  });
}

function rulerBarHTML(id, status, marker){
  var markerHTML = (marker!=null) ? '<div class="ruler-marker" style="left:'+clamp(marker,0,100)+'%"></div>' : "";
  return '' +
    '<div class="ruler-track" id="'+id+'-track">' +
      '<div class="ruler-fill status-'+status+'" id="'+id+'"></div>' +
      markerHTML +
    '</div>';
}

/* ============================================================
   HEATMAP DE CONSTANCIA
============================================================ */
function renderProgressChart(task){
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
function calculateStreak(){
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
function getDailyTotals(daysBack){
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

function renderHeatmap(daysBack){
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

function getProjectedCantidadNecesitasHoy(task, referenceDateStr){
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

function getWeeklySummary(){
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

function renderWeeklySummary(){
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
function renderTodayView(){
  var el = document.getElementById("todayView");
  if(!el) return;

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

/* ---------- RENDER: GRID DE TAREAS ---------- */
function sortedTaskEntries(){
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

function taskCardHTML(task, stats, index){
  var typeLabel = task.type === "cantidad" ? "Cantidad" : "Checklist";
  var isInactive = task.active === false;
  var statusLabel = isInactive ? "Pausada" : { ongreen:"Al día", onyellow:"Bien", onattention:"Atención", critical:"Crítico", overdue:"Vencida", done:"Completada", notstarted:"Por iniciar" }[stats.status];
  var barId = "cardbar-" + index;
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

function renderTaskGrid(){
  var grid = document.getElementById("tasksView");
  if(!grid) return;
  grid.innerHTML = '';
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

  grid.innerHTML = '<div class="task-grid">' + entries.map(function(entry, i){ return taskCardHTML(entry.t, entry.stats, i); }).join("") + '</div>';

  entries.forEach(function(entry, i){
    var fillEl = document.getElementById("cardbar-" + i);
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
      var task = state.tasks.find(function(t){ return t.id === taskId; });
      if(task){
        task.active = task.active === false ? true : false;
        saveState();
        renderTaskGrid();
        renderTodayView();
        renderTableView();
      }
    });
  });
}

/* ============================================================
   MODALES
============================================================ */
function escListener(e){ if(e.key === "Escape") closeModal(); }

function openModal(contentHTML, opts){
  opts = opts || {};
  var root = document.getElementById("modalRoot");
  root.innerHTML =
    '<div class="modal-overlay" id="modalOverlay">' +
      '<div class="modal-panel ' + (opts.wide ? "modal-wide" : "") + '" id="modalPanel">' + contentHTML + '</div>' +
    '</div>';
  var overlay = document.getElementById("modalOverlay");
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ overlay.classList.add("open"); }); });
  overlay.addEventListener("click", function(e){ if(e.target === overlay) closeModal(); });
  document.addEventListener("keydown", escListener);
  document.body.style.overflow = "hidden";
  return overlay;
}

function closeModal(refresh){
  if(refresh === undefined) refresh = true;
  var overlay = document.getElementById("modalOverlay");
  document.removeEventListener("keydown", escListener);
  document.body.style.overflow = "";
  if(!overlay){ if(refresh) renderAll(); return; }
  overlay.classList.remove("open");
  setTimeout(function(){
    document.getElementById("modalRoot").innerHTML = "";
    if(refresh) renderAll();
  }, 240);
}

/* ---------- Modal: Configurar Semestre ---------- */
function openSemesterModal(){
  var s = state.semester || {};
  var phases = s.phases || [];
  var numPhases = phases.length || 4;
  var defaultNames = ['Adaptación', 'Ajuste', 'Mejora', 'Decisiva', 'Consolidación', 'Refuerzo', 'Finalización', 'Cierre'];
  
  var phasesHTML = '';
  if(phases.length > 0){
    phasesHTML = '<div class="field"><label>Fases del semestre</label><div class="phases-list">';
    phases.forEach(function(phase, i){
      phasesHTML += '<div class="phase-item"><input type="text" class="phase-name-input" data-index="'+i+'" value="'+escapeHtml(phase.name)+'" placeholder="Nombre de fase">';
      phasesHTML += '<span class="phase-date-range">'+fmtDateLong(phase.start)+' - '+fmtDateLong(phase.end)+'</span></div>';
    });
    phasesHTML += '</div><button type="button" class="btn btn-ghost" id="recalcPhases">Recalcular fases</button></div>';
  }
  
  openModal(
    '<div class="modal-head"><h2>Semestre</h2>' +
      '<button class="icon-btn btn-ghost" id="closeSemModal" aria-label="Cerrar">✕</button></div>' +
    '<div class="modal-body">' +
      '<div class="field"><label>Fecha de inicio</label><input type="date" id="semStart" value="'+(s.start||"")+'"></div>' +
      '<div class="field"><label>Fecha de fin</label><input type="date" id="semEnd" value="'+(s.end||"")+'"></div>' +
      '<div class="field"><label>Dividir en fases</label><input type="number" id="semPhases" value="'+numPhases+'" min="2" max="8"></div>' +
      phasesHTML +
      '<p class="error-msg" id="semError"></p>' +
    '</div>' +
    '<div class="modal-foot">' +
      '<button class="btn" id="semCancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="semSave">Guardar</button>' +
    '</div>'
  );
  document.getElementById("closeSemModal").addEventListener("click", closeModal);
  document.getElementById("semCancel").addEventListener("click", closeModal);
  
  var recalcBtn = document.getElementById("recalcPhases");
  if(recalcBtn){
    recalcBtn.addEventListener("click", function(){
    var start = document.getElementById("semStart").value;
    var end = document.getElementById("semEnd").value;
    var num = parseInt(document.getElementById("semPhases").value) || 4;
    var err = document.getElementById("semError");
    if(!start || !end){ err.textContent = "Completa ambas fechas primero."; return; }
    if(parseDate(end) < parseDate(start)){ err.textContent = "La fecha de fin debe ser posterior al inicio."; return; }
    
    var startDate = parseDate(start);
    var endDate = parseDate(end);
    var totalDays = diffDays(startDate, endDate) + 1;
    var daysPerPhase = Math.floor(totalDays / num);
    var remainingDays = totalDays % num;
    
    var newPhases = [];
    var phaseStart = startDate;
    for(var i = 0; i < num; i++){
      var daysInThisPhase = daysPerPhase + (i < remainingDays ? 1 : 0);
      var phaseEnd = new Date(phaseStart);
      phaseEnd.setDate(phaseEnd.getDate() + daysInThisPhase - 1);
      
      newPhases.push({
        name: defaultNames[i] || 'Fase ' + (i + 1),
        start: formatDate(phaseStart),
        end: formatDate(phaseEnd)
      });
      
      phaseStart = new Date(phaseEnd);
      phaseStart.setDate(phaseStart.getDate() + 1);
    }
    
    var phasesList = document.querySelector('.phases-list');
    phasesList.innerHTML = newPhases.map(function(phase, i){
      return '<div class="phase-item"><input type="text" class="phase-name-input" data-index="'+i+'" value="'+escapeHtml(phase.name)+'" placeholder="Nombre de fase"><span class="phase-date-range">'+fmtDateLong(phase.start)+' - '+fmtDateLong(phase.end)+'</span></div>';
    }).join('');
  });
  }
  
  document.getElementById("semSave").addEventListener("click", function(){
    var start = document.getElementById("semStart").value;
    var end = document.getElementById("semEnd").value;
    var num = parseInt(document.getElementById("semPhases").value) || 4;
    var err = document.getElementById("semError");
    if(!start || !end){ err.textContent = "Completa ambas fechas."; return; }
    if(parseDate(end) < parseDate(start)){ err.textContent = "La fecha de fin debe ser posterior al inicio."; return; }
    
    var startDate = parseDate(start);
    var endDate = parseDate(end);
    var totalDays = diffDays(startDate, endDate) + 1;
    var daysPerPhase = Math.floor(totalDays / num);
    var remainingDays = totalDays % num;
    
    var newPhases = [];
    var phaseStart = startDate;
    var phaseNames = [];
    document.querySelectorAll('.phase-name-input').forEach(function(input){
      phaseNames.push(input.value);
    });
    
    for(var i = 0; i < num; i++){
      var daysInThisPhase = daysPerPhase + (i < remainingDays ? 1 : 0);
      var phaseEnd = new Date(phaseStart);
      phaseEnd.setDate(phaseEnd.getDate() + daysInThisPhase - 1);
      
      newPhases.push({
        name: phaseNames[i] || defaultNames[i] || 'Fase ' + (i + 1),
        start: formatDate(phaseStart),
        end: formatDate(phaseEnd)
      });
      
      phaseStart = new Date(phaseEnd);
      phaseStart.setDate(phaseStart.getDate() + 1);
    }
    
    state.semester = { start: start, end: end, phases: newPhases };
    saveState();
    closeModal();
    renderAll();
  });
}

/* ---------- Modal: Agregar Curso ---------- */
function openAddCourseModal(){
  openModal(
    '<div class="modal-head"><h2>Agregar Curso</h2>' +
      '<button class="icon-btn btn-ghost" id="closeCourseModal" aria-label="Cerrar">✕</button></div>' +
    '<div class="modal-body">' +
      '<div class="field"><label>Nombre del curso</label><input type="text" id="courseName" placeholder="Ej. Inter 2"></div>' +
      '<p class="error-msg" id="courseError"></p>' +
    '</div>' +
    '<div class="modal-foot">' +
      '<button class="btn" id="courseCancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="courseSave">Agregar</button>' +
    '</div>'
  );
  document.getElementById("closeCourseModal").addEventListener("click", closeModal);
  document.getElementById("courseCancel").addEventListener("click", closeModal);
  document.getElementById("courseSave").addEventListener("click", function(){
    var name = document.getElementById("courseName").value.trim();
    var err = document.getElementById("courseError");
    if(!name){ err.textContent = "Ingresa un nombre para el curso."; return; }
    addCourse(name);
    closeModal();
  });
}

/* ---------- Modal: Editar Celda ---------- */
function openCellEditor(cellKey, cellEl){
  var currentContent = state.cells[cellKey] || '';
  var details = state.cellDetails[cellKey] || { color: 'default', priority: 'medium', description: '', subtasks: [] };

  var colorOptions = [
    { value: 'default', label: 'Por defecto', color: 'var(--good)' },
    { value: 'red', label: 'Rojo', color: '#EF4444' },
    { value: 'orange', label: 'Naranja', color: '#F97316' },
    { value: 'yellow', label: 'Amarillo', color: '#EAB308' },
    { value: 'green', label: 'Verde', color: '#22C55E' },
    { value: 'blue', label: 'Azul', color: '#3B82F6' },
    { value: 'purple', label: 'Morado', color: '#8B5CF6' },
    { value: 'pink', label: 'Rosa', color: '#EC4899' }
  ];

  var colorHTML = colorOptions.map(function(opt){
    var isSelected = opt.value === details.color;
    return '<div class="color-option '+(isSelected?'selected':'')+'" data-color="'+opt.value+'" style="background:'+opt.color+';" title="'+opt.label+'"></div>';
  }).join('');

  var priorityOptions = [
    { value: 'low', label: 'Baja', color: '#22C55E' },
    { value: 'medium', label: 'Media', color: '#EAB308' },
    { value: 'high', label: 'Alta', color: '#EF4444' }
  ];

  var priorityHTML = priorityOptions.map(function(opt){
    var isSelected = opt.value === details.priority;
    return '<div class="priority-option '+(isSelected?'selected':'')+'" data-priority="'+opt.value+'" style="background:'+opt.color+';" title="'+opt.label+'"></div>';
  }).join('');

  var subtasksHTML = (details.subtasks || []).map(function(st){
    return '<div class="cell-subtask-row" data-id="'+st.id+'">' +
      '<input type="checkbox" class="cell-subtask-check" '+(st.done?'checked':'')+'>' +
      '<input type="text" class="cell-subtask-input" value="'+escapeHtml(st.text)+'" placeholder="Subtarea">' +
      '<button type="button" class="row-remove-btn cell-subtask-remove">✕</button>' +
    '</div>';
  }).join('');

  openModal(
    '<div class="modal-head"><h2>Editar Evento</h2>' +
      '<button class="icon-btn btn-ghost" id="closeCellModal" aria-label="Cerrar">✕</button></div>' +
    '<div class="modal-body modal-wide-body">' +
      '<div class="field"><label>Título</label>' +
        '<input type="text" id="cellContent" value="'+escapeHtml(currentContent)+'" placeholder="Ej. Parcial 1"></div>' +
      '<div class="field"><label>Descripción</label>' +
        '<textarea id="cellDescription" rows="2" placeholder="Detalles adicionales...">'+escapeHtml(details.description || '')+'</textarea></div>' +
      '<div class="field"><label>Fecha del evento</label>' +
        '<input type="date" id="cellEventDate" value="'+escapeHtml(details.eventDate || '')+'"></div>' +
      '<div class="field"><label>Prioridad</label>' +
        '<div class="priority-picker" id="priorityPicker">'+priorityHTML+'</div>' +
      '</div>' +
      '<div class="field"><label>Color</label>' +
        '<div class="color-picker" id="colorPicker">'+colorHTML+'</div>' +
      '</div>' +
      '<div class="field"><label>Subtareas</label>' +
        '<div id="cellSubtaskList">'+subtasksHTML+'</div>' +
        '<button type="button" class="add-row-btn" id="addCellSubtask">+ Agregar subtarea</button>' +
      '</div>' +
    '</div>' +
    '<div class="modal-foot">' +
      '<button class="btn" id="cellCancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="cellSave">Guardar</button>' +
    '</div>',
    { wide: true }
  );
  document.getElementById("closeCellModal").addEventListener("click", closeModal);
  document.getElementById("cellCancel").addEventListener("click", closeModal);

  var selectedColor = details.color;
  var selectedPriority = details.priority;

  document.getElementById("colorPicker").addEventListener("click", function(e){
    if(e.target.classList.contains('color-option')){
      document.querySelectorAll('.color-option').forEach(function(opt){ opt.classList.remove('selected'); });
      e.target.classList.add('selected');
      selectedColor = e.target.getAttribute('data-color');
    }
  });

  document.getElementById("priorityPicker").addEventListener("click", function(e){
    if(e.target.classList.contains('priority-option')){
      document.querySelectorAll('.priority-option').forEach(function(opt){ opt.classList.remove('selected'); });
      e.target.classList.add('selected');
      selectedPriority = e.target.getAttribute('data-priority');
    }
  });

  document.getElementById("addCellSubtask").addEventListener("click", function(){
    var newId = uid();
    document.getElementById("cellSubtaskList").insertAdjacentHTML("beforeend",
      '<div class="cell-subtask-row" data-id="'+newId+'">' +
        '<input type="checkbox" class="cell-subtask-check">' +
        '<input type="text" class="cell-subtask-input" placeholder="Subtarea">' +
        '<button type="button" class="row-remove-btn cell-subtask-remove">✕</button>' +
      '</div>'
    );
  });

  document.getElementById("cellSubtaskList").addEventListener("click", function(e){
    if(e.target.classList.contains('cell-subtask-remove')){
      e.target.closest('.cell-subtask-row').remove();
    }
  });

  document.getElementById("cellSave").addEventListener("click", function(){
    var content = document.getElementById("cellContent").value.trim();
    var description = document.getElementById("cellDescription").value.trim();
    var eventDate = document.getElementById("cellEventDate").value;
    var subtasks = [];
    document.querySelectorAll('.cell-subtask-row').forEach(function(row){
      var text = row.querySelector('.cell-subtask-input').value.trim();
      if(text){
        subtasks.push({
          id: row.getAttribute('data-id') || uid(),
          text: text,
          done: row.querySelector('.cell-subtask-check').checked
        });
      }
    });
    updateCell(cellKey, content, selectedColor, selectedPriority, description, subtasks, eventDate);
    closeModal();
  });
  setTimeout(function(){ document.getElementById("cellContent").focus(); }, 100);
}

/* ---------- Modal: Selector de Banderas ---------- */
function openFlagPicker(week, flagEl){
  var currentFlag = state.weekFlags[week] || 'none';
  openModal(
    '<div class="modal-head"><h2>Bandera Semana '+week+'</h2>' +
      '<button class="icon-btn btn-ghost" id="closeFlagModal" aria-label="Cerrar">✕</button></div>' +
    '<div class="modal-body">' +
      '<p class="muted">Selecciona un color para marcar esta semana:</p>' +
      '<div class="flag-picker">' +
        '<span class="flag-option flag-none" data-flag="none" title="Sin bandera">✕</span>' +
        '<span class="flag-option flag-red" data-flag="red" title="Importante">🚩</span>' +
        '<span class="flag-option flag-yellow" data-flag="yellow" title="Atención">⚠</span>' +
        '<span class="flag-option flag-green" data-flag="green" title="Completado">✓</span>' +
        '<span class="flag-option flag-blue" data-flag="blue" title="Destacado">★</span>' +
      '</div>' +
    '</div>' +
    '<div class="modal-foot">' +
      '<button class="btn" id="flagCancel">Cancelar</button>' +
    '</div>'
  );
  document.getElementById("closeFlagModal").addEventListener("click", closeModal);
  document.getElementById("flagCancel").addEventListener("click", closeModal);
  
  document.querySelectorAll('.flag-option').forEach(function(opt){
    opt.addEventListener('click', function(){
      var flag = opt.getAttribute('data-flag');
      setWeekFlag(week, flag);
      closeModal();
    });
  });
}

/* ============================================================
   MODAL: NUEVA / EDITAR TAREA
============================================================ */
function subtaskRowHTML(value){
  return (
    '<div class="subtask-row">' +
      '<input type="text" class="subtask-input" placeholder="Nombre de la subtarea" value="'+escapeHtml(value||"")+'">' +
      '<button type="button" class="row-remove-btn" aria-label="Quitar">✕</button>' +
    '</div>'
  );
}

function taskFormHTML(existing){
  var isEdit = !!existing;
  var t = existing || { type:"cantidad", startDate: todayStr(), endDate:"", totalUnits:"", workDays:[1,2,3,4,5], subtasks:[{name:"",done:false}], courseId:"", icon:"", categoryColor:"" };
  var subRows = (t.subtasks && t.subtasks.length ? t.subtasks : [{name:"",done:false}])
    .map(function(s){ return subtaskRowHTML(s.name); }).join("");
  var courseOptions = state.courses.map(function(course){
    var selected = (t.courseId || "") === course.id ? ' selected' : '';
    return '<option value="'+course.id+'"'+selected+'>'+escapeHtml(course.name)+'</option>';
  }).join('');
  var workDays = t.workDays || [1,2,3,4,5];
  var dayCheckboxes = '';
  for(var i=0; i<=6; i++){
    var checked = workDays.indexOf(i) !== -1 ? ' checked' : '';
    var dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    var shortNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    dayCheckboxes += '<label class="day-checkbox"><input type="checkbox" value="'+i+'" data-day="'+dayNames[i]+'"'+checked+'> '+shortNames[i]+'</label>';
  }
  
  var categoryColors = [
    { value: "", label: "Por defecto", color: "var(--text-faint)" },
    { value: "blue", label: "Azul", color: "var(--category-blue)" },
    { value: "purple", label: "Morado", color: "var(--category-purple)" },
    { value: "cyan", label: "Cyan", color: "var(--category-cyan)" },
    { value: "pink", label: "Rosado", color: "var(--category-pink)" },
    { value: "gray", label: "Gris", color: "var(--category-gray)" },
    { value: "teal", label: "Teal", color: "var(--category-teal)" }
  ];
  var categoryOptions = categoryColors.map(function(c){
    var selected = (t.categoryColor || "") === c.value ? ' selected' : '';
    return '<option value="'+c.value+'"'+selected+'>'+c.label+'</option>';
  }).join('');

  return (
    '<div class="modal-head"><h2>'+(isEdit ? "Editar tarea" : "Nueva tarea")+'</h2>' +
      '<button class="icon-btn btn-ghost" id="closeTaskForm" aria-label="Cerrar">✕</button></div>' +
    '<div class="modal-body">' +
      '<div class="field"><label>Nombre de la tarea</label>' +
        '<input type="text" id="tfName" placeholder="Ej. Matemática — 80 ejercicios" value="'+escapeHtml(t.name||"")+'"></div>' +

      '<div class="field-row">' +
        '<div class="field"><label>Ícono (emoji)</label>' +
          '<input type="text" id="tfIcon" placeholder="📋" maxlength="2" value="'+escapeHtml(t.icon||"")+'">' +
        '</div>' +
        '<div class="field"><label>Color de categoría</label>' +
          '<select id="tfCategoryColor">'+categoryOptions+'</select>' +
        '</div>' +
      '</div>' +

      '<div class="field"><label>Materia / Curso</label>' +
        '<select id="tfCourseId"><option value="">Sin curso</option>'+courseOptions+'</select></div>' +

      '<div class="type-toggle">' +
        '<input type="radio" name="tfType" id="tfTypeCantidad" value="cantidad" '+(t.type==="cantidad"?"checked":"")+'>' +
        '<label for="tfTypeCantidad">Por cantidad</label>' +
        '<input type="radio" name="tfType" id="tfTypeChecklist" value="checklist" '+(t.type==="checklist"?"checked":"")+'>' +
        '<label for="tfTypeChecklist">Por checklist</label>' +
      '</div>' +

      '<div id="tfCantidadFields" class="'+(t.type==="cantidad"?"":"hidden")+'">' +
        '<div class="field"><label>Total de unidades</label><input type="number" id="tfTotalUnits" min="1" step="1" placeholder="80" value="'+(t.totalUnits||"")+'"></div>' +
        '<div class="field"><label>Días de trabajo</label>' +
          '<div class="day-picker" id="tfDayPicker">'+dayCheckboxes+'</div>' +
        '</div>' +
      '</div>' +

      '<div id="tfChecklistFields" class="'+(t.type==="checklist"?"":"hidden")+'">' +
        '<label style="display:block;font-size:12.5px;font-weight:600;color:var(--text-soft);margin-bottom:6px;">Subtareas</label>' +
        '<div id="tfSubtaskList">'+subRows+'</div>' +
        '<button type="button" class="add-row-btn" id="tfAddSubtask">+ Agregar subtarea</button>' +
      '</div>' +

      '<div class="field-row" style="margin-top:16px;">' +
        '<div class="field"><label>Fecha de inicio</label><input type="date" id="tfStart" value="'+(t.startDate||todayStr())+'"></div>' +
        '<div class="field"><label>Fecha límite</label><input type="date" id="tfEnd" value="'+(t.endDate||"")+'"></div>' +
      '</div>' +
      (isEdit ? '<div class="field" style="margin-top:16px;"><label class="toggle-label"><input type="checkbox" id="tfActive" '+(t.active!==false?'checked':'')+'> Tarea activa</label></div>' : '') +
      '<p class="error-msg" id="tfError"></p>' +
    '</div>' +
    '<div class="modal-foot">' +
      (isEdit ? '<button class="btn btn-danger" id="tfDelete" style="margin-right:auto;">Eliminar</button>' : '') +
      '<button class="btn" id="tfCancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="tfSave">Guardar</button>' +
    '</div>'
  );
}

function wireTaskForm(existing){
  var isEdit = !!existing;

  document.getElementById("closeTaskForm").addEventListener("click", function(){ closeModal(); });
  document.getElementById("tfCancel").addEventListener("click", function(){ closeModal(); });

  function syncTypeFields(){
    var type = document.querySelector('input[name="tfType"]:checked').value;
    document.getElementById("tfCantidadFields").classList.toggle("hidden", type!=="cantidad");
    document.getElementById("tfChecklistFields").classList.toggle("hidden", type!=="checklist");
  }
  document.getElementById("tfTypeCantidad").addEventListener("change", syncTypeFields);
  document.getElementById("tfTypeChecklist").addEventListener("change", syncTypeFields);

  function wireRemoveButtons(){
    Array.prototype.forEach.call(document.querySelectorAll(".row-remove-btn"), function(btn){
      btn.onclick = function(){
        var list = document.getElementById("tfSubtaskList");
        if(list.children.length > 1){ btn.closest(".subtask-row").remove(); }
      };
    });
  }
  wireRemoveButtons();

  document.getElementById("tfAddSubtask").addEventListener("click", function(){
    document.getElementById("tfSubtaskList").insertAdjacentHTML("beforeend", subtaskRowHTML(""));
    wireRemoveButtons();
  });

  if(isEdit){
    var tfDeleteBtn = document.getElementById("tfDelete");
    var tfDeleteBtnClone = tfDeleteBtn.cloneNode(true);
    tfDeleteBtn.parentNode.replaceChild(tfDeleteBtnClone, tfDeleteBtn);
    tfDeleteBtnClone.addEventListener("click", function(){
      openConfirmModal(
        "Eliminar tarea",
        "¿Seguro que quieres eliminar \"" + existing.name + "\"? Esta acción no se puede deshacer.",
        function(){
          state.tasks = state.tasks.filter(function(t){ return t.id !== existing.id; });
          saveState();
          closeModal();
        },
        function(){ openTaskFormModal(existing.id); }
      );
    });
  }

  document.getElementById("tfSave").addEventListener("click", function(){
    var err = document.getElementById("tfError");
    var name = document.getElementById("tfName").value.trim();
    var type = document.querySelector('input[name="tfType"]:checked').value;
    var start = document.getElementById("tfStart").value;
    var end = document.getElementById("tfEnd").value;
    var courseId = document.getElementById("tfCourseId").value || "";
    var icon = document.getElementById("tfIcon").value.trim() || "";
    var categoryColor = document.getElementById("tfCategoryColor").value || "";

    if(!name){ err.textContent = "Ponle un nombre a la tarea."; return; }
    if(!start || !end){ err.textContent = "Completa las fechas de inicio y fin."; return; }
    if(parseDate(end) < parseDate(start)){ err.textContent = "La fecha límite debe ser posterior al inicio."; return; }

    var payload = { name:name, type:type, startDate:start, endDate:end, courseId:courseId, icon:icon, categoryColor:categoryColor };

    if(type === "cantidad"){
      var totalUnits = parseInt(document.getElementById("tfTotalUnits").value, 10);
      if(!totalUnits || totalUnits <= 0){ err.textContent = "Indica un total de unidades mayor a 0."; return; }
      payload.totalUnits = totalUnits;
      var selectedDays = [];
      document.querySelectorAll("#tfDayPicker input[type='checkbox']:checked").forEach(function(cb){
        selectedDays.push(parseInt(cb.value, 10));
      });
      console.log('[DEBUG] Guardando tarea - selectedDays:', selectedDays);
      if(selectedDays.length === 0){ err.textContent = "Selecciona al menos un día de trabajo."; return; }
      payload.workDays = selectedDays;
      payload.log = isEdit && existing.log ? existing.log : {};
    } else {
      var names = Array.prototype.map.call(document.querySelectorAll(".subtask-input"), function(i){ return i.value.trim(); }).filter(Boolean);
      if(names.length === 0){ err.textContent = "Agrega al menos una subtarea."; return; }
      if(isEdit && existing.subtasks){
        var oldByName = {};
        existing.subtasks.forEach(function(s){ if(!(s.name in oldByName)) oldByName[s.name] = []; oldByName[s.name].push(s); });
        payload.subtasks = names.map(function(n){
          var bucket = oldByName[n];
          if(bucket && bucket.length){ return bucket.shift(); }
          return { id: uid(), name: n, done:false };
        });
      } else {
        payload.subtasks = names.map(function(n){ return { id: uid(), name:n, done:false }; });
      }
    }

    if(isEdit){
      var activeCheckbox = document.getElementById("tfActive");
      if(activeCheckbox){
        payload.active = activeCheckbox.checked;
      }
      Object.assign(existing, payload);
      console.log('[DEBUG] Tarea editada - existing.workDays después de Object.assign:', existing.workDays);
      saveState();
      closeModal();
      renderAll();
      setTimeout(function(){
        openTaskDetail(existing.id);
      }, 300);
    } else {
      payload.id = uid();
      payload.createdAt = Date.now();
      payload.active = true;
      state.tasks.push(payload);
      saveState();
      closeModal();
      renderAll();
    }
  });
}

function openTaskFormModal(existingId){
  var existing = existingId ? state.tasks.find(function(t){ return t.id === existingId; }) : null;
  openModal(taskFormHTML(existing), { wide:true });
  wireTaskForm(existing);
}

/* ============================================================
   MODAL: CONFIRMACIÓN GENÉRICA
============================================================ */
function openConfirmModal(title, message, onConfirm, onCancel){
  openModal(
    '<div class="modal-head"><h2>'+escapeHtml(title)+'</h2></div>' +
    '<div class="modal-body"><p class="confirm-msg">'+escapeHtml(message)+'</p></div>' +
    '<div class="modal-foot">' +
      '<button class="btn" id="confirmCancel">Cancelar</button>' +
      '<button class="btn btn-danger" id="confirmOk">Eliminar</button>' +
    '</div>', {}
  );
  document.getElementById("confirmCancel").addEventListener("click", function(){
    if(onCancel){ onCancel(); } else { closeModal(); }
  });
  document.getElementById("confirmOk").addEventListener("click", function(){ onConfirm(); });
}

/* ============================================================
   MODAL: DETALLE DE TAREA
============================================================ */
function bannerHTML(stats){
  if(stats.notStarted){
    return '<div class="detail-status-banner banner-notstarted"><span class="banner-glyph">🕓</span><span>Esta tarea todavía no inicia.</span></div>';
  }
  if(stats.status === "done"){
    return '<div class="detail-status-banner banner-done"><span class="banner-glyph">✓</span><span>¡Tarea completada!</span></div>';
  }
  if(stats.status === "overdue"){
    return '<div class="detail-status-banner banner-overdue"><span class="banner-glyph">⚠</span><span>La fecha límite ya pasó y aún falta trabajo pendiente.</span></div>';
  }
  if(stats.status === "critical"){
    var msg = stats.daysRemainingDisplay <= 2 && stats.remaining > 0 
      ? "¡Solo " + stats.daysRemainingDisplay + " " + pluralDias(stats.daysRemainingDisplay) + " restantes! Necesitas acelerar."
      : "Tu ritmo actual (" + stats.ritmoActual.toFixed(1) + ") está muy por debajo del necesario (" + stats.ritmoNecesario.toFixed(1) + ").";
    return '<div class="detail-status-banner banner-critical"><span class="banner-glyph">⚠</span><span>'+msg+'</span></div>';
  }
  if(stats.status === "onattention"){
    var msg = "Vas por debajo del ritmo necesario (" + stats.ritmoActual.toFixed(1) + " vs " + stats.ritmoNecesario.toFixed(1) + "). Requiere atención.";
    return '<div class="detail-status-banner banner-onattention"><span class="banner-glyph">📊</span><span>'+msg+'</span></div>';
  }
  if(stats.status === "onyellow"){
    var msg = "Vas un poco por debajo del ritmo necesario (" + stats.ritmoActual.toFixed(1) + " vs " + stats.ritmoNecesario.toFixed(1) + "), pero aún tienes margen.";
    return '<div class="detail-status-banner banner-onyellow"><span class="banner-glyph">📊</span><span>'+msg+'</span></div>';
  }
  if(stats.status === "ongreen"){
    return '<div class="detail-status-banner banner-ongreen"><span class="banner-glyph">✓</span><span>¡Vas al día! Tu ritmo actual cubre el 90%+ de lo necesario.</span></div>';
  }
  return '<div class="detail-status-banner banner-ongreen"><span class="banner-glyph">✓</span><span>Vas a buen ritmo.</span></div>';
}

function cantidadDetailBody(task, stats){
  var logEntries = Object.keys(task.log||{}).sort().reverse();
  var historyHTML = logEntries.length ? logEntries.map(function(dateKey){
    return (
      '<div class="history-row" data-date="'+dateKey+'">' +
        '<span class="hr-date">'+fmtDateLong(dateKey)+'</span>' +
        '<span class="hr-amount mono">'+task.log[dateKey]+' unidades</span>' +
        '<span class="history-actions">' +
          '<button class="hist-edit" data-date="'+dateKey+'" aria-label="Editar">✎</button>' +
          '<button class="hist-del" data-date="'+dateKey+'" aria-label="Eliminar">✕</button>' +
        '</span>' +
      '</div>'
    );
  }).join("") : '<div class="history-empty">Todavía no hay registros.</div>';

  var ritmoDiario = Math.ceil(stats.ritmoNecesario);
  var necesarioHoy = stats.necesitasHoy;
  var recomendado = stats.recomendado;
  var necesarioHoyIndicator = necesarioHoy > ritmoDiario ? '<span class="stat-warning" title="Para ponerte al día">⚠️</span>' : '';
  
  var ratio = stats.ritmoNecesario > 0 ? stats.ritmoActual / stats.ritmoNecesario : 1;
  var daysLeftColorClass = ratio >= 0.9 ? 'stat-value-green' : ratio >= 0.7 ? 'stat-value-yellow' : ratio >= 0.5 ? 'stat-value-orange' : 'stat-value-red';
  
  var tKey = todayStr();
  var doneToday = Number((task.log||{})[tKey]) || 0;

  return (
    bannerHTML(stats) +
    rulerBarHTML("detailFill", stats.status, stats.notStarted?null:stats.timePercent, true) +
    renderProgressChart(task) +
    '<div class="stat-grid">' +
      '<div class="stat-box"><div class="stat-label">Meta diaria</div><div class="stat-value" id="dsMetaDiaria">'+ritmoDiario+'</div><div class="stat-sub">por día</div></div>' +
      '<div class="stat-box"><div class="stat-label">Necesitás hoy</div><div class="stat-value"><span id="dsNecesarioHoy">'+necesarioHoy+'</span>'+necesarioHoyIndicator+'</div><div class="stat-sub">para cerrar a tiempo · Recomendado: '+recomendado+'</div></div>' +
      '<div class="stat-box"><div class="stat-label">Completado</div><div class="stat-value" id="dsTotalDone">'+stats.totalDone+'</div><div class="stat-sub">de <span id="dsTotalUnits">'+stats.totalUnits+'</span> total</div></div>' +
      '<div class="stat-box"><div class="stat-label">Días restantes</div><div class="stat-value '+daysLeftColorClass+'" id="dsDaysLeft">'+stats.daysRemainingDisplay+'</div><div class="stat-sub">de '+stats.daysTotal+' totales</div></div>' +
    '</div>' +
    '<div class="divider"></div>' +
    '<div class="subsection-title">Avance rápido</div>' +
    '<div class="quick-log-panel">' +
      '<button class="btn btn-ghost quick-log-btn" id="quickLogMinus" aria-label="Restar 1">−</button>' +
      '<div class="quick-log-value" id="quickLogToday">'+doneToday+'</div>' +
      '<button class="btn btn-ghost quick-log-btn" id="quickLogPlus" aria-label="Sumar 1">+</button>' +
    '</div>' +
    '<div class="divider"></div>' +
    '<div class="subsection-title">Registrar avance</div>' +
    '<div class="log-form">' +
      '<div class="field"><label>Fecha</label><input type="date" id="logDate" value="'+todayStr()+'" max="'+todayStr()+'" min="'+task.startDate+'"></div>' +
      '<div class="field"><label>Cantidad hecha</label><input type="number" id="logAmount" min="0" step="1" placeholder="0"></div>' +
      '<button class="btn btn-primary" id="logSaveBtn">Guardar</button>' +
    '</div>' +
    '<p class="error-msg" id="logError"></p>' +
    '<div class="subsection-title">Historial</div>' +
    '<div class="history-list" id="historyList">' + historyHTML + '</div>'
  );
}

function checklistDetailBody(task, stats){
  var itemsHTML = task.subtasks.map(function(s){
    return (
      '<div class="subtask-item '+(s.done?"done":"")+'" data-id="'+s.id+'">' +
        '<span class="subtask-check"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.2 12L13 4" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
        '<span class="subtask-label">'+escapeHtml(s.name)+'</span>' +
      '</div>'
    );
  }).join("");

  return (
    bannerHTML(stats) +
    rulerBarHTML("detailFill", stats.status, stats.notStarted?null:stats.timePercent, true) +
    '<div class="stat-grid">' +
      '<div class="stat-box"><div class="stat-label">Completadas</div><div class="stat-value" id="dsDoneSub">'+stats.doneSub+'</div><div class="stat-sub">de <span id="dsTotalSub">'+stats.totalSub+'</span> subtareas</div></div>' +
      '<div class="stat-box"><div class="stat-label">Días restantes</div><div class="stat-value" id="dsDaysLeft">'+stats.daysRemainingDisplay+'</div><div class="stat-sub">de '+stats.daysTotal+' totales</div></div>' +
    '</div>' +
    '<div class="divider"></div>' +
    '<div class="subsection-title">Subtareas</div>' +
    '<div class="subtask-list" id="subtaskList">'+itemsHTML+'</div>' +
    '<div class="subtask-add-row"><input type="text" id="newSubtaskInput" placeholder="+ Agregar subtarea y presiona Enter"></div>'
  );
}

function taskDetailHTML(task){
  var stats = getTaskStats(task);
  var typeLabel = task.type === "cantidad" ? "Cantidad" : "Checklist";
  var icon = task.icon || "📋";
  var categoryColor = task.categoryColor || "";
  var categoryColorVar = categoryColor ? "var(--category-" + categoryColor + ")" : "var(--text-faint)";
  var categoryDot = categoryColor ? '<span class="category-dot" style="background:'+categoryColorVar+'"></span>' : '';
  return (
    '<div class="modal-head">' +
      '<div><div class="task-title-with-icon">'+categoryDot+'<span class="task-icon">'+icon+'</span></div><h2>'+escapeHtml(task.name)+'</h2><span class="type-chip" style="margin-top:6px;display:inline-block;">'+typeLabel+'</span></div>' +
      '<div class="modal-head-actions">' +
        '<button class="icon-btn btn-ghost" id="detailEditBtn" aria-label="Editar">✎</button>' +
        '<button class="icon-btn btn-ghost" id="detailDeleteBtn" aria-label="Eliminar">🗑</button>' +
        '<button class="icon-btn btn-ghost" id="detailCloseBtn" aria-label="Cerrar">✕</button>' +
      '</div>' +
    '</div>' +
    '<div class="modal-body" id="detailBody">' +
      (task.type === "cantidad" ? cantidadDetailBody(task, stats) : checklistDetailBody(task, stats)) +
    '</div>'
  );
}

function openTaskDetail(id){
  var task = state.tasks.find(function(t){ return t.id === id; });
  if(!task) return;
  openModal(taskDetailHTML(task), { wide:true });
  var fillEl = document.getElementById("detailFill");
  mountRulerFill(fillEl, getTaskStats(task).progressPercent);
  wireTaskDetail(id);
}

function refreshTaskViews(){
  renderTodayView();
  renderTaskGrid();
  renderTableView();
  renderCalendarView();
}

function refreshDetailPartial(taskId){
  var task = state.tasks.find(function(t){ return t.id === taskId; });
  if(!task) return;
  var stats = getTaskStats(task);

  var bannerParent = document.querySelector("#detailBody .detail-status-banner");
  if(bannerParent){
    var newBannerHTML = bannerHTML(stats);
    var tempDiv = document.createElement("div");
    tempDiv.innerHTML = newBannerHTML;
    var newBanner = tempDiv.firstElementChild;
    bannerParent.parentNode.replaceChild(newBanner, bannerParent);
  }

  var fillEl = document.getElementById("detailFill");
  if(fillEl) fillEl.style.width = clamp(stats.progressPercent,0,100) + "%";
  var progressChartEl = document.getElementById("detailProgressChart");
  if(progressChartEl){
    progressChartEl.outerHTML = renderProgressChart(task);
  }

  var markerEl = document.getElementById("detailFill-track");
  if(markerEl){
    var existingMarker = markerEl.querySelector(".ruler-marker");
    if(existingMarker && !stats.notStarted) existingMarker.style.left = clamp(stats.timePercent,0,100) + "%";
  }
  renderTodayView();

  if(task.type === "cantidad"){
    var ritmoDiario = Math.ceil(stats.ritmoNecesario);
    var necesarioHoy = stats.necesitasHoy;
    var recomendado = stats.recomendado;
    var necesarioHoyIndicator = necesarioHoy > ritmoDiario ? '<span class="stat-warning" title="Para ponerte al día">⚠️</span>' : '';
    
    var ratio = stats.ritmoNecesario > 0 ? stats.ritmoActual / stats.ritmoNecesario : 1;
    var daysLeftColorClass = ratio >= 0.9 ? 'stat-value-green' : ratio >= 0.7 ? 'stat-value-yellow' : ratio >= 0.5 ? 'stat-value-orange' : 'stat-value-red';
    
    var tKey = todayStr();
    var doneToday = Number((task.log||{})[tKey]) || 0;

    document.getElementById("dsMetaDiaria").textContent = ritmoDiario;
    var necesarioHoyEl = document.getElementById("dsNecesarioHoy");
    if(necesarioHoyEl) necesarioHoyEl.innerHTML = necesarioHoy + necesarioHoyIndicator;
    var necesarioHoySubEl = necesarioHoyEl ? necesarioHoyEl.parentElement.nextElementSibling : null;
    if(necesarioHoySubEl) necesarioHoySubEl.textContent = 'para cerrar a tiempo · Recomendado: ' + recomendado;
    document.getElementById("dsTotalDone").textContent = stats.totalDone;
    document.getElementById("dsTotalUnits").textContent = stats.totalUnits;
    
    var daysLeftEl = document.getElementById("dsDaysLeft");
    daysLeftEl.textContent = stats.daysRemainingDisplay;
    daysLeftEl.className = "stat-value " + daysLeftColorClass;
    
    var quickLogTodayEl = document.getElementById("quickLogToday");
    if(quickLogTodayEl) quickLogTodayEl.textContent = doneToday;

    var logEntries = Object.keys(task.log||{}).sort().reverse();
    var historyList = document.getElementById("historyList");
    historyList.innerHTML = logEntries.length ? logEntries.map(function(dateKey){
      return (
        '<div class="history-row" data-date="'+dateKey+'">' +
          '<span class="hr-date">'+fmtDateLong(dateKey)+'</span>' +
          '<span class="hr-amount mono">'+task.log[dateKey]+' unidades</span>' +
          '<span class="history-actions">' +
            '<button class="hist-edit" data-date="'+dateKey+'" aria-label="Editar">✎</button>' +
            '<button class="hist-del" data-date="'+dateKey+'" aria-label="Eliminar">✕</button>' +
          '</span>' +
        '</div>'
      );
    }).join("") : '<div class="history-empty">Todavía no hay registros.</div>';
    wireHistoryButtons(taskId);
  } else {
    document.getElementById("dsDoneSub").textContent = stats.doneSub;
    document.getElementById("dsTotalSub").textContent = stats.totalSub;
    document.getElementById("dsDaysLeft").textContent = stats.daysRemainingDisplay;
  }
}

function wireHistoryButtons(taskId){
  var task = state.tasks.find(function(t){ return t.id === taskId; });
  Array.prototype.forEach.call(document.querySelectorAll(".hist-edit"), function(btn){
    btn.onclick = function(){
      var d = btn.getAttribute("data-date");
      document.getElementById("logDate").value = d;
      document.getElementById("logAmount").value = task.log[d];
      document.getElementById("logAmount").focus();
    };
  });
  Array.prototype.forEach.call(document.querySelectorAll(".hist-del"), function(btn){
    btn.onclick = function(){
      var d = btn.getAttribute("data-date");
      delete task.log[d];
      saveState();
      refreshDetailPartial(taskId);
      
      // Actualizar vistas de Tabla, Hoy y Tareas
      var activeTab = document.querySelector('.topbar-tab.active');
      var tabName = activeTab ? activeTab.getAttribute('data-tab') : null;
      if(tabName === 'tasks') renderTaskGrid();
      if(tabName === 'table') renderTableView();
      renderTodayView();
    };
  });
}

function wireTaskDetail(taskId){
  document.getElementById("detailCloseBtn").addEventListener("click", function(){ closeModal(); });
  document.getElementById("detailEditBtn").addEventListener("click", function(){ openTaskFormModal(taskId); });
  var detailDeleteBtn = document.getElementById("detailDeleteBtn");
  var detailDeleteBtnClone = detailDeleteBtn.cloneNode(true);
  detailDeleteBtn.parentNode.replaceChild(detailDeleteBtnClone, detailDeleteBtn);
  detailDeleteBtnClone.addEventListener("click", function(){
    var t = state.tasks.find(function(x){ return x.id === taskId; });
    if(!t) return;
    openConfirmModal(
      "Eliminar tarea",
      "¿Seguro que quieres eliminar \"" + t.name + "\"? Esta acción no se puede deshacer.",
      function(){
        state.tasks = state.tasks.filter(function(x){ return x.id !== taskId; });
        saveState();
        closeModal();
      },
      function(){ openTaskDetail(taskId); }
    );
  });

  var task = state.tasks.find(function(t){ return t.id === taskId; });

  if(task.type === "cantidad"){
    wireHistoryButtons(taskId);
    
    // Panel de avance rápido +/-
    var quickLogPlus = document.getElementById("quickLogPlus");
    var quickLogMinus = document.getElementById("quickLogMinus");
    
    function updateQuickLogButtons(){
      var tKey = todayStr();
      var doneToday = Number((task.log||{})[tKey]) || 0;
      quickLogMinus.disabled = doneToday <= 0;
    }
    updateQuickLogButtons();
    
    quickLogPlus.addEventListener("click", function(){
      var tKey = todayStr();
      if(!task.log) task.log = {};
      task.log[tKey] = (task.log[tKey] || 0) + 1;
      saveState();
      refreshDetailPartial(taskId);
      updateQuickLogButtons();
      
      // Actualizar vistas de Tabla y Tareas
      var activeTab = document.querySelector('.topbar-tab.active');
      var tabName = activeTab ? activeTab.getAttribute('data-tab') : null;
      if(tabName === 'tasks') renderTaskGrid();
      if(tabName === 'table') renderTableView();
      renderTodayView();
    });
    
    quickLogMinus.addEventListener("click", function(){
      var tKey = todayStr();
      if(!task.log) task.log = {};
      var doneToday = Number((task.log||{})[tKey]) || 0;
      if(doneToday > 0){
        task.log[tKey] = doneToday - 1;
        if(task.log[tKey] === 0) delete task.log[tKey];
        saveState();
        refreshDetailPartial(taskId);
        updateQuickLogButtons();
        
        // Actualizar vistas de Tabla y Tareas
        var activeTab = document.querySelector('.topbar-tab.active');
        var tabName = activeTab ? activeTab.getAttribute('data-tab') : null;
        if(tabName === 'tasks') renderTaskGrid();
        if(tabName === 'table') renderTableView();
        renderTodayView();
      }
    });
    
    document.getElementById("logSaveBtn").addEventListener("click", function(){
      var dateVal = document.getElementById("logDate").value;
      var amountVal = document.getElementById("logAmount").value;
      var err = document.getElementById("logError");
      err.textContent = "";
      if(!dateVal){ err.textContent = "Selecciona una fecha."; return; }
      if(parseDate(dateVal) < parseDate(task.startDate)){ err.textContent = "La fecha es anterior al inicio de la tarea."; return; }
      if(parseDate(dateVal) > parseDate(todayStr())){ err.textContent = "No puedes registrar un día futuro."; return; }
      var amount = amountVal === "" ? NaN : Number(amountVal);
      if(isNaN(amount) || amount < 0){ err.textContent = "Ingresa una cantidad válida."; return; }
      if(!task.log) task.log = {};
      if(amount === 0){ delete task.log[dateVal]; } else { task.log[dateVal] = (task.log[dateVal] || 0) + amount; }
      saveState();
      document.getElementById("logAmount").value = "";
      refreshDetailPartial(taskId);
      updateQuickLogButtons();
      
      // Actualizar vistas de Tabla y Tareas
      var activeTab = document.querySelector('.topbar-tab.active');
      var tabName = activeTab ? activeTab.getAttribute('data-tab') : null;
      if(tabName === 'tasks') renderTaskGrid();
      if(tabName === 'table') renderTableView();
      renderTodayView();
    });
  } else {
    var list = document.getElementById("subtaskList");
    list.addEventListener("click", function(e){
      var item = e.target.closest(".subtask-item");
      if(!item) return;
      var sid = item.getAttribute("data-id");
      var sub = task.subtasks.find(function(s){ return s.id === sid; });
      if(!sub) return;
      sub.done = !sub.done;
      saveState();
      item.classList.toggle("done", sub.done);
      refreshDetailPartial(taskId);
      
      // Actualizar vistas de Tabla y Tareas
      var activeTab = document.querySelector('.topbar-tab.active');
      var tabName = activeTab ? activeTab.getAttribute('data-tab') : null;
      if(tabName === 'tasks') renderTaskGrid();
      if(tabName === 'table') renderTableView();
    });

    var newInput = document.getElementById("newSubtaskInput");
    newInput.addEventListener("keydown", function(e){
      if(e.key !== "Enter") return;
      var val = newInput.value.trim();
      if(!val) return;
      task.subtasks.push({ id: uid(), name: val, done:false });
      saveState();
      newInput.value = "";
      var newItemHTML =
        '<div class="subtask-item" data-id="'+task.subtasks[task.subtasks.length-1].id+'">' +
          '<span class="subtask-check"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.2 12L13 4" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
          '<span class="subtask-label">'+escapeHtml(val)+'</span>' +
        '</div>';
      list.insertAdjacentHTML("beforeend", newItemHTML);
      refreshDetailPartial(taskId);
      
      // Actualizar vistas de Tabla y Tareas
      var activeTab = document.querySelector('.topbar-tab.active');
      var tabName = activeTab ? activeTab.getAttribute('data-tab') : null;
      if(tabName === 'tasks') renderTaskGrid();
      if(tabName === 'table') renderTableView();
      renderTodayView();
    });
  }
}

/* ============================================================
   TABS
============================================================ */
function setupTabs(){
  if(setupTabs.initialized) return;
  setupTabs.initialized = true;
  document.querySelectorAll('.topbar-tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      document.querySelectorAll('.topbar-tab').forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');

      var tabName = tab.getAttribute('data-tab');
      var todayView = document.getElementById('todayView');
      var tableView = document.getElementById('tableView');
      var calendarView = document.getElementById('calendarView');
      var tasksView = document.getElementById('tasksView');
      var views = [todayView, tableView, calendarView, tasksView];
      var nextView = tabName === 'today' ? todayView : tabName === 'table' ? tableView : tabName === 'calendar' ? calendarView : tasksView;
      var currentView = views.find(function(view){ return view && !view.classList.contains('hidden'); });

      function showNextView(){
        views.forEach(function(view){
          if(!view) return;
          if(view === nextView){
            view.classList.remove('hidden');
            view.style.opacity = '0';
            view.style.transform = 'translateY(8px)';
            requestAnimationFrame(function(){
              view.style.opacity = '1';
              view.style.transform = 'translateY(0)';
            });
          } else {
            view.classList.add('hidden');
            view.style.opacity = '';
            view.style.transform = '';
          }
        });

        var fab = document.getElementById('newTaskFab');
        fab.classList.toggle('hidden', tabName !== 'tasks');

        if(tabName === 'table') renderTableView();
        else if(tabName === 'calendar') renderCalendarView();
        else if(tabName === 'tasks') renderTaskGrid();
        else if(tabName === 'today') renderTodayView();
        renderViewContext();
        renderSemesterPanel();
      }

      if(currentView && currentView !== nextView){
        currentView.style.opacity = '0';
        currentView.style.transform = 'translateY(8px)';
        var onTransitionEnd = function(e){
          if(e.propertyName === 'opacity'){
            currentView.removeEventListener('transitionend', onTransitionEnd);
            currentView.classList.add('hidden');
            currentView.style.transform = '';
            showNextView();
          }
        };
        currentView.addEventListener('transitionend', onTransitionEnd);
      } else {
        showNextView();
      }
    });
  });
}

/* ============================================================
   MODO OSCURO
============================================================ */
function toggleTheme(){
  var html = document.documentElement;
  var current = html.getAttribute('data-theme');
  var next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('ritmo_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme){
  var icon = document.querySelector('.theme-icon');
  if(icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function initTheme(){
  var saved = localStorage.getItem('ritmo_theme');
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

/* ============================================================
   INICIO
============================================================ */
function renderAll(){
  renderViewContext();
  renderSemesterPanel();
  renderTableView();
  renderCalendarView();
  var activeTab = document.querySelector('.topbar-tab.active');
  if(activeTab){
    var activeTabName = activeTab.getAttribute('data-tab');
    if(activeTabName === 'tasks') renderTaskGrid();
    else if(activeTabName === 'today') renderTodayView();
  } else {
    renderTodayView();
  }
}

function handleWeekKeyboardNavigation(e){
  var tagName = document.activeElement && document.activeElement.tagName;
  if(tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;
  if(document.getElementById('modalOverlay')) return;
  if(e.key === 'ArrowLeft'){ e.preventDefault(); setActiveWeek(getSelectedWeek() - 1); }
  if(e.key === 'ArrowRight'){ e.preventDefault(); setActiveWeek(getSelectedWeek() + 1); }
}

initTheme();
document.addEventListener('keydown', handleWeekKeyboardNavigation);
document.getElementById("settingsBtn").addEventListener("click", openSemesterModal);
document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);
document.getElementById("exportBtn").addEventListener("click", exportData);
document.getElementById("importBtn").addEventListener("click", importData);
document.getElementById("newTaskFab").addEventListener("click", function(){ openTaskFormModal(null); });
setupTabs();
renderAll();

})();
