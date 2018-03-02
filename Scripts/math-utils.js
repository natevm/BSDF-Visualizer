// Conversion code snippet from:
// http://cwestblog.com/2012/11/12/javascript-degree-and-radian-conversion//

// Converts from degrees to radians.
export function deg2rad(degrees) {
  return degrees * Math.PI / 180;
}

// Converts from radians to degrees.
// (Currently unused)
//export function rad2deg(radians) {
  //return radians * 180 / Math.PI;
//}

export function rotY(angle_radians){
  var y = angle_radians;

  //WARNING: Column-major representation, see "A note about matrix formatting"
  //on http://glmatrix.net/
  return mat3.fromValues( Math.cos(y),  0,  -Math.sin(y),
                          0,            1,  0,
                          Math.sin(y),  0,   Math.cos(y) );
}

export function rotZ(angle_radians){
  var z = angle_radians;

  //WARNING: Column-major representation (see above)
  return mat3.fromValues( Math.cos(z),  Math.sin(z), 0, 
                          -Math.sin(z), Math.cos(z),  0,
                          0,            0,            1); 
}

//TODO: These shouldn't be global variables? We probably
//need to put math-utils in its own module?

//Result in degrees
export function calc_delTheta(numThetaDivisions){
  return 90 / numThetaDivisions;
}

//Result in degrees
export function calc_delPhi(numPhiDivisions){
  return 360 / numPhiDivisions;
}
