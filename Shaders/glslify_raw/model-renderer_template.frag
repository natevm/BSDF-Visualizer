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
uniform float uIntensity;

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

<<<<<<< HEAD:Shaders/model-renderer_template.frag
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
=======
#pragma glslify: jet = require('glsl-colormap/jet')
>>>>>>> master:Shaders/glslify_raw/model-renderer_template.frag

void main(void) {
    float hdr_max = 2.0;
    vec3 V = -normalize(vPosition.xyz);

    /* Assuming uLightDirection is in model space */
    vec3 L = mat3(uVMatrix) * normalize(uLightDirection);
    vec3 N = normalize(vTransformedNormal);
    vec3 X; //eye space tangent
    vec3 Y; //eye space bitangent
    computeTangentVectors(N, X, Y);

<<<<<<< HEAD:Shaders/model-renderer_template.frag
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
=======
    vec3 color = uIntensity * BRDF(L, V, N, X, Y) * clamp(dot(N, L),0.0,1.0);
>>>>>>> master:Shaders/glslify_raw/model-renderer_template.frag

 //    float len = length(uModelSpacePickPoint - vModelSpacePosition);
    // if (len < 0.5) color = mix(color, vec3(1,0,0), smoothstep(0.0, 1.0, 1.0-2.0*len));

<<<<<<< HEAD:Shaders/model-renderer_template.frag
    //vColor = texture(EnvMap, toSpherical(uLightDirection));
=======
    vec4 pickPointView4 = inverse(uPickModelViewMatrix) * inversePMatrix * vec4(uPickPointNDC,1);
    vec3 pickPointView = vec3(pickPointView4.x/pickPointView4.w, pickPointView4.y/pickPointView4.w, pickPointView4.z/pickPointView4.w);
    if (length(pickPointView - vModelSpacePosition) < 0.5) color = mix(color, vec3(1,0,0), smoothstep(0.0, 1.0, 1.0-2.0*length(pickPointView - vModelSpacePosition)));
    //vColor = vec4(color, 1.0);
  if (uHeatmap) {
    vColor = jet(clamp(color.x/hdr_max,0.0,1.0));
  } else {
    vColor = vec4(color,1.0);
  }
>>>>>>> master:Shaders/glslify_raw/model-renderer_template.frag
}
