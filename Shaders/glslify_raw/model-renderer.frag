#version 300 es

precision mediump float;

uniform bool uHeatmap;
uniform float uIntensity;

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
//L points towards light.
//V points towards eye
//N is the normal
vec3 BRDF(vec3 L, vec3 V, vec3 N, vec3 X, vec3 Y){
    vec3 H = normalize(L + V);
    return vDiffuse * dot(N, L) + vSpecular * pow(dot(H, N), vSpecularExponent);
}

#pragma glslify: jet = require('glsl-colormap/jet')

void main(void) {
    float hdr_max = 2.0;
    vec3 V = -normalize(vPosition.xyz);
    vec3 L = mat3(uVMatrix) * normalize(uLightDirection);
    //vec3 H = normalize(L + V);
    vec3 N = normalize(vTransformedNormal);

    vec3 X; //eye sapce tangent
    vec3 Y; //eye space bitangent
    computeTangentVectors(N, X, Y);

    //vec3 V = -normalize(vModelSpacePosition.xyz);
    //vec3 L = normalize(uLightDirection);
    //vec3 N = normalize(modelSpaceNormal);

    vec3 color = uIntensity * BRDF(L, V, N, X, Y);

    //vec3 color = vDiffuse * dot(N, L) +
      //vSpecular * pow(dot(H, N), vSpecularExponent);

	vec4 pickPointView4 = inverse(uPickModelViewMatrix) * inversePMatrix * vec4(uPickPointNDC,1);
	vec3 pickPointView = vec3(pickPointView4.x/pickPointView4.w, pickPointView4.y/pickPointView4.w, pickPointView4.z/pickPointView4.w);
	if (length(pickPointView - vModelSpacePosition) < 0.5){
    color = mix(color, vec3(1,0,0), smoothstep(0.0, 1.0, 1.0-2.0*length(pickPointView - vModelSpacePosition)));
  }
  if (uHeatmap) {
    vColor = jet(clamp(color.x/hdr_max,0.0,1.0));
  } else {
    vColor = vec4(color,1);
  }
}
