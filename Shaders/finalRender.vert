#version 300 es

precision mediump float;

/* Attributes */
in vec3 aVertexPosition;

/* Uniforms */
uniform sampler2D Tex;

/* Varying */
out vec2 vUV;

void main(void) {
    vUV = (aVertexPosition.xy + 1.0) * .5;
    gl_Position = vec4(aVertexPosition,1.0);
}
