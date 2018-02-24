/*jshint esversion: 6 */

class ModelViewport {
  constructor(canvasName, width, height) {
    // the canvas2 element
    this.canvas = document.getElementById(canvasName);
    this.canvas.width = 512;
    this.canvas.height = 512;

    // WebGL context
    this.gl = null;

    // main shader program
    this.shaderProgram = null;

    this.setupWebGL2();
    this.initShaders();

    this.meshes = {};
    this.models = {};
    this.mvMatrix = mat4.create();
    this.mvMatrixStack = [];
    this.pMatrix = mat4.create();
	//initial light direction -- 45 degree pitch 45 degree yaw
	this.lightDirection = [Math.sin(Math.PI/4)*Math.cos(Math.PI/4), Math.cos(Math.PI/4), Math.sin(Math.PI/4)*Math.sin(Math.PI/4)];
    this.loadModels();
    this.modelsLoaded = false;
  }

  setupWebGL2() {
    this.gl = this.canvas.getContext("webgl2");
    if (!this.gl) {
        console.error("WebGL 2 not available");
        document.body.innerHTML = "This application requires WebGL 2 which is unavailable on this system.";
    }
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.viewportWidth = this.canvas.width;
    this.gl.viewportHeight = this.canvas.height;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  
  getShader(gl, id) {
  var shaderScript = document.getElementById(id);
    if (!shaderScript){
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k){
        if (k.nodeType == 3){
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment"){
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex"){
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else{
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
  }

  initShaders() {
    var gl = this.gl;
  var fragmentShader = this.getShader(gl, "shader-fs");
    var vertexShader = this.getShader(gl, "shader-vs");

    this.shaderProgram = gl.createProgram();
    gl.attachShader(this.shaderProgram, vertexShader);
    gl.attachShader(this.shaderProgram, fragmentShader);
    gl.linkProgram(this.shaderProgram);

    if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)){
        alert("Could not initialise shaders");
    }
    gl.useProgram(this.shaderProgram);

    const attrs = {
        'aVertexPosition': OBJ.Layout.POSITION.key,
        'aVertexNormal': OBJ.Layout.NORMAL.key,
        'aTextureCoord': OBJ.Layout.UV.key,
        'aDiffuse': OBJ.Layout.DIFFUSE.key,
        'aSpecular': OBJ.Layout.SPECULAR.key,
        'aSpecularExponent': OBJ.Layout.SPECULAR_EXPONENT.key,
    };

    this.shaderProgram.attrIndices = {};
    for (const attrName in attrs) {
        if (!attrs.hasOwnProperty(attrName)) {
            continue;
        }
        this.shaderProgram.attrIndices[attrName] = gl.getAttribLocation(this.shaderProgram, attrName);
        if (this.shaderProgram.attrIndices[attrName] != -1) {
            gl.enableVertexAttribArray(this.shaderProgram.attrIndices[attrName]);
        } else {
            console.warn('Shader attribute "' + attrName + '" not found in shader. Is it undeclared or unused in the shader code?');
        }
    }

    this.shaderProgram.pMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uPMatrix");
    this.shaderProgram.mvMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uMVMatrix");
    this.shaderProgram.nMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uNMatrix");
	this.shaderProgram.lightDirectionUniform = gl.getUniformLocation(this.shaderProgram, "uLightDirection");
	
    this.shaderProgram.applyAttributePointers = (model) => {
        const layout = model.vertexBuffer.layout;
        for (const attrName in attrs) {
            if (!attrs.hasOwnProperty(attrName) || this.shaderProgram.attrIndices[attrName] == -1) {
                continue;
            }
            const layoutKey = attrs[attrName];
            if (this.shaderProgram.attrIndices[attrName] != -1) {
                const attr = layout[layoutKey];
                gl.vertexAttribPointer(
                    this.shaderProgram.attrIndices[attrName],
                    attr.size,
                    gl[attr.type],
                    attr.normalized,
                    attr.stride,
                    attr.offset);
            }
        }
    };
  }
  
  initBuffers() {
    var layout = new OBJ.Layout(
        OBJ.Layout.POSITION,
        OBJ.Layout.NORMAL,
        OBJ.Layout.DIFFUSE,
        OBJ.Layout.UV,
        OBJ.Layout.SPECULAR,
        OBJ.Layout.SPECULAR_EXPONENT);

    // initialize the mesh's buffers
    for (var modelKey in this.models){
        // Create the vertex buffer for this mesh
        var vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        var vertexData = this.models[modelKey].makeBufferData(layout)
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexData, this.gl.STATIC_DRAW);
        vertexBuffer.numItems = vertexData.numItems;
        vertexBuffer.layout = layout;
        this.models[modelKey].vertexBuffer = vertexBuffer;

        // Create the index buffer for this mesh
        var indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        var indexData = this.models[modelKey].makeIndexBufferData()
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indexData, this.gl.STATIC_DRAW);
        indexBuffer.numItems = indexData.numItems;
        this.models[modelKey].indexBuffer = indexBuffer;

        // this loops through the mesh names and creates new
        // model objects and setting their mesh to the current mesh
        //this.models[modelKey] = {};
        //this.models[modelKey].mesh = this.models[modelKey];
    }
  }

