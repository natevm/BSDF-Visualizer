#version 300 es

precision mediump float;

/* Uniforms */
uniform vec3 diffuse;
uniform vec3 specular;
uniform float specularExponent;

uniform mat4 uMMatrix;
uniform mat4 uVMatrix;
uniform mat4 uPMatrix;

uniform vec3 uLightDirection;
uniform vec3 uModelSpacePickPoint;
uniform mat4 uNMatrix;

uniform sampler2D EnvMap;

/* Varying */
in vec2 vTextureCoord;
in vec4 vPosition;
in vec3 vTransformedNormal;
in vec3 vWorldNormal;
in vec3 vModelSpaceNormal;
in vec3 vModelSpacePosition;
in vec4 vProjPosition;

out vec4 vColor;

void main(void) {
    vColor = vec4(vModelSpaceNormal, gl_FragCoord.z);
}
