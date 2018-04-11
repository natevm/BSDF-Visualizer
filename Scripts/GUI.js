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
    incidentPhiEnvelope,
    intensityEnvelope,
    convergenceEnvelope,
    qualityEnvelope,
    brdfSliderDiv,
    brdfCheckboxDiv,
    heatCheckboxDiv,
    	heatmapEnabled = false,
    iblCheckboxDiv,
    iblEnabled = true;


  const
    model = inModel,
    starting_theta = 45,
    starting_phi = 0,

    setupUI = function(){
      //TODO: should this menu really be attached to #brdf-menu?
      //or should it be elsewhere?
      let modelMenu = d3.select("#model-menu");
      let brdfHeader = d3.select("#brdf-header");
      let brdfMenu = d3.select("#brdf-menu");
      let thetaInput;
      let thetaOutput;
      let phiInput;
      let phiOutput;
      let camRotInput;

      modelMenu.html("");
      brdfMenu.html("");
      brdfHeader.html("");

      let fileChooser = brdfHeader.append("div")
      .attr("id", "file-chooser")
      .style("display", "flex");

      fileChooser.html("");
      fileChooser.append("input")
      .attr("id", "file_chooser")
      .attr("type","file");

      brdfCheckboxDiv = brdfMenu.append("div");
      brdfCheckboxDiv.attr("class", "checkbox-div")
      .attr("id", "checkboxes")
      .style("display", "flex")
      .style("width", "100%")
      .style("justify-content", "space-evenly");

      brdfSliderDiv = brdfMenu.append("div");
      brdfSliderDiv.attr("id", "sliders");
      brdfSliderDiv.style("display", "flex")
      .style("width", "100%");

      let ptLightSliderDiv = modelMenu.append("div");
      ptLightSliderDiv.style("display", "flex")
      .style("width", "100%");

      /* Add incident theta slider */
      incidentThetaEnvelope = addEnvelopeControl(ptLightSliderDiv, "θ",
        "slider_incidentTheta", 0, 90, starting_theta);

      /* Add incident phi slider */
      incidentPhiEnvelope = addEnvelopeControl(ptLightSliderDiv, "φ",
        "slider_incidentPhi", -180, 180, starting_phi);

      intensityEnvelope = addEnvelopeControl(ptLightSliderDiv, "Intens.",
        "slider_intensity", 0, 5, 2.5);

      convergenceEnvelope = addEnvelopeControl(ptLightSliderDiv, "Conv.",
        "slider_convergence", 0, 1, .5);

      qualityEnvelope = addEnvelopeControl(ptLightSliderDiv, "Qual.",
        "slider_quality", 0, 3, 1.0);

      // let camRotSlider = document.getElementById("slider_camRot");
      // camRotSlider.setAttribute("min", -180);
      // camRotSlider.setAttribute("max", 180);
      // camRotSlider.setAttribute("step", 1);
      // camRotSlider.setAttribute("value", 0);

      heatCheckboxDiv = document.getElementById("heatmap-toggle");
      heatCheckboxDiv.addEventListener("change", event => {
        model.setHeatmap(event.target.checked);
    			heatmapEnabled = event.target.checked;
      });

      iblCheckboxDiv = document.getElementById("ibl-toggle");
      iblCheckboxDiv.addEventListener("change", event => {
        model.setIBL(event.target.checked);
        iblEnabled = event.target.checked;
      });
    },

    loadAnalytical = function(file){
      model.loadAnalyticalBRDF(file).then(returnResult => {
        //console.log(returnResult);
        const {uniforms, uniform_update_funcs} = returnResult;
        spawnUniformSliders(uniforms, uniform_update_funcs, brdfSliderDiv,
          brdfCheckboxDiv);
    		}).then( () => {
    			//console.log(heatCheckboxDiv.getAttribute("checked"));
    			//let checkboxValStr = heatCheckboxDiv.getAttribute("checked");
    			////"cast" bool to str: http://stackoverflow.com/questions/263965/ddg#264037
    			//let checkboxValBool = (checkboxValStr === 'true');
    			//console.log(checkboxValStr);
        model.setHeatmap(heatmapEnabled);
    		});
    },

    setupButtonCallback = function(button, url) {
      // Buttons to select predefined BRDFs
      button.on('click', (event) => {
        var blob = null;
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.responseType = "blob";//force the HTTP response, response-type header to be blob
        xhr.onload = function()
        {
          if (this.status === 200) {
            // Note: .response instead of .responseText
            var blob = new Blob([this.response], {type: 'Blob'});
            loadAnalytical(blob);
            //model.loadAnalyticalBRDF([blob]).then(returnResult => {
              ////console.log(returnResult);
              //const {uniforms, uniform_update_funcs} = returnResult;
              //spawnUniformSliders(uniforms, uniform_update_funcs, brdfSliderDiv,
                //brdfCheckboxDiv);
            //});
          }
        };
        xhr.send();
      });
    },

    setupUICallbacks = function(){
      setupButtonCallback(d3.select("#btn1"), "./brdfs/ashikhmin-shirley.yaml");
      setupButtonCallback(d3.select("#btn2"), "./brdfs/normalized_phong.yaml");
      setupButtonCallback(d3.select("#btn3"), "./brdfs/lambert.yaml");
      setupButtonCallback(d3.select("#btn4"), "./brdfs/oren-nayar.yaml");
      setupButtonCallback(d3.select("#btn5"), "./brdfs/ross-li.yaml");

      //Set initial values
      //now this slider only controls light theta and phi
      incidentThetaEnvelope.addEventListener('change', (event) => {
        model.setTheta(event.target.value);
      });

      incidentPhiEnvelope.addEventListener('change', (event) => {
        model.setPhi(event.target.value);
      });

      intensityEnvelope.addEventListener('change', (event) => {
        model.setIntensity(event.target.value);
      });

      convergenceEnvelope.addEventListener('change', (event) => {
        model.setMaxConvergence(event.target.value);
      });

      qualityEnvelope.addEventListener('change', (event) => {
        model.setQuality(event.target.value);
      });

      // document.getElementById("slider_camRot").oninput = (event) => {
      //   model.setCamRot(event.target.value);
      // };

      //File input snippet from:
      //https://developer.mozilla.org/en-US/docs/Web/API/File/Using_files_from_web_applications
      document.getElementById("file_chooser").addEventListener("change", function(){
        //in the below function, "this" appears to be bound to some object
        //that addEventListener binds the function to.
        loadAnalytical(this.files[0]); //BOLD ASSUMPTION: only one file in list
        //model.loadAnalyticalBRDF(this.files).then(returnResult => {
          ////console.log(returnResult);
          //const {uniforms, uniform_update_funcs} = returnResult;
          //spawnUniformSliders(uniforms, uniform_update_funcs, brdfSliderDiv,
            //brdfCheckboxDiv);
        //});
      });
    },

    spawnUniformSliders = function(uniforms, uniform_update_funcs, sliderDiv, checkboxContainer){
      //clear old sliders, checkboxes, and color pickers
      sliderDiv.html("");
      checkboxContainer.html("");
      //TODO: clear color pickers

      Object.keys(uniforms).forEach( name => {
        let curr_u = uniforms[name];
        if (curr_u.type === "float"){
          let sliderEnvelope = addEnvelopeControl(sliderDiv, name,
            "slider_" + name, curr_u.min, curr_u.max, curr_u.default);
          sliderEnvelope.addEventListener('change', (event) => {
            //uniform_update_funcs maps from a name to a list of update
            //functions (i.e. callbacks) for the uniform. We need to call
            //each function in the list.
            uniform_update_funcs.get(name).forEach(f => {
              f(event.target.value);
            });
          });
        } else if (curr_u.type === "bool") {
          let checkboxDiv = checkboxContainer.append("div");
          checkboxDiv.style("display", "flex")
            .style("justify-content", "center")
            .style("align-items", "center")
            .style("flex-direction", "column");

          let checkboxId = "checkbox_" + name;
          let checkbox = checkboxDiv.append("input")
            .attr("id", checkboxId)
            .attr("type","checkbox")
            .classed("magic-checkbox", true);

          if (curr_u.default === true) {
            checkbox.attr("checked",true);
          }

          let label = checkboxDiv.append("div")
            .text(name);

          document.getElementById(checkboxId).addEventListener("change", event => {
            //console.log(event.target.checked);
            uniform_update_funcs.get(name).forEach(f => {
              f(event.target.checked);
            });
          });

        } else if (curr_u.type === "color") {
          console.warn(name + ": Color support not yet implemented");
        } else {
          throw "Invalid uniform type: " + curr_u.type;
        }
      });
    };

  //************* Start "constructor" **************
  setupUI();
  setupUICallbacks();
  //WARNING: The below breaks ModelViewport in Chrome.
  //I suspect this is due to a race condition
  //When I tested, loadAnalytical fires before the model
  //is done loading. To make this work, we might have to
  //attach a callback to when the model is finished loading.
  /*
   *var xhr = new XMLHttpRequest();
   *xhr.open("GET", './brdfs/ashikhman_shirley.yaml');
   *xhr.responseType = "blob";//force the HTTP response, response-type header to be blob
   *xhr.onload = function()
   *{
   *  if (this.status === 200) {
   *    // Note: .response instead of .responseText
   *    var blob = new Blob([this.response], {type: 'Blob'});
   *    console.log("Loading analytical!");
   *    loadAnalytical(blob);
   *  }
   *};
   *xhr.send();
   */
  //************* End "constructor" **************
}
