#version 300 es

precision mediump float;

/* Attributes */
in vec3 aVertexPosition;

/* Uniforms */
uniform mat4 uIVMatrix;
uniform mat4 uIPMatrix;
uniform sampler2D EnvMap;

/* Varying */
out vec3 vCamPos;
out vec3 vUVW;

void main(void) {
    vec4 NDC_UVW = uIVMatrix * uIPMatrix * vec4(aVertexPosition, 1.0);
    vUVW = NDC_UVW.xyz / NDC_UVW.w;
    gl_Position = vec4(aVertexPosition,1.0);
    vCamPos = vec3(uIVMatrix[3]);
}
