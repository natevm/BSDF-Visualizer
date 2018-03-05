attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;
attribute vec3 aDiffuse;
attribute vec3 aSpecular;
attribute float aSpecularExponent;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat3 uNMatrix;

varying vec2 vTextureCoord;
varying vec3 vTransformedNormal;
varying vec4 vPosition;

varying vec3 vDiffuse;
varying vec3 vSpecular;
varying float vSpecularExponent;

void main(void) {
    vDiffuse = aDiffuse;
    vSpecular = aSpecular;
    vSpecularExponent = aSpecularExponent;

    vPosition = uMVMatrix * vec4(aVertexPosition, 1.0);
    gl_Position = uPMatrix * vPosition;
    vTextureCoord = aTextureCoord;
    vTransformedNormal = uNMatrix * aVertexNormal;
}
