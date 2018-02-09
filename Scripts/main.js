console.log("Hello, World!");

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

var gl = canvas.getContext("webgl2");
if (!gl) {
    console.error("WebGL 2 not available");
    document.body.innerHTML = "This application requires WebGL 2 which is unavailable on this system.";
}

gl.clearColor(0, 0, 0, 1);

/////////////////////
// SET UP PROGRAM
/////////////////////

var vsSource = document.getElementById("vs").text.trim();
var fsSource = document.getElementById("fs").text.trim();

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
var mvpUniformLoc = gl.getUniformLocation(program, "u_mvp");

/////////////////////
// SET UP GEOMETRY
/////////////////////

var triangleArray = gl.createVertexArray();
gl.bindVertexArray(triangleArray);

var positions = new Float32Array([
    -0.5, -0.5, -1.0,
    0.5, -0.5, -1.0,
    0.0, 0.5, -1.0
]);

var positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(0);

var colors = new Float32Array([
    1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 0.0, 1.0
]);

var colorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(1);

//Set up model, view, projection
M = mat4.create();
V = mat4.create();
//P = mat4.create()
fov = Math.PI * 0.5;
aspectRatio = 1; //TODO: get the actual width and height
nearClip = 1;
farClip  = 50;
P = MDN.perspectiveMatrix(fov, aspectRatio, nearClip, farClip);

MV = mat4.create();
MVP = mat4.create();

mat4.multiply(MV,V,M); //MV = V * M
mat4.multiply(MVP,P,MV); //MVP = P * MV

gl.uniformMatrix4fv(mvpUniformLoc, false, MVP);

////////////////
// DRAW
////////////////
gl.clear(gl.COLOR_BUFFER_BIT);
gl.drawArrays(gl.TRIANGLES, 0, 3);
