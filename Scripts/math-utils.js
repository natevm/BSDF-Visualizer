// Conversion code snippet from:
// http://cwestblog.com/2012/11/12/javascript-degree-and-radian-conversion//

// Converts from degrees to radians.
Math.radians = function(degrees) {
  return degrees * Math.PI / 180;
};

// Converts from radians to degrees.
Math.degrees = function(radians) {
  return radians * 180 / Math.PI;
};

mat3.rotY = function(angle_radians){
  var y = angle_radians;

  //WARNING: Column-major representation, see "A note about matrix formatting"
  //on http://glmatrix.net/
  return mat3.fromValues( Math.cos(y),  0,  -Math.sin(y),
                          0,            1,  0,
                          Math.sin(y),  0,   Math.cos(y) );
};

mat3.rotZ = function(angle_radians){
  var z = angle_radians;

  //WARNING: Column-major representation (see above)
  return mat3.fromValues( Math.cos(z),  Math.sin(z), 0, 
                          -Math.sin(z), Math.cos(z),  0,
                          0,            0,            1); 
};

//TODO: These shouldn't be global variables? We probably
//need to put math-utils in its own module?

//Result in degrees
var calc_delTheta = function(numThetaDivisions){
  return 90 / numThetaDivisions;
};

//Result in degrees
var calc_delPhi = function(numPhiDivisions){
  return 360 / numPhiDivisions;
};
