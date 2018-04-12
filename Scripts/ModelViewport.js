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
      useHeatmap = input_bool;
      resetIBL();
    },
    setIBL = function(input_bool){
      useIBL = input_bool;
      if (useIBL) {
        setEnvironmentTexture(cubemapURL);
      }else {
        setEnvironmentColor(0,0,0,255);
      }
      resetIBL();
    },
    setIntensity = function(newIntensity){
      intensity = newIntensity;
      resetIBL();
    },
    setMaxConvergence = function(newMaxConvergence){
      maxConvergence = newMaxConvergence * 20000 + 1;
    },

    setQuality = function(newQuality){
      quality = Math.max(newQuality, 0.01);
      queueRefresh1 = true;
      queueRefresh2 = true;
    };
  let
    { canvasName, width, height, shdrDir, inputByModel } = spec,
    canvas = document.getElementById(canvasName),
    gl, // WebGL context
    rttShaderProgram,
    defaultShaderProgram,
    skyboxShaderProgram,
    finalRenderShaderProgram,

    //TODO: move to const...
    model_vert_shader_name = "model-renderer.vert",
    model_frag_shader_name = "glslify_processed/model-renderer.frag",
    cubemapURL = "./cubemaps/Old_Industrial_Hall/fin4_Bg.jpg",

    models = {},
    skyboxVertexBuffer,
    finalRenderVertexBuffer,
    envMapTex,
    mMatrix = mat4.create(),
    vMatrix = mat4.create(),
    pMatrix = mat4.create(),
    normalMatrix = mat4.create(),
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

    totalFrames = 1,
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

    iblRenderBuffer = null,
    iblColorBuffer = null,
    depthBuffer = null, colorBuffer = null,
    iblTexture1 = null, iblTexture2 = null,
    iblCurrentBuffer = 0,
    maxConvergence = 10000,

    quality = 1.0,
    queueRefresh1 = false,
    queueRefresh2 = false,

    intensity = 2.5,
    useIBL = true,
    useHeatmap = false,

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
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.viewportWidth = canvas.width;
      gl.viewportHeight = canvas.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
    },

    initShaders = function(shaderProgram) {
      //var shaderProgram;
      const attrs = {
        'aVertexPosition': OBJ.Layout.POSITION.key,
        'aVertexNormal': OBJ.Layout.NORMAL.key,
        'aTextureCoord': OBJ.Layout.UV.key
      };

      gl.useProgram(shaderProgram);

      shaderProgram.attrIndices = {};

      Object.keys(attrs).forEach(function(attrName) {
        shaderProgram.attrIndices[attrName] = gl.getAttribLocation(shaderProgram, attrName);
        if (shaderProgram.attrIndices[attrName] !== -1) {
          gl.enableVertexAttribArray(shaderProgram.attrIndices[attrName]);
        } else {
          console.warn('Shader attribute "' + attrName + '" not found in shader. Is it undeclared or unused in the shader code?');
        }
      });

      shaderProgram.diffuseUniform = gl.getUniformLocation(shaderProgram, "uDiffuse");
      shaderProgram.specularUniform = gl.getUniformLocation(shaderProgram, "uSpecular");
      shaderProgram.specularExponentUniform = gl.getUniformLocation(shaderProgram, "uSpecularExponent");

      shaderProgram.uHeatmap = gl.getUniformLocation(shaderProgram, "uHeatmap");
      shaderProgram.uIBL = gl.getUniformLocation(shaderProgram, "uIBL");
      shaderProgram.uIntensity = gl.getUniformLocation(shaderProgram, "uIntensity");

      shaderProgram.mMatrixUniform = gl.getUniformLocation(shaderProgram, "uMMatrix");
      shaderProgram.vMatrixUniform = gl.getUniformLocation(shaderProgram, "uVMatrix");
      shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");

      shaderProgram.lightDirectionUniform = gl.getUniformLocation(shaderProgram, "uLightDirection");
      shaderProgram.modelSpacePickPointUniform = gl.getUniformLocation(shaderProgram, "uModelSpacePickPoint");
      shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");

      shaderProgram.totalFramesUniform = gl.getUniformLocation(shaderProgram, "uTotalFrames");
      shaderProgram.timeUniform = gl.getUniformLocation(shaderProgram, "uTime");
      shaderProgram.envMapSamplerUniform = gl.getUniformLocation(shaderProgram, "EnvMap");
      shaderProgram.prevFrameSamplerUniform = gl.getUniformLocation(shaderProgram, "PrevFrame");

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
    },

    initSkyboxShaderProgram = function() {
      /* Find and store attributes/uniforms */
      skyboxShaderProgram.aVertexPosition = gl.getAttribLocation(skyboxShaderProgram, "aVertexPosition");
      skyboxShaderProgram.uEnvMap = gl.getUniformLocation(skyboxShaderProgram, "EnvMap");
      skyboxShaderProgram.uIVMatrix = gl.getUniformLocation(skyboxShaderProgram, "uIVMatrix");
      skyboxShaderProgram.uIPMatrix = gl.getUniformLocation(skyboxShaderProgram, "uIPMatrix");

      /* Setup VAO */
      skyboxShaderProgram.vao = gl.createVertexArray();
      gl.bindVertexArray(skyboxShaderProgram.vao);

      /* Skybox triangle */
      let skyboxVerts = new Float32Array([
        -1.0, -1.0, 0.99999,
        -1.0, 3.0, 0.99999,
        3.0, -1.0, 0.99999
        ]);
      skyboxVertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, skyboxVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, skyboxVerts, gl.STATIC_DRAW);

      /* Enable the attrib array */
      gl.bindBuffer(gl.ARRAY_BUFFER, skyboxVertexBuffer);
      gl.enableVertexAttribArray(skyboxShaderProgram.aVertexPosition);
      // Four bytes per float, 3 floats per vert, offset 0
      gl.vertexAttribPointer(skyboxShaderProgram.aVertexPosition, 3, gl.FLOAT, false, 0, 0);

      gl.bindVertexArray(null);
    },

    initFinalRenderShaderProgram = function() {
      finalRenderShaderProgram.aVertexPosition = gl.getAttribLocation(finalRenderShaderProgram, "aVertexPosition");
      finalRenderShaderProgram.uTex = gl.getUniformLocation(finalRenderShaderProgram, "Tex");
      finalRenderShaderProgram.uResolution = gl.getUniformLocation(finalRenderShaderProgram, "resolution");

      /* Setup VAO */
      finalRenderShaderProgram.vao = gl.createVertexArray();
      gl.bindVertexArray(finalRenderShaderProgram.vao);

      /* Skybox triangle */
      let finalRenderVerts = new Float32Array([
        -1.0, -1.0, 0.9,
        -1.0, 3.0, 0.9,
        3.0, -1.0, 0.9
        ]);
      finalRenderVertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, finalRenderVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, finalRenderVerts, gl.STATIC_DRAW);

      /* Enable the attrib array */
      gl.bindBuffer(gl.ARRAY_BUFFER, finalRenderVertexBuffer);
      gl.enableVertexAttribArray(finalRenderShaderProgram.aVertexPosition);
      // Four bytes per float, 3 floats per vert, offset 0
      gl.vertexAttribPointer(finalRenderShaderProgram.aVertexPosition, 3, gl.FLOAT, false, 0, 0);

      gl.bindVertexArray(null);
    },


    initBuffers = function() {
      let layout = new OBJ.Layout(
        OBJ.Layout.POSITION,
        OBJ.Layout.NORMAL,
        OBJ.Layout.UV);

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

    initIBLFramebuffers = function() {
        if (iblRenderBuffer === null) iblRenderBuffer = gl.createFramebuffer();
        if (iblColorBuffer === null) iblColorBuffer = gl.createFramebuffer();

        iblRenderBuffer.width = canvas.width * quality;
        iblRenderBuffer.height = canvas.height * quality;

        iblColorBuffer.width = canvas.width * quality;
        iblColorBuffer.height = canvas.height * quality;

        /* Setup texture to blit to  */
        if (iblTexture1 === null)  {
          iblTexture1 = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, iblTexture1);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, iblRenderBuffer.width, iblRenderBuffer.height, 0, gl.RGBA, gl.FLOAT, null);
        }
        if (iblTexture2 === null)  {
          iblTexture2 = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, iblTexture2);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, iblRenderBuffer.width, iblRenderBuffer.height, 0, gl.RGBA, gl.FLOAT, null);
        }

        if( depthBuffer === null) depthBuffer = gl.createRenderbuffer();
        if( colorBuffer === null) colorBuffer = gl.createRenderbuffer();

        /* Setup render buffers */
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 1, gl.DEPTH_COMPONENT16, iblRenderBuffer.width * 2, iblRenderBuffer.height * 2);

        gl.bindRenderbuffer(gl.RENDERBUFFER, colorBuffer);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 1, gl.RGBA32F, iblRenderBuffer.width * 2, iblRenderBuffer.height * 2);

        /* Setup frame buffers */
        gl.bindFramebuffer(gl.FRAMEBUFFER, iblRenderBuffer);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colorBuffer);

        /* Clear global state */
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },

    updateIBLTextures = function(texIdx) {
      initIBLFramebuffers();
      iblRenderBuffer.width = canvas.width * quality;
      iblRenderBuffer.height = canvas.height * quality;

      iblColorBuffer.width = canvas.width * quality;
      iblColorBuffer.height = canvas.height * quality;

      if (texIdx === 0) {
        /* Setup texture to blit to  */
        gl.bindTexture(gl.TEXTURE_2D, iblTexture1);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, iblRenderBuffer.width, iblRenderBuffer.height, 0, gl.RGBA, gl.FLOAT, null);
      }
      else {
        gl.bindTexture(gl.TEXTURE_2D, iblTexture2);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, iblRenderBuffer.width, iblRenderBuffer.height, 0, gl.RGBA, gl.FLOAT, null);
      }

      /* Clear global state */
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },

    setMainUniforms = function(shaderProgram){
      let lightDirection = [Math.sin(lightTheta)*Math.cos(lightPhi) , Math.cos(lightTheta), Math.sin(lightTheta)*Math.sin(lightPhi)];

      /* Color data */
      gl.uniform3fv(shaderProgram.diffuseUniform, new Float32Array([1.0, 1.0, 1.0]));
      gl.uniform3fv(shaderProgram.specularUniform, new Float32Array([1.0, 1.0, 1.0]));
      gl.uniform1f(shaderProgram.specularExponentUniform, 100.0);
      gl.uniform1f(shaderProgram.uIntensity, intensity);

      /* Matrix data  */
      gl.uniformMatrix4fv(shaderProgram.mMatrixUniform, false, mMatrix);
      gl.uniformMatrix4fv(shaderProgram.vMatrixUniform, false, vMatrix);
      gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
      gl.uniformMatrix4fv(shaderProgram.nMatrixUniform, false, normalMatrix);

      /* Light */
      gl.uniform3fv(shaderProgram.lightDirectionUniform, new Float32Array(lightDirection));
      // TODO: add back pick point


      // gl.uniformMatrix4fv(shaderProgram.pickProjMatrixUniform, false, pickProjMatrix);
      // gl.uniformMatrix4fv(shaderProgram.pickModelViewMatrixUniform, false, pickModelViewMatrix);
      // gl.uniform3fv(shaderProgram.pickPointNDCUniform, pickPointNDC);

      /* Environment map */
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, envMapTex);
      gl.uniform1i(shaderProgram.envMapSamplerUniform, 0);

      /* IBR stuff */
      gl.useProgram(shaderProgram);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, (iblCurrentBuffer === 0) ? iblTexture1 : iblTexture2);
      gl.uniform1i(shaderProgram.prevFrameSamplerUniform, 1);
      gl.uniform1f(shaderProgram.timeUniform, Math.random());
      gl.uniform1f(shaderProgram.totalFramesUniform, totalFrames);
      gl.uniform1i(shaderProgram.uHeatmap, useHeatmap);
      incrementIBL();

      /* Heatmap */
      gl.uniform1i(shaderProgram.uIBL, useIBL);
    },

    setSkyboxUniforms = function(shaderProgram) {
      /* Environment map */
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, envMapTex);
      gl.uniform1i(shaderProgram.envMapSamplerUniform, 0);

      /* Matrix data */
      let iVMatrix = mat4.create();
      let iPMatrix = mat4.create();
      mat4.invert(iVMatrix, vMatrix);
      mat4.invert(iPMatrix, pMatrix);
      gl.uniformMatrix4fv(skyboxShaderProgram.uIVMatrix, false, iVMatrix);
      gl.uniformMatrix4fv(skyboxShaderProgram.uIPMatrix, false, iPMatrix);
    },

    setFinalRenderUniforms = function(shaderProgram) {
      gl.useProgram(shaderProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, (iblCurrentBuffer === 0) ? iblTexture1 : iblTexture2);
      gl.uniform1i(shaderProgram.uTex, 0);
      gl.uniform2fv(shaderProgram.uResolution, new Float32Array([canvas.width, canvas.height]));
    },

    loadModels = function(){
      let p = OBJ.downloadModels([
        {
          name: 'teapot',
          obj: 'models/teapot.obj',
          mtl: true,
        },
      ]);

      p.then((loaded_models) => {
        models = loaded_models;
        initBuffers();
        modelsLoaded = true;
      });
    },

    isPowerOf2 = function(value) {
      return (value & (value - 1)) === 0;
    },

    setEnvironmentColor = function(red = 255, blue = 255, green = 255, alpha = 255) {
      gl.bindTexture(gl.TEXTURE_2D, envMapTex);
      resetIBL();

      /* Download image */
      const level = 0;
      const internalFormat = gl.RGBA;
      const width = 1;
      const height = 1;
      const border = 0;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      const pixel = new Uint8Array([0,0,0,255]); // Single opaque blue pixel until image is loaded.
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
        width, height, border, srcFormat, srcType, pixel);
    },

    setEnvironmentTexture = function(url) {
     const image = new Image();
      image.onload = function() {
        resetIBL();

        const level = 0;
        const internalFormat = gl.RGBA;
        const width = 1;
        const height = 1;
        const border = 0;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;

        gl.bindTexture(gl.TEXTURE_2D, envMapTex);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                      srcFormat, srcType, image);

        // WebGL1 has different requirements for power of 2 images
        // vs non power of 2 images so check if the image is a
        // power of 2 in both dimensions.
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
           // Yes, it's a power of 2. Generate mips.
           gl.generateMipmap(gl.TEXTURE_2D);
        } else {
           // No, it's not a power of 2. Turn of mips and set
           // wrapping to clamp to edge
           gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
           gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
           gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
      };
      image.src = url;
    },
    loadEnvironmentMap = function() {
      console.log("Loading environment map");

      envMapTex = gl.createTexture();

      /* Initially set environment to black. */
      setEnvironmentColor(0,0,0,255);

      /* Asyncronously replace with an environment map */
      setEnvironmentTexture(cubemapURL);
    },

    drawObject = function(model) {
      /*
         Takes in a model that points to a mesh and draws the object on the scene.
         Assumes that the setMainUniforms function exists
         as well as the shaderProgram has a uniform attribute called "samplerUniform"
         */
      //    gl2.useProgram(shaderProgram);

      //gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindBuffer(gl.ARRAY_BUFFER, model.vertexBuffer);
      defaultShaderProgram.applyAttributePointers(model);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
      gl.useProgram(defaultShaderProgram);
      setMainUniforms(defaultShaderProgram);
      gl.drawElements(gl.TRIANGLES, model.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    },

    drawSkybox = function() {
      gl.useProgram(skyboxShaderProgram);
      setSkyboxUniforms(skyboxShaderProgram);
      gl.bindVertexArray(skyboxShaderProgram.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },

    drawFinalRender = function() {
      gl.useProgram(finalRenderShaderProgram);
      setFinalRenderUniforms(finalRenderShaderProgram);
      gl.bindVertexArray(finalRenderShaderProgram.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);

      iblCurrentBuffer = (iblCurrentBuffer === 0) ? 1 : 0;
    },

    drawNormalDepthTexture = function(model){
      gl.viewport(0, 0, canvas.width, canvas.height);

      gl.bindFramebuffer(gl.FRAMEBUFFER, rttFramebuffer);
      gl.clearColor(0.0,0.0,0.0,0.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      rttShaderProgram.applyAttributePointers(model);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
      gl.useProgram(rttShaderProgram);
      setMainUniforms(rttShaderProgram);
      gl.drawElements(gl.TRIANGLES, model.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    },

    drawScene = function() {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


      let teapotToWorld = mat4.create();
      let worldToCamera = mat4.create();

      /* Teapot to World */
      //model matrix (rotate our z-up teapot to y-up) -- need to change later
      mat4.identity(teapotToWorld);
      mat4.rotate(teapotToWorld, teapotToWorld, -0.5 * Math.PI, [1, 0, 0]);

      /* Use this as our model matrix */
      mMatrix = mat4.clone(teapotToWorld);

      /* World to Camera */
      mat4.identity(worldToCamera);

      // First, translate the camera
      mat4.translate(worldToCamera, worldToCamera, [0, -2.5, -40]);

      // Next, handle rotation
      let tempMatrix = mat4.create();
      mat4.identity(tempMatrix);
      mat4.rotate(tempMatrix, tempMatrix, cameraYRotation, [1, 0, 0]);
      mat4.rotate(tempMatrix, tempMatrix, cameraXRotation, [0, 1, 0]);
      mat4.multiply(worldToCamera, worldToCamera, tempMatrix);
      mat3.fromMat4(camRotMatrix, tempMatrix);

      /* Use this as our view matrix */
      vMatrix = mat4.clone(worldToCamera);

      /* Projection matrix */
      //these values are hardcoded now for demo purpose, will change later
      mat4.perspective(pMatrix, 45 * Math.PI / 180.0, gl.viewportWidth / gl.viewportHeight, 18.0, 50.0);

      /* Find normal matrix */
      let mvMatrix = mat4.create();
      mat4.multiply(mvMatrix, vMatrix, mMatrix);
      let vmMatrix = mat4.create();
      mat4.invert(vmMatrix, mvMatrix);
      normalMatrix = mat4.transpose(normalMatrix, vmMatrix);

      drawNormalDepthTexture(models.teapot);

      /* Swap blitted texture */
      gl.bindFramebuffer(gl.FRAMEBUFFER, iblColorBuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,
        (iblCurrentBuffer === 0) ? iblTexture2 : iblTexture1, 0);
      gl.clearColor(0, 0, 0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.bindFramebuffer(gl.FRAMEBUFFER, iblRenderBuffer);
      gl.clearColor(0, 0, 0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.viewport(0, 0, iblRenderBuffer.width, iblRenderBuffer.height);
      drawObject(models.teapot);
      drawSkybox();

      /* Blit multisampled FBO to texture */
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, iblRenderBuffer);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, iblColorBuffer);
      gl.blitFramebuffer(
          0, 0, iblRenderBuffer.width, iblRenderBuffer.width,
          0, 0, iblColorBuffer.width, iblColorBuffer.width,
          gl.COLOR_BUFFER_BIT, gl.LINEAR
      );

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      drawFinalRender();


      if (queueRefresh1) {
        iblCurrentBuffer = (iblCurrentBuffer === 0) ? 1 : 0;
        updateIBLTextures(iblCurrentBuffer);
        iblCurrentBuffer = (iblCurrentBuffer === 0) ? 1 : 0;
        queueRefresh1 = false;
        resetIBL();
      }
      else if (queueRefresh2) {
        iblCurrentBuffer = (iblCurrentBuffer === 0) ? 1 : 0;
        updateIBLTextures(iblCurrentBuffer);
        iblCurrentBuffer = (iblCurrentBuffer === 0) ? 1 : 0;
        queueRefresh2 = false;
        resetIBL();
      }
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
    // (called when we load a BRDF)
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

    resetIBL = function() {
      totalFrames = 1;
    },

    incrementIBL = function() {
      totalFrames = parseFloat(totalFrames) + 1;
      if (totalFrames > maxConvergence) totalFrames = maxConvergence;
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
       //let res = mat3.create();
       //return mat3.multiply(res, camRotMatrix, normalRotMatrix);
      return normalRotMatrix;
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
        let pickPointNDC = vec3.fromValues(2*(pos.x/canvas.width)-1, 2*(pos.y/canvas.height)-1, 2*pixels[3]-1);

        pickProjMatrix = pMatrix;
        let mvMatrix = mat4.create();
        mat4.multiply(mvMatrix, vMatrix, mMatrix);
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

        vec3.normalize(bitangent,bitangent);
        vec3.normalize(tangent,tangent);
        vec3.normalize(normalDir,normalDir);

        //DEBUG. Make sure that bitangent, tangent, and normal are orthonormal.
        //console.log("Bitangent:");
        //console.log(bitangent);
        //console.log("Bitangent length:");
        //console.log("Bitangent length:" + vec3.length(bitangent));
        //console.log("Tangent:");
        //console.log(tangent);
        //console.log("Tangent length:" + vec3.length(tangent));
        //console.log("Normal:");
        //console.log(normalDir);
        //console.log("Normal length:" + vec3.length(normalDir));
        //console.log("Normal length:");
        //console.log("bitangent dot tangent:");
        //console.log(vec3.dot(bitangent,tangent));
        //console.log("bitangent dot normal:");
        //console.log(vec3.dot(bitangent,normalDir));
        //console.log("tangent dot normal:");
        //console.log(vec3.dot(tangent,normalDir));

        normalRotMatrix = mat3.fromValues(tangent[0], tangent[1], tangent[2], normalDir[0], normalDir[1],  normalDir[2],
            bitangent[0], bitangent[1], bitangent[2]);


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
    const shdrDir = "./Shaders/"; //FIXME: duplicated code from BRDFViewport

    let defaultVertSrc;
    let defaultFragSrc;
    let rttVertSrc;
    let rttFragSrc;
    let skyboxVertSrc;
    let skyboxFragSrc;
    let finalRenderVertSrc;
    let finalRenderFragSrc;
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
      },
      error: function(result){
        console.log("failed to load model-renderer.vert with error ");
        console.log(result);
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
    promises.push($.ajax({
      url: shdrDir + "skybox.vert",
      success: function(result){
        skyboxVertSrc = result.trim();
      }
    }));
    promises.push($.ajax({
      url: shdrDir + "skybox.frag",
      success: function(result){
        skyboxFragSrc = result.trim();
      }
    }));
    promises.push($.ajax({
      url: shdrDir + "finalRender.vert",
      success: function(result){
        finalRenderVertSrc = result.trim();
      }
    }));
    promises.push($.ajax({
      url: shdrDir + "glslify_processed/finalRender.frag",
      success: function(result){
        finalRenderFragSrc = result.trim();
      }, error: function(result) {
        console.log("failed to load model-renderer.frag with error ");
        console.log(result);
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
      skyboxShaderProgram = compile_and_link_shdr(gl, skyboxVertSrc, skyboxFragSrc);
      initSkyboxShaderProgram();
      finalRenderShaderProgram = compile_and_link_shdr(gl, finalRenderVertSrc, finalRenderFragSrc);
      initFinalRenderShaderProgram();

      initRTTFramebuffer();
      initIBLFramebuffers();

      loadModels();
      loadEnvironmentMap();
    }, function(err) {
        console.log("Shader Load Error: " + err);
    });

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
      resetIBL();
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
        resetIBL();
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
    setIBL,
    resetIBL,
    setHeatmap,
    setIntensity,
    setMaxConvergence,
    setQuality
  });
}
