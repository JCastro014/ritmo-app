/* ============================================================
   RENDER: CALENDARIO
============================================================ */
import { getState, toggleCalendarCheck } from '../state.js';
import { parseDate, todayStr, formatDate, escapeHtml, fmtDateLong } from '../dateUtils.js';
import { getSemesterStats, getSelectedWeek, getWeekStartDateForWeek, getCalendarEvents } from '../semesterUtils.js';
import { openModal, closeModal } from '../modals.js';
import { getPhaseColorForDate } from '../components/semesterPanel.js';

// Mobile calendar state
var mobileCalendarMonth = null;
var mobileCalendarYear = null;

export function renderCalendarView(){
  var el = document.getElementById("calendarView");
  if(!el) return;
  el.innerHTML = '';
  var stats = getSemesterStats();
  if(!stats){
    el.innerHTML = '<p class="muted">Configura el semestre para ver el calendario.</p>';
    return;
  }

  // Check if mobile
  var isMobile = window.innerWidth <= 768;
  
  if(isMobile){
    renderMobileCalendar(el, stats);
  } else {
    renderDesktopCalendar(el, stats);
  }
}

function renderDesktopCalendar(el, stats){
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
  
  var state = getState();
  var phases = state.semester.phases || [];

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
    
    // Get phase color for background tint
    var phaseColor = getPhaseColorForDate(dateStr, phases);
    var bgStyle = phaseColor ? 'style="background:linear-gradient(135deg,'+phaseColor+'15, transparent 50%);"' : '';

    html += '<div class="calendar-day'+(isToday?' today':'')+(isPast?' past':'')+(isSelectedWeek?' selected-week':'')+'" data-date="'+dateStr+'" '+bgStyle+'>';
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
    check.addEventListener('click', async function(e){
      e.stopPropagation();
      var dateStr = check.getAttribute('data-date');
      var idx = parseInt(check.getAttribute('data-index'));
      await toggleCalendarCheck(dateStr, idx);
      renderCalendarView();
    });
  });
}

function renderMobileCalendar(el, stats){
  // Initialize to current month if not set
  if(mobileCalendarMonth === null || mobileCalendarYear === null){
    var today = parseDate(todayStr());
    mobileCalendarMonth = today.getMonth();
    mobileCalendarYear = today.getFullYear();
  }
  
  var dayNames = ['D','L','M','X','J','V','S'];
  var monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  
  var html = '<div class="mobile-calendar">';
  
  // Month navigation
  html += '<div class="mobile-calendar-nav">';
  html += '<button class="icon-btn mobile-month-nav" data-step="-1" aria-label="Mes anterior">←</button>';
  html += '<span class="mobile-calendar-title">'+monthNames[mobileCalendarMonth]+' '+mobileCalendarYear+'</span>';
  html += '<button class="icon-btn mobile-month-nav" data-step="1" aria-label="Mes siguiente">→</button>';
  html += '</div>';
  
  // Day headers
  html += '<div class="mobile-calendar-day-headers">';
  dayNames.forEach(function(d){ html += '<div class="mobile-calendar-day-header">'+d+'</div>'; });
  html += '</div>';
  
  // Calendar grid
  html += '<div class="mobile-calendar-grid">';
  
  var firstDayOfMonth = new Date(mobileCalendarYear, mobileCalendarMonth, 1);
  var lastDayOfMonth = new Date(mobileCalendarYear, mobileCalendarMonth + 1, 0);
  var startDay = firstDayOfMonth.getDay();
  var totalDays = lastDayOfMonth.getDate();
  
  var today = parseDate(todayStr());
  var todayStrFormatted = todayStr();
  
  var state = getState();
  var phases = state.semester.phases || [];
  
  // Empty cells for days before the first day of month
  for(var i = 0; i < startDay; i++){
    html += '<div class="mobile-calendar-day empty"></div>';
  }
  
  // Day cells
  for(var day = 1; day <= totalDays; day++){
    var currentDate = new Date(mobileCalendarYear, mobileCalendarMonth, day);
    var dateStr = formatDate(currentDate);
    var isToday = dateStr === todayStrFormatted;
    var isPast = currentDate < today;
    var isInRange = currentDate >= stats.start && currentDate <= stats.end;
    
    // Get phase color for background tint
    var phaseColor = getPhaseColorForDate(dateStr, phases);
    var bgStyle = phaseColor ? 'style="background:linear-gradient(135deg,'+phaseColor+'20, transparent 60%);"' : '';
    
    html += '<div class="mobile-calendar-day'+(isToday?' today':'')+(isPast?' past':'')+(!isInRange?' out-of-range':'')+'" data-date="'+dateStr+'" '+bgStyle+'>';
    html += '<span class="mobile-calendar-day-number">'+day+'</span>';
    html += '</div>';
  }

  
  html += '</div>';
  html += '</div>';
  el.innerHTML = html;
  
  // Month navigation
  el.querySelectorAll('.mobile-month-nav').forEach(function(btn){
    btn.addEventListener('click', function(){
      var step = parseInt(btn.getAttribute('data-step'), 10);
      mobileCalendarMonth += step;
      if(mobileCalendarMonth > 11){
        mobileCalendarMonth = 0;
        mobileCalendarYear++;
      } else if(mobileCalendarMonth < 0){
        mobileCalendarMonth = 11;
        mobileCalendarYear--;
      }
      renderCalendarView();
    });
  });
  
  // Day click - open detail modal
  el.querySelectorAll('.mobile-calendar-day:not(.empty):not(.out-of-range)').forEach(function(day){
    day.addEventListener('click', function(){
      var dateStr = day.getAttribute('data-date');
      openDayDetailModal(dateStr);
    });
  });
}

