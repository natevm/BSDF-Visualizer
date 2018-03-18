"use strict";

import {addEnvelopeControl} from "./ui-wranglers.js";

//requires d3.js

//************************
//"Class" Controller
//
// Using "Classless OOP":
// https://github.com/n8vm/BSDF-Visualizer/wiki/Classless-OOP-reference
//************************

//Constructor with one argument - the Model that we hook this controller to.
export default function Controller(inModel){
  //Declare our object's properties and methods below.
  //They are private by default, unless we put them
  //in the "frozen" object that gets returned at the end.
  let
    incidentThetaEnvelope,
    incidentPhiEnvelope;

  const
    model = inModel,
    starting_theta = 45,
    starting_phi = 0,

    setupUI = function(){
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
    },

    setupUICallbacks = function(){
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
        //that addEventListener binds the function to.
        function(){
          model.loadAnalyticalBRDF(this.files);
        }, false);
    };

  //************* Start "constructor" **************
  setupUI();
  setupUICallbacks();
  //************* End "constructor" **************
}
