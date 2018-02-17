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

var triangleArray = gl.createVertexArray();
gl.bindVertexArray(triangleArray);

var numPhiDivisions = 200;
var numThetaDivisions = 100;

//var numPhiDivisions = 6;
//var numThetaDivisions = 3;

//Dimensionality of positions, colors, normals
var pos_dim = 3;
var color_dim = 3;
var norm_dim = 3;

var positions = [];
var colors = [];

var delTheta = 90 / numThetaDivisions;
var delPhi = 360 / numPhiDivisions;

// L_hat points towards the light
// N_hat is the normal direction
// *_hat refers to a normalized vector

var L_hat = vec3.fromValues(-1/Math.sqrt(2),0,1/Math.sqrt(2));
var N_hat = vec3.fromValues(0,0,1);

var diffuse = function(light_dir, normal_dir){
  return vec3.dot(light_dir, normal_dir);
};

//output is unit reflected vector
var get_reflected = function(L_hat,N_hat){
  var L_plus_R = vec3.create();
  vec3.scale(L_plus_R, N_hat, 2*vec3.dot(L_hat,N_hat));
  var R_hat = vec3.create(); 
  vec3.sub(R_hat, L_plus_R, L_hat);
  return R_hat;
};

var phong = function(L_hat, V_hat, N_hat){
  const k_d = 0.7; 
  const k_s = 0.3; 
  const spec_power = 20; 

  var R_hat = get_reflected(L_hat, N_hat);
  var specular_value = Math.pow(vec3.dot(R_hat, V_hat), spec_power);
  var diffuse_value = diffuse(L_hat,N_hat); //diffuse coefficient

  return k_d*diffuse_value + k_s*specular_value; 
};

//var indices = [];
var normals = [];

var polar_to_cartesian = function(theta_deg,phi_deg){
    // radians
    var phi = (Math.PI / 180) * phi_deg;
    var theta = (Math.PI / 180) * theta_deg;

    var x = Math.sin(theta)*Math.cos(phi);
    var y = Math.sin(theta)*Math.sin(phi);
    var z = Math.cos(theta);
    return vec3.fromValues(x, y, z);
};

var polar_to_color = function(theta_deg, phi_deg){
    //in HSV, H ranges from 0 to 360, S and V range from 0 to 100
    var h = phi_deg; 
    var s = (theta_deg / 90)*100;
    var v = 100;
    
    return hsvToRgb(h, s, v);
};

//vtx is the original vertex on the hemisphere
//return value is the same vertex with length scaled by the BRDF
var shade_vtx = function(L_hat,N_hat,vtx){
    var V_hat = vtx; //view (outgoing) direction 
    var phong_shade = phong(L_hat, V_hat, N_hat);
    var result = vec3.create(); 
    vec3.scale(result,vtx,phong_shade);
    return result;
};