function openDayDetailModal(dateStr){
  var state = getState();
  var checks = state.calendarChecks[dateStr] || [];
  var eventsByDate = {};
  getCalendarEvents().forEach(function(event){
    if(!eventsByDate[event.date]) eventsByDate[event.date] = [];
    eventsByDate[event.date].push(event);
  });
  var dayEvents = eventsByDate[dateStr] || [];
  
  var checksHTML = '';
  for(var i = 0; i < 5; i++){
    var checked = checks[i] || false;
    checksHTML += '<span class="calendar-check'+(checked?' checked':'')+'" data-date="'+dateStr+'" data-index="'+i+'"></span>';
  }
  
  var eventsHTML = '';
  if(dayEvents.length > 0){
    eventsHTML = '<div style="margin-top:16px;"><h4 style="font-size:14px;font-weight:600;margin-bottom:8px;">Eventos</h4>';
    dayEvents.forEach(function(event){
      var colorStyle = event.color ? 'style="border-left-color:'+({red:'#EF4444',orange:'#F97316',yellow:'#EAB308',green:'#22C55E',blue:'#3B82F6',purple:'#8B5CF6',pink:'#EC4899'}[event.color] || 'var(--accent)')+';"' : '';
      eventsHTML += '<div class="calendar-event'+(event.type === 'task' ? ' task' : '')+'" '+colorStyle+' style="margin-bottom:6px;">'+escapeHtml(event.title)+'</div>';
    });
    eventsHTML += '</div>';
  } else {
    eventsHTML = '<p class="muted" style="margin-top:16px;">Sin eventos este día</p>';
  }
  
  openModal(
    '<div class="modal-head"><h2>'+fmtDateLong(dateStr)+'</h2>' +
      '<button class="icon-btn btn-ghost" id="closeDayModal" aria-label="Cerrar">✕</button></div>' +
    '<div class="modal-body">' +
      '<div style="margin-bottom:16px;">' +
        '<h4 style="font-size:14px;font-weight:600;margin-bottom:8px;">Checklist</h4>' +
        '<div class="calendar-checks" style="display:flex;gap:4px;">' + checksHTML + '</div>' +
      '</div>' +
      eventsHTML +
    '</div>'
  );
  
  document.getElementById("closeDayModal").addEventListener("click", closeModal);
  
  // Handle check clicks
  document.querySelectorAll('.calendar-check').forEach(function(check){
    check.addEventListener('click', async function(e){
      e.stopPropagation();
      var checkDateStr = check.getAttribute('data-date');
      var idx = parseInt(check.getAttribute('data-index'));
      await toggleCalendarCheck(checkDateStr, idx);
      // Update the modal content
      closeModal(false);
      openDayDetailModal(dateStr);
    });
  });
}
