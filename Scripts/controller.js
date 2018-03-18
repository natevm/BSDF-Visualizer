"use strict";

import BRDFViewport from "./BRDFViewport.js";
import ModelViewport from "./ModelViewport.js";
import Model from "./Model.js";

let brdfViewport;
let modelViewport;
let model;

const render = function(time) {
  brdfViewport.render(time);
  modelViewport.render(time);
  requestAnimationFrame(render);
};

document.addEventListener('DOMContentLoaded', function () {
  const shdrPath = "./Shaders/";
  model = Model();
  let canvas = document.getElementById('brdf-canvas');

  brdfViewport = BRDFViewport({canvasName: "brdf-canvas",
    width: canvas.clientWidth, height: canvas.clientHeight, shdrDir: shdrPath});
  modelViewport = ModelViewport({canvasName: "model-canvas",
    width: canvas.clientWidth, height: canvas.clientHeight, shdrDir: shdrPath});

  model.registerViewer(brdfViewport);
  model.registerViewer(modelViewport);

  requestAnimationFrame(render);
});
