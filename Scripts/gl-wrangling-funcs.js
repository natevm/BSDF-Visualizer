import {deg2rad, rotY, rotZ} from './math-utils.js';

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

export function get_initial_V(){
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
