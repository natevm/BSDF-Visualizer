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

uniform sampler2D EnvMap;

/* Varying */
in vec2 vTextureCoord;
in vec4 vPosition;
in vec3 vTransformedNormal;
in vec3 vWorldNormal;
in vec3 vModelSpaceNormal;
in vec3 vModelSpacePosition;

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
    return uDiffuse * dot(N, L) + uSpecular * pow(max(dot(N, H),0.0), uSpecularExponent);
}

float rand(vec2 co){
    return (2.0 * fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453)) - 1.0;
}

vec3 hemisphereSample_cos(float u, float v) {
    float phi = v * 2.0 * PI;
    float cosTheta = sqrt(1.0 - u);
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    return vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
}

void main(void) {
    vec3 V = -normalize(vPosition.xyz);

    /* Assuming uLightDirection is in model space */
    vec3 L = mat3(uVMatrix) * normalize(uLightDirection);

    vec3 L1 = (vec3(rand(gl_FragCoord.xy), rand(gl_FragCoord.xy + 10.0), rand(gl_FragCoord.xy + 20.0)));
    vec3 L2 = (vec3(rand(gl_FragCoord.xy), rand(gl_FragCoord.xy + 30.0), rand(gl_FragCoord.xy + 40.0)));
    vec3 L3 = (vec3(rand(gl_FragCoord.xy), rand(gl_FragCoord.xy + 50.0), rand(gl_FragCoord.xy + 60.0)));
    vec3 L4 = (vec3(rand(gl_FragCoord.xy), rand(gl_FragCoord.xy + 70.0), rand(gl_FragCoord.xy + 80.0)));
    vec3 L5 = (vec3(rand(gl_FragCoord.xy), rand(gl_FragCoord.xy + 90.0), rand(gl_FragCoord.xy + 100.0)));

    vec3 N = normalize(vTransformedNormal);
    vec3 X; //eye space tangent
    vec3 Y; //eye space bitangent
    computeTangentVectors(N, X, Y);

    vec3 finalColor = vec3(0.0,0.0,0.0);
    for (int i = 0; i < 8; ++i) {
        float rand1 = rand(gl_FragCoord.xy + float(i * 10));
        float rand2 = rand(gl_FragCoord.xy + float(i * 20));
        float rand3 = rand(gl_FragCoord.xy + float(i * 30));
        vec3 L = normalize(vWorldNormal + vec3(rand1, rand2, rand3));
        finalColor += (BRDF(mat3(uVMatrix) * L, V, N, X, Y) * vec3(texture(EnvMap, toSpherical(L)))) / 8.0;
    }

    vColor = vec4(finalColor, 1.0);

 //    float len = length(uModelSpacePickPoint - vModelSpacePosition);
    // if (len < 0.5) color = mix(color, vec3(1,0,0), smoothstep(0.0, 1.0, 1.0-2.0*len));

    //vColor = texture(EnvMap, toSpherical(uLightDirection));
}
