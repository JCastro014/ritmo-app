/* ============================================================
   ESTADO Y PERSISTENCIA
============================================================ */
import { uid, todayStr } from './dateUtils.js';

const STORAGE_KEY = "ritmo_academic_v2";

let state = {
  semester: null,
  courses: [],
  cells: {},
  weekFlags: {},
  calendarChecks: {},
  tasks: [],
  cellDetails: {},
  activeWeek: null
};

async function loadState(){
  try{
    var raw = await localStorage.getItem(STORAGE_KEY);
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

async function saveState(){
  try{
    await localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){
    console.error("No se pudo guardar:", e);
    alert("No se pudieron guardar los datos en este navegador.");
  }
}

// API pública del estado
export function getState(){
  return state;
}

export async function updateSemester(semester){
  state.semester = semester;
  await saveState();
}

export async function addCourse(name){
  state.courses.push({ id: uid(), name: name });
  await saveState();
}

export async function removeCourse(courseId){
  state.courses = state.courses.filter(function(c){ return c.id !== courseId; });
  // Remove cells for this course
  Object.keys(state.cells).forEach(function(key){
    if(key.startsWith(courseId + '_')) delete state.cells[key];
  });
  await saveState();
}

export async function updateCell(cellKey, content, color, priority, description, subtasks, eventDate){
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
  await saveState();
}

export async function setWeekFlag(week, flag){
  if(flag === 'none'){
    delete state.weekFlags[week];
  } else {
    state.weekFlags[week] = flag;
  }
  await saveState();
}

export async function addTask(task){
  state.tasks.push(task);
  await saveState();
}

export async function updateTask(id, changes){
  var task = state.tasks.find(function(t){ return t.id === id; });
  if(task){
    Object.assign(task, changes);
    await saveState();
  }
}

export async function deleteTask(id){
  state.tasks = state.tasks.filter(function(t){ return t.id !== id; });
  await saveState();
}

export async function setActiveWeek(week){
  state.activeWeek = week;
  await saveState();
}

export async function toggleCalendarCheck(dateStr, idx){
  if(!state.calendarChecks[dateStr]) state.calendarChecks[dateStr] = [];
  state.calendarChecks[dateStr][idx] = !state.calendarChecks[dateStr][idx];
  await saveState();
}

export async function exportData(){
  var data = JSON.stringify(state, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'ritmo_backup_' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

export async function importData(){
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = async function(e){
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
        await saveState();
        alert('Datos importados correctamente.');
      } catch(err){
        alert('Error al importar: archivo inválido.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Inicializar el estado al cargar el módulo
export async function initializeState(){
  state = await loadState();
}
