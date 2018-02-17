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

var lobeProgram = setup_program(lobeVsSource, lobeFsSource);

const lobe_mUniformLoc = gl.getUniformLocation(lobeProgram, "u_m"); // model matrix
const lobe_vUniformLoc = gl.getUniformLocation(lobeProgram, "u_v"); // view matrix
const lobe_pUniformLoc = gl.getUniformLocation(lobeProgram, "u_p"); // proj matrix

/////////////////////
// SET UP GEOMETRY 
/////////////////////
var num_verts = lobe_setupGeometry(30)

setupMVP(lobeProgram, lobe_mUniformLoc, lobe_vUniformLoc, lobe_pUniformLoc);

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
  
  const offset = 0; //see https://stackoverflow.com/q/10221647
  gl.drawArrays(gl.TRIANGLES, 0, num_verts);
  updateMVP(deltaTime, lobeProgram, lobe_mUniformLoc);

  prev_time = time;
  // Notes on animation from:
  // https://webgl2fundamentals.org/webgl/lessons/webgl-animation.html
  requestAnimationFrame(render);
}

requestAnimationFrame(render); //TODO: Should we move this line somewhere else?
