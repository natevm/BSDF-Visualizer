// main app object
var app = {};
app.meshes = {};
app.models = {};
app.mvMatrix = mat4.create();
app.mvMatrixStack = [];
app.pMatrix = mat4.create();

window.requestAnimFrame = (function (){
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (/* function FrameRequestCallback */ callback, /* DOMElement Element */ element){
            return window.setTimeout(callback, 1000 / 60);
        };
})();

function initWebGL(canvas2){
    try{
        // Try to grab the standard context. If it fails, fallback to experimental.
        gl2 = canvas2.getContext("webgl") || canvas2.getContext("experimental-webgl");
    }
    catch (e){
    }
    if (!gl2){
        alert("Unable to initialize WebGL. Your browser may not support it.");
        gl2 = null;
    }
    gl2.viewportWidth = canvas2.width;
    gl2.viewportHeight = canvas2.height;
    gl2.viewport(0, 0, canvas2.width, canvas2.height);
    return gl2;
}

function getShader(gl2, id){
    
}

function initShaders(){
    
}

function drawObject(model){
    /*
     Takes in a model that points to a mesh and draws the object on the scene.
     Assumes that the setMatrixUniforms function exists
     as well as the shaderProgram has a uniform attribute called "samplerUniform"
     */
//    gl2.useProgram(shaderProgram);

    gl2.bindBuffer(gl2.ARRAY_BUFFER, model.mesh.vertexBuffer);
    shaderProgram.applyAttributePointers(model);

    gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, model.mesh.indexBuffer);
    setMatrixUniforms();
    gl2.drawElements(gl2.TRIANGLES, model.mesh.indexBuffer.numItems, gl2.UNSIGNED_SHORT, 0);
}

function mvPushMatrix(){
    var copy = mat4.create();
    mat4.copy(copy, app.mvMatrix);
    app.mvMatrixStack.push(copy);
}

function mvPopMatrix(){
    if (app.mvMatrixStack.length === 0){
        throw "Invalid popMatrix!";
    }
    app.mvMatrix = app.mvMatrixStack.pop();
}

function setMatrixUniforms(){
    gl2.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, app.pMatrix);
    gl2.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, app.mvMatrix);

    var normalMatrix = mat3.create();
    mat3.normalFromMat4(normalMatrix, app.mvMatrix);
    gl2.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
}

function initBuffers(){
    var layout = new OBJ.Layout(
        OBJ.Layout.POSITION,
        OBJ.Layout.NORMAL,
        OBJ.Layout.DIFFUSE,
        OBJ.Layout.UV,
        OBJ.Layout.SPECULAR,
        OBJ.Layout.SPECULAR_EXPONENT);

    // initialize the mesh's buffers
    for (var mesh in app.meshes){
        // Create the vertex buffer for this mesh
        var vertexBuffer = gl2.createBuffer();
        gl2.bindBuffer(gl2.ARRAY_BUFFER, vertexBuffer);
        var vertexData = app.meshes[mesh].makeBufferData(layout)
        gl2.bufferData(gl2.ARRAY_BUFFER, vertexData, gl2.STATIC_DRAW);
        vertexBuffer.numItems = vertexData.numItems;
        vertexBuffer.layout = layout;
        app.meshes[mesh].vertexBuffer = vertexBuffer;

        // Create the index buffer for this mesh
        var indexBuffer = gl2.createBuffer();
        gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, indexBuffer);
        var indexData = app.meshes[mesh].makeIndexBufferData()
        gl2.bufferData(gl2.ELEMENT_ARRAY_BUFFER, indexData, gl2.STATIC_DRAW);
        indexBuffer.numItems = indexData.numItems;
        app.meshes[mesh].indexBuffer = indexBuffer;

        // this loops through the mesh names and creates new
        // model objects and setting their mesh to the current mesh
        app.models[mesh] = {};
        app.models[mesh].mesh = app.meshes[mesh];
    }
}

function animate(){
    app.timeNow = new Date().getTime();
    app.elapsed = app.timeNow - app.lastTime;
    if (!app.time) {
        app.time = 0.0;
    }
    app.time += app.elapsed / 1000.0;
    if (app.lastTime !== 0){
        // do animations
    }
    app.lastTime = app.timeNow;
}

function drawScene(){
    gl2.clear(gl2.COLOR_BUFFER_BIT | gl2.DEPTH_BUFFER_BIT);
    mat4.perspective(app.pMatrix, 45 * Math.PI / 180.0, gl2.viewportWidth / gl2.viewportHeight, 0.01, 1000.0);
    mat4.identity(app.mvMatrix);
    // move the camera
    mat4.translate(app.mvMatrix, app.mvMatrix, [0, -10, -40]);
    mat4.rotate(app.mvMatrix, app.mvMatrix, -0.5 * Math.PI, [1, 0, 0]);
    mat4.rotate(app.mvMatrix, app.mvMatrix, app.time * 0.25 * Math.PI, [0, 0, 1]);
    // set up the scene
    mvPushMatrix();
        drawObject(app.models.teapot);
    mvPopMatrix();
}

function tick(){
    requestAnimFrame(tick);
    drawScene();
    animate();
}

function webGLStart(meshes){
    app.meshes = meshes;
    canvas2 = document.getElementById('model-canvas');
	canvas2.width = 800;
	canvas2.height = 600;
    gl2 = initWebGL(canvas2);
    initShaders();
    initBuffers();
    gl2.clearColor(0.5, 0.5, 0.5, 1.0);
    gl2.enable(gl2.DEPTH_TEST);

    tick();
//    drawScene();
}

window.onload = function (){
    let p = OBJ.downloadModels([
        {
            obj: 'models/teapot.obj',
            mtl: true,
        }, 
    ]);

    p.then((models) => {
        for ([name, mesh] of Object.entries(models)) {
            console.log('Name:', name);
            console.log('Mesh:', mesh);
        }
        webGLStart(models);
    });
};

		