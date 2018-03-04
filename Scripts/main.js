"use strict";

import BRDFViewport from "./BRDFViewport.js";
import ModelViewport from "./ModelViewport.js";

var brdfViewport = null;
var modelViewport = null;

var render = function(time) {
  brdfViewport.render(time);
  modelViewport.render(time);
  requestAnimationFrame(render);
};

document.addEventListener('DOMContentLoaded', function () {
  //brdfViewport = new BRDFViewport("brdf-canvas", 512, 512);
  brdfViewport = BRDFViewport({canvasName: "brdf-canvas", width: 512, height: 512});
  //modelViewport = new ModelViewport("model-canvas", 512, 512);
  modelViewport = ModelViewport({canvasName: "model-canvas", width: 512, height: 512});
  requestAnimationFrame(render);
});
