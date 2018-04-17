"use strict";

import {deg2rad, get_reflected} from './math-utils.js';
import {init_gl_context} from './gl-wrangling-funcs.js';
import LobeRenderer from "./LobeRenderer.js";

// Requires jquery
// Requires gl-matrix.js
// Requires d3.js

//************************
//"Class" BRDFViewport
//
// Using "Classless OOP":
// https://github.com/n8vm/BSDF-Visualizer/wiki/Classless-OOP-reference
//************************

//put "constructor" arguments inside "spec" (see main.js for usage example)
export default function BRDFViewport(spec) {
  //Declare our object's properties and methods below.
  //They are private by default, unless we put them
  //in the "frozen" object that gets returned at the end.

  const //TODO: I should probably put more stuff that doesn't change here.
    getInputByModel = function(){ //TODO: confusing name. Refactor this.
      return inputByModel;
    };
  let
    { canvasName, width, height, shdrDir, inputByModel } = spec,
    canvas = document.getElementById(canvasName), //Store canvas to viewport instance
    gl, //GL context is initialized in "setupWebGL2"

    lobe_vert_shader_name = "lobe.vert",
    lobe_frag_shader_name = "phong.frag",

    current_lvm,
    linked = true,

    lobeRdr,

    oldCamrotDeg = 0.0,

    get_initial_V = function(){
      var cam_z = 1.5; // z-position of camera in camera space
      var cam_y = 0.5; // altitude of camera
      var init_V = [1,      0,     0, 0,
                    0,      1,     0, 0,
                    0,      0,     1, 0,
                    0, -cam_y,-cam_z, 1];
      return init_V;
    },
    initial_V = get_initial_V(),
    Tangent2World = mat4.fromValues(0, 0, 1, 0,
                                    1, 0, 0, 0,
                                    0, 1, 0, 0,
                                    0, 0, 0, 1),
    V = mat4.clone(initial_V),
    P,
    num_lobe_verts = 0,
    num_line_verts = 0,

    /////////////////////
    // CANVAS AND GL CONTEXT FUNCTIONS
    /////////////////////
    setupWebGL2 = function() {
      gl = init_gl_context(canvas);
      gl.clearColor(0, 0, 0, 1);
      gl.enable(gl.DEPTH_TEST);
    },

    /////////////////////
    // SET UP PROGRAM
    /////////////////////

    updateLinkedTangent2World = function(Tangent2World){
      lobeRdr.setTangent2World(Tangent2World);
    },

    /////////////////////
    // SET UP UI CALLBACKS
    /////////////////////

    resetView = function() {
      V = mat4.clone(initial_V);
      linked = false;
    },

    recoverView = function() {
      linked = true;
      this.updateLinkedCamRot(current_lvm);
    },

    updateLinkedCamRot = function(lvm){
      current_lvm = mat4.clone(lvm);
      if (linked) {
      let linkedViewMatrix4 = mat4.fromValues(lvm[0],lvm[1],lvm[2],0,lvm[3],lvm[4],lvm[5],0,lvm[6],lvm[7],lvm[8],0,0,-0.5,-1.5,1);
      //TODO: The following is a HACK...
      //there should be a better solution than zeroing these quantities and
      //then restoring them back.
      let orig_12 = initial_V[12];
      let orig_13 = initial_V[13];
      let orig_14 = initial_V[14];
      initial_V[12] = 0.0;
      initial_V[13] = 0.0;
      initial_V[14] = 0.0;
      mat4.multiply(V,linkedViewMatrix4, initial_V);
      initial_V[12] = orig_12;
      initial_V[13] = orig_13;
      initial_V[14] = orig_14;

       //let slider = document.getElementById("slider_camRot");
       //slider.value = 0;
    }
      console.log(V);
      lobeRdr.setV(V);
    },

    updateCamRot = function(newCamrotDeg){
      let rot_angle_deg = newCamrotDeg - oldCamrotDeg;
      oldCamrotDeg = newCamrotDeg;
      let rot_angle = deg2rad(rot_angle_deg);
      let rot_axis = vec3.create();
      let rot = mat4.create();

      vec3.set(rot_axis, 0, 0, 1);
      mat4.fromRotation(rot, rot_angle, rot_axis);
      mat4.multiply(V,V,rot);

      lobeRdr.setV(V);
    },

    updateTheta = function(newThetaDeg){
      lobeRdr.updateTheta(newThetaDeg);
    },

    updatePhi = function(newPhiDeg){
      lobeRdr.updatePhi(newPhiDeg);
    },

    //templatePath: path to template shader for this Viewport.
    //templateType: eitehr "vert" or "frag", specifies which shader is the
    //template for this particular Viewport.
    getTemplateInfo = function(){
      return {shaderDir: shdrDir, templatePath: "lobe_template.vert",
        vertPath: lobe_vert_shader_name, fragPath: lobe_frag_shader_name, templateType: "vert"};
    },

    /////////////////////
    // ADD UNIFORMS AT RUNTIME
    // (called when we load a BRDF)
    /////////////////////
    addUniformsFunc = function(addUniformsHelper){
      lobeRdr.addUniformsFunc(addUniformsHelper, Tangent2World, V, P);
    },

    /////////////////////
    // DRAW
    /////////////////////
    render = function(time){
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      lobeRdr.render(time);
    };

  //************* Start "constructor" **************
  {
    canvas.width = width;
    canvas.height = height;
    setupWebGL2();

    //TODO: we shouldn't be hardcoding starting_theta / starting_phi here... should be
    //in main.js or in a config file.

    //Go from BRDF's coordinate system to world space.
    //See https://github.com/n8vm/BSDF-Visualizer/wiki/BxDF-and-camera-coordinate-systems
    //TODO: The above page may need to be updated...
    //M = mat4.fromValues(0, 1, 0, 0,
                        //1, 0, 0, 0,
                        //0, 0, 1, 0,
                        //0, 0, 0, 1);

    let fov = 90 * Math.PI / 180;
    let aspectRatio = canvas.width/canvas.height;
    let nearClip = 0.5;
    let farClip  = 50;
    //P = perspectiveMatrix(fov, aspectRatio, nearClip, farClip);
    P = mat4.create();
    mat4.perspective(P, fov, aspectRatio, nearClip, farClip);

    lobeRdr = LobeRenderer({gl: gl, starting_theta: 45, starting_phi: 180,
      lobe_vert_shader_name: lobe_vert_shader_name, lobe_frag_shader_name: lobe_frag_shader_name,
      shdrDir: shdrDir, initial_Tangent2World: Tangent2World, initial_V: initial_V, initial_P: P});
  }
  //************* End "constructor" **************

  //Put any methods / properties that we want to make public inside this object.
  return Object.freeze({
    render,
    resetView,
    recoverView,
    updateTheta,
    updatePhi,
    updateCamRot,
    updateLinkedCamRot,
    updateLinkedTangent2World,
    addUniformsFunc,
    getInputByModel, //TODO: confusing name. refactor this.
    getTemplateInfo
  });
}
