#version 300 es

precision mediump float;

uniform vec3 uLightDirection;
uniform mat4 uVMatrix;

in vec2 vTextureCoord;
in vec3 vTransformedNormal;
in vec4 vPosition;

in vec3 vDiffuse;
in vec3 vSpecular;
in float vSpecularExponent;

in vec3 modelSpaceNormal;
in mat4 inversePMatrix;
in vec3 vModelSpacePosition;
out vec4 vColor;

void main(void) {
    vColor = vec4(modelSpaceNormal, gl_FragCoord.z);
}
