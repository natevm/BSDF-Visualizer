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

out vec4 vColor;

void main(void) {
    vec3 V = -normalize(vPosition.xyz);
    vec3 L = mat3(uVMatrix) * normalize(uLightDirection);
    vec3 H = normalize(L + V);
    vec3 N = normalize(vTransformedNormal);

    vec3 color = vDiffuse * dot(N, L) +
      vSpecular * pow(dot(H, N), vSpecularExponent);
    vColor = vec4(color, 1.0);
}
