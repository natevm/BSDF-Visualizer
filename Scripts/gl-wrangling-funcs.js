"use strict";

import {deg2rad, rotY, rotZ} from './math-utils.js';
import {map_insert_chain} from './collections-wranglers.js';

//TODO: we want to pass the templatePath / vertPath / fragPath / templateType in as parameters.
//NOT viewers.

//We call this function once for each viewer, and pass in the appropriate information from
//the viewer.
//
//pass in the viewer's addUniformfunc so we can call it on the viewer.
//
//The viewer should have a getter that returns the appropriate shader paths.
export function loadAnalytical_getUniforms(file, viewers){
  let reader = new FileReader();
  //key: uniform name. value: function for updating the uniform.
  let uniform_update_funcs = new Map();
  let uniforms;
  let vertSrc;
  let fragSrc;

  //****************************************************
  //The function below defines a function addUniformsHelper, which is passed to
  //a Viewport by calling addUniformsFunc.
  //
  //addUniformHelper needs to be called inside our Viewport because it requires access
  //to the Viewport's unique OpenGL context. This means that we do not have to expose the Viewport's
  //OpenGL context publicly. (No one else should be able to touch it, otherwise we might corrupt the
  //Viewport's OpenGL state.)
  //
  //addUniformHelper is defined here in order to have access to uniform_update_funcs via closure.
  //This way, our Viewport cannot access uniform_update_funcs. It shouldn't be allowed to because
  //only the GUI should be able to update them.
  //
  //addUniformHelper binds uniforms using gl.getUniformLocation and also creates update
  //functions for the uniform based on the uniform type (float, bool, or color). (These update
  //functions are wrappers around gl.uniform*.) These update functions are stored in
  //update_uniform_funcs, which is a Map that maps from the uniform name to a list of
  //update functions (because if we have multiple Viewports, then the same uniform
  //will have multiple update callbacks regsitered to it).
  //****************************************************
  var generate_addUniformsHelper = function(loadPromise, currViewer){
    return loadPromise.then(value => {
      //"value" is in some sense the "return value" of loadBRDFPromise.
      //In other words, the "return value" of the original promise is the first argument
      //to the function passed to the "resolve" parameter (i.e. the first parameter) of the
      //"then" function.
      uniforms = value.uniformsInfo;
      vertSrc = value.finalVtxSrc;
      fragSrc = value.finalFragSrc;
    }, err => {
        throw "BRDF load error: " + err;
    }).then( () => { //call the below asynchronously, AFTER the above is done loading
      //The below is passed as a first-class function to addUniformsFunc
      let addUniformsHelper = function(gl) {
        let program = compile_and_link_shdr(gl, vertSrc, fragSrc);

        gl.useProgram(program);

        Object.keys(uniforms).forEach( u => {
          //We need to use "let" for loc. If we use "var", the closure
          //won't work due to hoisting and all functions stored in
          //uniform_update_funcs will store a pointer to the location of
          //the last uniform processed!
          let loc = gl.getUniformLocation(program, u);
          let curr_u = uniforms[u];
          let u_type = curr_u.type;

          if (u_type === "float") {
            let flt_update_func = flt => {
              let oldProgram = gl.getParameter(gl.CURRENT_PROGRAM);
              gl.useProgram(program);

              gl.uniform1f(loc,flt);

              gl.useProgram(oldProgram); //restore previous state
            };

            if ( (typeof curr_u.default) !== "number" ){
              throw "curr_u.default should be a number!";
            }
            flt_update_func(curr_u.default);

            map_insert_chain(uniform_update_funcs, u, flt_update_func);
          } else if (u_type === "bool") {
            let bool_update_func = bool_v => {
              let oldProgram = gl.getParameter(gl.CURRENT_PROGRAM);
              gl.useProgram(program);

              if (bool_v === true) {
                gl.uniform1i(loc,1);
              } else if (bool_v === false) {
                gl.uniform1i(loc,0);
              } else {
                throw "Invalid boolean input: " + bool_v;
              }

              gl.useProgram(oldProgram); //restore previous state
            };

            bool_update_func(curr_u.default);

            map_insert_chain(uniform_update_funcs, u, bool_update_func);
          } else if (u_type === "color") {
            let vec3_update_func = vec3_v => {
              let oldProgram = gl.getParameter(gl.CURRENT_PROGRAM);
              gl.useProgram(program);

              gl.uniform3f(loc, vec3_v[0], vec3_v[1], vec3_v[2]);

              gl.useProgram(oldProgram); //restore previous state
            };

            if ( (typeof curr_u.defaultR) !== "number" ||
                 (typeof curr_u.defaultG) !== "number" ||
                 (typeof curr_u.defaultB) !== "number" ){
              throw "curr_u.default[RGB] should be a number!";
            }
            vec3_update_func([curr_u.defaultR, curr_u.defaultG,
              curr_u.defaultB]);

            map_insert_chain(uniform_update_funcs, u, vec3_update_func);
          } else {
            throw "Invalid uniform type: " + u_type;
          }
        });

        //Give our new program to the Viewer, so the Viewer can bind
        //it to the appropriate variable. E.g. At time of writing,
        //BRDFViewport binds this to lobeProgram.
        return program;
      };

      //viewers.forEach( v => {
        //if( "addUniformsFunc" in currViewer ){
          currViewer.addUniformsFunc(addUniformsHelper);
        //}
      //});
    });
    //.then( () => {
      //console.log("Done adding uniforms!");
      //return {uniforms, uniform_update_funcs};
    //});
  };

  //*******************************************************
  // Done defining generate_addUniformsHelper, get stuff done down below...
  //*******************************************************

  //onload will be invoked when this is done
  reader.readAsText(file);

  //We can wrap onload with a promise, and set reader.onload = resolve.
  //We can call .then() on the new promise and call the below code there.
  //We can return this promise, which the caller can then handle.
  return new Promise(resolve => {reader.onload = resolve;}).then(() => {
    let promises = [];

    //WARNING: hasOwnProperty won't get inherited properties. That's intentional for now...
    viewers.forEach( v => {
      if (v.hasOwnProperty("getTemplateInfo") && v.hasOwnProperty("addUniformsFunc")){
        let templInfo = v.getTemplateInfo();
        let loadBRDFPromise = loadBRDF({brdfFileStr: reader.result,
          shdrDir: templInfo.shaderDir, templatePath: templInfo.templatePath,
          vertPath: templInfo.vertPath, fragPath: templInfo.fragPath,
          templateType: templInfo.templateType});
        promises.push(generate_addUniformsHelper(loadBRDFPromise, v));
      }
    });

    //return generate_addUniformsHelper(loadBRDFPromise, viewers[0]);
    return Promise.all(promises).then(function() {
      return({uniforms, uniform_update_funcs});
    }); //when we call .then() in GUI.js, we are really just appending a .then() right here on this line.
  });
}

