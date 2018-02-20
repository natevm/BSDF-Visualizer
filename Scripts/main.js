var brdfViewport = null;
var modelViewport = null;

var render = function(time) {
  brdfViewport.render(time);
  requestAnimationFrame(render);
}

/* Requires BRDFViewport.js */
document.addEventListener('DOMContentLoaded', function () {
  brdfViewport = new BRDFViewport("brdf-canvas", 512, 512);
  // Todo: add model viewport
  requestAnimationFrame(render);
});
