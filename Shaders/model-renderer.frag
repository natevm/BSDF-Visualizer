precision mediump float;

uniform vec3 uLightDirection;
uniform mat4 uVMatrix;

varying vec2 vTextureCoord;
varying vec3 vTransformedNormal;
varying vec4 vPosition;

varying vec3 vDiffuse;
varying vec3 vSpecular;
varying float vSpecularExponent;

void main(void) {
    vec3 V = -normalize(vPosition.xyz);
    vec3 L = mat3(uVMatrix) * normalize(uLightDirection);
    vec3 H = normalize(L + V);
    vec3 N = normalize(vTransformedNormal);

    vec3 color = vDiffuse * dot(N, L) +
      vSpecular * pow(dot(H, N), vSpecularExponent);
    gl_FragColor = vec4(color, 1.0);
}