  setMatrixUniforms(){
      this.gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform, false, this.pMatrix);
      this.gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform, false, this.mvMatrix);

      var normalMatrix = mat3.create();
      mat3.normalFromMat4(normalMatrix, this.mvMatrix);
      this.gl.uniformMatrix3fv(this.shaderProgram.nMatrixUniform, false, normalMatrix);
	  this.gl.uniform3fv(this.shaderProgram.lightDirectionUniform, new Float32Array(this.lightDirection));
  }

  loadModels() {
    let p = OBJ.downloadModels([
        {
            name: 'teapot',
            obj: 'models/teapot.obj',
            mtl: true,
        },
        {
            name: 'teapot2',
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
    //     this.models = models;
    //     this.modelsLoaded = true;

    //     /* Now that the models are loaded, we can initialize the buffers */
    //     this.initBuffers();
    // });

    p.then((models) => {
      console.log(models);
      this.models = models;
      this.initBuffers();
      this.modelsLoaded = true;
    });
  }

  mvPushMatrix(){
      var copy = mat4.create();
      mat4.copy(copy, this.mvMatrix);
      this.mvMatrixStack.push(copy);
  }

  mvPopMatrix(){
      if (this.mvMatrixStack.length === 0){
          throw "Invalid popMatrix!";
      }
      this.mvMatrix = this.mvMatrixStack.pop();
  }

  drawObject(model){
      /*
       Takes in a model that points to a mesh and draws the object on the scene.
       Assumes that the setMatrixUniforms function exists
       as well as the shaderProgram has a uniform attribute called "samplerUniform"
       */
  //    gl2.useProgram(shaderProgram);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, model.vertexBuffer);
      this.shaderProgram.applyAttributePointers(model);

      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
      this.setMatrixUniforms();
      this.gl.drawElements(this.gl.TRIANGLES, model.indexBuffer.numItems, this.gl.UNSIGNED_SHORT, 0);
  }

  drawScene() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    mat4.perspective(this.pMatrix, 45 * Math.PI / 180.0, this.gl.viewportWidth / this.gl.viewportHeight, 0.01, 1000.0);
    mat4.identity(this.mvMatrix);
    // move the camera
    mat4.translate(this.mvMatrix, this.mvMatrix, [0, -10, -40]);
    mat4.rotate(this.mvMatrix, this.mvMatrix, -0.5 * Math.PI, [1, 0, 0]);
    mat4.rotate(this.mvMatrix, this.mvMatrix, this.time * 0.25 * Math.PI, [0, 0, 1]);
    // set up the scene
    this.mvPushMatrix();
        this.drawObject(this.models.teapot);
    this.mvPopMatrix();
  }

  animate() {
    this.timeNow = new Date().getTime();
    this.elapsed = this.timeNow - this.lastTime;
    if (!this.time) {
        this.time = 0.0;
    }
    this.time += this.elapsed / 1000.0;
    if (this.lastTime !== 0){
        // do animations
    }
    this.lastTime = this.timeNow;
  }

  render(time) {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    if (this.modelsLoaded) {
      this.drawScene();
      this.animate();
    }
  }
}