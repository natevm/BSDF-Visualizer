#version 300 es

precision mediump float;

uniform vec3 uLightDirection;
uniform mat4 uVMatrix;
uniform vec3 uPickPointNDC;
uniform mat4 uPickModelViewMatrix;
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
    vec3 V = -normalize(vPosition.xyz);
    vec3 L = mat3(uVMatrix) * normalize(uLightDirection);
    vec3 H = normalize(L + V);
    vec3 N = normalize(vTransformedNormal);

    vec3 color = vDiffuse * dot(N, L) +
      vSpecular * pow(dot(H, N), vSpecularExponent);
	  
	vec4 pickPointView4 = inverse(uPickModelViewMatrix) * inversePMatrix * vec4(uPickPointNDC,1);
	vec3 pickPointView = vec3(pickPointView4.x/pickPointView4.w, pickPointView4.y/pickPointView4.w, pickPointView4.z/pickPointView4.w);
	if (length(pickPointView - vModelSpacePosition) < 0.5) color = vec3(1,0,0);
    vColor = vec4(color, 1.0);
}
