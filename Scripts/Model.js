"use strict";

import {loadBRDF_disneyFormat, compile_and_link_shdr} from './gl-wrangling-funcs.js';
import {map_insert_chain} from './collections-wranglers.js';

//requires d3.js

//************************
//"Class" ControlsManager
//
// Using "Classless OOP":
// https://github.com/n8vm/BSDF-Visualizer/wiki/Classless-OOP-reference
//************************

//Currently there are no "constructor" arguments
//See BRDFViewport.js for an example of one with arguments
export default function Model(){
  //const starting_theta = 45;
  //const starting_phi = 0;

  //Declare our object's properties and methods below.
  //They are private by default, unless we put them
  //in the "frozen" object that gets returned at the end.
  let
  viewers = [],
  //incidentThetaEnvelope,
  //incidentPhiEnvelope,
  //normalThetaEnvelope,
  //normalPhiEnvelope,
  registerViewer = function(new_viewer){
    viewers.push(new_viewer);
  },

  setTheta = function(newTheta){
    viewers.forEach(function(v) {
      if (v.inputByModel === true) {
        v.updateTheta(newTheta);
      }
    });
  },

  setPhi = function(newPhi){
    viewers.forEach(function(v) {
      if (v.inputByModel === true) {
        v.updatePhi(newPhi);
      }
    });
  },

  setCamRot = function(newCamRot){
    viewers.forEach(function(v) {
      if (v.inputByModel === true && "updateCamRot" in v) {
        v.updateCamRot(newCamRot);
      }
    });
  },

  loadBrdfFile = function(fileList, viewers){
    let reader = new FileReader();
    //key: uniform name. value: function for updating the uniform.
    let uniform_update_funcs = new Map();
    let uniforms;
    let vertSrc;
    let fragSrc;

    reader.onload = function() {
      //FIXME: duplicate definition of shdrDir
      let loadBRDFPromise = loadBRDF_disneyFormat({brdfFileStr: reader.result,
        shdrDir: "./Shaders/", templatePath: "lobe_template.vert",
        vertPath: "lobe.vert", fragPath: "phong.frag", templateType: "vert"});

      loadBRDFPromise.then(value => {
        uniforms = value.uniformsInfo;
        vertSrc = value.finalVtxSrc;
        fragSrc = value.finalFragSrc;
        //console.log("Loading .brdf done!");
        //console.log(vertSrc);
        //console.log(fragSrc);
      }, err => {
          throw "BRDF load error: " + err;
      }).then( () => { //call the below asynchronously, AFTER the above is done loading
        //The below is passed as a first-class function to addUniformsFunc
        let addUniformsHelper = function(gl) {
          let program = compile_and_link_shdr(gl, vertSrc, fragSrc);

          gl.useProgram(program);

          Object.keys(uniforms).forEach( u => {
            //We need to use "let" for loc. If we use "var", the closure
            //won't work due to hoisting and all functions stored in
            //uniform_update_funcs will store a pointer to the location of
            //the last uniform processed!
            let loc = gl.getUniformLocation(program, u);
            let curr_u = uniforms[u];
            let u_type = curr_u.type;

            if (u_type === "float") {
              let flt_update_func = flt => {
                gl.uniform1f(loc,flt);
              };

              if ( (typeof curr_u.default) !== "number" ){
                throw "curr_u.default should be a number!";
              }
              flt_update_func(curr_u.default);

              map_insert_chain(uniform_update_funcs, u, flt_update_func);
            } else if (u_type === "bool") {
              let bool_update_func = bool_v => {
                if (bool_v === true) {
                  gl.uniform1i(loc,1);
                } else if (bool_v === false) {
                  gl.uniform1i(loc,0);
                } else {
                  throw "Invalid boolean input: " + bool_v;
                }
              };

              bool_update_func(curr_u.default);

              map_insert_chain(uniform_update_funcs, u, bool_update_func);
            } else if (u_type === "color") {
              let vec3_update_func = vec3_v => {
                gl.uniform3f(loc, vec3_v[0], vec3_v[1], vec3_v[2]);
              };

              if ( (typeof curr_u.defaultR) !== "number" ||
                   (typeof curr_u.defaultG) !== "number" ||
                   (typeof curr_u.defaultB) !== "number" ){
                throw "curr_u.default[RGB] should be a number!";
              }
              vec3_update_func([curr_u.defaultR, curr_u.defaultG,
                curr_u.defaultB]);

              map_insert_chain(uniform_update_funcs, u, vec3_update_func);
            } else {
              throw "Invalid uniform type: " + u_type;
            }
          });

          //Give our new program to the Viewer, so the Viewer can bind
          //it to the appropriate variable. E.g. At time of writing,
          //BRDFViewport binds this to lobeProgram.
          return program;
        };

        viewers.forEach( v => {
          if( "addUniformsFunc" in v ){
            v.addUniformsFunc(addUniformsHelper);
          }
        });
      }).then( () => {
        console.log("Done adding uniforms!");
        //TODO: bind each function in uniform_update_funcs to its own slider.
      });
    };

    //onload will be invoked when this is done
    reader.readAsText(fileList[0]);
  },

  loadAnalyticalBRDF = function(in_fileList){
    loadBrdfFile(in_fileList, viewers);
  };

  //setupUI = function() {
    //let menu = d3.select("#brdf-menu");
    //let thetaInput;
    //let thetaOutput;
    //let phiInput;
    //let phiOutput;
    //let camRotInput;

    //menu.html("");

    //let fileChooser = menu.append("div")
    //.attr("id", "file-chooser")
    //.style("display", "flex");

    //menu.append("br");

    //fileChooser.html("");
    //fileChooser.append("input")
    //.attr("id", "file_chooser")
    //.attr("type","file");

    //let sliderDiv = menu.append("div");
    //sliderDiv.style("display", "flex")
    //.style("width", "100%");

    //[> Add incident theta slider <]
    //incidentThetaEnvelope = addEnvelopeControl(sliderDiv, "θ",
      //"slider_incidentTheta", 0, 90, starting_theta);

    //[> Add incident phi slider <]
    //incidentPhiEnvelope = addEnvelopeControl(sliderDiv, "φ",
      //"slider_incidentPhi", -180, 180, starting_phi);

    //[> add camRot slider <]
    //d3.select("#brdf-header").html("");
    //d3.select("#brdf-header").append("input")
    //.attr("id", "slider_camRot")
    //.attr("class", "niceSlider")
    //.attr("type", "range")
    //.attr("min", -180)
    //.attr("max", 180)
    //.attr("step", 1)
    //.attr("value", 0);
  //},


  //debounce = function(func, wait, immediate) {
    //var timeout;
    //return function() {
      //var context = this, args = arguments;
      //var later = function() {
        //timeout = null;
        //if (!immediate) func.apply(context, args);
      //};
      //var callNow = immediate && !timeout;
      //clearTimeout(timeout);
      //timeout = setTimeout(later, wait);
      //if (callNow) func.apply(context, args);
    //};
  //};

  //setupUICallbacks = function() {
    ////Set initial values
    ////now this slider only controls light theta and phi
    //incidentThetaEnvelope.addEventListener('change', (event) => {
      //viewers.forEach(function(v) {
        //let new_theta = incidentThetaEnvelope.value;

         //viewers.forEach(function(v) {
           //let new_theta = event.target.value;
           //if (v.inputByModel === true) {
             //v.updateTheta(new_theta);
           //}
         //});
      //});
    //});

    //incidentPhiEnvelope.addEventListener('change', (event) => {
      //let new_phi = incidentPhiEnvelope.value;

       //viewers.forEach(function(v) {
         //let new_phi = event.target.value;
         //if (v.inputByModel === true) {
           //v.updatePhi(new_phi);
         //}
       //});
    //});

    //document.getElementById("slider_camRot").oninput = (event) => {
      //viewers.forEach(function(v) {
        //let new_camRot = event.target.value;
        //if( "updateCamRot" in v ){
          //v.updateCamRot(new_camRot);
        //}
      //});
    //};

    ////File input snippet from:
    ////https://developer.mozilla.org/en-US/docs/Web/API/File/Using_files_from_web_applications
    //document.getElementById("file_chooser").addEventListener("change",
      ////in the below function, "this" appears to be bound to some object
      ////that addEventListener bind the function to.
      //function(){
        //loadBrdfFile(this.files,viewers);
      //}, false);
  //};

  //************* Start "constructor" **************
  //setupUI();
  //setupUICallbacks();
  //************* End "constructor" **************

  //Put any methods / properties that we want to make pulic inside this object.
  return Object.freeze({
    registerViewer,
    setTheta,
    setPhi,
    setCamRot,
    loadAnalyticalBRDF,
  });
}
