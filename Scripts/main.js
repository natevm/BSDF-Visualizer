import BRDFViewport from "./BRDFViewport.js";
import PointLightViewport from "./PointLightViewport.js";
import Controller from "./Controller.js";
import Model from "./Model.js";

let brdfViewport;
let pointLightViewport;
let model;

const render = function(time) {
  brdfViewport.render(time);
  pointLightViewport.render(time);
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
  pointLightViewport = PointLightViewport({canvasName: "pointlight-canvas", shdrDir: shdrPath,
    width: canvas.clientWidth, height: canvas.clientHeight, inputByModel: true});

  pointLightViewport.registerLinkedViewport(brdfViewport);

  model.registerViewer(brdfViewport);
  model.registerViewer(pointLightViewport);

  Controller(model); //construct a Controller.

  requestAnimationFrame(render);
});
