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
