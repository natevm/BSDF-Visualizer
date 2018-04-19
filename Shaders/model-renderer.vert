#version 300 es

precision mediump float;

/* Attributes */
in vec3 aVertexPosition;
in vec3 aVertexNormal;
in vec2 aTextureCoord;

/* Uniforms */
uniform vec3 uDiffuse;
uniform vec3 uSpecular;
uniform float uSpecularExponent;

uniform mat4 uMMatrix;
uniform mat4 uVMatrix;
uniform mat4 uPMatrix;

uniform vec3 uLightDirection;
uniform vec3 uModelSpacePickPoint;
uniform mat4 uNMatrix;

uniform float uTotalFrames;
uniform float uTime;
uniform sampler2D EnvMap;
uniform sampler2D PrevFrame;

uniform float uTheta;
uniform float uPhi;

/* Varying */
out vec2 vTextureCoord;
out vec4 vPosition;
out vec3 vTransformedNormal;
out vec3 vWorldNormal;
out vec3 vModelSpaceNormal;
out vec3 vModelSpacePosition;
out vec4 vProjPosition;

void main(void) {
    vTextureCoord = aTextureCoord;
    vPosition = uVMatrix * uMMatrix * vec4(aVertexPosition, 1.0);
    vTransformedNormal = mat3(uNMatrix) * aVertexNormal;
    vWorldNormal = vec3(uMMatrix * vec4(aVertexNormal, 0.0));
    vModelSpaceNormal = aVertexNormal;
    vModelSpacePosition = aVertexPosition;

    gl_Position =  uPMatrix * uVMatrix * uMMatrix * vec4(aVertexPosition, 1.0); ////uPMatrix * vPosition;
    vProjPosition = gl_Position;
}
