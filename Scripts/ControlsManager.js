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
export default function ControlsManager(){
  const starting_theta = 45;
  const starting_phi = 0;

  //Declare our object's properties and methods below.
  //They are private by default, unless we put them
  //in the "frozen" object that gets returned at the end.
  let
    viewers = [],
    registerViewer = function(new_viewer){
      viewers.push(new_viewer);
    },
    setupUI = function() {
      //FIXME: ControlsManager should be writing to its
      //own div, not to #brdf-menu
      let menu = d3.select("#brdf-menu");
      let fileChooser = d3.select("#file-chooser");
      let thetaInput;
      let thetaOutput;
      let phiInput;
      let phiOutput;
      let camRotInput;

      menu.html("");

      /* Add incident theta slider */
      menu.append("input")
        .attr("id", "slider_incidentTheta")
        .attr("type", "range")
        .attr("min", 0)
        .attr("max", 90)
        .attr("step", 1)
        .attr("value", starting_theta);

      menu.append("output")
        .attr("id", "output_incidentTheta");

      /* Add incident phi slider */
      menu.append("input")
        .attr("id", "slider_incidentPhi")
        .attr("type", "range")
        .attr("min", -180)
        .attr("max", 180)
        .attr("step", 1)
        .attr("value", starting_phi);

      menu.append("output")
        .attr("id", "output_incidentPhi");

      /* add camRot slider */
      menu.append("input")
        .attr("id", "slider_camRot")
        .attr("type", "range")
        .attr("min", -180)
        .attr("max", 180)
        .attr("step", 1)
        .attr("value", 0);

      fileChooser.html("");
      fileChooser.append("input")
        .attr("id", "file_chooser")
        .attr("type","file");
        //.attr("onchange", "ctrlManager.handleFiles(this.files)");
        //.attr("onchange", "console.log(this.files[0])");
    },

    setupUICallbacks = function() {
      let output_incidentTheta = document.getElementById("output_incidentTheta");
      let output_incidentPhi = document.getElementById("output_incidentPhi");

      //Set initial values
      output_incidentTheta.innerHTML = starting_theta;
      output_incidentPhi.innerHTML = starting_phi;

      document.getElementById("slider_incidentTheta").oninput = (event) => {
        viewers.forEach(function(v) {
          let new_theta = event.target.value;
          output_incidentTheta.innerHTML = new_theta;
          v.updateTheta(new_theta);
        });
      };

      document.getElementById("slider_incidentPhi").oninput = (event) => {
        viewers.forEach(function(v) {
          let new_phi = event.target.value;
          output_incidentPhi.innerHTML = new_phi;
          v.updatePhi(new_phi);
        });
      };

      document.getElementById("slider_camRot").oninput = (event) => {
        viewers.forEach(function(v) {
          let new_camRot = event.target.value;
          if( "updateCamRot" in v ){
            v.updateCamRot(new_camRot);
          }
        });
      };

      //File input snippet from:
      //https://developer.mozilla.org/en-US/docs/Web/API/File/Using_files_from_web_applications
      document.getElementById("file_chooser").addEventListener("change",
        //in the below function, "this" appears to be bound to some object
        //that addEventListener bind the function to.
        function(){
          loadBrdfFile(this.files);
        },
        false);
    },

    //TODO: should the "controller" really be processing the BRDF file?
    //This sounds more like the job of the "model".
    //Because this is still a small project we probably don't need a separate
    //"model" and "controller"...

    loadBrdfFile = function(fileList){
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
          console.log("Loading .brdf done!");
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
    };

  //************* Start "constructor" **************
  setupUI();
  setupUICallbacks();
  //************* End "constructor" **************

  //Put any methods / properties that we want to make pulic inside this object.
  return Object.freeze({
    registerViewer
  });
}
