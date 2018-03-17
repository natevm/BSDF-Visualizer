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
  let canvas = document.getElementById('brdf-canvas');

  brdfViewport = BRDFViewport({canvasName: "brdf-canvas",
    width: canvas.clientWidth, height: canvas.clientHeight, shdrDir: shdrPath});
  modelViewport = ModelViewport({canvasName: "model-canvas",
    width: canvas.clientWidth, height: canvas.clientHeight, shdrDir: shdrPath});

  ctrlManager.registerViewer(brdfViewport);
  ctrlManager.registerViewer(modelViewport);

  requestAnimationFrame(render);
});
