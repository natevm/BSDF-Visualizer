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
  const shdrPath = "./Shaders/";
  ctrlManager = ControlsManager();
  brdfViewport = BRDFViewport({canvasName: "brdf-canvas",
    width: 512, height: 512, shdrDir: shdrPath});
  modelViewport = ModelViewport({canvasName: "model-canvas",
    width: 512, height: 512, shdrDir: shdrPath});

  ctrlManager.registerViewer(brdfViewport);
  ctrlManager.registerViewer(modelViewport);

  requestAnimationFrame(render);
});
