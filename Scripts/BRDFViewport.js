"use strict";

import {deg2rad, calc_delTheta, calc_delPhi, polar_to_cartesian, 
    polar_to_color} from './math-utils.js';
import {perspectiveMatrix, get_initial_V, compile_and_link_shdr, get_reflected,
    compute_L_hat, compute_N_hat, init_gl_context} from './gl-wrangling-funcs.js';

// Requires jquery
// Requires gl-matrix.js
// Requires d3.js

//************************
//"Class" BRDFViewport
//
// Using "Classless OOP": 
// https://github.com/n8vm/BSDF-Visualizer/wiki/Classless-OOP-reference 
//************************

//put "constructor" arguments inside "spec" (see main.js for usage example)
export default function BRDFViewport(spec) { 

  //Declare our object's properties and methods below.
  //They are private by default, unless we put them
  //in the "frozen" object that gets returned at the end.
  let 
    { canvasName, width, height, shdrDir } = spec,
    canvas = document.getElementById(canvasName), //Store canvas to viewport instance 
    gl, //GL context is initialized in "setupWebGL2"

    // Programs are initialized in createShaders
    lobeProgram,
    lobe_nUniformLoc,
    lobe_lUniformLoc,
    lobe_delThetaUniformLoc,
    lobe_delPhiUniformLoc,
    lobe_mUniformLoc,
    lobe_vUniformLoc,
    lobe_pUniformLoc,
    lobeVAO,

    lineProgram,
    line_mUniformLoc,
    line_vUniformLoc,
    line_pUniformLoc,
    lineVAO,

    renderReady = false,

    //TODO: remove in_theta_deg, in_phi_deg once we setup our
    //separate ControlsManager object
    in_theta_deg = 45,
    in_phi_deg = 0,
    numPhiDivisions = 200,
    numThetaDivisions = 100,
    delTheta = 90 / numThetaDivisions,
    delPhi = 360 / numPhiDivisions,

    prev_time = 0,
    //M = mat4.create(), //Right now we are keeping M as identity
    initial_V = get_initial_V(),
    V = mat4.clone(initial_V), 
    num_lobe_verts = 0,
    num_line_verts = 0,
    
    /////////////////////
    // CANVAS AND GL CONTEXT FUNCTIONS
    /////////////////////
    setupWebGL2 = function() {
      gl = init_gl_context(canvas);
      gl.clearColor(0, 0, 0, 1);
      gl.enable(gl.DEPTH_TEST);
    },

    /////////////////////
    // SET UP PROGRAM
    /////////////////////
    setupShaders = function(lobeVsSource, lobeFsSource, lineVsSource, lineFsSource) {
      lobeProgram = compile_and_link_shdr(gl, lobeVsSource, lobeFsSource);
      lineProgram = compile_and_link_shdr(gl, lineVsSource, lineFsSource);

      lobe_nUniformLoc = gl.getUniformLocation(lobeProgram, "u_n"); 
      lobe_lUniformLoc = gl.getUniformLocation(lobeProgram, "u_l"); 
      lobe_delThetaUniformLoc = 
          gl.getUniformLocation(lobeProgram, "u_delTheta"); 
      lobe_delPhiUniformLoc = 
          gl.getUniformLocation(lobeProgram, "u_delPhi"); 

      // model, view, and projection matrices, respectively.
      lobe_mUniformLoc = gl.getUniformLocation(lobeProgram, "u_m"); 
      lobe_vUniformLoc = gl.getUniformLocation(lobeProgram, "u_v"); 
      lobe_pUniformLoc = gl.getUniformLocation(lobeProgram, "u_p"); 

      line_mUniformLoc = gl.getUniformLocation(lineProgram, "u_m"); 
      line_vUniformLoc = gl.getUniformLocation(lineProgram, "u_v"); 
      line_pUniformLoc = gl.getUniformLocation(lineProgram, "u_p"); 

      setupMVP(lobeProgram, lobe_mUniformLoc, lobe_vUniformLoc, lobe_pUniformLoc);
      setupMVP(lineProgram, line_mUniformLoc, line_vUniformLoc, line_pUniformLoc);
    },

    /////////////////////
    // SET UP GEOMETRY  (This was tricky to port over. Could use some refactoring )
    /////////////////////

    //ASSSUMES THAT POSITIONS ARE AT ATTRIBUTE 0, COLORS AT ATTRIBUTE 1 IN SHADER.
    line_setupGeometry = function(lineVAO, L_hat, N_hat){
      const pos_dim = 3; //dimensionality of position vectors
      const color_dim = 3; //dimensionality of color vectors

      const posAttribLoc = 0;
      const positionBuffer = gl.createBuffer();
      const colorAttribLoc = 1;
      const colorBuffer = gl.createBuffer();

      let R_hat = get_reflected(L_hat, N_hat); 
      let positions = [];
      let colors = [];

      gl.bindVertexArray(lineVAO);

      //Incoming ray (cyan)
      positions.push(L_hat[0], L_hat[1], L_hat[2]); colors.push(0,1,1);
      positions.push(0, 0, 0); colors.push(0,1,1);

      //Outgoing ray (magenta)
      positions.push(0, 0, 0); colors.push(1,0,1);
      positions.push(R_hat[0], R_hat[1], R_hat[2]); colors.push(1,0,1);

      //TODO: Draw x (red), y (green), z (blue) axes 
      positions.push(0, 0, 0); colors.push(1, 0, 0);
      positions.push(1, 0, 0); colors.push(1, 0, 0);
      positions.push(0, 0, 0); colors.push(0, 1, 0);
      positions.push(0, 1, 0); colors.push(0, 1, 0);
      positions.push(0, 0, 0); colors.push(0, 0, 1);
      positions.push(0, 0, 1); colors.push(0, 0, 1);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(posAttribLoc, pos_dim, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(posAttribLoc); 

      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(colorAttribLoc, color_dim, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(colorAttribLoc);

      return positions.length/pos_dim; 
    },

    //ASSSUMES THAT POSITIONS ARE AT ATTRIBUTE 0, COLORS AT ATTRIBUTE 1,
    //NORMALS AT ATTRIBUTE 2 IN SHADER.
    lobe_setupGeometry = function(lobeVAO, L_hat, N_hat){
      //Dimensionality of positions, colors, normals
      const pos_dim = 3;
      const color_dim = 3;
      const norm_dim = 3;
      const polar_dim = 2;

      const posAttribLoc = 0;
      const positionBuffer = gl.createBuffer();
      const colorAttribLoc = 1;
      const colorBuffer = gl.createBuffer();
      const normalAttribLoc = 2;
      const normalBuffer = gl.createBuffer();
      const polar_coordAttribLoc = 3;
      const polar_coordBuffer = gl.createBuffer();

      let positions = [];
      let colors = [];
      let normals = []; //TODO: We can actually get rid of this attribute
      let polar_coords = [];

      let num_verts = 0;

      let delTheta = calc_delTheta(numThetaDivisions);
      let delPhi = calc_delPhi(numPhiDivisions); 

      gl.bindVertexArray(lobeVAO);

      for(let i = 0; i < numThetaDivisions; i++){
        for(let j = 0; j < numPhiDivisions; j++){
          // degrees 
          let phi_deg = j*delPhi; 
          let theta_deg = i*delTheta; 

          // TODO: Take a picture of my updated diagram.

          //Four position attributes of our quad
          let p = polar_to_cartesian(theta_deg,phi_deg); 
          let p_k_plus_1 = polar_to_cartesian(theta_deg, (j+1)*delPhi);
          let p_k_plus_N = polar_to_cartesian((i+1)*delTheta, phi_deg);
          let p_k_plus_N_plus_1 = polar_to_cartesian((i+1)*delTheta, (j+1)*delPhi);

          //Right now these four points are on a perfect hemisphere... 

          //Four color attributes of our quad 
          let c = polar_to_color(theta_deg,phi_deg); 
          let c_k_plus_1 = polar_to_color(theta_deg, (j+1)*delPhi);
          let c_k_plus_N = polar_to_color((i+1)*delTheta, phi_deg);
          let c_k_plus_N_plus_1 = polar_to_color((i+1)*delTheta, (j+1)*delPhi);

          //All verts share the same normal
          let v1 = vec3.create(); 
          let v2 = vec3.create(); 
          let n = vec3.create(); //The normal

          vec3.sub(v1, p_k_plus_N_plus_1, p); 
          vec3.sub(v2, p_k_plus_N, p);
          vec3.cross(n,v2,v1); 
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
          polar_coords.push(theta_deg,phi_deg);
          polar_coords.push(theta_deg, (j+1)*delPhi);
          polar_coords.push((i+1)*delTheta, (j+1)*delPhi);

          //p_k --> p_k_plus_N_plus_1 --> p_k_plus_N  
          positions.push(p[0],p[1],p[2]); 
          positions.push(p_k_plus_N_plus_1[0],p_k_plus_N_plus_1[1],p_k_plus_N_plus_1[2]); 
          positions.push(p_k_plus_N[0],p_k_plus_N[1],p_k_plus_N[2]); 
          colors.push(c[0],c[1],c[2]); 
          colors.push(c_k_plus_N_plus_1[0],c_k_plus_N_plus_1[1],c_k_plus_N_plus_1[2]); 
          colors.push(c_k_plus_N[0],c_k_plus_N[1],c_k_plus_N[2]); 
          normals.push(n[0],n[1],n[2]); normals.push(n[0],n[1],n[2]); normals.push(n[0],n[1],n[2]);
          polar_coords.push(theta_deg,phi_deg);
          polar_coords.push((i+1)*delTheta, (j+1)*delPhi);
          polar_coords.push((i+1)*delTheta, phi_deg);

          num_verts += 6;
        }
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
      gl.vertexAttribPointer(posAttribLoc, pos_dim, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(posAttribLoc); 

      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
      gl.vertexAttribPointer(colorAttribLoc, color_dim, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(colorAttribLoc);

      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
      gl.vertexAttribPointer(normalAttribLoc, norm_dim, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(normalAttribLoc); 

      gl.bindBuffer(gl.ARRAY_BUFFER, polar_coordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, 
        new Float32Array(polar_coords), gl.STATIC_DRAW);
      gl.vertexAttribPointer(polar_coordAttribLoc, polar_dim, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(polar_coordAttribLoc);

      return num_verts;
    },

    setupGeometry = function() {
      let L_hat = compute_L_hat(in_theta_deg, in_phi_deg);
      let N_hat = compute_N_hat();

      lobeVAO = gl.createVertexArray();
   
      //Assumes positions at attribute 0, colors at attribute 1, 
      //normals at attribute 2 in lobe shader
      num_lobe_verts = lobe_setupGeometry(lobeVAO, L_hat, N_hat);
      gl.useProgram(lobeProgram);
      gl.useProgram(lobeProgram);
      gl.uniform3fv(lobe_nUniformLoc,N_hat);
      gl.uniform3fv(lobe_lUniformLoc,L_hat);

      //TODO: calc_delPHi and calc_delTheta should be called exactly once, 
      //at init time, and their values should be stored in consts.
      gl.uniform1f(lobe_delPhiUniformLoc,calc_delPhi(numPhiDivisions));
      gl.uniform1f(lobe_delThetaUniformLoc,calc_delTheta(numThetaDivisions));

      lineVAO = gl.createVertexArray();
      //Assumes positions at attribute 0, colors at attribute 1 in line shader
      num_line_verts = line_setupGeometry(lineVAO, L_hat, N_hat);

      //TODO: Modify the V matrix, not the M matrix
      //TODO: should probably move this to setupShaders
      //setupMVP(lobeProgram, lobe_mUniformLoc, lobe_vUniformLoc, lobe_pUniformLoc);
      //setupMVP(lineProgram, line_mUniformLoc, line_vUniformLoc, line_pUniformLoc);
    },

    diffuse = function(light_dir, normal_dir){
      return Math.max(0,vec3.dot(light_dir, normal_dir));
    },

    phong = function(L_hat, V_hat, N_hat){
      const k_d = 0.7; 
      const k_s = 0.3; 
      const spec_power = 20; 

      let R_hat = get_reflected(L_hat, N_hat);
      let specular_value = Math.pow(Math.max(vec3.dot(R_hat, V_hat),0), spec_power);
      let diffuse_value = diffuse(L_hat,N_hat); //diffuse coefficient

      return k_d*diffuse_value + k_s*specular_value; 
    },

    //vtx is the original vertex on the hemisphere
    //return value is the same vertex with length scaled by the BRDF
    shade_vtx = function(L_hat,N_hat,vtx){
        let V_hat = vtx; //view (outgoing) direction 
        let phong_shade = phong(L_hat, V_hat, N_hat);
        let result = vec3.create(); 
        vec3.scale(result,vtx,phong_shade);
        return result;
    },

    setupMVP = function(program, mUniformLoc, vUniformLoc, pUniformLoc){
      let fov = Math.PI * 0.5;
      let canvas = document.getElementById('brdf-canvas');
      let aspectRatio = canvas.width/canvas.height;
      let nearClip = 0.5;
      let farClip  = 50;
      let P = perspectiveMatrix(fov, aspectRatio, nearClip, farClip);
      let M = mat4.create(); 

      gl.useProgram(program);

      gl.uniformMatrix4fv(vUniformLoc, false, initial_V); //View
      gl.uniformMatrix4fv(mUniformLoc, false, M); //Model
      gl.uniformMatrix4fv(pUniformLoc, false, P); //Projection
    },

    //prev_time is the time when previous frame was drawn
    updateV = function(V,vUniformLoc){ 
      gl.uniformMatrix4fv(vUniformLoc, false, V);
    },

    /////////////////////
    // SET UP UI CALLBACKS 
    /////////////////////
    setupUI = function() {
      const menu = d3.select("#brdf-menu");
      let thetaInput;
      let thetaOutput;
      let phiInput;
      let phiOutput;
      let camRotInput;

      /* add camRot slider */
      menu.append("input")
        .attr("id", "slider_camRot")
        .attr("type", "range")
        .attr("min", -180)
        .attr("max", 180)
        .attr("step", 1)
        .attr("value", 0);
    },

    setupUICallbacks = function() {
      document.getElementById("slider_camRot").oninput = (event) => {
        let rot_angle_deg = event.target.value;
        let rot_angle = deg2rad(rot_angle_deg);
        let rot_axis = vec3.create();
        let rot = mat4.create();

        vec3.set(rot_axis, 0, 0, 1);
        mat4.fromRotation(rot, rot_angle, rot_axis);
        mat4.multiply(V,initial_V,rot);
      };
    },

    updateTheta = function(newThetaDeg){
      let L_hat;
      let N_hat; 

      in_theta_deg = newThetaDeg; 
      L_hat = compute_L_hat(in_theta_deg, in_phi_deg);
      N_hat = compute_N_hat(); 

      gl.useProgram(lobeProgram);
      gl.uniform3fv(lobe_lUniformLoc,L_hat);

      //TODO: we should just be modifying uniforms, not setting up
      //the geometry again.
      num_line_verts = line_setupGeometry(lineVAO, L_hat, N_hat);
    },

    updatePhi = function(newPhiDeg){
      let L_hat;
      let N_hat;

      in_phi_deg = newPhiDeg;
      L_hat = compute_L_hat(in_theta_deg, in_phi_deg);
      N_hat = compute_N_hat(); 

      gl.useProgram(lobeProgram);
      gl.uniform3fv(lobe_lUniformLoc,L_hat);

      //TODO: we should just be modifying uniforms, not setting up
      //the geometry again.
      num_line_verts = line_setupGeometry(lineVAO, L_hat, N_hat);
    },

    /////////////////////
    // DRAW 
    /////////////////////
    render = function(time){
      if(renderReady === true){
        let deltaTime;
        let first; 

        time *= 0.001; // convert to seconds
        deltaTime = time - prev_time;

        gl.clear(gl.COLOR_BUFFER_BIT);
        
        //Draw lobe
        gl.bindVertexArray(lobeVAO);
        gl.useProgram(lobeProgram);
        updateV(V, lobe_vUniformLoc);
        first = 0; //see https://stackoverflow.com/q/10221647
        gl.drawArrays(gl.TRIANGLES, first, num_lobe_verts);

        //Draw line
        gl.bindVertexArray(lineVAO);
        gl.useProgram(lineProgram);
        updateV(V, line_vUniformLoc);
        first = 0; 
        gl.drawArrays(gl.LINES, first, num_line_verts);

        prev_time = time;
      }
    };

  //************* Start "constructor" **************
  {
    let lobeVertSrc;
    let lobeFragSrc;
    let lineVertSrc;
    let lineFragSrc;

    let promises = [];

    canvas.width = width;
    canvas.height = height;
    setupWebGL2();

    promises.push($.ajax({
      url: shdrDir + "color_only.vert", 
      success: function(result){
        lineVertSrc = result.trim();
      }
    }));
    promises.push($.ajax({
      url: shdrDir + "color_only.frag", 
      success: function(result){
        lineFragSrc = result.trim();
      }
    }));
    promises.push($.ajax({
      url: shdrDir + "lobe.vert", 
      success: function(result){
        lobeVertSrc = result.trim();
      }
    }));
    promises.push($.ajax({
      url: shdrDir + "phong.frag", 
      success: function(result){
        lobeFragSrc = result.trim();
      }
    }));

    //JQuery promise snippet from https://stackoverflow.com/a/10004137
    //Wait for all async callbacks to return, then execute the code below.
    $.when.apply($, promises).then(function() {
      // returned data is in arguments[0][0], arguments[1][0], ... arguments[9][0]
      // you can process it here
      setupShaders(lobeVertSrc, lobeFragSrc, lineVertSrc, lineFragSrc); 
      setupGeometry();
      renderReady = true;

      setupUI();
      setupUICallbacks();
        
    }, function() {
        // error occurred
        console.log("Error loading shaders!");
    });
  }
  //************* End "constructor" **************

  //Put any methods / properties that we want to make public inside this object. 
  return Object.freeze({
    render,   
    updateTheta,
    updatePhi
  });
}
