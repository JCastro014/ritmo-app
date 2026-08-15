/* ============================================================
   MODALES
============================================================ */
import { getState, updateSemester, addCourse, updateCell, setWeekFlag, updateTask, deleteTask, setActiveWeek, exportData, importData } from './state.js';
import { uid, escapeHtml, parseDate, todayStr, formatDate, diffDays, fmtDateLong, pluralDias, clamp } from './dateUtils.js';
import { getTaskStats } from './taskStats.js';
import { rulerBarHTML, mountRulerFill } from './components/progressBar.js';
import { renderProgressChart } from './components/heatmap.js';
import { renderTableView } from './views/tableView.js';
import { renderTaskGrid } from './views/taskGridView.js';
import { renderTodayView } from './views/todayView.js';
import { toggleTheme, renderAll, showSavingIndicator, showSavedIndicator } from './ui.js';

function escListener(e){ if(e.key === "Escape") closeModal(); }

export function openModal(contentHTML, opts){
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

export function closeModal(refresh){
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
export function openSemesterModal(){
  var state = getState();
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
  
  document.getElementById("semSave").addEventListener("click", async function(){
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
    
    await updateSemester({ start: start, end: end, phases: newPhases });
    closeModal();
  });
}

/* ---------- Modal: Ajustes (Mobile) ---------- */
export function openSettingsModal(){
  var state = getState();
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
  
  var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  
  openModal(
    '<div class="modal-head"><h2>Ajustes</h2>' +
      '<button class="icon-btn btn-ghost" id="closeSettingsModal" aria-label="Cerrar">✕</button></div>' +
    '<div class="modal-body">' +
      '<div class="settings-section">' +
        '<h3>📅 Semestre</h3>' +
        '<div class="field"><label>Fecha de inicio</label><input type="date" id="semStart" value="'+(s.start||"")+'"></div>' +
        '<div class="field"><label>Fecha de fin</label><input type="date" id="semEnd" value="'+(s.end||"")+'"></div>' +
        '<div class="field"><label>Dividir en fases</label><input type="number" id="semPhases" value="'+numPhases+'" min="2" max="8"></div>' +
        phasesHTML +
      '</div>' +
      '<div class="settings-section" style="margin-top:24px;padding-top:24px;border-top:1px solid var(--border);">' +
        '<h3>🎨 Apariencia</h3>' +
        '<div class="field">' +
          '<label>Tema</label>' +
          '<div class="theme-toggle">' +
            '<button class="theme-option '+(currentTheme==='light'?'active':'')+'" data-theme="light">☀️ Claro</button>' +
            '<button class="theme-option '+(currentTheme==='dark'?'active':'')+'" data-theme="dark">🌙 Oscuro</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="settings-section" style="margin-top:24px;padding-top:24px;border-top:1px solid var(--border);">' +
        '<h3>💾 Datos</h3>' +
        '<button class="btn" id="exportBtn" style="width:100%;margin-bottom:8px;">📤 Exportar JSON</button>' +
        '<button class="btn" id="importBtn" style="width:100%;">📥 Importar JSON</button>' +
      '</div>' +
      '<p class="error-msg" id="semError"></p>' +
    '</div>' +
    '<div class="modal-foot">' +
      '<button class="btn btn-primary" id="semSave">Guardar cambios</button>' +
    '</div>'
  );
  
  document.getElementById("closeSettingsModal").addEventListener("click", closeModal);
  
  // Theme toggle
  document.querySelectorAll('.theme-option').forEach(function(btn){
    btn.addEventListener('click', function(){
      var theme = btn.getAttribute('data-theme');
      toggleTheme();
      document.querySelectorAll('.theme-option').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });
  
  // Export/Import
  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("importBtn").addEventListener("click", importData);
  
  // Recalc phases
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
  
  // Save
  document.getElementById("semSave").addEventListener("click", async function(){
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
    
    await updateSemester({ start: start, end: end, phases: newPhases });
    closeModal();
  });
}

/* ---------- Modal: Agregar Curso ---------- */
export function openAddCourseModal(){
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
  document.getElementById("courseSave").addEventListener("click", async function(){
    var name = document.getElementById("courseName").value.trim();
    var err = document.getElementById("courseError");
    if(!name){ err.textContent = "Ingresa un nombre para el curso."; return; }
    await addCourse(name);
    closeModal();
  });
}

/* ---------- Modal: Editar Celda ---------- */
export function openCellEditor(cellKey, cellEl){
  var state = getState();
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

  document.getElementById("cellSave").addEventListener("click", async function(){
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
    await updateCell(cellKey, content, selectedColor, selectedPriority, description, subtasks, eventDate);
    closeModal();
  });
  setTimeout(function(){ document.getElementById("cellContent").focus(); }, 100);
}

/* ---------- Modal: Selector de Banderas ---------- */
export function openFlagPicker(week, flagEl){
  var state = getState();
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
    opt.addEventListener('click', async function(){
      var flag = opt.getAttribute('data-flag');
      await setWeekFlag(week, flag);
      closeModal();
    });
  });
}

/* ---------- Modal: Nueva / Editar Tarea ---------- */
function subtaskRowHTML(value){
  return (
    '<div class="subtask-row">' +
      '<input type="text" class="subtask-input" placeholder="Nombre de la subtarea" value="'+escapeHtml(value||"")+'">' +
      '<button type="button" class="row-remove-btn" aria-label="Quitar">✕</button>' +
    '</div>'
  );
}

function taskFormHTML(existing){
  var state = getState();
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
        async function(){
          await deleteTask(existing.id);
          closeModal();
        },
        function(){ openTaskFormModal(existing.id); }
      );
    });
  }

  document.getElementById("tfSave").addEventListener("click", async function(){
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
      await updateTask(existing.id, payload);
      closeModal();
      setTimeout(function(){
        openTaskDetail(existing.id);
      }, 300);
    } else {
      payload.id = uid();
      payload.createdAt = Date.now();
      payload.active = true;
      var state = getState();
      state.tasks.push(payload);
      await updateTask(payload.id, payload);
      closeModal();
    }
  });
}

