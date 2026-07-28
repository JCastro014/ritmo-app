/* ============================================================
   ESTADO Y PERSISTENCIA
============================================================ */
import { uid, todayStr } from './dateUtils.js';

const STORAGE_KEY = "ritmo_academic_v2";

const SUPABASE_URL = "https://dqwnvrydjtywbcfgzcma.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ovrvq4OenUXrookq1EyIkg_FwTMJw1a";
const APP_SECRET = "ritmo-9xK2mLpQ7vZa4Rt";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  { global: { headers: { 'x-app-secret': APP_SECRET } } }
);

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
    var { data, error } = await supabaseClient
      .from('app_state')
      .select('data')
      .eq('id', 'ritmo')
      .single();
    
    if(!error && data && data.data){
      return data.data;
    }
  }catch(e){
    console.error("Error al cargar desde Supabase:", e);
  }
  
  // Fallback a localStorage
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
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
    }
  }catch(e){
    console.error("Error al leer localStorage:", e);
  }
  
  // Estructura default vacía
  return { semester: null, courses: [], cells: {}, weekFlags: {}, calendarChecks: {}, tasks: [], cellDetails: {}, activeWeek: null };
}

async function saveState(){
  try{
    var { error } = await supabaseClient
      .from('app_state')
      .update({ data: state })
      .eq('id', 'ritmo');
    
    if(error){
      throw error;
    }
    
    // Respaldo en localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){
    console.error("Error al guardar en Supabase:", e);
    // Intentar guardar solo en localStorage como fallback
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }catch(e2){
      console.error("Error al guardar en localStorage:", e2);
    }
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

export function subscribeToRemoteChanges(onChangeCallback){
  var channel = supabaseClient
    .channel('app_state_changes')
    .on('postgres_changes', 
      { event: 'UPDATE', schema: 'public', table: 'app_state', filter: 'id=eq.ritmo' },
      function(payload){
        if(payload.new && payload.new.data){
          state = payload.new.data;
          if(onChangeCallback) onChangeCallback();
        }
      }
    )
    .subscribe();
  return channel;
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
