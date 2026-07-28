/* ============================================================
   UI GENERAL
============================================================ */
import { getState, setActiveWeek, exportData, importData } from './state.js';
import { parseDate, formatDate, fmtDateLong } from './dateUtils.js';
import { renderTableView } from './views/tableView.js';
import { renderTodayView } from './views/todayView.js';
import { renderTaskGrid } from './views/taskGridView.js';
import { renderSemesterPanel } from './components/semesterPanel.js';
import { getSelectedWeek, getWeekStartDateForWeek } from './semesterUtils.js';
import { openSemesterModal, openTaskFormModal } from './modals.js';

// Removed renderViewContext - week navigation now lives in Table view only

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
  var tasksView = document.getElementById('tasksView');
  var views = [todayView, tableView, tasksView];
  var nextView = tabName === 'today' ? todayView : tabName === 'table' ? tableView : tasksView;
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
    else if(tabName === 'tasks') renderTaskGrid();
    else if(tabName === 'today') renderTodayView();
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
  renderSemesterPanel();
  renderTableView();
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
  if(e.key === 'ArrowLeft'){ e.preventDefault(); await setActiveWeek(getSelectedWeek() - 1); renderTableView(); renderTaskGrid(); }
  if(e.key === 'ArrowRight'){ e.preventDefault(); await setActiveWeek(getSelectedWeek() + 1); renderTableView(); renderTaskGrid(); }
}
