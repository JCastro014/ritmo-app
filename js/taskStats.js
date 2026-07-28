/* ============================================================
   SISTEMA DE TAREAS - CÁLCULOS
============================================================ */
import { parseDate, todayStr, diffDays, clamp } from './dateUtils.js';

export function countWorkDays(startStr, endStr, workDays){
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

export function baseTimeStats(startStr, endStr){
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

export function statusFromProgress(stats){
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

export function computeCantidadStats(task){
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

export function computeChecklistStats(task){
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

export function getTaskStats(task){
  return task.type === "cantidad" ? computeCantidadStats(task) : computeChecklistStats(task);
}

export function daysRemainingLabel(stats){
  if(stats.isDone) return "Completada";
  if(stats.notStarted) return "Aún no inicia";
  if(stats.isOverdue) return "Venció";
  if(stats.daysRemainingDisplay === 0) return "Vence hoy";
  return stats.daysRemainingDisplay + " " + pluralDias(stats.daysRemainingDisplay) + " restantes";
}

function pluralDias(n){ 
  return Math.abs(n) === 1 ? "día" : "días"; 
}
