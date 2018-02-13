/*jshint esversion: 6 */

// Code for perspective matrix from https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection
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

var numPhiDivisions = 200;
var numThetaDivisions = 100;
var numVerts = numPhiDivisions*(numThetaDivisions+1); 

//const posArrayBuf = new ArrayBuffer(3*numVerts);
//const colorArrayBuf = new ArrayBuffer(3*numVerts);
var positions = new Float32Array(3*numVerts);
var colors = new Float32Array(3*numVerts);

// Two lines per vertex, except for the last row, which only draws
// one line per vertex.
var indices = [];

var dTheta = 90 / numThetaDivisions;
var dPhi = 360 / numPhiDivisions;

// L_hat points towards the light
// N_hat is the normal direction
// R_hat is L_hat reflected about the normal
// *_hat refers to a normalized vector

var L_hat = vec3.fromValues(1/Math.sqrt(2),0,1/Math.sqrt(2));
var N_hat = vec3.fromValues(0,0,1);
var L_plus_R = vec3.create();
vec3.scale(L_plus_R, N_hat, 2*vec3.dot(L_hat,N_hat));
var R_hat = vec3.create(); 
vec3.sub(R_hat, L_plus_R, L_hat);

const spec_power = 100; // specular power

var diffuse = function(light_dir, normal_dir){
  return vec3.dot(light_dir, normal_dir);
};

var vtx_idx = 0; // vertex index
for(i = 0; i <= numThetaDivisions; i++){
  for(j = 0; j < numPhiDivisions; j++){
    // degrees 
    var phi_deg = j*dPhi; 
    var theta_deg = i*dTheta; 

    // radians
    var phi = (Math.PI / 180) * phi_deg;
    var theta = (Math.PI / 180) * theta_deg;

    var x = Math.sin(theta)*Math.cos(phi);
    var y = Math.sin(theta)*Math.sin(phi);
    var z = Math.cos(theta);

    var V_hat = vec3.fromValues(x, y, z); //view (outgoing) direction 

    var k_s = Math.pow(vec3.dot(R_hat, V_hat), spec_power);
    var k_d = diffuse(L_hat,N_hat); //diffuse coefficient

    var shade = 0.7*k_d + 0.3*k_s; 

    positions[3*vtx_idx] = shade*x;
    positions[3*vtx_idx + 1] = shade*y;
    positions[3*vtx_idx + 2] = shade*z;

    //in HSV, H ranges from 0 to 360, S and V range from 0 to 100
    var h = phi_deg; 
    var s = (theta_deg / 90)*100;
    var v = 100;
    
    var rgb = hsvToRgb(h, s, v);

    colors[3*vtx_idx] = rgb[0];
    colors[3*vtx_idx + 1] = rgb[1];
    colors[3*vtx_idx + 2] = rgb[2];

    if(i < numThetaDivisions){ //don't do the bottommost concentric ring
      var N = numPhiDivisions;
      var k = vtx_idx;
      var k_plus_N = vtx_idx + N;
      var k_plus_1;
      var k_plus_N_plus_1;
      
      if(j < numPhiDivisions - 1){
        k_plus_1 = k + 1;
        k_plus_N_plus_1 = k_plus_N + 1; 
      } else { // circle back around to the first if we are the last on the ring
        k_plus_1 = vtx_idx - j;
        k_plus_N_plus_1 = k_plus_1 + N;
      }

      // two tris make a quad. CCW winding order
      indices.push(k, k_plus_N, k_plus_N_plus_1);
      indices.push(k, k_plus_N_plus_1, k_plus_1);
    }

/*
 *    // line between current and next vertex
 *    indices.push(vtx_idx);
 *    if(j < numPhiDivisions - 1)  
 *      indices.push(vtx_idx + 1); 
 *    else // circle back around to the first if we are at last vertex
 *      indices.push(vtx_idx - j);
 *
 *    // Line between current vertex and vertex directly beneath it. 
 *    // Don't do this for the bottommost concentric ring because there's
 *    // nothing beneath it
 *    if(i < numThetaDivisions){
 *      indices.push(vtx_idx);
 *      indices.push(vtx_idx + numPhiDivisions);
 *    }
 */

    vtx_idx++;
  }
}

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(0); 

const colorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(1);

const indexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
const idxType = gl.UNSIGNED_INT; // This is why we use Uint16Array on the next line
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

// Set up model, view
var M = mat4.create();
// var V = mat4.create();
var cam_z = 2; // z-position of camera in camera space
var cam_y = 0.9; // altitude of camera

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
var V = [1,      0,     0, 0,
         0,      0,     1, 0,
         0,      1,     0, 0,
         0, -cam_y,-cam_z, 1];

var test = mat4.create();
mat4.translate(test,test,[0, 0, -2]); 

//var V = mat4.create();

//mat4.translate(V,V,[0, 0, -2]); 

// Perspective projection
var fov = Math.PI * 0.5;
var canvas = document.getElementById('webgl-canvas');
var width = canvas.width;
var height = canvas.height;
var aspectRatio = width/height; // TODO: get the actual width and height
var nearClip = 1;
var farClip  = 50;
var P = MDN.perspectiveMatrix(fov, aspectRatio, nearClip, farClip);

var MV = mat4.create();
var MVP = mat4.create();

var then = 0;
var rot = 0;

var rot_angle = 0; // radians
var rot_axis = vec3.create();
vec3.set(rot_axis, 0, 0, 1);

gl.enable(gl.DEPTH_TEST);

function updateMVP(now){

  now *= 0.001; // convert to seconds
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
  //gl.drawArrays(gl.POINTS, 0, numVerts);
  
  const offset = 0; //see https://stackoverflow.com/q/10221647
  //gl.drawElements(gl.LINES, indices.length, idxType, 0);
  gl.drawElements(gl.TRIANGLES, indices.length, idxType, 0);
  updateMVP(time);

  // Notes on animation from:
  // https://webgl2fundamentals.org/webgl/lessons/webgl-animation.html
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
