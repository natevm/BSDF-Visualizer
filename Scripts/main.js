"use strict";

import BRDFViewport from "./BRDFViewport.js";
import ModelViewport from "./ModelViewport.js";
import ControlsManager from "./ControlsManager.js";

let brdfViewport;
let modelViewport;
let ctrlManager;

const render = function(time) {
  brdfViewport.render(time);
  modelViewport.render(time);
  requestAnimationFrame(render);
};

document.addEventListener('DOMContentLoaded', function () {
  ctrlManager = ControlsManager();
  brdfViewport = BRDFViewport({canvasName: "brdf-canvas", width: 512, height: 512});
  modelViewport = ModelViewport({canvasName: "model-canvas", width: 512, height: 512});

  ctrlManager.registerViewer(brdfViewport);
  ctrlManager.registerViewer(modelViewport);

  requestAnimationFrame(render);
});