export function loadBRDF(spec){
  let { brdfFileStr, shdrDir, templatePath, vertPath, fragPath,
        templateType } = spec;
  let templStr; //template shader as string
  let vertStr; //vertex shader as string
  let fragStr; //fragment shader as string

  //ES6 promises: https://stackoverflow.com/a/10004137
  //jQuery AJAX requests return an ES6-compatible promise,
  //because jQuery 3.0+ implements the
  //Promise/A+ API (see https://stackoverflow.com/a/35135488)
  let promises = [];

  promises.push($.ajax({
    url: shdrDir + templatePath,
    success: function(result){
      templStr = result.trim();
    }
  }));
  promises.push($.ajax({
    url: shdrDir + vertPath,
    success: function(result){
      vertStr = result.trim();
    }
  }));
  promises.push($.ajax({
    url: shdrDir + fragPath,
    success: function(result){
      fragStr = result.trim();
    }
  }));

  return Promise.all(promises).then(function() {
      // returned data is in arguments[0][0], arguments[1][0], ... arguments[9][0]
      // you can process it here

      let { uniformsInfo, finalFragSrc, finalVtxSrc } = brdfShaderFromTemplate({
        rawVtxShdr: vertStr, rawFragShdr: fragStr, templShdr: templStr,
        brdfSrc: brdfFileStr, whichTemplate: templateType});

      //resolve({uniformsInfo, finalVtxSrc, finalFragSrc});
      return {uniformsInfo, finalVtxSrc, finalFragSrc};
    }, function(err) {
        console.log("Shader Load Error: " + err);
    });
}

