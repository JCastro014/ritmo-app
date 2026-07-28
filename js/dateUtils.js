/* ============================================================
   UTILIDADES
============================================================ */
export function uid(){
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export function clamp(n, min, max){ 
  return Math.min(max, Math.max(min, n)); 
}

export function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, function(s){
    return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[s];
  });
}

export function parseDate(str){
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

export function formatDate(d){
  var y = d.getFullYear();
  var m = String(d.getMonth()+1).padStart(2,"0");
  var day = String(d.getDate()).padStart(2,"0");
  return y + "-" + m + "-" + day;
}

export function todayStr(){ 
  return formatDate(new Date()); 
}

export function diffDays(a,b){ 
  return Math.round((b - a) / 86400000); 
}

export function fmtDateLong(str){
  var d = parseDate(str);
  return d.toLocaleDateString("es-ES", { day:"numeric", month:"short", year:"numeric" });
}

export function pluralDias(n){ 
  return Math.abs(n) === 1 ? "día" : "días"; 
}
