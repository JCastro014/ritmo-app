/* ============================================================
   UI GENERAL
============================================================ */
import { getState, setActiveWeek, exportData, importData } from './state.js';
import { parseDate, formatDate, fmtDateLong } from './dateUtils.js';
import { renderTableView } from './views/tableView.js';
import { renderCalendarView } from './views/calendarView.js';
import { renderTodayView } from './views/todayView.js';
import { renderTaskGrid } from './views/taskGridView.js';
import { renderSemesterPanel } from './components/semesterPanel.js';
import { getSelectedWeek, getWeekStartDateForWeek } from './semesterUtils.js';
import { openSemesterModal, openTaskFormModal } from './modals.js';

export function setupTabs(){
  if(setupTabs.initialized) return;
  setupTabs.initialized = true;
  
  // Desktop topbar tabs
  document.querySelectorAll('.topbar-tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      switchTab(tab.getAttribute('data-tab'));
    });
  });
  
  // Mobile bottom nav items
  document.querySelectorAll('.bottom-nav-item').forEach(function(item){
    item.addEventListener('click', function(){
      switchTab(item.getAttribute('data-tab'));
    });
  });
}

function switchTab(tabName){
  // Update desktop tabs
  document.querySelectorAll('.topbar-tab').forEach(function(t){ 
    t.classList.toggle('active', t.getAttribute('data-tab') === tabName); 
  });
  
  // Update mobile bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(function(item){
    item.classList.toggle('active', item.getAttribute('data-tab') === tabName);
  });

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
    if(fab) fab.classList.toggle('hidden', tabName !== 'tasks');

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
}

function renderViewContext(){
  var el = document.getElementById('viewContextBar');
  if(!el) return;
  var state = getState();
  if(!state.semester){ el.innerHTML=''; return; }
  var selectedWeek = getSelectedWeek();
  var weekStart = getWeekStartDateForWeek(selectedWeek);
  var weekEnd = weekStart ? new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6) : null;
  var rangeLabel = weekStart && weekEnd ? fmtDateLong(formatDate(weekStart)) + ' – ' + fmtDateLong(formatDate(weekEnd)) : 'Semana ' + selectedWeek;
  el.innerHTML =
    '<div class="view-context-pill">' +
      '<span class="view-context-label">Semana activa</span>' +
      '<strong>Semana '+selectedWeek+'</strong>' +
      '<span class="view-context-range">'+rangeLabel+'</span>' +
    '</div>' +
    '<div class="view-context-actions">' +
      '<button class="icon-btn view-context-btn" data-step="-1" title="Semana anterior" aria-label="Semana anterior">←</button>' +
      '<button class="icon-btn view-context-btn" data-step="1" title="Semana siguiente" aria-label="Semana siguiente">→</button>' +
    '</div>';
  el.querySelectorAll('.view-context-btn').forEach(function(btn){
    btn.addEventListener('click', async function(){
      var step = parseInt(btn.getAttribute('data-step'), 10);
      await setActiveWeek(getSelectedWeek() + step);
      renderViewContext();
      renderTableView();
      renderCalendarView();
      if(document.querySelector('.tab.active') && document.querySelector('.tab.active').getAttribute('data-tab') === 'tasks'){ renderTaskGrid(); }
    });
  });
}


export function toggleTheme(){
  var html = document.documentElement;
  var current = html.getAttribute('data-theme');
  var next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('ritmo_theme', next);
  updateThemeIcon(next);
}

export function updateThemeIcon(theme){
  var icon = document.querySelector('.theme-icon');
  if(icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

export function initTheme(){
  var saved = localStorage.getItem('ritmo_theme');
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

export function renderAll(){
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

export async function handleWeekKeyboardNavigation(e){
  var tagName = document.activeElement && document.activeElement.tagName;
  if(tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;
  if(document.getElementById('modalOverlay')) return;
  if(e.key === 'ArrowLeft'){ e.preventDefault(); await setActiveWeek(getSelectedWeek() - 1); renderViewContext(); renderTableView(); renderCalendarView(); renderTaskGrid(); }
  if(e.key === 'ArrowRight'){ e.preventDefault(); await setActiveWeek(getSelectedWeek() + 1); renderViewContext(); renderTableView(); renderCalendarView(); renderTaskGrid(); }
}
