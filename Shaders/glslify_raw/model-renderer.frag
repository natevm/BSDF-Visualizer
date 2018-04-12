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

//TODO: can we make inVec const?
//TODO: can we do this with less branching? Possibly inefficient on GPU.
void computeTangentVectors( vec3 inVec, out vec3 uVec, out vec3 vVec )
{
  //inVec is +z in tangent space (the normal direction)
  //uVec is +x in tangent space.
  //vVec is +y in tangent space.

  //This was created to match Daqi's code in selectPointEventFunction
  //in ModelViewport.js
  vec3 normalDir = inVec;
  vec3 projNormal = vec3(normalDir.x, 0, normalDir.z);
  vec3 bitangent;
  vec3 tangent;
  if (projNormal[2] == 0.0) {
      if (projNormal[0] > 0.0) {
          tangent = vec3(0.0,0.0,-1.0);
          bitangent = vec3(0.0,1.0,0.0);
      } else if (projNormal[0] < 0.0) {
          tangent = vec3(0.0,0.0,1.0);
          bitangent = vec3(0.0,1.0,0.0);
      } else {
          tangent = vec3(1.0,0.0,0.0);
          bitangent = vec3(0.0,0.0,-1.0);
      }
  } else {
      vec3 xdir;
      if(projNormal[2] > 0.0) {
          xdir = vec3(1.0,0.0,0.0);
      } else { // projNormal[2] < 0
          xdir = vec3(-1.0,0.0,0.0);
      }
      bitangent = cross(projNormal, xdir);
      bitangent = normalize(bitangent);
      tangent = cross(bitangent, projNormal);
      tangent = normalize(tangent);
  }

  bitangent = cross(tangent, normalDir);
  tangent = normalize(tangent);
  bitangent = normalize(bitangent);

  uVec = tangent;
  vVec = bitangent;
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

// From LGWJGL3
vec3 randomCosineWeightedHemispherePoint(vec3 rand, vec3 n) {
  float r = rand.x * 0.5 + 0.5; // [-1..1) -> [0..1)
  float angle = (rand.y + 1.0) * PI; // [-1..1] -> [0..2*PI)
  float sr = sqrt(r);
  vec2 p = vec2(sr * cos(angle), sr * sin(angle));
  /*
   * Unproject disk point up onto hemisphere:
   * 1.0 == sqrt(x*x + y*y + z*z) -> z = sqrt(1.0 - x*x - y*y)
   */
  vec3 ph = vec3(p.xy, sqrt(1.0 - p*p));
  /*
   * Compute some arbitrary tangent space for orienting
   * our hemisphere 'ph' around the normal. We use the camera's up vector
   * to have some fix reference vector over the whole screen.
   */
  vec3 tangent = normalize(rand);
  vec3 bitangent = cross(tangent, n);
  tangent = cross(bitangent, n);

  /* Make our hemisphere orient around the normal. */
  return tangent * ph.x + bitangent * ph.y + n * ph.z;
}

float gold_noise(in vec2 coordinate, in float seed){
    float phi = 1.61803398874989484820459 * 00000.1; // Golden Ratio
    float pi  = 3.14159265358979323846264 * 00000.1; // pi
    float sq2 = 1.41421356237309504880169 * 10000.0; // Square Root of Two

    return (2.0 * fract(sin(dot(coordinate*(seed+phi), vec2(phi, pi)))*sq2)) - 1.0;
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
        for (int i = 1; i <= 64; ++i) {
            float rand1 = gold_noise(gl_FragCoord.xy, uTime * float(i * 3));
            float rand2 = gold_noise(gl_FragCoord.xy, uTime * float(i * 5));
            float rand3 = gold_noise(gl_FragCoord.xy, uTime * float(i * 7));
            vec3 L = normalize(randomCosineWeightedHemispherePoint(vec3(rand1, rand2, rand3), vWorldNormal));
            color += (uIntensity * max(BRDF(mat3(uVMatrix) * L, V, N, X, Y),0.0) * clamp(dot(N, mat3(uVMatrix) * L),0.0,1.0) * vec3(texture(EnvMap, toSpherical(L))) * 2.0) / 64.0;
        }
    } else {
        vec3 L = mat3(uVMatrix) * normalize(uLightDirection);
        color = (uIntensity * clamp(dot(N, L),0.0,1.0) * max(BRDF(L, V, N, X, Y),0.0));
    }

    if (uHeatmap) color = jet(clamp(color.x/hdr_max,0.0,1.0)).xyz;

    float currentInfluence = 1.0/uTotalFrames;
    float previousInfluence = (uTotalFrames-1.0)/uTotalFrames;
    vec2 UV = ((vProjPosition.xy / vProjPosition.w) + 1.0) * .5;
    vColor = vec4(color * currentInfluence + texture(PrevFrame, UV).xyz * previousInfluence, 1.0);
    if (any(isnan(vColor))) vColor = vec4(color, 1.0);
}
