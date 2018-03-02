import {deg2rad, calc_delTheta, calc_delPhi} from './math-utils.js';
import {perspectiveMatrix, get_initial_V, setup_program, get_reflected,
        compute_L_hat, compute_N_hat} from './gl-wrangling-funcs.js';

// Requires gl-wrangle-funcs.js
// Requires gl-matrix.js
// Requires hsvToRGB.js

export default class BRDFViewport {
  constructor(canvasName, width, height) {
    /* Store canvas to viewport instance */
    this.canvas = document.getElementById(canvasName);
    this.canvas.width = 512;
    this.canvas.height = 512;

    //TODO: is the best thing to do, to initialize to null or to 
    //initialize to undefined? (I don't actually know.)

    /* GL context is initialized in "setupWebGL2" */
    this.gl = null;

    /* Programs are initialized in createShaders */
    this.lobeProgram = null;
    this.lobe_nUniformLoc = null;
    this.lobe_lUniformLoc = null;
    this.lobe_delThetaUniformLoc = null;
    this.lobe_delPhiUniformLoc = null;
    this.lobe_mUniformLoc = null;
    this.lobe_vUniformLoc = null;
    this.lobe_pUniformLoc = null;
    this.lobeVAO = null;

    this.lineProgram = null;
    this.line_mUniformLoc = null;
    this.line_vUniformLoc = null;
    this.line_pUniformLoc = null;
    this.lineVAO = null; 

    this.in_theta_deg = 45;
    this.in_phi_deg = 0;
    this.numPhiDivisions = 200;
    this.numThetaDivisions = 100;
    this.delTheta = 90 / this.numThetaDivisions;
    this.delPhi = 360 / this.numPhiDivisions;

    /* For render function */
    this.prev_time = 0;
    //this.M = mat4.create(); //Right now we are keeping M as identity
    this.initial_V = get_initial_V();
    this.V = mat4.clone(this.initial_V); 


    this.num_lobe_verts = 0;
    this.num_line_verts = 0;

    this.setupWebGL2();
    this.createShaders();
    this.setupGeometry();

    this.setupUI();
    this.setupUICallbacks();
  }

  /////////////////////
  // SET UP CANVAS AND GL CONTEXT
  /////////////////////
  setupWebGL2() {
    this.gl = this.canvas.getContext("webgl2");
    if (!this.gl) {
        console.error("WebGL 2 not available");
        document.body.innerHTML = "This application requires WebGL 2 which is unavailable on this system.";
    }
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.enable(this.gl.DEPTH_TEST);
  }

  /////////////////////
  // SET UP PROGRAM
  /////////////////////
  createShaders() {
    const lobeVsSource = document.getElementById("lobe.vert").text.trim();
    const lobeFsSource = document.getElementById("phong.frag").text.trim();
    const lineVsSource = document.getElementById("color_only.vert").text.trim();
    const lineFsSource = document.getElementById("color_only.frag").text.trim();

    this.lobeProgram = setup_program(this.gl, lobeVsSource, lobeFsSource);
    this.lineProgram = setup_program(this.gl, lineVsSource, lineFsSource);

    this.lobe_nUniformLoc = this.gl.getUniformLocation(this.lobeProgram, "u_n"); 
    this.lobe_lUniformLoc = this.gl.getUniformLocation(this.lobeProgram, "u_l"); 
    this.lobe_delThetaUniformLoc = 
      this.gl.getUniformLocation(this.lobeProgram, "u_delTheta"); 
    this.lobe_delPhiUniformLoc = 
      this.gl.getUniformLocation(this.lobeProgram, "u_delPhi"); 

    // model, view, and projection matrices, respectively.
    this.lobe_mUniformLoc = this.gl.getUniformLocation(this.lobeProgram, "u_m"); 
    this.lobe_vUniformLoc = this.gl.getUniformLocation(this.lobeProgram, "u_v"); 
    this.lobe_pUniformLoc = this.gl.getUniformLocation(this.lobeProgram, "u_p"); 

    this.line_mUniformLoc = this.gl.getUniformLocation(this.lineProgram, "u_m"); 
    this.line_vUniformLoc = this.gl.getUniformLocation(this.lineProgram, "u_v"); 
    this.line_pUniformLoc = this.gl.getUniformLocation(this.lineProgram, "u_p"); 
  }

