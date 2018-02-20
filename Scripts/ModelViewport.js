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
    this.loadModels();
  }

  setupWebGL2() {
    this.gl = this.canvas.getContext("webgl2");
    if (!this.gl) {
        console.error("WebGL 2 not available");
        document.body.innerHTML = "This application requires WebGL 2 which is unavailable on this system.";
    }
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.enable(this.gl.DEPTH_TEST);
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

    /* Not sure how to update this yet... */
    // shaderProgram.applyAttributePointers = function(model) {
    //     const layout = model.mesh.vertexBuffer.layout;
    //     for (const attrName in attrs) {
    //         if (!attrs.hasOwnProperty(attrName) || shaderProgram.attrIndices[attrName] == -1) {
    //             continue;
    //         }
    //         const layoutKey = attrs[attrName];
    //         if (shaderProgram.attrIndices[attrName] != -1) {
    //             const attr = layout[layoutKey];
    //             gl.vertexAttribPointer(
    //                 shaderProgram.attrIndices[attrName],
    //                 attr.size,
    //                 gl[attr.type],
    //                 attr.normalized,
    //                 attr.stride,
    //                 attr.offset);
    //         }
    //     }

    // };
  }
  
  loadModels() {
  	let p = OBJ.downloadModels([
        {
            obj: 'models/teapot.obj',
            mtl: true,
        },
    ]);

    p.then((models) => {
    	console.log(models["teapot"]);
    	console.log('Name:', models["teapot"].name);
        console.log('Mesh:', models["teapot"]);
    	
    	/* For some reason this is giving me trouble. Seems to work on other browsers...*/
        // for ([name, mesh] of Object.entries(models)) {
        
        // }
        this.models = models;
    });
  }

  render(time) {
  	this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }
}