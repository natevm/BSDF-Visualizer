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
export default function GUI(inModel){
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
      let pointlightMenu = d3.select("#pointlight-menu");
      let brdfMenu = d3.select("#brdf-menu");
      let thetaInput;
      let thetaOutput;
      let phiInput;
      let phiOutput;
      let camRotInput;

      pointlightMenu.html("");
      brdfMenu.html("");

      let fileChooser = brdfMenu.append("div")
      .attr("id", "file-chooser")
      .style("display", "flex");

      brdfMenu.append("br");

      fileChooser.html("");
      fileChooser.append("input")
      .attr("id", "file_chooser")
      .attr("type","file");

      let sliderDiv = pointlightMenu.append("div");
      sliderDiv.style("display", "flex")
      .style("width", "100%");

      /* Add incident theta slider */
      incidentThetaEnvelope = addEnvelopeControl(sliderDiv, "θ",
        "slider_incidentTheta", 0, 90, starting_theta);

      /* Add incident phi slider */
      incidentPhiEnvelope = addEnvelopeControl(sliderDiv, "φ",
        "slider_incidentPhi", -180, 180, starting_phi);

      let camRotSlider = document.getElementById("slider_camRot");
      camRotSlider.setAttribute("min", -180);
      camRotSlider.setAttribute("max", 180);
      camRotSlider.setAttribute("step", 1);
      camRotSlider.setAttribute("value", 0);
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
      document.getElementById("file_chooser").addEventListener("change", function(){
        //in the below function, "this" appears to be bound to some object
        //that addEventListener binds the function to.
        model.loadAnalyticalBRDF(this.files).then( returnResult => {
          console.log(returnResult);
        });

      });
    };

  //************* Start "constructor" **************
  setupUI();
  setupUICallbacks();
  //************* End "constructor" **************
}