export function openTaskFormModal(existingId){
  var state = getState();
  var existing = existingId ? state.tasks.find(function(t){ return t.id === existingId; }) : null;
  openModal(taskFormHTML(existing), { wide:true });
  wireTaskForm(existing);
}

/* ---------- Modal: Confirmación Genérica ---------- */
export function openConfirmModal(title, message, onConfirm, onCancel){
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

/* ---------- Modal: Detalle de Tarea ---------- */
function bannerHTML(stats){
  var diasDeAtraso = (typeof stats.diasDeAtraso === 'number' && !isNaN(stats.diasDeAtraso)) 
    ? stats.diasDeAtraso 
    : null;
  
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
      : (diasDeAtraso !== null ? "Vas atrasado por " + Math.abs(diasDeAtraso).toFixed(1) + " días respecto al ritmo esperado." : "Actualizando estado...");
    return '<div class="detail-status-banner banner-critical"><span class="banner-glyph">⚠</span><span>'+msg+'</span></div>';
  }
  if(stats.status === "onattention"){
    var msg = diasDeAtraso !== null ? "Vas atrasado por " + Math.abs(diasDeAtraso).toFixed(1) + " días. Requiere atención." : "Actualizando estado...";
    return '<div class="detail-status-banner banner-onattention"><span class="banner-glyph">📊</span><span>'+msg+'</span></div>';
  }
  if(stats.status === "onyellow"){
    var msg = diasDeAtraso !== null ? "Vas atrasado por " + Math.abs(diasDeAtraso).toFixed(1) + " días, pero aún tienes margen." : "Actualizando estado...";
    return '<div class="detail-status-banner banner-onyellow"><span class="banner-glyph">📊</span><span>'+msg+'</span></div>';
  }
  if(stats.status === "ongreen"){
    return '<div class="detail-status-banner banner-ongreen"><span class="banner-glyph">✓</span><span>¡Vas al día! Tu atraso es menor a 0.3 días.</span></div>';
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

export function openTaskDetail(id){
  var state = getState();
  var task = state.tasks.find(function(t){ return t.id === id; });
  if(!task) return;
  openModal(taskDetailHTML(task), { wide:true });
  var fillEl = document.getElementById("detailFill");
  mountRulerFill(fillEl, getTaskStats(task).progressPercent);
  wireTaskDetail(id);
}

export function refreshTaskViews(){
  renderTodayView();
  renderTaskGrid();
  renderTableView();
}

function refreshDetailPartial(taskId){
  var state = getState();
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
  var state = getState();
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
    btn.onclick = async function(){
      var d = btn.getAttribute("data-date");
      delete task.log[d];
      await updateTask(taskId, { log: task.log });
      refreshDetailPartial(taskId);
      renderTaskGrid();
      renderTableView();
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
    var state = getState();
    var t = state.tasks.find(function(x){ return x.id === taskId; });
    if(!t) return;
    openConfirmModal(
      "Eliminar tarea",
      "¿Seguro que quieres eliminar \"" + t.name + "\"? Esta acción no se puede deshacer.",
      async function(){
        await deleteTask(taskId);
        closeModal();
      },
      function(){ openTaskDetail(taskId); }
    );
  });

  var state = getState();
  var task = state.tasks.find(function(t){ return t.id === taskId; });

  if(task.type === "cantidad"){
    wireHistoryButtons(taskId);
    
    // Panel de avance rápido +/-
    var quickLogPlus = document.getElementById("quickLogPlus");
    var quickLogMinus = document.getElementById("quickLogMinus");
    var debounceTimer = null;
    
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
      
      // Renderizar UI inmediatamente
      updateQuickLogButtons();
      refreshDetailPartial(taskId);
      renderTaskGrid();
      renderTableView();
      renderTodayView();
      
      // Debouncing para guardar
      if(debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function(){
        showSavingIndicator();
        updateTask(taskId, { log: task.log }).then(function(){
          showSavedIndicator();
        }).catch(function(e){
          console.error('[TaskDetail] Error al guardar:', e);
        });
      }, 300);
    });
    
    quickLogMinus.addEventListener("click", function(){
      var tKey = todayStr();
      if(!task.log) task.log = {};
      var doneToday = Number((task.log||{})[tKey]) || 0;
      if(doneToday > 0){
        task.log[tKey] = doneToday - 1;
        if(task.log[tKey] === 0) delete task.log[tKey];
        
        // Renderizar UI inmediatamente
        updateQuickLogButtons();
        refreshDetailPartial(taskId);
        renderTaskGrid();
        renderTableView();
        renderTodayView();
        
        // Debouncing para guardar
        if(debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function(){
          showSavingIndicator();
          updateTask(taskId, { log: task.log }).then(function(){
            showSavedIndicator();
          }).catch(function(e){
            console.error('[TaskDetail] Error al guardar:', e);
          });
        }, 300);
      }
    });
    
    document.getElementById("logSaveBtn").addEventListener("click", async function(){
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
      
      // Renderizar UI inmediatamente
      document.getElementById("logAmount").value = "";
      refreshDetailPartial(taskId);
      updateQuickLogButtons();
      renderTaskGrid();
      renderTableView();
      renderTodayView();
      
      // Guardar en background
      showSavingIndicator();
      updateTask(taskId, { log: task.log }).then(function(){
        showSavedIndicator();
      }).catch(function(e){
        console.error('[TaskDetail] Error al guardar:', e);
      });
    });
  } else {
    var list = document.getElementById("subtaskList");
    list.addEventListener("click", async function(e){
      var item = e.target.closest(".subtask-item");
      if(!item) return;
      var sid = item.getAttribute("data-id");
      var sub = task.subtasks.find(function(s){ return s.id === sid; });
      if(!sub) return;
      sub.done = !sub.done;
      
      // Renderizar UI inmediatamente
      item.classList.toggle("done", sub.done);
      refreshDetailPartial(taskId);
      renderTaskGrid();
      renderTableView();
      renderTodayView();
      
      // Guardar en background
      showSavingIndicator();
      updateTask(taskId, { subtasks: task.subtasks }).then(function(){
        showSavedIndicator();
      }).catch(function(e){
        console.error('[TaskDetail] Error al guardar:', e);
      });
    });

    var newInput = document.getElementById("newSubtaskInput");
    newInput.addEventListener("keydown", async function(e){
      if(e.key !== "Enter") return;
      var val = newInput.value.trim();
      if(!val) return;
      task.subtasks.push({ id: uid(), name: val, done:false });
      
      // Renderizar UI inmediatamente
      newInput.value = "";
      var newItemHTML =
        '<div class="subtask-item" data-id="'+task.subtasks[task.subtasks.length-1].id+'">' +
          '<span class="subtask-check"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.2 12L13 4" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
          '<span class="subtask-label">'+escapeHtml(val)+'</span>' +
        '</div>';
      list.insertAdjacentHTML("beforeend", newItemHTML);
      refreshDetailPartial(taskId);
      renderTaskGrid();
      renderTableView();
      renderTodayView();
      
      // Guardar en background
      showSavingIndicator();
      updateTask(taskId, { subtasks: task.subtasks }).then(function(){
        showSavedIndicator();
      }).catch(function(e){
        console.error('[TaskDetail] Error al guardar:', e);
      });
    });
  }
}