var num_verts = 0;
for(var i = 0; i < numThetaDivisions; i++){
  for(var j = 0; j < numPhiDivisions; j++){
    // degrees 
    var phi_deg = j*delPhi; 
    var theta_deg = i*delTheta; 

    // TODO: Take a picture of my updated diagram.

    //Four position attributes of our quad
    var p = polar_to_cartesian(theta_deg,phi_deg); 
    var p_k_plus_1 = polar_to_cartesian(theta_deg, (j+1)*delPhi);
    var p_k_plus_N = polar_to_cartesian((i+1)*delTheta, phi_deg);
    var p_k_plus_N_plus_1 = polar_to_cartesian((i+1)*delTheta, (j+1)*delPhi);

    //Right now these four points are on a perfect hemisphere... 

    //Scale by BRDF
    p = shade_vtx(L_hat,N_hat,p);
    p_k_plus_1 = shade_vtx(L_hat,N_hat,p_k_plus_1);
    p_k_plus_N = shade_vtx(L_hat,N_hat,p_k_plus_N);
    p_k_plus_N_plus_1 = shade_vtx(L_hat,N_hat,p_k_plus_N_plus_1);

    //Four color attributes of our quad 
    var c = polar_to_color(theta_deg,phi_deg); 
    var c_k_plus_1 = polar_to_color(theta_deg, (j+1)*delPhi);
    var c_k_plus_N = polar_to_color((i+1)*delTheta, phi_deg);
    var c_k_plus_N_plus_1 = polar_to_color((i+1)*delTheta, (j+1)*delPhi);

    //All verts share the same normal
    var v1 = vec3.create(); vec3.sub(v1, p_k_plus_N_plus_1, p); 
    var v2 = vec3.create(); vec3.sub(v2, p_k_plus_N, p);
    var n = vec3.create(); vec3.cross(n,v2,v1); //the normal

    vec3.normalize(n,n);

    //Push these values to the buffers. 
    //There are two tris per quad, so we need a total of six attributes.
    //CCW winding order

    //p_k --> p_k_plus_1 --> p_k_plus_N_plus_1
    positions.push(p[0],p[1],p[2]); 
    positions.push(p_k_plus_1[0],p_k_plus_1[1],p_k_plus_1[2]); 
    positions.push(p_k_plus_N_plus_1[0],p_k_plus_N_plus_1[1],p_k_plus_N_plus_1[2]); 
    colors.push(c[0],c[1],c[2]); 
    colors.push(c_k_plus_1[0],c_k_plus_1[1],c_k_plus_1[2]); 
    colors.push(c_k_plus_N_plus_1[0],c_k_plus_N_plus_1[1],c_k_plus_N_plus_1[2]); 
    normals.push(n[0],n[1],n[2]); normals.push(n[0],n[1],n[2]); normals.push(n[0],n[1],n[2]);

    //p_k --> p_k_plus_N_plus_1 --> p_k_plus_N  
    positions.push(p[0],p[1],p[2]); 
    positions.push(p_k_plus_N_plus_1[0],p_k_plus_N_plus_1[1],p_k_plus_N_plus_1[2]); 
    positions.push(p_k_plus_N[0],p_k_plus_N[1],p_k_plus_N[2]); 
    colors.push(c[0],c[1],c[2]); 
    colors.push(c_k_plus_N_plus_1[0],c_k_plus_N_plus_1[1],c_k_plus_N_plus_1[2]); 
    colors.push(c_k_plus_N[0],c_k_plus_N[1],c_k_plus_N[2]); 
    normals.push(n[0],n[1],n[2]); normals.push(n[0],n[1],n[2]); normals.push(n[0],n[1],n[2]);
    num_verts += 6;
      //num_verts += 3;

    // Set triangle indices
/*
 *    if(i < numThetaDivisions){ // don't do the bottommost concentric ring
 *      var N = numPhiDivisions;
 *      var k = vtx_idx;
 *      var k_plus_N = vtx_idx + N;
 *      var k_plus_1;
 *      var k_plus_N_plus_1;
 *      
 *      if(j < numPhiDivisions - 1){
 *        k_plus_1 = k + 1;
 *        k_plus_N_plus_1 = k_plus_N + 1; 
 *      } else { // circle back around to the first if we are the last on the ring
 *        k_plus_1 = vtx_idx - j;
 *        k_plus_N_plus_1 = k_plus_1 + N;
 *      }
 *
 *      // two tris make a quad. CCW winding order
 *      indices.push(k, k_plus_1, k_plus_N);
 *      indices.push(k_plus_N, k_plus_1, k_plus_N_plus_1);
 *    }
 */

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
  }
}

const posAttribLoc = 0;
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
gl.vertexAttribPointer(posAttribLoc, pos_dim, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(posAttribLoc); 

const colorAttribLoc = 1;
const colorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
gl.vertexAttribPointer(colorAttribLoc, color_dim, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(colorAttribLoc);

//const indexBuffer = gl.createBuffer();
//gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
//const idxType = gl.UNSIGNED_INT; // This is why we use Uint16Array on the next line. 
////idxType is passed to our draw command later.
//gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW); 

const normalAttribLoc = 2;
const normalBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
gl.vertexAttribPointer(normalAttribLoc, norm_dim, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(normalAttribLoc); 

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
