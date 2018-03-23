import BRDFViewport from "./BRDFViewport.js";
import ModelViewport from "./ModelViewport.js";
import GUI from "./GUI.js";
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
  //setupUI();
  //setupUICallbacks();

  const shdrPath = "./Shaders/";
  model = Model();
  let canvas = document.getElementById('brdf-canvas');

  brdfViewport = BRDFViewport({canvasName: "brdf-canvas", shdrDir: shdrPath,
    width: canvas.clientWidth, height: canvas.clientHeight, inputByModel: false});
  modelViewport = ModelViewport({canvasName: "model-canvas", shdrDir: shdrPath,
    width: canvas.clientWidth, height: canvas.clientHeight, inputByModel: true});

  modelViewport.registerLinkedViewport(brdfViewport);

  model.registerViewer(brdfViewport);
  model.registerViewer(modelViewport);

  GUI(model); //construct a GUI.

  requestAnimationFrame(render);
});
