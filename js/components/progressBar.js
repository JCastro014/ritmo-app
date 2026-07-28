/* ============================================================
   BARRA DE PROGRESO
============================================================ */
import { clamp } from '../dateUtils.js';

export function mountRulerFill(el, targetPercent){
  el.style.width = "0%";
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      el.style.width = clamp(targetPercent,0,100) + "%";
    });
  });
}

export function rulerBarHTML(id, status, marker){
  var markerHTML = (marker!=null) ? '<div class="ruler-marker" style="left:'+clamp(marker,0,100)+'%"></div>' : "";
  return '' +
    '<div class="ruler-track" id="'+id+'-track">' +
      '<div class="ruler-fill status-'+status+'" id="'+id+'"></div>' +
      markerHTML +
    '</div>';
}