  /////////////////////
  // SET UP GEOMETRY  (This was tricky to port over. Could use some refactoring )
  /////////////////////
  setupGeometry() {

    //const default_in_angle_deg = 45; //Default value when we open the app.
    //var in_angle = Math.radians(default_in_angle_deg);

    // L_hat points towards the light
    // N_hat is the normal direction
    // *_hat refers to a normalized vector

    var L_hat = compute_L_hat(this.in_theta_deg, this.in_phi_deg);
    var N_hat = compute_N_hat();

    this.lobeVAO = this.gl.createVertexArray();
 
    //Assumes positions at attribute 0, colors at attribute 1, 
    //normals at attribute 2 in lobe shader
    this.num_lobe_verts = this.lobe_setupGeometry(this.lobeVAO, L_hat, N_hat);
    this.gl.useProgram(this.lobeProgram);
    this.gl.useProgram(this.lobeProgram);
    this.gl.uniform3fv(this.lobe_nUniformLoc,N_hat);
    this.gl.uniform3fv(this.lobe_lUniformLoc,L_hat);

    //TODO: calc_delPHi and calc_delTheta should be called exactly once, at init time,
    //and their values should be stored in consts.
    this.gl.uniform1f(this.lobe_delPhiUniformLoc,calc_delPhi(this.numPhiDivisions));
    this.gl.uniform1f(this.lobe_delThetaUniformLoc,calc_delTheta(this.numThetaDivisions));

    this.lineVAO = this.gl.createVertexArray();
    //Assumes positions at attribute 0, colors at attribute 1 in line shader
    this.num_line_verts = this.line_setupGeometry(this.lineVAO, L_hat, N_hat);

    //TODO: Modify the V matrix, not the M matrix
    this.setupMVP(this.lobeProgram, this.lobe_mUniformLoc, 
      this.lobe_vUniformLoc, this.lobe_pUniformLoc);
    this.setupMVP(this.lineProgram, this.line_mUniformLoc, 
      this.line_vUniformLoc, this.line_pUniformLoc);
  }

