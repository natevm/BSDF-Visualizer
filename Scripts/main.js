"use strict"; 

import BRDFViewport from "./BRDFViewport.js";

var brdfViewport = null;
var modelViewport = null;

var render = function(time) {
  brdfViewport.render(time);
  modelViewport.render(time);
  requestAnimationFrame(render);
};

/* Requires BRDFViewport.js */
document.addEventListener('DOMContentLoaded', function () {
  brdfViewport = new BRDFViewport("brdf-canvas", 512, 512);
  modelViewport = new ModelViewport("model-canvas", 512, 512);
  requestAnimationFrame(render);
});
