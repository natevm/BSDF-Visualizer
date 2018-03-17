#version 300 es

in vec3 aVertexPosition;
in vec3 aVertexNormal;
in vec2 aTextureCoord;
in vec3 aDiffuse;
in vec3 aSpecular;
in float aSpecularExponent;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uPickProjMatrix;
uniform mat3 uNMatrix;
out vec2 vTextureCoord;
out vec3 vTransformedNormal;
out vec4 vPosition;

out vec3 vDiffuse;
out vec3 vSpecular;
out float vSpecularExponent;

out vec3 modelSpaceNormal;

out mat4 inversePMatrix;

out vec3 vModelSpacePosition;

void main(void) {
    vDiffuse = aDiffuse;
    vSpecular = aSpecular;
    vSpecularExponent = aSpecularExponent;

    vPosition = uMVMatrix * vec4(aVertexPosition, 1.0);
    gl_Position = uPMatrix * vPosition;
    vTextureCoord = aTextureCoord;
	modelSpaceNormal = aVertexNormal;
    vTransformedNormal = uNMatrix * aVertexNormal;
	vModelSpacePosition = aVertexPosition;
	inversePMatrix = inverse(uPickProjMatrix);
}