  //ASSSUMES THAT POSITIONS ARE AT ATTRIBUTE 0, COLORS AT ATTRIBUTE 1,
  //NORMALS AT ATTRIBUTE 2 IN SHADER.
  lobe_setupGeometry(lobeVAO, L_hat, N_hat){

    console.log("setting up lobe geometry");
    
    this.gl.bindVertexArray(this.lobeVAO);

    //Dimensionality of positions, colors, normals
    var pos_dim = 3;
    var color_dim = 3;
    var norm_dim = 3;
    var polar_dim = 2;

    var positions = [];
    var colors = [];

    //var indices = [];
    var normals = []; //TODO: We can actually get rid of this attribute
    var polar_coords = [];

    var num_verts = 0;

    //TODO: fix these two as constant computed at init time
    var delTheta = calc_delTheta(this.numThetaDivisions);
    var delPhi = calc_delPhi(this.numPhiDivisions); 

    for(var i = 0; i < this.numThetaDivisions; i++){
      for(var j = 0; j < this.numPhiDivisions; j++){
        // degrees 
        var phi_deg = j*this.delPhi; 
        var theta_deg = i*this.delTheta; 

        // TODO: Take a picture of my updated diagram.

        //Four position attributes of our quad
        var p = this.polar_to_cartesian(theta_deg,phi_deg); 
        var p_k_plus_1 = this.polar_to_cartesian(theta_deg, (j+1)*this.delPhi);
        var p_k_plus_N = this.polar_to_cartesian((i+1)*this.delTheta, phi_deg);
        var p_k_plus_N_plus_1 = this.polar_to_cartesian((i+1)*this.delTheta, (j+1)*this.delPhi);

        //Right now these four points are on a perfect hemisphere... 

        //NOTE: We now do the commented out code below in the vertex shader.
        //Scale by BRDF
        //p = this.shade_vtx(L_hat,N_hat,p);
        //p_k_plus_1 = this.shade_vtx(L_hat,N_hat,p_k_plus_1);
        //p_k_plus_N = this.shade_vtx(L_hat,N_hat,p_k_plus_N);
        //p_k_plus_N_plus_1 = this.shade_vtx(L_hat,N_hat,p_k_plus_N_plus_1);

        //Four color attributes of our quad 
        var c = this.polar_to_color(theta_deg,this.phi_deg); 
        var c_k_plus_1 = this.polar_to_color(theta_deg, (j+1)*this.delPhi);
        var c_k_plus_N = this.polar_to_color((i+1)*this.delTheta, this.phi_deg);
        var c_k_plus_N_plus_1 = this.polar_to_color((i+1)*this.delTheta, (j+1)*this.delPhi);

        //All verts share the same normal
        var v1 = vec3.create(); vec3.sub(v1, p_k_plus_N_plus_1, p); 
        var v2 = vec3.create(); vec3.sub(v2, p_k_plus_N, p);
        var n = vec3.create(); vec3.cross(n,v2,v1); //the normal

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
          //num_verts += 3;

        // Set triangle indices
    /*
     *    if(i < numThetaDivisions){ // don't do the bottommost concentric ring
     *      var N = numPhiDivisions;
     *      var k = vtx_idx;
     *      var k_plus_N = vtx_idx + N;
     *      var k_plus_1;
     *      var k_plus_N_plus_1;
     *      
     *      if(j < numPhiDivisions - 1){
     *        k_plus_1 = k + 1;
     *        k_plus_N_plus_1 = k_plus_N + 1; 
     *      } else { // circle back around to the first if we are the last on the ring
     *        k_plus_1 = vtx_idx - j;
     *        k_plus_N_plus_1 = k_plus_1 + N;
     *      }
     *
     *      // two tris make a quad. CCW winding order
     *      indices.push(k, k_plus_1, k_plus_N);
     *      indices.push(k_plus_N, k_plus_1, k_plus_N_plus_1);
     *    }
     */

    /*
     *    // line between current and next vertex
     *    indices.push(vtx_idx);
     *    if(j < numPhiDivisions - 1)  
     *      indices.push(vtx_idx + 1); 
     *    else // circle back around to the first if we are at last vertex
     *      indices.push(vtx_idx - j);
     *
     *    // Line between current vertex and vertex directly beneath it. 
     *    // Don't do this for the bottommost concentric ring because there's
     *    // nothing beneath it
     *    if(i < numThetaDivisions){
     *      indices.push(vtx_idx);
     *      indices.push(vtx_idx + numPhiDivisions);
     *    }
     */
      }
    }

    const posAttribLoc = 0;
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.DYNAMIC_DRAW);
    this.gl.vertexAttribPointer(posAttribLoc, pos_dim, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(posAttribLoc); 

    const colorAttribLoc = 1;
    const colorBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.DYNAMIC_DRAW);
    this.gl.vertexAttribPointer(colorAttribLoc, color_dim, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(colorAttribLoc);

    //const indexBuffer = this.gl.createBuffer();
    //this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    //const idxType = this.gl.UNSIGNED_INT; // This is why we use Uint16Array on the next line. 
    ////idxType is passed to our draw command later.
    //this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), this.gl.STATIC_DRAW); 

    const normalAttribLoc = 2;
    const normalBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, normalBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(normals), this.gl.DYNAMIC_DRAW);
    this.gl.vertexAttribPointer(normalAttribLoc, norm_dim, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(normalAttribLoc); 

    const polar_coordAttribLoc = 3;
    const polar_coordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, polar_coordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, 
      new Float32Array(polar_coords), this.gl.DYNAMIC_DRAW);
    this.gl.vertexAttribPointer(polar_coordAttribLoc, polar_dim, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(polar_coordAttribLoc);

    return num_verts;
  }

  //ASSSUMES THAT POSITIONS ARE AT ATTRIBUTE 0, COLORS AT ATTRIBUTE 1 IN SHADER.
  line_setupGeometry(lineVAO, L_hat, N_hat){
    
    this.gl.bindVertexArray(lineVAO);

    var R_hat = get_reflected(L_hat, N_hat); 

    //Dimensionality of positions, colors, normals
    var pos_dim = 3;
    var color_dim = 3;

    var positions = [];
    var colors = [];

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

    const posAttribLoc = 0;
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.DYNAMIC_DRAW);
    this.gl.vertexAttribPointer(posAttribLoc, pos_dim, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(posAttribLoc); 

    const colorAttribLoc = 1;
    const colorBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.DYNAMIC_DRAW);
    this.gl.vertexAttribPointer(colorAttribLoc, color_dim, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(colorAttribLoc);

    var num_verts = positions.length/pos_dim; 
    return num_verts;
  }

