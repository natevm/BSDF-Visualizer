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

const lobeVsSource = document.getElementById("phong.vert").text.trim();
const lobeFsSource = document.getElementById("phong.frag").text.trim();
const lineVsSource = document.getElementById("color_only.vert").text.trim();
const lineFsSource = document.getElementById("color_only.frag").text.trim();

var lobeProgram = setup_program(lobeVsSource, lobeFsSource);
var lineProgram = setup_program(lineVsSource, lineFsSource);

const lobe_mUniformLoc = gl.getUniformLocation(lobeProgram, "u_m"); // model matrix
const lobe_vUniformLoc = gl.getUniformLocation(lobeProgram, "u_v"); // view matrix
const lobe_pUniformLoc = gl.getUniformLocation(lobeProgram, "u_p"); // proj matrix

const line_mUniformLoc = gl.getUniformLocation(lineProgram, "u_m"); 
const line_vUniformLoc = gl.getUniformLocation(lineProgram, "u_v"); 
const line_pUniformLoc = gl.getUniformLocation(lineProgram, "u_p"); 

/////////////////////
// SET UP GEOMETRY 
/////////////////////
var initial_in_angle_deg = 30;
var in_angle = (Math.PI/180)*initial_in_angle_deg;

// L_hat points towards the light
// N_hat is the normal direction
// *_hat refers to a normalized vector
var L_hat = compute_L_hat(in_angle);
var N_hat = compute_N_hat();

var lobeVAO = gl.createVertexArray();
//Assumes positions at attribute 0, colors at attribute 1, 
//normals at attribute 2 in lobe shader
var num_lobe_verts = lobe_setupGeometry(lobeVAO, L_hat, N_hat);

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
// DRAW 
/////////////////////
function render(time){
  time *= 0.001; // convert to seconds
  var deltaTime = time - prev_time;

  gl.clear(gl.COLOR_BUFFER_BIT);
  //gl.drawArrays(gl.POINTS, 0, numVerts);
  
  //update M
  var rotationSpeed = 1.2;
  rot_angle += rotationSpeed * deltaTime;
  mat4.fromRotation(M, rot_angle, rot_axis);

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
