"use strict";

import BRDFViewport from "./BRDFViewport.js";
import PointLightViewport from "./PointLightViewport.js";
import Model from "./Model.js";
import {addEnvelopeControl} from "./ui-wranglers.js";

const starting_theta = 45;
const starting_phi = 0;

//TODO: The controller shouldn't have access to brdfViewport or
//pointLightViewport. We really want main.js to set those up... it
//should call functions on the Controller.
let brdfViewport;
let pointLightViewport;
let model;

let incidentThetaEnvelope;
let incidentPhiEnvelope;

const render = function(time) {
  brdfViewport.render(time);
  pointLightViewport.render(time);
  requestAnimationFrame(render);
};

const setupUI = function(){
  //TODO: should this menu really be attached to #brdf-menu?
  //or should it be elsewhere?
  let menu = d3.select("#brdf-menu");
  let thetaInput;
  let thetaOutput;
  let phiInput;
  let phiOutput;
  let camRotInput;

  menu.html("");

  let fileChooser = menu.append("div")
  .attr("id", "file-chooser")
  .style("display", "flex");

  menu.append("br");

  fileChooser.html("");
  fileChooser.append("input")
  .attr("id", "file_chooser")
  .attr("type","file");

  let sliderDiv = menu.append("div");
  sliderDiv.style("display", "flex")
  .style("width", "100%");

  /* Add incident theta slider */
  incidentThetaEnvelope = addEnvelopeControl(sliderDiv, "θ",
    "slider_incidentTheta", 0, 90, starting_theta);

  /* Add incident phi slider */
  incidentPhiEnvelope = addEnvelopeControl(sliderDiv, "φ",
    "slider_incidentPhi", -180, 180, starting_phi);

  /* add camRot slider */
  d3.select("#brdf-header").html("");
  d3.select("#brdf-header").append("input")
  .attr("id", "slider_camRot")
  .attr("class", "niceSlider")
  .attr("type", "range")
  .attr("min", -180)
  .attr("max", 180)
  .attr("step", 1)
  .attr("value", 0);
};

let setupUICallbacks = function(){
  //Set initial values
  //now this slider only controls light theta and phi
  incidentThetaEnvelope.addEventListener('change', (event) => {
    model.setTheta(event.target.value);
  });

  incidentPhiEnvelope.addEventListener('change', (event) => {
    model.setPhi(event.target.value);
  });

  document.getElementById("slider_camRot").oninput = (event) => {
    model.setCamRot(event.target.value);
  };

  //File input snippet from:
  //https://developer.mozilla.org/en-US/docs/Web/API/File/Using_files_from_web_applications
  document.getElementById("file_chooser").addEventListener("change",
    //in the below function, "this" appears to be bound to some object
    //that addEventListener bind the function to.
    function(){
      model.loadAnalyticalBRDF(this.files);
    }, false);
};

//***************************
// DO STUFF once we are done loading
//***************************
document.addEventListener('DOMContentLoaded', function () {
  setupUI();
  setupUICallbacks();

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

  requestAnimationFrame(render);
});
