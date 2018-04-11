#version 300 es

precision mediump float;
#define GLSLIFY 1

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

  uVec = tangent;
  vVec = bitangent;
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

vec4 jet (float x_0) {
  const float e0 = 0.0;
  const vec4 v0 = vec4(0,0,0.5137254901960784,1);
  const float e1 = 0.125;
  const vec4 v1 = vec4(0,0.23529411764705882,0.6666666666666666,1);
  const float e2 = 0.375;
  const vec4 v2 = vec4(0.0196078431372549,1,1,1);
  const float e3 = 0.625;
  const vec4 v3 = vec4(1,1,0,1);
  const float e4 = 0.875;
  const vec4 v4 = vec4(0.9803921568627451,0,0,1);
  const float e5 = 1.0;
  const vec4 v5 = vec4(0.5019607843137255,0,0,1);
  float a0 = smoothstep(e0,e1,x_0);
  float a1 = smoothstep(e1,e2,x_0);
  float a2 = smoothstep(e2,e3,x_0);
  float a3 = smoothstep(e3,e4,x_0);
  float a4 = smoothstep(e4,e5,x_0);
  return max(mix(v0,v1,a0)*step(e0,x_0)*step(x_0,e1),
    max(mix(v1,v2,a1)*step(e1,x_0)*step(x_0,e2),
    max(mix(v2,v3,a2)*step(e2,x_0)*step(x_0,e3),
    max(mix(v3,v4,a3)*step(e3,x_0)*step(x_0,e4),mix(v4,v5,a4)*step(e4,x_0)*step(x_0,e5)
  ))));
}

void main(void) {
    float hdr_max = 2.0;
    vec3 V = -normalize(vPosition.xyz);
    vec3 N = normalize(vTransformedNormal);
    vec3 X; //eye space tangent
    vec3 Y; //eye space bitangent
    computeTangentVectors(N, X, Y);

    vec3 color = vec3(0.0,0.0,0.0);
    if (uIBL) {
        for (int i = 1; i <= 16; ++i) {
            float rand1 = gold_noise(gl_FragCoord.xy, uTime * float(i * 3));
            float rand2 = gold_noise(gl_FragCoord.xy, uTime * float(i * 5));
            float rand3 = gold_noise(gl_FragCoord.xy, uTime * float(i * 7));
            vec3 L = normalize(randomCosineWeightedHemispherePoint(vec3(rand1, rand2, rand3), (vWorldNormal)));
            vec3 color_inc = (uIntensity * max(BRDF(mat3(uVMatrix) * L, V, N, X, Y),0.0)  * vec3(texture(EnvMap, toSpherical(L))) * 2.0) / 16.0;
            if(NdotL){
              color_inc *= clamp(dot(N, mat3(uVMatrix) * L),0.0,1.0);
            }
            color += color_inc;
        }
    } else {
        vec3 L = mat3(uVMatrix) * normalize(uLightDirection);
        color = (uIntensity * max(BRDF(L, V, N, X, Y),0.0));
        if(NdotL){
          color *= clamp(dot(N, L),0.0,1.0);
        }
    }

    if (uHeatmap) color = jet(clamp(color.x/hdr_max,0.0,1.0)).xyz;

    float currentInfluence = 1.0/uTotalFrames;
    float previousInfluence = (uTotalFrames-1.0)/uTotalFrames;
    vec2 UV = ((vProjPosition.xy / vProjPosition.w) + 1.0) * .5;
    vColor = vec4(color * currentInfluence + texture(PrevFrame, UV).xyz * previousInfluence, 1.0);
    if (any(isnan(vColor))) vColor = vec4(color, 1.0);
}
