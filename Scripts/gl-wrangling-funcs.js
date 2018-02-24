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

var get_initial_V = function(){
  var cam_z = 1.5; // z-position of camera in camera space
  var cam_y = 0.5; // altitude of camera
  var V = [1,      0,     0, 0,
           0,      0,     1, 0,
           0,      1,     0, 0,
           0, -cam_y,-cam_z, 1];
  return V;
};

var setup_program = function(gl, vsSource, fsSource){

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
};

//output is unit reflected vector
var get_reflected = function(L_hat,N_hat){
  var L_plus_R = vec3.create();
  vec3.scale(L_plus_R, N_hat, 2*vec3.dot(L_hat,N_hat));
  var R_hat = vec3.create(); 
  vec3.sub(R_hat, L_plus_R, L_hat);
  vec3.normalize(R_hat,R_hat); //I don't think this is needed?
  return R_hat;
};

//incident angle is the angle between the incident light vector and the normal

var compute_L_hat = function(in_theta_deg, in_phi_deg){
  var in_theta = Math.radians(in_theta_deg);
  var in_phi = Math.radians(in_phi_deg); 

  var rot_Y = mat3.rotY(-in_theta);
  var rot_Z = mat3.rotZ(in_phi);

  var rot = mat3.create(); mat3.multiply(rot, rot_Z, rot_Y);
  var L_hat_unrotated = vec3.fromValues(0,0,1);
  var L_hat = vec3.create(); vec3.transformMat3(L_hat, L_hat_unrotated, rot);
  return L_hat;
};

/*
 *var compute_L_hat = function(in_angle){
 *  return vec3.fromValues(-Math.cos(Math.PI/2 - in_angle),0,
 *    Math.sin(Math.PI/2 - in_angle));
 *};
 */

var compute_N_hat = function(){
  return vec3.fromValues(0,0,1);
};

