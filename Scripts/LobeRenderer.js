"use strict";

//************************
//"Class" LobeRenderer
//
// Using "Classless OOP":
// https://github.com/n8vm/BSDF-Visualizer/wiki/Classless-OOP-reference
//************************
import {compile_and_link_shdr, compute_L_hat,
  compute_N_hat} from './gl-wrangling-funcs.js';
import {calc_delTheta, calc_delPhi, polar_to_cartesian, get_reflected,
    polar_to_color} from './math-utils.js';

//put "constructor" arguments inside "spec" (see main.js for usage example)
export default function LobeRenderer(spec) {
  let
    {gl, starting_theta, starting_phi, lobe_vert_shader_name, lobe_frag_shader_name,
      shdrDir, initial_Tangent2World, initial_V, initial_P} = spec,

    // Programs are initialized in createShaders
    lobeProgram,
    lobe_nUniformLoc,
    lobe_lUniformLoc,
    lobe_delThetaUniformLoc,
    lobe_delPhiUniformLoc,
    lobe_mUniformLoc,
    lobe_vUniformLoc,
    lobe_pUniformLoc,
    //lobe_vert_shader_name = "lobe.vert",
    //lobe_frag_shader_name = "phong.frag",
    lobeVAO,
    line_positionBuffer,
    num_lobe_verts,

    lineProgram,
    line_mUniformLoc,
    line_vUniformLoc,
    line_pUniformLoc,
    lineVAO,
    num_line_verts,

    renderReady = false,

    numPhiDivisions = 200,
    numThetaDivisions = 100,
    delTheta = 90 / numThetaDivisions,
    delPhi = 360 / numPhiDivisions,

    in_theta_deg = starting_theta,
    in_phi_deg = starting_phi,

    //called when user loads a BRDF
    addUniformsFunc = function(addUniformsHelper, Tangent2World, V, P){
      lobeProgram = addUniformsHelper(gl);
      //we need to set up our uniforms again because
      //the above function returned a new lobeProgram.
      setupUniformsLobe();
      setupGeometry();
      //setMVP(M, V, P);
      setTangent2World(Tangent2World);
      setV(V);
      setP(P);
      renderReady = true;
    },

    //setV_helper = function(V,uniformLoc){
      //gl.uniformMatrix4fv(uniformLoc, false, V);
    //},

    setV = function(V){
      gl.useProgram(lobeProgram);
      gl.uniformMatrix4fv(lobe_vUniformLoc, false, V);
      //setV_helper(V, lobe_vUniformLoc);
      gl.useProgram(lineProgram);
      gl.uniformMatrix4fv(line_vUniformLoc, false, V);
      //setV_helper(V, line_vUniformLoc);
    },

    //setMVP = function(M, V, P){
      //let set = (program, mUniformLoc, vUniformLoc, pUniformLoc) => {
        //gl.useProgram(program);

        ////gl.uniformMatrix4fv(vUniformLoc, false, V); //View
        //setV_helper(V, vUniformLoc);
        //gl.uniformMatrix4fv(mUniformLoc, false, M); //Model
        //gl.uniformMatrix4fv(pUniformLoc, false, P); //Projection
      //};

      //set(lobeProgram, lobe_mUniformLoc, lobe_vUniformLoc, lobe_pUniformLoc);
      //set(lineProgram, line_mUniformLoc, line_vUniformLoc, line_pUniformLoc);
    //},

    setM = function(M){
      gl.useProgram(lobeProgram);
      gl.uniformMatrix4fv(lobe_mUniformLoc, false, M);
      gl.useProgram(lineProgram);
      gl.uniformMatrix4fv(line_mUniformLoc, false, M);
    },

    setP = function(P){
      gl.useProgram(lobeProgram);
      gl.uniformMatrix4fv(lobe_pUniformLoc, false, P);
      gl.useProgram(lineProgram);
      gl.uniformMatrix4fv(line_pUniformLoc, false, P);
    },


    setTangent2World = function(Tangent2World){
      let M = mat4.create();
      let BRDF2Tangent = mat4.fromValues(0, 1, 0, 0,
                                         1, 0, 0, 0,
                                         0, 0, 1, 0,
                                         0, 0, 0, 1);
      mat4.multiply(M, Tangent2World, BRDF2Tangent);

      let setM = () => {
        gl.useProgram(lobeProgram);
        gl.uniformMatrix4fv(lobe_mUniformLoc, false, M);
        gl.useProgram(lineProgram);
        gl.uniformMatrix4fv(line_mUniformLoc, false, M);
      };

      setM();
    },

    setupUniformsLobe = function() {
      lobe_nUniformLoc = gl.getUniformLocation(lobeProgram, "u_n");
      lobe_lUniformLoc = gl.getUniformLocation(lobeProgram, "u_l");
      lobe_delThetaUniformLoc =
          gl.getUniformLocation(lobeProgram, "u_delTheta");
      lobe_delPhiUniformLoc =
          gl.getUniformLocation(lobeProgram, "u_delPhi");
      lobe_mUniformLoc = gl.getUniformLocation(lobeProgram, "u_m");
      lobe_vUniformLoc = gl.getUniformLocation(lobeProgram, "u_v");
      lobe_pUniformLoc = gl.getUniformLocation(lobeProgram, "u_p");
    },

    setupUniformsLine = function() {
      line_mUniformLoc = gl.getUniformLocation(lineProgram, "u_m");
      line_vUniformLoc = gl.getUniformLocation(lineProgram, "u_v");
      line_pUniformLoc = gl.getUniformLocation(lineProgram, "u_p");
    },

    setupShaders = function(lobeVsSource, lobeFsSource, lineVsSource, lineFsSource) {
      lobeProgram = compile_and_link_shdr(gl, lobeVsSource, lobeFsSource);
      lineProgram = compile_and_link_shdr(gl, lineVsSource, lineFsSource);

      setupUniformsLobe();
      setupUniformsLine();
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
      //num_line_verts = line_setupGeometry(lineVAO, L_hat, N_hat);
      updateLineGeometry(L_hat, N_hat);
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
      //num_line_verts = line_setupGeometry(lineVAO, L_hat, N_hat);
      updateLineGeometry(L_hat, N_hat);
    },

    //ASSSUMES THAT POSITIONS ARE AT ATTRIBUTE 0, COLORS AT ATTRIBUTE 1 IN SHADER.
    line_setupGeometry = function(vao, L_hat, N_hat){
      const pos_dim = 3; //dimensionality of position vectors
      const color_dim = 3; //dimensionality of color vectors

      const posAttribLoc = 0;
      line_positionBuffer = gl.createBuffer();
      const colorAttribLoc = 1;
      const colorBuffer = gl.createBuffer();

      let R_hat = get_reflected(L_hat, N_hat);
      let positions = [];
      let colors = [];

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

      gl.bindVertexArray(vao);

      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(colorAttribLoc, color_dim, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(colorAttribLoc);

      //For some reason, things break if we leave colorBuffer bound as gl.ARRAY_BUFFER.
      gl.bindBuffer(gl.ARRAY_BUFFER, line_positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(posAttribLoc, pos_dim, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(posAttribLoc);

      gl.bindVertexArray(null);

      return positions.length/pos_dim;
    },

    //Assumes line_setupGeometry() has been called
    updateLineGeometry = function(L_hat, N_hat){
      let positions = [];

      //Incoming ray (cyan)
      positions.push(L_hat[0], L_hat[1], L_hat[2]);
      positions.push(0, 0, 0);

      //Outgoing ray (magenta)
      let R_hat = get_reflected(L_hat, N_hat);
      positions.push(0, 0, 0);
      positions.push(R_hat[0], R_hat[1], R_hat[2]);

      let posFlt32Array = new Float32Array(positions);
      let dstByteOffset = 0;
      let srcOffset = 0;
      gl.bindVertexArray(lineVAO);
      //gl.bindBuffer(gl.ARRAY_BUFFER, line_positionBuffer);
      //gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, dstByteOffset, posFlt32Array, srcOffset, positions.length);
      gl.bindVertexArray(null);
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

      gl.bindVertexArray(lobeVAO);

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

      gl.bindVertexArray(null);

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

    render = function(time){
      if(renderReady === true){
        let first;

        gl.clear(gl.COLOR_BUFFER_BIT);

        //Draw lobe
        gl.bindVertexArray(lobeVAO);
        gl.useProgram(lobeProgram);
        first = 0; //see https://stackoverflow.com/q/10221647
        gl.drawArrays(gl.TRIANGLES, first, num_lobe_verts);

        //Draw line
        gl.bindVertexArray(lineVAO);
        gl.useProgram(lineProgram);
        first = 0;
        gl.drawArrays(gl.LINES, first, num_line_verts);
        gl.bindVertexArray(null);
      }
    };
  //************* Start "constructor" **************
  {
    let lobeVertSrc;
    let lobeFragSrc;
    let lineVertSrc;
    let lineFragSrc;

    //ES6 promises: https://stackoverflow.com/a/10004137
    //jQuery AJAX requests return an ES6-compatible promise,
    //because jQuery 3.0+ implements the
    //Promise/A+ API (see https://stackoverflow.com/a/35135488)
    let promises = [];

    promises.push($.ajax({
      url: shdrDir + "color_only.vert",
      success: function(result){
        lineVertSrc = result.trim();
      }, error: function(result) {
        console.log("failed to load mcolor_only.vert with error ");
        console.log(result);
      }
    }));
    promises.push($.ajax({
      url: shdrDir + "color_only.frag",
      success: function(result){
        lineFragSrc = result.trim();
      }, error: function(result) {
        console.log("failed to load color_only.frag with error ");
        console.log(result);
      }
    }));
    promises.push($.ajax({
      url: shdrDir + lobe_vert_shader_name,
      success: function(result){
        lobeVertSrc = result.trim();
      }, error: function(result) {
        console.log("failed to load lobe.vert with error ");
        console.log(result);
      }
    }));
    promises.push($.ajax({
      url: shdrDir + lobe_frag_shader_name,
      success: function(result){
        lobeFragSrc = result.trim();
      }, error: function(result) {
        console.log("failed to load phong.frag with error ");
        console.log(result);
      }
    }));

    Promise.all(promises).then(function() {
      // returned data is in arguments[0][0], arguments[1][0], ... arguments[9][0]
      // you can process it here
      setupShaders(lobeVertSrc, lobeFragSrc, lineVertSrc, lineFragSrc);
      setupGeometry();
      //setMVP(initial_M, initial_V, initial_P);
      setTangent2World(initial_Tangent2World);
      setV(initial_V);
      setP(initial_P);
      renderReady = true;
    }, function(err) {
        throw "Shader load error: " + err;
    });
  }
  //************* End "constructor" **************

  //Put any methods / properties that we want to make public inside this object.
  return Object.freeze({
    render,
    updateTheta,
    updatePhi,
    addUniformsFunc,
    setV,
    setP,
    //setMVP
    setTangent2World
  });
}
