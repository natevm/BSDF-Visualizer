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

//*************** START INLINED UNIFORMS ******************
// <INLINE_UNIFORMS_HERE>
//*************** END INLINED UNIFORMS ********************


/* Varying */
in vec2 vTextureCoord;
in vec4 vPosition;
in vec3 vTransformedNormal;
in vec3 vWorldNormal;
in vec3 vModelSpaceNormal;
in vec3 vModelSpacePosition;
in vec4 vProjPosition;

out vec4 vColor;

//From Disney's BRDF Explorer:
//https://www.disneyanimation.com/technology/brdf.html
//(see DISNEY_LICENSE at the root of this repository
//for a complete copy of their license).
void computeTangentVectors( vec3 inVec, out vec3 uVec, out vec3 vVec )
{
    uVec = abs(inVec.x) < 0.999 ? vec3(1,0,0) : vec3(0,1,0);
    uVec = normalize(cross(inVec, uVec));
    vVec = normalize(cross(inVec, uVec));
}

//L, V, N assumed to be unit vectors

//*************** START INLINED BRDF ******************
// <INLINE_BRDF_HERE>
//*************** END INLINED BRDF ********************

// Assumes radius = 1
#define PI 3.1415926535897932384626433832795
vec2 toSpherical(vec3 dir) {
    float u = atan(dir.z, dir.x) / (2.0 * PI) + .5;
    float v = asin(dir.y) / PI + .5;
    return vec2(u, 1.0 - v);
}

float rand(vec2 co){
    return (2.0 * fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453)) - 1.0;
}

void main(void) {
    vec3 V = -normalize(vPosition.xyz);

    /* Assuming uLightDirection is in model space */
    vec3 L = mat3(uVMatrix) * normalize(uLightDirection);
    vec3 N = normalize(vTransformedNormal);
    vec3 X; //eye space tangent
    vec3 Y; //eye space bitangent
    computeTangentVectors(N, X, Y);

    vec3 finalColor = vec3(0.0,0.0,0.0);
    for (int i = 1; i <= 4; ++i) {
        float rand1 = rand(gl_FragCoord.xy * uTime * float(i * 3));
        float rand2 = rand(gl_FragCoord.xy * uTime * float(i * 5));
        float rand3 = rand(gl_FragCoord.xy * uTime * float(i * 7));
        if (uTotalFrames <= 1.0) {
            rand1 = rand(gl_FragCoord.xy * float(i * 3));
            rand2 = rand(gl_FragCoord.xy * float(i * 5));
            rand3 = rand(gl_FragCoord.xy * float(i * 7));
        }
        vec3 L = normalize(vWorldNormal + vec3(rand1, rand2, rand3));
        finalColor += (BRDF(mat3(uVMatrix) * L, V, N, X, Y) * vec3(texture(EnvMap, toSpherical(L))) * 2.0) / 4.0;
    }

    vec2 UV = ((vProjPosition.xy / vProjPosition.w)  + 1.0) * .5;
    vColor = vec4(finalColor * 1.0/float(uTotalFrames) + vec3(texture(PrevFrame, UV)) * (float(uTotalFrames)-1.0)/float(uTotalFrames), 1.0);

 //    float len = length(uModelSpacePickPoint - vModelSpacePosition);
    // if (len < 0.5) color = mix(color, vec3(1,0,0), smoothstep(0.0, 1.0, 1.0-2.0*len));

    //vColor = texture(EnvMap, toSpherical(uLightDirection));
}
