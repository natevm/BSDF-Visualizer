"use strict";

/*jshint esversion: 6 */

//Requires gl-matrix.js
//Requires webgl-obj-loader.js

import {deg2rad} from './math-utils.js';
import {init_gl_context, compile_and_link_shdr} from './gl-wrangling-funcs.js';

//************************
//"Class" ModelViewport
//
// Using "Classless OOP":
// https://github.com/n8vm/BSDF-Visualizer/wiki/Classless-OOP-reference
//************************

//put "constructor" arguments inside "spec" (see main.js for usage example)
export default function ModelViewport(spec) {
  //Declare our object's properties and methods below.
  //They are private by default, unless we put them
  //in the "frozen" object that gets returned at the end.

  const //TODO: I should probably put more stuff that doesn't change here.
    updateCamRot = function(newCamRotDeg){
      cameraXRotation = deg2rad(newCamRotDeg);
      if (linkedViewport !== undefined) {
        linkedViewport.updateLinkedCamRot(getLinkedCamRotMatrix());
      }
    },
    getInputByModel = function(){
      return inputByModel;
    },
    setHeatmap = function(input_bool){
      if (input_bool === true) {
        gl.uniform1i(defaultShaderProgram.uHeatmapLoc,1);
      } else if (input_bool === false) {
        gl.uniform1i(defaultShaderProgram.uHeatmapLoc,0);
      } else {
        throw "expected input_bool to be a bool!";
      }
    };
  let
    { canvasName, width, height, shdrDir, inputByModel } = spec,
    canvas = document.getElementById(canvasName),
    gl, // WebGL context
    rttShaderProgram,
    defaultShaderProgram,
    uHeatmapLoc,

    //TODO: move to const...
    model_vert_shader_name = "model-renderer.vert",
    model_frag_shader_name = "glslify_processed/model-renderer.frag",

    models = {},
    mvMatrix = mat4.create(),
    pMatrix = mat4.create(),
    vMatrix = mat4.create(),
    camRotMatrix = mat3.create(),
    normalRotMatrix = mat3.create(),
    pickProjMatrix = mat4.create(),
    pickModelViewMatrix = mat4.create(),
    lightPhi = 0,
    lightTheta =  Math.PI/4,
    normalPhi = 0,
    normalTheta = 0,
    normalDir = vec3.fromValues(0,1,0),
    tangent = vec3.fromValues(1,0,0),
    bitangent = vec3.fromValues(0,0,-1),
    pickPointNDC = vec3.fromValues(0,0,0), //should be a vec3
    pickPointNDCStored = vec3.fromValues(0,0,0), //should be a vec3
    modelsLoaded = false,

    cameraXRotation = 0,
    cameraYRotation = 0,
    mouseDown = false,
    lastMouseX,
    lastMouseY,

    timeNow,
    lastTime, //FIXME: we don't ever set a valid initial value
    elapsed,
    time,

    rttFramebuffer,
    rttTexture,

    linkedViewport,

    registerLinkedViewport = function(viewportPtr){
      linkedViewport = viewportPtr;
    },

    setupWebGL2 = function(){
      gl = init_gl_context(canvas);
      const ext = gl.getExtension("EXT_color_buffer_float");
        if (!ext) {
        alert("need EXT_color_buffer_float");
        return;
      }
      gl.clearColor(0, 0, 0, 1);
      gl.enable(gl.DEPTH_TEST);
      gl.viewportWidth = canvas.width;
      gl.viewportHeight = canvas.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
    },

    //initShaders = function(vsSource, fsSource) {
    initShaders = function(shaderProgram) {
      //var shaderProgram;
      const attrs = {
        'aVertexPosition': OBJ.Layout.POSITION.key,
        'aVertexNormal': OBJ.Layout.NORMAL.key,
        'aTextureCoord': OBJ.Layout.UV.key,
        'aDiffuse': OBJ.Layout.DIFFUSE.key,
        'aSpecular': OBJ.Layout.SPECULAR.key,
        'aSpecularExponent': OBJ.Layout.SPECULAR_EXPONENT.key,
      };

      //shaderProgram = compile_and_link_shdr(gl, vsSource, fsSource);
      gl.useProgram(shaderProgram);

      shaderProgram.attrIndices = {};

      //NathanX: if we use Object.keys(object).forEach we don't have
      //to check for attrs.hasOwnProperty()
      //
      //for (const attrName in attrs) {
        //if (!attrs.hasOwnProperty(attrName)) {
          //continue;
        //}
      Object.keys(attrs).forEach(function(attrName) {
        shaderProgram.attrIndices[attrName] = gl.getAttribLocation(shaderProgram, attrName);
        if (shaderProgram.attrIndices[attrName] !== -1) {
          gl.enableVertexAttribArray(shaderProgram.attrIndices[attrName]);
        } else {
          console.warn('Shader attribute "' + attrName + '" not found in shader. Is it undeclared or unused in the shader code?');
        }
      });

      shaderProgram.uHeatmapLoc = gl.getUniformLocation(shaderProgram, "uHeatmap");
      shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
      shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
      shaderProgram.vMatrixUniform = gl.getUniformLocation(shaderProgram, "uVMatrix");
      shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
      shaderProgram.pickProjMatrixUniform = gl.getUniformLocation(shaderProgram, "uPickProjMatrix");
      shaderProgram.pickModelViewMatrixUniform = gl.getUniformLocation(shaderProgram, "uPickModelViewMatrix");
      shaderProgram.lightDirectionUniform = gl.getUniformLocation(shaderProgram, "uLightDirection");
      shaderProgram.pickPointNDCUniform = gl.getUniformLocation(shaderProgram, "uPickPointNDC");

      shaderProgram.applyAttributePointers = (model) => {
        const layout = model.vertexBuffer.layout;

        //NathanX: if we use Object.keys(object).forEach we don't have
        //to check for attrs.hasOwnProperty()
        //
        //for (const attrName in attrs) {
          //if (!attrs.hasOwnProperty(attrName) ||
            //shaderProgram.attrIndices[attrName] === -1) {
         Object.keys(attrs).forEach(function(attrName) {
          const layoutKey = attrs[attrName];
          if (shaderProgram.attrIndices[attrName] !== -1) {
            const attr = layout[layoutKey];
            gl.vertexAttribPointer(
              shaderProgram.attrIndices[attrName],
              attr.size,
              gl[attr.type],
              attr.normalized,
              attr.stride,
              attr.offset);
          }
        });
      };

      //return shaderProgram;
    },

    initBuffers = function() {
      let layout = new OBJ.Layout(
        OBJ.Layout.POSITION,
        OBJ.Layout.NORMAL,
        OBJ.Layout.DIFFUSE,
        OBJ.Layout.UV,
        OBJ.Layout.SPECULAR,
        OBJ.Layout.SPECULAR_EXPONENT);

      // initialize the mesh's buffers

      //NathanX: if we use Object.keys(object).forEach we don't have
      //to check for attrs.hasOwnProperty()
      //
      //While there was never a check for hasOwnProperty() here, it's still
      //safer to not have to check for it at all.
      //
      //for (let modelKey in models){
      Object.keys(models).forEach(function(modelKey) {
        let vertexBuffer = gl.createBuffer();
        let vertexData = models[modelKey].makeBufferData(layout);
        let indexBuffer = gl.createBuffer();
        let indexData = models[modelKey].makeIndexBufferData();

        // Create the vertex buffer for this mesh
        //var vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        //var vertexData = models[modelKey].makeBufferData(layout);
        gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
        vertexBuffer.numItems = vertexData.numItems;
        vertexBuffer.layout = layout;
        models[modelKey].vertexBuffer = vertexBuffer;

        // Create the index buffer for this mesh
        //var indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        //var indexData = models[modelKey].makeIndexBufferData();
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);
        indexBuffer.numItems = indexData.numItems;
        models[modelKey].indexBuffer = indexBuffer;

        // this loops through the mesh names and creates new
        // model objects and setting their mesh to the current mesh
        //models[modelKey] = {};
        //models[modelKey].mesh = models[modelKey];
      });
    },

    initRTTFramebuffer = function() {
        rttFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, rttFramebuffer);
        rttFramebuffer.width = canvas.width;
        rttFramebuffer.height = canvas.height;
        rttTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, rttTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, rttFramebuffer.width, rttFramebuffer.height, 0, gl.RGBA, gl.FLOAT, null);
        var renderbuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, rttFramebuffer.width, rttFramebuffer.height);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rttTexture, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },

    setMatrixUniforms = function(shaderProgram){
      let normalMatrix = mat3.create();
      let lightDirection = [Math.sin(lightTheta)*Math.cos(lightPhi) , Math.cos(lightTheta), Math.sin(lightTheta)*Math.sin(lightPhi)];

      gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
      gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
      gl.uniformMatrix4fv(shaderProgram.vMatrixUniform, false, vMatrix);
      gl.uniformMatrix4fv(shaderProgram.pickProjMatrixUniform, false, pickProjMatrix);
      gl.uniformMatrix4fv(shaderProgram.pickModelViewMatrixUniform, false, pickModelViewMatrix);

      mat3.normalFromMat4(normalMatrix, mvMatrix);
      gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
      gl.uniform3fv(shaderProgram.lightDirectionUniform, new Float32Array(lightDirection));
      gl.uniform3fv(shaderProgram.pickPointNDCUniform, pickPointNDC);
    },

    loadModels = function(){
      let p = OBJ.downloadModels([
        {
          name: 'teapot',
          obj: 'models/teapot.obj',
          mtl: true,
        },
      ]);

      //  (meshes) => {
      //   console.log(models["teapot"]);
      //   console.log('Name:', models["teapot"].name);
      //     console.log('Mesh:', models["teapot"]);

      //   /* For some reason this is giving me trouble. Seems to work on other browsers...*/
      //     // for ([name, mesh] of Object.entries(models)) {

      //     // }
      //     models = models;
      //     modelsLoaded = true;

      //     /* Now that the models are loaded, we can initialize the buffers */
      //     initBuffers();
      // });


      return p.then((loaded_models) => {
        //console.log("Models loaded!");
        //console.log(loaded_models);
        models = loaded_models;
        initBuffers();
        modelsLoaded = true;
      });
    },

    drawObject = function(model){
      /*
         Takes in a model that points to a mesh and draws the object on the scene.
         Assumes that the setMatrixUniforms function exists
         as well as the shaderProgram has a uniform attribute called "samplerUniform"
         */
      //    gl2.useProgram(shaderProgram);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindBuffer(gl.ARRAY_BUFFER, model.vertexBuffer);
      defaultShaderProgram.applyAttributePointers(model);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
      gl.useProgram(defaultShaderProgram);
      setMatrixUniforms(defaultShaderProgram);
      gl.drawElements(gl.TRIANGLES, model.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    },

    drawNormalDepthTexture = function(model){
      gl.bindFramebuffer(gl.FRAMEBUFFER, rttFramebuffer);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      rttShaderProgram.applyAttributePointers(model);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
      gl.useProgram(rttShaderProgram);
      setMatrixUniforms(rttShaderProgram);
      gl.drawElements(gl.TRIANGLES, model.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    },

    drawScene = function() {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      //these values are hardcoded now for demo purpose, will change later
      mat4.perspective(pMatrix, 45 * Math.PI / 180.0, gl.viewportWidth / gl.viewportHeight, 18.0, 50.0);
      mat4.identity(mvMatrix);
      // move the camera
      //view matrix
      mat4.translate(mvMatrix, mvMatrix, [0, -10, -40]);
      mat4.rotate(mvMatrix, mvMatrix, cameraYRotation, [1, 0, 0]);
      mat4.rotate(mvMatrix, mvMatrix, cameraXRotation, [0, 1, 0]);
      vMatrix = mat4.clone(mvMatrix);
      let tempMatrix = mat4.create();
      mat4.rotate(tempMatrix, tempMatrix, cameraYRotation, [1, 0, 0]);
      mat4.rotate(tempMatrix, tempMatrix, cameraXRotation, [0, 1, 0]);
      mat3.fromMat4(camRotMatrix, tempMatrix);
      //model matrix (rotate our z-up teapot to y-up) -- need to change later
      mat4.rotate(mvMatrix, mvMatrix, -0.5 * Math.PI, [1, 0, 0]);

      drawNormalDepthTexture(models.teapot);
      drawObject(models.teapot);
    },

    animate = function() {
      timeNow = new Date().getTime();
      elapsed = timeNow - lastTime;
      if (!time) { //TODO: check against undefined, or init at beginning
        time = 0.0;
      }
      time += elapsed / 1000.0;
      if (lastTime !== 0){
        // do animations
      }
      lastTime = timeNow;
    },

    //templatePath: path to template shader for this Viewport.
    //templateType: eitehr "vert" or "frag", specifies which shader is the
    //template for this particular Viewport.
    getTemplateInfo = function(){
      return {shaderDir: shdrDir, templatePath: "glslify_processed/model-renderer_template.frag",
        vertPath: model_vert_shader_name, fragPath: model_frag_shader_name, templateType: "frag"};
    },

    /////////////////////
    // ADD UNIFORMS AT RUNTIME
    // (called when we load a Disney .brdf)
    /////////////////////
    addUniformsFunc = function(addUniformsHelper){
      defaultShaderProgram = addUniformsHelper(gl);
      //we need to set up our uniforms again because
      //the above function returned a new lobeProgram.
      initShaders(defaultShaderProgram);
      initBuffers();
    },

    /////////////////////
    // DRAW
    /////////////////////
    render = function(time) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (modelsLoaded) {
        drawScene();
        animate();
      }
    },

    updateTheta = function(newThetaDeg){
      lightTheta = deg2rad(newThetaDeg);
      if (linkedViewport !== undefined) {
        linkedViewport.updateTheta(getNormalTheta());
        linkedViewport.updatePhi(getNormalPhi());
      }
    },

    updatePhi = function(newPhiDeg){
      lightPhi = deg2rad(newPhiDeg);
      if (linkedViewport !== undefined) {
        linkedViewport.updateTheta(getNormalTheta());
        linkedViewport.updatePhi(getNormalPhi());
      }
    },

    getNormalTheta = function(){
      let lightDirection = vec3.fromValues(Math.sin(lightTheta)*Math.cos(lightPhi), Math.cos(lightTheta), Math.sin(lightTheta)*Math.sin(lightPhi));
      let dot = vec3.dot(lightDirection, normalDir);
      normalTheta = 180*Math.acos(dot)/Math.PI;
      return normalTheta;
    },

    getNormalPhi = function(){
        let lightDirection = vec3.fromValues(Math.sin(lightTheta)*Math.cos(lightPhi), Math.cos(lightTheta), Math.sin(lightTheta)*Math.sin(lightPhi));
        let dot = vec3.dot(lightDirection, normalDir);
        let scaledNormal = vec3.create();
        vec3.scale(scaledNormal, normalDir, dot);
        let projLightDirection = vec3.create();
        vec3.subtract(projLightDirection, lightDirection, scaledNormal);
        vec3.normalize(projLightDirection, projLightDirection);
        let prjx = vec3.dot(projLightDirection, tangent);
        let scaledTangent = vec3.create();
        vec3.scale(scaledTangent, tangent, prjx);
        let prjyvec = vec3.create();
        vec3.subtract(prjyvec, projLightDirection, scaledTangent);
        if (vec3.dot(bitangent, prjyvec) >= 0) {
            normalPhi = 180*Math.atan2(vec3.length(prjyvec), prjx) / Math.PI;
        } else {
            normalPhi = 180*Math.atan2(-vec3.length(prjyvec), prjx) / Math.PI;
        }
        //console.log(normalPhi);
        return normalPhi+180;
    },

    getLinkedCamRotMatrix = function(){
       let res = mat3.create();
       //console.log(camRotMatrix);
        //console.log(normalRotMatrix);
       return mat3.multiply(res, camRotMatrix, normalRotMatrix);
        //return normalRotMatrix;
    },


    // get mouse GL screen coordinates
    //ref: https://stackoverflow.com/questions/42309715/how-to-correctly-pass-mouse-coordinates-to-webgl
    getRelativeMousePosition = function(event, target) {
      target = target || event.target;
      var rect = target.getBoundingClientRect();

      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    },

    getNoPaddingNoBorderCanvasRelativeMousePosition = function(event, target) {
      target = target || event.target;
      var pos = getRelativeMousePosition(event, target);

      pos.x = pos.x * target.width  / target.clientWidth;
      pos.y = pos.y * target.height / target.clientHeight;

      return pos;
    },

    selectPointEventFunction = function(event) {
        let pos = getNoPaddingNoBorderCanvasRelativeMousePosition(event, canvas);
        pos.y = canvas.height - pos.y - 1;
        let pixels = new Float32Array(4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, rttFramebuffer);
        gl.readPixels(pos.x, pos.y, 1, 1, gl.RGBA, gl.FLOAT, pixels);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        //console.log([pos.x, pos.y]);
        //console.log([pixels[0], pixels[2], -pixels[1], pixels[3]]);
        normalDir = vec3.fromValues(pixels[0], pixels[2], -pixels[1]);
        pickPointNDC = vec3.fromValues(2*(pos.x/canvas.width)-1, 2*(pos.y/canvas.height)-1, 2*pixels[3]-1);
        pickProjMatrix = pMatrix;
        pickModelViewMatrix = mat4.clone(mvMatrix);
        //normalPhi = 180 * Math.atan2(normalDir[2], normalDir[0]) / Math.PI;
        //normalTheta = 180 * Math.acos(pixels[2]) / Math.PI;

        let lightDirection = vec3.fromValues(Math.sin(lightTheta)*Math.cos(lightPhi),
            Math.cos(lightTheta),
            Math.sin(lightTheta)*Math.sin(lightPhi));
        let dot = vec3.dot(lightDirection, normalDir);

        //compute normalPhi
        let xdir;
        let projNormal = vec3.fromValues(normalDir[0], 0, normalDir[2]);
        if (projNormal[2] === 0) {
            if (projNormal[0] > 0) {
                tangent = vec3.fromValues(0,0,-1);
                bitangent = vec3.fromValues(0,1,0);
            } else if (projNormal[0] < 0) {
                tangent = vec3.fromValues(0,0,1);
                bitangent = vec3.fromValues(0,1,0);
            } else {
                tangent = vec3.fromValues(1,0,0);
                bitangent = vec3.fromValues(0,0,-1);
            }
        } else {
            if(projNormal[2] > 0) {
                xdir = vec3.fromValues(1,0,0);
            } else { // projNormal[2] < 0
                xdir = vec3.fromValues(-1,0,0);
            }
            bitangent = vec3.create();
            tangent = vec3.create();
            vec3.cross(bitangent, projNormal, xdir);
            vec3.normalize(bitangent, bitangent);
            vec3.cross(tangent, bitangent, projNormal);
            vec3.normalize(tangent, tangent);
        }

        vec3.cross(bitangent, tangent, normalDir);
        normalRotMatrix = mat3.fromValues(tangent[0], tangent[1], tangent[2], normalDir[0], normalDir[1],  normalDir[2],
            bitangent[0], bitangent[1], bitangent[2]);


        //normalRotMatrix = mat3.fromValues(1,0,0, 0, 1,
          //  0, 0,0,1);

        //normalRotMatrix = mat3.creat
        let scaledNormal = vec3.create();
        vec3.scale(scaledNormal, normalDir, dot);
        let projLightDirection = vec3.create();
        vec3.subtract(projLightDirection, lightDirection, scaledNormal);
        vec3.normalize(projLightDirection, projLightDirection);
        let prjx = vec3.dot(projLightDirection, tangent);
        let scaledTangent = vec3.create();
        vec3.scale(scaledTangent, tangent, prjx);
        let prjyvec = vec3.create();
        vec3.subtract(prjyvec, projLightDirection, scaledTangent);
        if (vec3.dot(bitangent, prjyvec) >= 0) {
            normalPhi = 180*Math.atan2(vec3.length(prjyvec), prjx) / Math.PI;
        } else {
            normalPhi = 180*Math.atan2(-vec3.length(prjyvec), prjx) / Math.PI;
        }
        normalTheta = 180*Math.acos(dot)/Math.PI;
        //let normalThetaElement = document.getElementById("normalTheta");
        //let normalPhiElement = document.getElementById("normalPhi");
        //normalThetaElement.value = normalTheta;
        //normalPhiElement.value = normalPhi + 180;

        let evt = new Event('change');

        //normalThetaElement.dispatchEvent(evt);
        //normalPhiElement.dispatchEvent(evt);
        if (linkedViewport !== undefined) {
          linkedViewport.updateTheta(normalTheta);
          linkedViewport.updatePhi(normalPhi + 180);
          linkedViewport.updateLinkedCamRot(getLinkedCamRotMatrix());
        }
    };

  //************* Start "constructor" **************
  {
    const shdrDir = "Shaders/"; //FIXME: duplicated code from BRDFViewport

    let defaultVertSrc;
    let defaultFragSrc;
    let rttVertSrc;
    let rttFragSrc;
    //ES6 promises: https://stackoverflow.com/a/10004137
    //jQuery AJAX requests return an ES6-compatible promise,
    //because jQuery 3.0+ implements the
    //Promise/A+ API (see https://stackoverflow.com/a/35135488)
    let promises = [];

    canvas.width = width;
    canvas.height = height;
    setupWebGL2();

    promises.push($.ajax({
      url: shdrDir + model_vert_shader_name,
      success: function(result){
        defaultVertSrc = result.trim();
      }
    }));
    //console.log(shdrDir + model_frag_shader_name);
    promises.push($.ajax({
      url: shdrDir + model_frag_shader_name,
      success: function(result){
        defaultFragSrc = result.trim();
      }
    }));
    promises.push($.ajax({
      url: shdrDir + "model-renderer.vert",
      success: function(result){
        rttVertSrc = result.trim();
      }
    }));
    promises.push($.ajax({
      url: shdrDir + "model-renderer-rtt.frag",
      success: function(result){
        rttFragSrc = result.trim();
      }
    }));

    //Wait for all async callbacks to return, then execute the code below.
    //$.when.apply($, promises).then(function() {
    Promise.all(promises).then(function() {
      // returned data is in arguments[0][0], arguments[1][0], ... arguments[9][0]
      // you can process it here

    defaultShaderProgram = compile_and_link_shdr(gl, defaultVertSrc, defaultFragSrc);
    initShaders(defaultShaderProgram);
    rttShaderProgram = compile_and_link_shdr(gl, rttVertSrc, rttFragSrc);
    initShaders(rttShaderProgram);

    //uHeatmapLoc = gl.getUniformLocation(defaultShaderProgram, "uHeatmap");

    initRTTFramebuffer();
    loadModels();


    }, function(err) {
      console.error(err);
    });

    //FIXME: This should really be moved to GUI.js
    //mouse events
      document.getElementById(canvasName).ondblclick = (event) => {
          if (pickPointNDC[0] < 500){
              pickPointNDCStored = vec3.clone(pickPointNDC);
              pickPointNDC = vec3.fromValues(999,999,999);
          } else {
              pickPointNDC = pickPointNDCStored;
          }
      };

      document.getElementById(canvasName).onmousedown = (event) => {
      //console.log("detected!\n");
      mouseDown = true;
      if( event.which === 2 || event.ctrlKey ) {
          selectPointEventFunction(event);
      }
      else {
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
      }
    };

    document.getElementById(canvasName).onmouseup = (event) => {
      mouseDown = false;
    };

    document.getElementById(canvasName).onmousemove = (event) => {
      if (mouseDown) {
        if( event.which === 2 || event.ctrlKey ) {
            selectPointEventFunction(event);
        }
        else {
            let newX = event.clientX;
            let newY = event.clientY;
            let deltaY = newY - lastMouseY;
            let deltaX = newX - lastMouseX;

            if (Math.abs(deltaX) > Math.abs(deltaY)) cameraXRotation += 0.01*deltaX;
            else cameraYRotation += 0.01*deltaY;
            if (linkedViewport !== undefined) {
              linkedViewport.updateLinkedCamRot(getLinkedCamRotMatrix());
            }

            lastMouseX = newX;
            lastMouseY = newY;
        }
      }
    };
  }
  //************* End "constructor" (not really a constructor) **************

  //Put any methods / properties that we want to make public inside this object.
  return Object.freeze({
    render,
    updateTheta,
    updatePhi,
    getNormalTheta,
    getNormalPhi,
    getLinkedCamRotMatrix,
    registerLinkedViewport,
    getInputByModel,
    updateCamRot,
    getTemplateInfo,
    addUniformsFunc,
    setHeatmap
  });
}
