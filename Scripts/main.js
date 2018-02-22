/*jshint esversion: 6 */

"use strict";

/////////////////////
// SET UP CANVAS AND GL CONTEXT
/////////////////////

var canvas = document.getElementById("webgl-canvas");
canvas.width = 800;
canvas.height = 600;

const gl = canvas.getContext("webgl2");
if (!gl) {
    console.error("WebGL 2 not available");
    document.body.innerHTML = "This application requires WebGL 2 which is unavailable on this system.";
}

gl.clearColor(0, 0, 0, 1);
gl.enable(gl.DEPTH_TEST);

/////////////////////
// SET UP PROGRAM
/////////////////////

const lobeVsSource = document.getElementById("lobe.vert").text.trim();
const lobeFsSource = document.getElementById("phong.frag").text.trim();
const lineVsSource = document.getElementById("color_only.vert").text.trim();
const lineFsSource = document.getElementById("color_only.frag").text.trim();

var lobeProgram = setup_program(lobeVsSource, lobeFsSource);
var lineProgram = setup_program(lineVsSource, lineFsSource);

const lobe_mUniformLoc = gl.getUniformLocation(lobeProgram, "u_m"); // model matrix
const lobe_vUniformLoc = gl.getUniformLocation(lobeProgram, "u_v"); // view matrix
const lobe_pUniformLoc = gl.getUniformLocation(lobeProgram, "u_p"); // proj matrix

const lobe_nUniformLoc = gl.getUniformLocation(lobeProgram, "u_n"); // unit normal 
const lobe_lUniformLoc = gl.getUniformLocation(lobeProgram, "u_l"); // unit in-direction

const lobe_delThetaUniformLoc = gl.getUniformLocation(lobeProgram, "u_delTheta"); 
const lobe_delPhiUniformLoc = gl.getUniformLocation(lobeProgram, "u_delPhi"); 

const line_mUniformLoc = gl.getUniformLocation(lineProgram, "u_m"); 
const line_vUniformLoc = gl.getUniformLocation(lineProgram, "u_v"); 
const line_pUniformLoc = gl.getUniformLocation(lineProgram, "u_p"); 

// Conversion code snippet from:
// http://cwestblog.com/2012/11/12/javascript-degree-and-radian-conversion/

/////////////////////
// SET UP GEOMETRY 
/////////////////////
//const default_in_angle_deg = 45; //Default value when we open the app.
//var in_angle = Math.radians(default_in_angle_deg);

// L_hat points towards the light
// N_hat is the normal direction
// *_hat refers to a normalized vector

var in_theta_deg = 45;
var in_phi_deg = 0;


var lobeVAO = gl.createVertexArray();
//Assumes positions at attribute 0, colors at attribute 1, 
//normals at attribute 2 in lobe shader

var numPhiDivisions = 200;
var numThetaDivisions = 100;
var L_hat = compute_L_hat(in_theta_deg, in_phi_deg);
var N_hat = compute_N_hat();
var num_lobe_verts = lobe_setupGeometry(lobeVAO, L_hat, N_hat, numPhiDivisions, numThetaDivisions);
gl.useProgram(lobeProgram);
gl.uniform3fv(lobe_nUniformLoc,N_hat);
gl.uniform3fv(lobe_lUniformLoc,L_hat);
gl.uniform1f(lobe_delPhiUniformLoc,calc_delPhi(numPhiDivisions));
gl.uniform1f(lobe_delThetaUniformLoc,calc_delTheta(numThetaDivisions));

var lineVAO = gl.createVertexArray();
//Assumes positions at attribute 0, colors at attribute 1 in line shader
var num_line_verts = line_setupGeometry(lineVAO, L_hat, N_hat);

setupMVP(lobeProgram, lobe_mUniformLoc, lobe_vUniformLoc, lobe_pUniformLoc);
setupMVP(lineProgram, line_mUniformLoc, line_vUniformLoc, line_pUniformLoc);

var prev_time = 0; //time when the previous frame was drawn
var rot = 0;

var rot_angle = 0; // radians
var rot_axis = vec3.create();
vec3.set(rot_axis, 0, 0, 1);

var M = mat4.create();

/////////////////////
// SET UP UI CALLBACKS 
/////////////////////

var output_incidentTheta = document.getElementById("output_incidentTheta");
var output_incidentPhi = document.getElementById("output_incidentPhi");

//Set initial values
//TODO: this is a hack, we should be querying the default value from the HTML tag
output_incidentTheta.innerHTML = in_theta_deg; 
output_incidentPhi.innerHTML = in_phi_deg; 

document.getElementById("slider_incidentTheta").oninput = function(event) {
  in_theta_deg = event.target.value;
  output_incidentTheta.innerHTML = in_theta_deg;
  L_hat = compute_L_hat(in_theta_deg, in_phi_deg);
  gl.useProgram(lobeProgram);
  gl.uniform3fv(lobe_lUniformLoc,L_hat);
  //console.log(L_hat);
  num_lobe_verts = lobe_setupGeometry(lobeVAO, L_hat, N_hat, numThetaDivisions, numPhiDivisions);
  num_line_verts = line_setupGeometry(lineVAO, L_hat, N_hat);
};

document.getElementById("slider_incidentPhi").oninput = function(event) {
  in_phi_deg = event.target.value;
  output_incidentPhi.innerHTML = in_phi_deg;
  L_hat = compute_L_hat(in_theta_deg, in_phi_deg);
  //console.log(L_hat);
  num_lobe_verts = lobe_setupGeometry(lobeVAO, L_hat, N_hat, numThetaDivisions, numPhiDivisions);
  num_line_verts = line_setupGeometry(lineVAO, L_hat, N_hat);
};

var output_camRot = document.getElementById("output_camRot");
document.getElementById("slider_camRot").oninput = function(event) {
  var rot_angle_deg = event.target.value;
  rot_angle = Math.radians(rot_angle_deg);
  mat4.fromRotation(M, rot_angle, rot_axis);
};

/////////////////////
// DRAW 
/////////////////////
function render(time){
  time *= 0.001; // convert to seconds
  var deltaTime = time - prev_time;

  gl.clear(gl.COLOR_BUFFER_BIT);
  //gl.drawArrays(gl.POINTS, 0, numVerts);
  
  //auto-rotate M
  //var rotationSpeed = 1.2;
  //rot_angle += rotationSpeed * deltaTime;
  //mat4.fromRotation(M, rot_angle, rot_axis);

  //Draw lobe
  gl.bindVertexArray(lobeVAO);
  updateMVP(M, lobeProgram, lobe_mUniformLoc);
  var first = 0; //see https://stackoverflow.com/q/10221647
  gl.drawArrays(gl.TRIANGLES, first, num_lobe_verts);

  //Draw line
  gl.bindVertexArray(lineVAO);
  updateMVP(M, lineProgram, line_mUniformLoc);
  first = 0; 
  gl.drawArrays(gl.LINES, first, num_line_verts);

  prev_time = time;
  // Notes on animation from:
  // https://webgl2fundamentals.org/webgl/lessons/webgl-animation.html
  requestAnimationFrame(render);
}

requestAnimationFrame(render); //TODO: Should we move this line somewhere else?