  polar_to_cartesian(theta_deg,phi_deg){
      // radians
      var phi = (Math.PI / 180) * phi_deg;
      var theta = (Math.PI / 180) * theta_deg;

      var x = Math.sin(theta)*Math.cos(phi);
      var y = Math.sin(theta)*Math.sin(phi);
      var z = Math.cos(theta);
      return vec3.fromValues(x, y, z);
  }

  polar_to_color(theta_deg, phi_deg){
      //in HSV, H ranges from 0 to 360, S and V range from 0 to 100
      var h = phi_deg; 
      var s = (theta_deg / 90)*100;
      var v = 100;
      
      return hsvToRgb(h, s, v);
  }

  diffuse(light_dir, normal_dir){
    return Math.max(0,vec3.dot(light_dir, normal_dir));
  }

  phong(L_hat, V_hat, N_hat){
    const k_d = 0.7; 
    const k_s = 0.3; 
    const spec_power = 20; 

    var R_hat = get_reflected(L_hat, N_hat);
    var specular_value = Math.pow(Math.max(vec3.dot(R_hat, V_hat),0), spec_power);
    var diffuse_value = this.diffuse(L_hat,N_hat); //diffuse coefficient

    return k_d*diffuse_value + k_s*specular_value; 
  }

  //vtx is the original vertex on the hemisphere
  //return value is the same vertex with length scaled by the BRDF
  shade_vtx(L_hat,N_hat,vtx){
      var V_hat = vtx; //view (outgoing) direction 
      var phong_shade = this.phong(L_hat, V_hat, N_hat);
      var result = vec3.create(); 
      vec3.scale(result,vtx,phong_shade);
      return result;
  }

  //TODO: We may want to pre-allocate V and pass it in if we end up changing V
  //often.
  setupMVP(program, mUniformLoc, vUniformLoc, pUniformLoc){
    
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

    //var cam_z = 1.5; // z-position of camera in camera space
    //var cam_y = 0.5; // altitude of camera

    // BRDF is in tangent space. Tangent space is Z-up.
    // Also, we need to move the camera so that it's not at the origin 
    //var V = [1,      0,     0, 0,
             //0,      0,     1, 0,
             //0,      1,     0, 0,
             //0, -cam_y,-cam_z, 1];

    this.gl.useProgram(program);

    //View
    this.gl.uniformMatrix4fv(vUniformLoc, false, this.initial_V);

    //Model
    var M = mat4.create(); 
    this.gl.uniformMatrix4fv(mUniformLoc, false, M);

    // Projection (perspective)
    var fov = Math.PI * 0.5;
    var canvas = document.getElementById('brdf-canvas');
    var width = canvas.width;
    var height = canvas.height;
    var aspectRatio = width/height; // TODO: get the actual width and height
    var nearClip = 0.5;
    var farClip  = 50;
    var P = perspectiveMatrix(fov, aspectRatio, nearClip, farClip);

    this.gl.uniformMatrix4fv(pUniformLoc, false, P);
  }

  //prev_time is the time when previous frame was drawn
  updateV(V,vUniformLoc){ 
    this.gl.uniformMatrix4fv(vUniformLoc, false, V);
  }

  /////////////////////
  // SET UP UI CALLBACKS 
  /////////////////////
  setupUI() {
    this.menu = d3.select("#brdf-menu");
    this.menu.html("");

    /* Add incident theta slider */
    var thetaInput = this.menu.append("input")
      .attr("id", "slider_incidentTheta")
      .attr("type", "range")
      .attr("min", 0)
      .attr("max", 90)
      .attr("step", 1)
      .attr("value", 0);
    
    this.menu.append("br");
    
    var thetaOutput = this.menu.append("output")
       .attr("id", "output_incidentTheta");

    this.menu.append("br");

    /* Add incident phi slider */
    var phiInput = this.menu.append("input")
      .attr("id", "slider_incidentPhi")
      .attr("type", "range")
      .attr("min", -180)
      .attr("max", 180)
      .attr("step", 1)
      .attr("value", 0);

    this.menu.append("br");
    
    var phiOutput = this.menu.append("output")
       .attr("id", "output_incidentPhi");

    this.menu.append("br");

    /* add camRot slider */
     var camRotInput = this.menu.append("input")
      .attr("id", "slider_camRot")
      .attr("type", "range")
      .attr("min", -180)
      .attr("max", 180)
      .attr("step", 1)
      .attr("value", 0);
  }

