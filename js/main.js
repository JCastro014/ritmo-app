/* ============================================================
   PUNTO DE ENTRADA
============================================================ */
import { initializeState, exportData, importData, subscribeToRemoteChanges } from './state.js';
import { initTheme, setupTabs, renderAll, handleWeekKeyboardNavigation, toggleTheme } from './ui.js';
import { openSemesterModal, openTaskFormModal, openSettingsModal } from './modals.js';

async function init(){
  await initializeState();
  initTheme();
  setupTabs();
  renderAll();
  
  // Suscripción a cambios remotos en tiempo real
  subscribeToRemoteChanges(function(){
    renderAll();
  });
  
  // Event listeners globales - Desktop
  var settingsBtn = document.getElementById("settingsBtn");
  if(settingsBtn) settingsBtn.addEventListener("click", openSemesterModal);
  
  var themeToggleBtn = document.getElementById("themeToggleBtn");
  if(themeToggleBtn) themeToggleBtn.addEventListener("click", toggleTheme);
  
  var exportBtn = document.getElementById("exportBtn");
  if(exportBtn) exportBtn.addEventListener("click", exportData);
  
  var importBtn = document.getElementById("importBtn");
  if(importBtn) importBtn.addEventListener("click", async function(){ await importData(); renderAll(); });
  
  var newTaskFab = document.getElementById("newTaskFab");
  if(newTaskFab) newTaskFab.addEventListener("click", function(){ openTaskFormModal(null); });
  
  // Event listeners globales - Mobile
  var mobileSettingsBtn = document.getElementById("mobileSettingsBtn");
  if(mobileSettingsBtn) mobileSettingsBtn.addEventListener("click", openSettingsModal);
  
  var mobileNewTaskFab = document.getElementById("mobileNewTaskFab");
  if(mobileNewTaskFab) mobileNewTaskFab.addEventListener("click", function(){ openTaskFormModal(null); });
  
  document.addEventListener('keydown', handleWeekKeyboardNavigation);
}

init();
