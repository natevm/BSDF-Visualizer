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
  //Declare our object's properties and methods below.  They are private by default, unless we put them
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

    addKnob = function(parent, label, id, min, max, value, angleArc = 360, angleOffset=0) {
      let knobDiv = parent.append("div");
      knobDiv.style("display", "flex");
      knobDiv.style("height", "100%");
      knobDiv.style("align-items", "center")
      .style("justify-content", "space-evenly")
      .style("flex-direction", "column");

      knobDiv.append("input").attr("type", "text")
        .attr("id", id)
        .attr("data-cursor", "25")
        .attr("data-fgColor", "#2196F3")
        .attr("data-bgColor", "#ccc")
        .attr("data-inputColor", "#FFFFFF")
        .attr("data-angleArc", angleArc)
        .attr("data-angleOffset", angleOffset)
        .attr("value", value)
        .attr("data-step", .1)
        .attr("data-min", min)
        .attr("data-max", max)
        .attr("data-height", "50%")
        .attr("data-thickness", ".4");

      knobDiv.append("label")
        .text(label);
    },

    addSwitch = function(parent, label, id, checked = false) {
      parent.append("label").text(label);
      let switchDiv = parent.append("label");
      switchDiv.attr("class", "switch");
      let switcher = switchDiv.append("input");
      switcher.attr("id", id)
        .attr("type", "checkbox")
        .property("checked", checked);
      switchDiv.append("span").attr("class", "slider");
    },

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
      .style("width", "25%")
      .style("justify-content", "space-evenly");

      brdfSliderDiv = brdfMenu.append("div");
      brdfSliderDiv.attr("id", "sliders");
      brdfSliderDiv.style("display", "flex")
      .style("justify-content", "space-evenly")
      .style("width", "75%");

      let ptLightSliderDiv = modelMenu.append("div");
      ptLightSliderDiv.style("display", "flex")
      .style("width", "100%")
      .style("height", "100%")
      .style("justify-content", "space-evenly");

      /* Add incident theta slider */
      addKnob(ptLightSliderDiv, "θ", "slider_incidentTheta", 0, 360, starting_theta);
      addKnob(ptLightSliderDiv, "φ", "slider_incidentPhi", -180, 180, starting_phi);
      addKnob(ptLightSliderDiv, "Intens.", "slider_intensity", 0, 100, 30, 270, -135);
      addKnob(ptLightSliderDiv, "Qual.", "slider_quality", 0, 100, 100, 270, -135);

      // let camRotSlider = document.getElementById("slider_camRot");
      // camRotSlider.setAttribute("min", -180);
      // camRotSlider.setAttribute("max", 180);
      // camRotSlider.setAttribute("step", 1);
      // camRotSlider.setAttribute("value", 0);
      let modelHeader = d3.select("#model-header");
      modelHeader.style("display", "flex")
      .style("width", "100%")
      .style("justify-content", "space-evenly");

      addSwitch(modelHeader, "Heatmap", "heatmap-toggle", false);
      addSwitch(modelHeader, "Image Based Lighting", "ibl-toggle", true);

      d3.select("#heatmap-toggle").on('change', () => {
        heatmapEnabled = d3.select("#heatmap-toggle").property('checked');
        model.setHeatmap(heatmapEnabled);
      });

      d3.select("#ibl-toggle").on('change', () => {
        iblEnabled = d3.select("#ibl-toggle").property('checked');
        model.setIBL(iblEnabled);
      });
    },

    loadAnalytical = function(file){
      return model.loadAnalyticalBRDF(file).then(returnResult => {
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


      $("#slider_incidentTheta").knob({
          'release' : function (v) { model.setTheta(v); },
          'change' : function (v) { model.setTheta(v); }
        });

      $("#slider_incidentPhi").knob({
          'release' : function (v) { model.setPhi(v); },
          'change' : function (v) { model.setPhi(v); }
        });

      $("#slider_intensity").knob({
          'release' : function (v) { model.setIntensity(5.0*parseFloat(v)/100.0); },
          'change' : function (v) { model.setIntensity(5.0*parseFloat(v)/100.0); }
        });

      $("#slider_quality").knob({
          'release' : function (v) { model.setQuality(parseFloat(v)/100.0); },
          'change' : function (v) { model.setQuality(parseFloat(v)/100.0); }
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
          addKnob(sliderDiv, name, "slider_" + name, curr_u.min, curr_u.max, curr_u.default, 270, -135);


          //uniform_update_funcs maps from a name to a list of update
          //functions (i.e. callbacks) for the uniform. We need to call
          //each function in the list.
          let update = function(v) {
            uniform_update_funcs.get(name).forEach(f => {
              f(v);
            });
            model.resetIBL()
          }

          $("#" + "slider_" + name).knob({
            'release' : update ,
            'change' : update
          });
        }
        else if (curr_u.type === "bool") {
          addSwitch(checkboxContainer, name, "checkbox_" + name, curr_u.default);
          d3.select("#checkbox_" + name).on('change', () => {
            let checked = d3.select("#checkbox_" + name).property('checked');
            console.log("checked:" + checked);
            uniform_update_funcs.get(name).forEach(f => {
              f(checked);
            });
            model.resetIBL();
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