  /////////////////////
  // SET UP UI CALLBACKS 
  /////////////////////
  setupUICallbacks() {
    var output_incidentTheta = document.getElementById("output_incidentTheta");
    var output_incidentPhi = document.getElementById("output_incidentPhi");

    //Set initial values
    //TODO: this is a hack, we should be querying the default value from the HTML tag
    output_incidentTheta.innerHTML = this.in_theta_deg; 
    output_incidentPhi.innerHTML = this.in_phi_deg; 

    document.getElementById("slider_incidentTheta").oninput = (event) => {
      this.in_theta_deg = event.target.value;
      output_incidentTheta.innerHTML = this.in_theta_deg;
      var L_hat = compute_L_hat(this.in_theta_deg, this.in_phi_deg);
      var N_hat = compute_N_hat(); //TODO: N_hat only needs to be computed once. 

      this.gl.useProgram(this.lobeProgram);
      this.gl.uniform3fv(this.lobe_lUniformLoc,L_hat);

      //this.num_lobe_verts = this.lobe_setupGeometry(this.lobeVAO, L_hat, N_hat);
      this.num_line_verts = this.line_setupGeometry(this.lineVAO, L_hat, N_hat);
	  // change light direction in model viewport at same time
	  var deg = event.target.value;
	  var rad = deg * Math.PI / 180;

      //not strictly necessary for now.
      //We may be better off with an object that holds common state
      //modelViewport.lightTheta = rad;
    };

    document.getElementById("slider_incidentPhi").oninput = (event) => {
      this.in_phi_deg = event.target.value;
      output_incidentPhi.innerHTML = this.in_phi_deg;
      var L_hat = compute_L_hat(this.in_theta_deg, this.in_phi_deg);
      var N_hat = compute_N_hat(); //TODO: N_hat only needs to be computed once. 

      this.gl.useProgram(this.lobeProgram);
      this.gl.uniform3fv(this.lobe_lUniformLoc,L_hat);

      //this.num_lobe_verts = this.lobe_setupGeometry(this.lobeVAO, L_hat, N_hat);
      this.num_line_verts = this.line_setupGeometry(this.lineVAO, L_hat, N_hat);
      var deg = event.target.value;
      var rad = deg * Math.PI / 180;

      //not strictly necessary for now.
      //We may be better off with an object that holds common state
      //modelViewport.lightPhi = rad; 
    };

    var output_camRot = document.getElementById("output_camRot");
    document.getElementById("slider_camRot").oninput = (event) => {
      var rot_angle_deg = event.target.value;
      var rot_angle = deg2rad(rot_angle_deg);
      //mat4.fromRotation(this.M, this.rot_angle, this.rot_axis);

      var rot_axis = vec3.create();
      vec3.set(rot_axis, 0, 0, 1);

      var rot = mat4.create();
      mat4.fromRotation(rot, rot_angle, rot_axis);
      mat4.multiply(this.V,this.initial_V,rot);
    };
  }

  /////////////////////
  // DRAW 
  /////////////////////
  render(time){
    time *= 0.001; // convert to seconds
    var deltaTime = time - this.prev_time;

    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    //gl.drawArrays(gl.POINTS, 0, numVerts);
    
    // //auto-rotate M
    // var rotationSpeed = 1.2;
    // this.rot_angle += rotationSpeed * deltaTime;
    // mat4.fromRotation(this.M, this.rot_angle, this.rot_axis);

    //Draw lobe
    this.gl.bindVertexArray(this.lobeVAO);
    this.gl.useProgram(this.lobeProgram);
    this.updateV(this.V, this.lobe_vUniformLoc);
    var first = 0; //see https://stackoverflow.com/q/10221647
    this.gl.drawArrays(this.gl.TRIANGLES, first, this.num_lobe_verts);

    //Draw line
    this.gl.bindVertexArray(this.lineVAO);
    this.gl.useProgram(this.lineProgram);
    this.updateV(this.V, this.line_vUniformLoc);
    first = 0; 
    this.gl.drawArrays(this.gl.LINES, first, this.num_line_verts);

    this.prev_time = time;
  }
}
