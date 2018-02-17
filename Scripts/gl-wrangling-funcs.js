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

var setup_program = function(vsSource, fsSource){

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

//TODO: We may want to pre-allocate V and pass it in if we end up changing V
//often.
var setupMVP = function(program, mUniformLoc, vUniformLoc, pUniformLoc){
  
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

  var cam_z = 2; // z-position of camera in camera space
  var cam_y = 0.9; // altitude of camera

  // BRDF is in tangent space. Tangent space is Z-up.
  // Also, we need to move the camera so that it's not at the origin 
  var V = [1,      0,     0, 0,
           0,      0,     1, 0,
           0,      1,     0, 0,
           0, -cam_y,-cam_z, 1];

  gl.useProgram(program);
  gl.uniformMatrix4fv(vUniformLoc, false, V);

  // Perspective projection
  var fov = Math.PI * 0.5;
  var canvas = document.getElementById('webgl-canvas');
  var width = canvas.width;
  var height = canvas.height;
  var aspectRatio = width/height; // TODO: get the actual width and height
  var nearClip = 1;
  var farClip  = 50;
  var P = MDN.perspectiveMatrix(fov, aspectRatio, nearClip, farClip);

  gl.uniformMatrix4fv(pUniformLoc, false, P);
};

//prev_time is the time when previous frame was drawn
function updateMVP(deltaTime,program,mUniformLoc){

  var rotationSpeed = 1.2;
  rot_angle += rotationSpeed * deltaTime;

  mat4.fromRotation(M, rot_angle, rot_axis);

  gl.useProgram(program);
  gl.uniformMatrix4fv(mUniformLoc, false, M);
}
