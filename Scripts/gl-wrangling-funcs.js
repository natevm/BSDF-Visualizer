"use strict";

import {deg2rad, rotY, rotZ} from './math-utils.js';
import {getNextLine_brdfFile} from './text-utils.js';

//Consumes a template shader with:
// 1) Analytical BRDF in Disney's .brdf format.
// 2) A "template shader" that contains the strings:
//   a) <INLINE_UNIFORMS_HERE> where additional uniforms should be inlined.
//   b) <INLINE_BRDF_HERE> where the BRDF function gets inlined.
function brdfTemplSubst(templShdr, disneyBrdf){
  let uniformsInfo = {};
  let substitutedSrc;
  let brdfLines = disneyBrdf.split('\n');
  //JS iterators: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/@@iterator
  let brdfFile_it = brdfLines[Symbol.iterator]();
  //let currLine = brdfFile_it.next().value;
  let currLine = getNextLine_brdfFile(brdfFile_it);

  //Parsing files line-by-line: https://stackoverflow.com/a/42316936

  //console.log("Printing line by line");
  //templateShdrLines.map((line) => {
    //console.log(line);
  //});

  console.log("substituting...");

  //Go until we reach the parameters
  while (currLine.search("::begin parameters") === -1) {
    //console.log(currLine);
    currLine = getNextLine_brdfFile(brdfFile_it);
  }
  console.log("Found ::begin parameters");

  //Ignoring whitespace, read each line into uniformsInfo
  currLine = getNextLine_brdfFile(brdfFile_it);
  while (currLine.search("::end parameters") === -1) {
    if (/\S/.test(currLine)) { //at least one non-whitespace char
      let tokens = currLine.split(" ");
      let param_type = tokens[0];
      let name = tokens[1];

      if (param_type === "float") {
        uniformsInfo[name] = {type: "float", min: tokens[2],
          max: tokens[3], default: tokens[4]};
      } else if (param_type === "bool") {
        uniformsInfo[name] = {type: "bool", default: tokens[2]};
      } else if (param_type === "color") {
        uniformsInfo[name] = {type: "color", defaultR: tokens[2],
          defaultG: tokens[3], defaultB: tokens[4]};
      } else {
        throw "Invalid parameter param_type for param '" + name +
          "' in .brdf file!";
      }
    }
    currLine = getNextLine_brdfFile(brdfFile_it);
  }
  console.log("Found ::end parameters");

  //Go until we reach the BRDF function

  //Copy the BRDF function verbatim

  //Based on uniformsInfo, generate string that contains the GLSL uniforms

  //Substitute our generated uniforms into template
  //Use string.replace?

  //Substitute BRDF function into template

  return {uInfo: uniformsInfo, substSrc: substitutedSrc};
}

//which_template has a value of either "vert" or "frag".
//If which_template === "vert", vtx_shdr is the template
//If which_template === "frag", frag_shdr is the template
//It is assumed that vtx_shdr and frag_shdr cannot both be templates.
export function brdfShaderFromTemplate(spec){
  let {rawVtxShdr, rawFragShdr, disneyBrdf, whichTemplate} = spec;
  let uniformsInfo;
  let finalFragSrc;
  let finalVtxSrc;

  if(whichTemplate === "vert"){
    let {uInfo, substSrc} = brdfTemplSubst(rawVtxShdr,disneyBrdf);
    uniformsInfo = uInfo;
    finalVtxSrc = substSrc;
    finalFragSrc = rawFragShdr;
  } else if(whichTemplate === "frag"){
    let {uInfo, substSrc} = brdfTemplSubst(rawFragShdr,disneyBrdf);
    uniformsInfo = uInfo;
    finalVtxSrc = rawVtxShdr;
    finalFragSrc = substSrc;
  } else {
    throw "Value of whichTemplate expected to be either 'vtx' or 'frag'";
  }

  return { uniformsInfo, finalFragSrc, finalVtxSrc };
}

export function init_gl_context(canvas){
  const gl = canvas.getContext("webgl2");
    if (gl === null) {
        console.error("WebGL 2 not available");
        document.body.innerHTML = "This application requires WebGL 2 which is unavailable on this system.";
    }
  return gl;
}

// Code for perspective matrix from https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection
export function perspectiveMatrix(fieldOfViewInRadians, aspectRatio, near, far) {

  var f = 1.0 / Math.tan(fieldOfViewInRadians / 2);
  var rangeInv = 1 / (near - far);

  return [
    f / aspectRatio, 0,                          0,   0,
    0,               f,                          0,   0,
    0,               0,    (near + far) * rangeInv,  -1,
    0,               0,  near * far * rangeInv * 2,   0
  ];
}

//TODO: move this into BRDFViewport.js, since it's specific to that viewer.
export function get_initial_V(){
  /*
   * gl-matrix stores matrices in column-major order
   * Therefore, the following matrix:
   *
   * [1, 0, 0, 0,
   * 0, 1, 0, 0,
   * 0, 0, 1, 0,
   * x, y, z, 0]
   *
   * Is equivalent to this in the OpenGL docs:
   *
   * 1 0 0 x
   * 0 1 0 y
   * 0 0 1 z
   * 0 0 0 0
   */

  // BRDF is in tangent space. Tangent space is Z-up.
  // Also, we need to move the camera so that it's not at the origin
  var cam_z = 1.5; // z-position of camera in camera space
  var cam_y = 0.5; // altitude of camera
  var V = [1,      0,     0, 0,
           0,      0,     1, 0,
           0,      1,     0, 0,
           0, -cam_y,-cam_z, 1];
  return V;
}

export function compile_and_link_shdr(gl, vsSource, fsSource){

  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vsSource);
  gl.compileShader(vertexShader);

  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(vertexShader));
  }

  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fsSource);
  gl.compileShader(fragmentShader);

  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(fragmentShader));
  }

  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
  }

  return program;
}

//output is unit reflected vector
//var get_reflected = function(L_hat,N_hat){
export function get_reflected(L_hat,N_hat){
  var L_plus_R = vec3.create();
  vec3.scale(L_plus_R, N_hat, 2*vec3.dot(L_hat,N_hat));
  var R_hat = vec3.create();
  vec3.sub(R_hat, L_plus_R, L_hat);
  vec3.normalize(R_hat,R_hat); //I don't think this is needed?
  return R_hat;
}

//incident angle is the angle between the incident light vector and the normal

export function compute_L_hat(in_theta_deg, in_phi_deg){
  var in_theta = deg2rad(in_theta_deg);
  var in_phi = deg2rad(in_phi_deg);

  var rot_Y = rotY(-in_theta);
  var rot_Z = rotZ(in_phi);

  var rot = mat3.create(); mat3.multiply(rot, rot_Z, rot_Y);
  var L_hat_unrotated = vec3.fromValues(0,0,1);
  var L_hat = vec3.create(); vec3.transformMat3(L_hat, L_hat_unrotated, rot);
  return L_hat;
}

//var compute_N_hat = function(){
export function compute_N_hat(){
  return vec3.fromValues(0,0,1);
}
