"use strict";

//Hacked from https://github.com/Jam3/camera-unproject
//TODO: Import this function properly using NPM and browserify
export function unproject (out, vec, viewport, invProjectionView) {
  var viewX = viewport[0],
    viewY = viewport[1],
    viewWidth = viewport[2],
    viewHeight = viewport[3];

  var x = vec[0],
    y = vec[1],
    z = vec[2];

  x = x - viewX;
  y = viewHeight - y - 1;
  y = y - viewY;

  out[0] = (2 * x) / viewWidth - 1;
  out[1] = (2 * y) / viewHeight - 1;
  out[2] = 2 * z - 1;

  //See https://github.com/Jam3/camera-unproject/blob/master/lib/projectMat4.js
  let transform = function (out, vec, m) {
    var x = vec[0],
      y = vec[1],
      z = vec[2],
      a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3],
      a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
      a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11],
      a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

    var lw = 1 / (x * a03 + y * a13 + z * a23 + a33);

    out[0] = (x * a00 + y * a10 + z * a20 + a30) * lw;
    out[1] = (x * a01 + y * a11 + z * a21 + a31) * lw;
    out[2] = (x * a02 + y * a12 + z * a22 + a32) * lw;
    return out;
  };

  return transform(out, out, invProjectionView);
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

// Conversion code snippets from:
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


//HSV to RGB color conversion

//H runs from 0 to 360 degrees
//S and V run from 0 to 100

//Ported from the excellent java algorithm by Eugene Vishnevsky at:
//http://www.cs.rit.edu/~ncs/color/t_convert.html
export function hsv2Rgb(h, s, v) {
    var r, g, b;
    var i;
    var f, p, q, t;

    // Make sure our arguments stay in-range
    h = Math.max(0, Math.min(360, h));
    s = Math.max(0, Math.min(100, s));
    v = Math.max(0, Math.min(100, v));

    // We accept saturation and value arguments from 0 to 100 because that's
    // how Photoshop represents those values. Internally, however, the
    // saturation and value are calculated from a range of 0 to 1. We make
    // That conversion here.
    s /= 100;
    v /= 100;

    if(s === 0) {
        // Achromatic (grey)
        r = g = b = v;
        return [
            //Math.round(r * 255),
            //Math.round(g * 255),
            //Math.round(b * 255)
            r,
            g,
            b
        ];
    }

    h /= 60; // sector 0 to 5
    i = Math.floor(h);
    f = h - i; // factorial part of h
    p = v * (1 - s);
    q = v * (1 - s * f);
    t = v * (1 - s * (1 - f));

    switch(i) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;

        case 1:
            r = q;
            g = v;
            b = p;
            break;

        case 2:
            r = p;
            g = v;
            b = t;
            break;

        case 3:
            r = p;
            g = q;
            b = v;
            break;

        case 4:
            r = t;
            g = p;
            b = v;
            break;

        default: // case 5:
            r = v;
            g = p;
            b = q;
    }

    /*
     *return [
     *    Math.round(r * 255),
     *    Math.round(g * 255),
     *    Math.round(b * 255)
     *];
     */
    return [r,g,b];
}

export function polar_to_cartesian(theta_deg,phi_deg){
    // radians
    var phi = (Math.PI / 180) * phi_deg;
    var theta = (Math.PI / 180) * theta_deg;

    var x = Math.sin(theta)*Math.cos(phi);
    var y = Math.sin(theta)*Math.sin(phi);
    var z = Math.cos(theta);
    return vec3.fromValues(x, y, z);
}

export function polar_to_color(theta_deg, phi_deg){
    //in HSV, H ranges from 0 to 360, S and V range from 0 to 100
    var h = phi_deg;
    var s = (theta_deg / 90)*100;
    var v = 100;

    return hsv2Rgb(h, s, v);
}
