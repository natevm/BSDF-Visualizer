/*jshint esversion: 6 */

//Code for perspective matrix from https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection
var MDN = {};
MDN.perspectiveMatrix = function(fieldOfViewInRadians, aspectRatio, near, far) {

  var f = 1.0 / Math.tan(fieldOfViewInRadians / 2);
  var rangeInv = 1 / (near - far);

  return [
    f / aspectRatio, 0,                          0,   0,
    0,               f,                          0,   0,
    0,               0,    (near + far) * rangeInv,  -1,
    0,               0,  near * far * rangeInv * 2,   0
  ];
};

var canvas = document.getElementById("webgl-canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gl = canvas.getContext("webgl2");
if (!gl) {
    console.error("WebGL 2 not available");
    document.body.innerHTML = "This application requires WebGL 2 which is unavailable on this system.";
}

gl.clearColor(0, 0, 0, 1);

/////////////////////
// SET UP PROGRAM
/////////////////////

const vsSource = document.getElementById("vs").text.trim();
const fsSource = document.getElementById("fs").text.trim();

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

gl.useProgram(program);

//Boilerplate for uniform
const mvpUniformLoc = gl.getUniformLocation(program, "u_mvp");

/////////////////////
// SET UP GEOMETRY
/////////////////////

var triangleArray = gl.createVertexArray();
gl.bindVertexArray(triangleArray);

const positions = new Float32Array([
    -0.5, -0.5, 0.0,
    0.5, -0.5, 0.0,
    0.0, 0.5, 0.0
]);

/*
 *var numPhiDivisions = 10;
 *var numThetaDivisions = 40;
 *var numDivisions = numPhiDivisions*numThetaDivisions; 
 *
 *const positions = new Float32Array(numDivisions);
 *
 *var dTheta = 360 / numThetaDivisions;
 *var dPhi = 360 / numPhiDivisions;
 *
 *for(i = 0; i < numThetaDivisions; i++){
 *  for(j = 0; j < numPhiDivisions; j++){
 *    var phi = j*dPhi;
 *    var theta = i*dTheta; 
 *  }
 *}
 */

var positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(0); 
const colors = new Float32Array([
    1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 0.0, 1.0
]);

var colorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(1);

//Set up model, view
var M = mat4.create();
var V = mat4.create();
mat4.translate(V,V,[0, 0, -2]);

//Perspective projection
var fov = Math.PI * 0.5;
var aspectRatio = 1; //TODO: get the actual width and height
var nearClip = 1;
var farClip  = 50;
var P = MDN.perspectiveMatrix(fov, aspectRatio, nearClip, farClip);

var MV = mat4.create();
var MVP = mat4.create();

var then = 0;
var rot = 0;

var rot_angle = 0; //radians
var rot_axis = vec3.create();
vec3.set(rot_axis, 0, 1, 0);

function updateMVP(now){

  now *= 0.001; //convert to seconds
  var deltaTime = now - then;
  then = now;

  var rotationSpeed = 1.2;
  rot_angle += rotationSpeed * deltaTime;

  mat4.fromRotation(M, rot_angle, rot_axis);

  mat4.multiply(MV,V,M); //MV = V * M
  mat4.multiply(MVP,P,MV); //MVP = P * MV
  gl.uniformMatrix4fv(mvpUniformLoc, false, MVP);
}

/////////////////////
// DRAW 
/////////////////////
function render(time){
  gl.clear(gl.COLOR_BUFFER_BIT);
  //gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.drawArrays(gl.POINTS, 0, 3);
  updateMVP(time);

  //Notes on animation from:
  //https://webgl2fundamentals.org/webgl/lessons/webgl-animation.html
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
