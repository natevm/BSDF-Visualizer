#version 300 es

precision mediump float;

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
uniform bool uHeatmap;
uniform bool uIBL;
uniform float uIntensity;

/* Varying */
in vec2 vTextureCoord;
in vec4 vPosition;
in vec3 vTransformedNormal;
in vec3 vWorldNormal;
in vec3 vModelSpaceNormal;
in vec3 vModelSpacePosition;
in vec4 vProjPosition;

out vec4 vColor;

void computeTangentVectors( vec3 inVec, out vec3 uVec, out vec3 vVec )
{
    uVec = abs(inVec.x) < 0.999 ? vec3(1,0,0) : vec3(0,1,0);
    uVec = normalize(cross(inVec, uVec));
    vVec = normalize(cross(inVec, uVec));
}

// Assumes radius = 1
#define PI 3.1415926535897932384626433832795
vec2 toSpherical(vec3 dir) {
    float u = atan(dir.z, dir.x) / (2.0 * PI) + .5;
    float v = asin(dir.y) / PI + .5;
    return vec2(u, 1.0 - v);
}

//L, V, N assumed to be unit vectors
//L points towards light.
//V points towards eye
//N is the normal
vec3 BRDF(vec3 L, vec3 V, vec3 N, vec3 X, vec3 Y){
    vec3 H = normalize(L + V);
    return uDiffuse * (1.0 / PI) + uSpecular * pow(max(dot(N, H),0.0), uSpecularExponent) * (1.0 / dot(N, L));
}

float rand(vec2 co){
    return (2.0 * fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453)) - 1.0;
}

#pragma glslify: jet = require('glsl-colormap/jet')

void main(void) {
    float hdr_max = 2.0;
    vec3 V = -normalize(vPosition.xyz);

    /* Assuming uLightDirection is in model space */
    vec3 N = normalize(vTransformedNormal);
    vec3 X; //eye space tangent
    vec3 Y; //eye space bitangent
    computeTangentVectors(N, X, Y);

    vec3 color = vec3(0.0,0.0,0.0);
    if (uIBL) {
        for (int i = 1; i <= 16; ++i) {
            float rand1 = rand(gl_FragCoord.xy * uTime * float(i * 3));
            float rand2 = rand(gl_FragCoord.xy * uTime * float(i * 5));
            float rand3 = rand(gl_FragCoord.xy * uTime * float(i * 7));
            vec3 L = normalize(vWorldNormal + normalize(vec3(rand1, rand2, rand3)));
            color += (uIntensity * BRDF(mat3(uVMatrix) * L, V, N, X, Y) * dot(N, mat3(uVMatrix) * L)
                * vec3(texture(EnvMap, toSpherical(L))) * 2.0) / 16.0;
        }
    } else {
        vec3 L = mat3(uVMatrix) * normalize(uLightDirection);
        color = (uIntensity * dot(N, L) * BRDF(L, V, N, X, Y));
    }

    if (uHeatmap) color = jet(clamp(color.x/hdr_max,0.0,1.0)).xyz;

    float currentInfluence = 1.0/uTotalFrames;
    float previousInfluence = (uTotalFrames-1.0)/uTotalFrames;
    vec2 UV = ((vProjPosition.xy / vProjPosition.w) + 1.0) * .5;
    vColor = vec4(color * currentInfluence + texture(PrevFrame, UV).xyz * previousInfluence, 1.0);
    if (any(isnan(vColor))) vColor = vec4(color, 1.0);
}
