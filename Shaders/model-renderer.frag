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

//L, V, N assumed to be unit vectors
//L points towards light.
//V points towards eye
//N is the normal
//X, Y assumed to be (1, 0, 0) and (0, 1, 0), respectively
vec3 BRDF(vec3 L, vec3 V, vec3 N, vec3 X, vec3 Y){
    vec3 H = normalize(L + V);
    return vDiffuse * dot(N, L) + vSpecular * pow(dot(H, N), vSpecularExponent);
}

void main(void) {
    vec3 V = -normalize(vPosition.xyz);
    vec3 L = mat3(uVMatrix) * normalize(uLightDirection);
    //vec3 H = normalize(L + V);
    vec3 N = normalize(vTransformedNormal);

    //vec3 V = -normalize(vModelSpacePosition.xyz);
    //vec3 L = normalize(uLightDirection);
    //vec3 N = normalize(modelSpaceNormal);

    vec3 X = mat3(uVMatrix) * vec3(1,0,0);
    vec3 Y = mat3(uVMatrix) * vec3(0,1,0);
    vec3 color = BRDF(L, V, N, X, Y);

    //vec3 color = vDiffuse * dot(N, L) +
      //vSpecular * pow(dot(H, N), vSpecularExponent);

	vec4 pickPointView4 = inverse(uPickModelViewMatrix) * inversePMatrix * vec4(uPickPointNDC,1);
	vec3 pickPointView = vec3(pickPointView4.x/pickPointView4.w, pickPointView4.y/pickPointView4.w, pickPointView4.z/pickPointView4.w);
	if (length(pickPointView - vModelSpacePosition) < 0.5) color = mix(color, vec3(1,0,0), smoothstep(0.0, 1.0, 1.0-2.0*length(pickPointView - vModelSpacePosition)));
    vColor = vec4(color, 1.0);
}