function uniformsInfo_toString(uniformsInfo){
  let uniformsStr = "";
  Object.keys(uniformsInfo).forEach(function(name){
    let currUniform = uniformsInfo[name];
    if (currUniform.type === "float"){
      uniformsStr += "uniform float " + name + ";\n";
    } else if (currUniform.type === "bool"){
      uniformsStr += "uniform bool " + name + ";\n";
    } else if (currUniform.type === "color"){
      uniformsStr += "uniform vec3 " + name + ";\n";
    } else {
      throw "Invalid uniform type: " + currUniform.type;
    }
  });
  return uniformsStr;
}

//Requires js-yaml: https://github.com/nodeca/js-yaml
//
//Consumes a template shader with:
// 1) Analytical BRDF in our YAML format.
// 2) A "template shader" that contains the strings:
//   a) <INLINE_UNIFORMS_HERE> where additional uniforms should be inlined.
//   b) <INLINE_BRDF_HERE> where the BRDF function gets inlined.
function brdfTemplSubst(templShdrSrc, brdfYaml){
  let brdf_t = jsyaml.load(brdfYaml);
  //console.log(brdf_t);
  let uniformsInfo = brdf_t.uniforms;
  if( !uniformsInfo.hasOwnProperty('NdotL') ){
    uniformsInfo.NdotL = {type: "bool", default: true};
  }
  let brdfFuncStr = brdf_t.brdf;

  {
    //Based on uniformsInfo, generate string that contains the GLSL uniforms
    let uniformsSrc = uniformsInfo_toString(uniformsInfo);
    let uniformHook = /\/\/\s*<INLINE_UNIFORMS_HERE>/;
    let brdfFuncHook = /\/\/\s*<INLINE_BRDF_HERE>/;
    //Substitute our generated uniforms into template
    //Substitute BRDF function into template
    let substitutedSrc = templShdrSrc.replace(uniformHook, uniformsSrc)
                                     .replace(brdfFuncHook, brdfFuncStr);

    console.log(substitutedSrc);
    return {uInfo: uniformsInfo, substSrc: substitutedSrc};
  }
}

//which_template has a value of either "vert" or "frag".
//If which_template === "vert", vtx_shdr is the template
//If which_template === "frag", frag_shdr is the template
//It is assumed that vtx_shdr and frag_shdr cannot both be templates.
export function brdfShaderFromTemplate(spec){
  let {rawVtxShdr, rawFragShdr, templShdr, brdfSrc, whichTemplate} = spec;
  let finalFragSrc;
  let finalVtxSrc;
  let {uInfo, substSrc} = brdfTemplSubst(templShdr,brdfSrc);
  let uniformsInfo = uInfo;

  if(whichTemplate === "vert"){
    //uniformsInfo = uInfo;
    finalVtxSrc = substSrc;
    finalFragSrc = rawFragShdr;
  } else if(whichTemplate === "frag"){
    //uniformsInfo = uInfo;
    finalVtxSrc = rawVtxShdr;
    finalFragSrc = substSrc;
  } else {
    throw "Value of whichTemplate expected to be either 'vtx' or 'frag'";
  }

  return { uniformsInfo, finalFragSrc, finalVtxSrc };
}

export function init_gl_context(canvas){
  const gl = canvas.getContext("webgl2", {antialias:true});
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

//TODO: move this into BRDFViewport.js, since it's specific to that viewer.
//export function get_initial_V(){
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

  //// BRDF is in tangent space. Tangent space is Z-up.
  //// Also, we need to move the camera so that it's not at the origin
  //var cam_z = 1.5; // z-position of camera in camera space
  //var cam_y = 0.5; // altitude of camera
  //var V = [1,      0,     0, 0,
           //0,      0,     1, 0,
           //0,      1,     0, 0,
           //0, -cam_y,-cam_z, 1];
  //return V;
//}

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
