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

  //Declare our object's variables and methods below.
  //They are private by default, unless we put them
  //in the "frozen" object that gets returned at the end.
  var
  { canvasName, width, height } = spec,
    canvas = document.getElementById(canvasName),
    gl, // WebGL context
    shaderProgram,
    models = {},
    mvMatrix = mat4.create(),
    mvMatrixStack = [],
    pMatrix = mat4.create(),
    vMatrix = mat4.create(),
    lightPhi = 0,
    lightTheta =  Math.PI/4,
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

    setupWebGL2 = function(){
      gl = init_gl_context(canvas);
      gl.clearColor(0, 0, 0, 1);
      gl.enable(gl.DEPTH_TEST);
      gl.viewportWidth = canvas.width;
      gl.viewportHeight = canvas.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
    },

    initShaders = function(vsSource, fsSource) {
      //const vsSource = document.getElementById("model-renderer.vert").text.trim();
      //const fsSource = document.getElementById("model-renderer.frag").text.trim();
      shaderProgram = compile_and_link_shdr(gl, vsSource, fsSource);  
      gl.useProgram(shaderProgram);

      const attrs = {
        'aVertexPosition': OBJ.Layout.POSITION.key,
        'aVertexNormal': OBJ.Layout.NORMAL.key,
        'aTextureCoord': OBJ.Layout.UV.key,
        'aDiffuse': OBJ.Layout.DIFFUSE.key,
        'aSpecular': OBJ.Layout.SPECULAR.key,
        'aSpecularExponent': OBJ.Layout.SPECULAR_EXPONENT.key,
      };

      shaderProgram.attrIndices = {};
      for (const attrName in attrs) {
        if (!attrs.hasOwnProperty(attrName)) {
          continue;
        }
        shaderProgram.attrIndices[attrName] = gl.getAttribLocation(shaderProgram, attrName);
        if (shaderProgram.attrIndices[attrName] != -1) {
          gl.enableVertexAttribArray(shaderProgram.attrIndices[attrName]);
        } else {
          console.warn('Shader attribute "' + attrName + '" not found in shader. Is it undeclared or unused in the shader code?');
        }
      }

      shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
      shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
      shaderProgram.vMatrixUniform = gl.getUniformLocation(shaderProgram, "uVMatrix");
      shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
      shaderProgram.lightDirectionUniform = gl.getUniformLocation(shaderProgram, "uLightDirection");

      shaderProgram.applyAttributePointers = (model) => {
        const layout = model.vertexBuffer.layout;
        for (const attrName in attrs) {
          if (!attrs.hasOwnProperty(attrName) || shaderProgram.attrIndices[attrName] == -1) {
            continue;
          }
          const layoutKey = attrs[attrName];
          if (shaderProgram.attrIndices[attrName] != -1) {
            const attr = layout[layoutKey];
            gl.vertexAttribPointer(
              shaderProgram.attrIndices[attrName],
              attr.size,
              gl[attr.type],
              attr.normalized,
              attr.stride,
              attr.offset);
          }
        }
      };
    },

    initBuffers = function(){
      var layout = new OBJ.Layout(
        OBJ.Layout.POSITION,
        OBJ.Layout.NORMAL,
        OBJ.Layout.DIFFUSE,
        OBJ.Layout.UV,
        OBJ.Layout.SPECULAR,
        OBJ.Layout.SPECULAR_EXPONENT);

      // initialize the mesh's buffers
      for (var modelKey in models){
        // Create the vertex buffer for this mesh
        var vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        var vertexData = models[modelKey].makeBufferData(layout);
        gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
        vertexBuffer.numItems = vertexData.numItems;
        vertexBuffer.layout = layout;
        models[modelKey].vertexBuffer = vertexBuffer;

        // Create the index buffer for this mesh
        var indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        var indexData = models[modelKey].makeIndexBufferData();
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);
        indexBuffer.numItems = indexData.numItems;
        models[modelKey].indexBuffer = indexBuffer;

        // this loops through the mesh names and creates new
        // model objects and setting their mesh to the current mesh
        //models[modelKey] = {};
        //models[modelKey].mesh = models[modelKey];
      }
    },

    setMatrixUniforms = function(){
      var normalMatrix = mat3.create();
      var lightDirection = [Math.sin(lightTheta)*Math.cos(lightPhi) , Math.cos(lightTheta), Math.sin(lightTheta)*Math.sin(lightPhi)];

      gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
      gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
      gl.uniformMatrix4fv(shaderProgram.vMatrixUniform, false, vMatrix);

      mat3.normalFromMat4(normalMatrix, mvMatrix);
      gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
      gl.uniform3fv(shaderProgram.lightDirectionUniform, new Float32Array(lightDirection));
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

      p.then((loaded_models) => {
        console.log(loaded_models);
        models = loaded_models;
        initBuffers();
        modelsLoaded = true;
      });
    },

    mvPushMatrix = function(){
      var copy = mat4.create();
      mat4.copy(copy, mvMatrix);
      mvMatrixStack.push(copy);
    },

    mvPopMatrix = function(){
      if (mvMatrixStack.length === 0){
        throw "Invalid popMatrix!";
      }
      mvMatrix = mvMatrixStack.pop();
    },

    drawObject = function(model){
      /*
         Takes in a model that points to a mesh and draws the object on the scene.
         Assumes that the setMatrixUniforms function exists
         as well as the shaderProgram has a uniform attribute called "samplerUniform"
         */
      //    gl2.useProgram(shaderProgram);

      gl.bindBuffer(gl.ARRAY_BUFFER, model.vertexBuffer);
      shaderProgram.applyAttributePointers(model);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
      setMatrixUniforms();
      gl.drawElements(gl.TRIANGLES, model.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    },

    drawScene = function() {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      mat4.perspective(pMatrix, 45 * Math.PI / 180.0, gl.viewportWidth / gl.viewportHeight, 0.01, 1000.0);
      mat4.identity(mvMatrix);
      // move the camera
      mat4.translate(mvMatrix, mvMatrix, [0, -10, -40]);
      mat4.rotate(mvMatrix, mvMatrix, cameraYRotation, [1, 0, 0]);
      mat4.rotate(mvMatrix, mvMatrix, cameraXRotation, [0, 1, 0]);
      vMatrix = mat4.clone(mvMatrix);
      mat4.rotate(mvMatrix, mvMatrix, -0.5 * Math.PI, [1, 0, 0]);
      // set up the scene
      //mvPushMatrix();
      drawObject(models.teapot);
      //mvPopMatrix();
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

    render = function(time) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (modelsLoaded) {
        drawScene();
        animate();
      }
    },

    updateTheta = function(newThetaDeg){
      lightTheta = deg2rad(newThetaDeg);
    },

    updatePhi = function(newPhiDeg){
      lightPhi = deg2rad(newPhiDeg);
    };

  //************* Start "constructor" (not really a constructor) **************
  canvas.width = width;
  canvas.height = height;
  setupWebGL2();

  const shdrDir = "Shaders/"; //FIXME: duplicated code from BRDFViewport
  let vertSrc;
  let fragSrc;

  let promises = [];
  promises.push($.ajax({
    url: shdrDir + "model-renderer.vert", 
    success: function(result){
      vertSrc = result.trim();
    }
  }));
  promises.push($.ajax({
    url: shdrDir + "model-renderer.frag", 
    success: function(result){
      fragSrc = result.trim();
    }
  }));

  //JQuery promise snippet from https://stackoverflow.com/a/10004137
  //Wait for all async callbacks to return, then execute the code below.
  $.when.apply($, promises).then(function() {
    // returned data is in arguments[0][0], arguments[1][0], ... arguments[9][0]
    // you can process it here
    
    initShaders(vertSrc, fragSrc);
    loadModels();

  }, function() {
      // error occurred
      console.log("Error loading shaders!");
  });


  document.getElementById(canvasName).onmousedown = (event) => {
    //console.log("detected!\n");
    mouseDown = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  };

  document.getElementById(canvasName).onmouseup = (event) => {
    mouseDown = false;
  };

  document.getElementById(canvasName).onmousemove = (event) => {
    if (mouseDown) {
      let newX = event.clientX;
      let newY = event.clientY;
      let deltaY = newY - lastMouseY;
      let deltaX = newX - lastMouseX;

      if (Math.abs(deltaX) > Math.abs(deltaY)) cameraXRotation += 0.01*deltaX;
      else cameraYRotation += 0.01*deltaY;
      //console.log(cameraXRotation);

      lastMouseX = newX;
      lastMouseY = newY;
    }
  };
  //************* End "constructor" (not really a constructor) **************

  //Put any methods / properties that we want to make public inside this object.
  return Object.freeze({
    render,
    updateTheta,
    updatePhi
  });
}
