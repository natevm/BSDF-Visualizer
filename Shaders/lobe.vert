#version 300 es
#define M_PI 3.1415926535897932384626433832795

layout (location=0) in vec4 model_position;
layout (location=1) in vec3 color;
layout (location=2) in vec4 model_normal;
layout (location=3) in vec2 polar_coords;

uniform mat4 u_m;
uniform mat4 u_v;
uniform mat4 u_p;

uniform vec3 u_n;
uniform vec3 u_l;

uniform float u_delTheta;
uniform float u_delPhi;

//*************** START INLINED UNIFORMS ******************
// <INLINE_UNIFORMS_HERE>
//*************** END INLINED UNIFORMS ********************

out vec3 vColor;
out vec4 normal_eyecoords;
out vec4 pos_eyecoords;

vec3 polar_to_cartesian(float theta_deg, float phi_deg){
  float theta = (M_PI/180.0) * theta_deg;
  float phi = (M_PI/180.0) * phi_deg;
  return vec3(sin(theta)*cos(phi),sin(theta)*sin(phi),cos(theta));
}

//L and N are assumed to be unit vectors
vec3 get_reflected(vec3 L, vec3 N){
  vec3 L_plus_R = N * 2.0 * dot(L, N);
  return normalize(L_plus_R - L);
}

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

//L, V, N assumed to be unit vectors
//X, Y assumed to be (1, 0, 0) and (0, 1, 0), respectively

vec3 BRDF(vec3 L, vec3 V, vec3 N, vec3 X, vec3 Y){
  //TODO: These should actually be uniforms.
  const float k_d = 0.7;
  const float k_s = 0.3;
  const float spec_power = 20.0;

  vec3 R = get_reflected(L, N);
  float spec_val = pow(max(dot(R,V),0.0), spec_power);
  float diffuse_val = max(0.0, dot(L,N));

  return vec3(k_d*diffuse_val + k_s*spec_val);
}

//See https://en.wikipedia.org/wiki/Relative_luminance
float rgb_to_luminance(vec3 rgb_color){
  return 0.2126*rgb_color.r + 0.7152*rgb_color.g + 0.0722*rgb_color.b;
}

void main() {
    /*
    //FOR DEBUG OF UNIT SPHERE
    //Assumes our input model coordinates are on the unit sphere.
    vec3 polar_color = vec3(polar_coords.x/90.0,polar_coords.y/360.0,0);
    vColor = 0.99*polar_color + 0.01*color; //DEBUG ONLY
    */

    vColor = color;

    //TODO: should we be working with radians "natively"?
    float theta_deg = polar_coords.x;
    float phi_deg = polar_coords.y;

    //prior to scaling, p SHOULD BE the same as position as model_position
    vec3 p = polar_to_cartesian(theta_deg,phi_deg);
    vec3 p_U = polar_to_cartesian(theta_deg - u_delTheta,phi_deg);
    vec3 p_D = polar_to_cartesian(theta_deg + u_delTheta,phi_deg);
    vec3 p_L = polar_to_cartesian(theta_deg,phi_deg + u_delPhi);
    vec3 p_R = polar_to_cartesian(theta_deg,phi_deg - u_delPhi);

    //Scale points by the BRDF
    vec3 N = vec3(0,0,1);
    vec3 X; //eye sapce tangent
    vec3 Y; //eye space bitangent
    computeTangentVectors(N, X, Y);
    p *= rgb_to_luminance(BRDF(u_l, normalize(p), u_n, X, Y));
    p_U *= rgb_to_luminance(BRDF(u_l, normalize(p_U), u_n, X, Y));
    p_D *= rgb_to_luminance(BRDF(u_l, normalize(p_D), u_n, X, Y));
    p_L *= rgb_to_luminance(BRDF(u_l, normalize(p_L), u_n, X, Y));
    p_R *= rgb_to_luminance(BRDF(u_l, normalize(p_R), u_n, X, Y));

    vec3 v1 = p_R - p;
    vec3 v2 = p_U - p;
    vec3 v3 = p_L - p;
    vec3 v4 = p_D - p;

    vec3 n1 = normalize(cross(v2,v1));
    vec3 n2 = normalize(cross(v3,v2));
    vec3 n3 = normalize(cross(v4,v3));
    vec3 n4 = normalize(cross(v1,v4));

    vec3 avg_model_normal = normalize(n1 + n2 + n3 + n4);

    //gl_Position = u_p * u_v * u_m * model_position; //old
    gl_Position = u_p * u_v * u_m * vec4(p,1);

    //world_normal = u_m * model_normal;
    //world_normal = model_normal; //DEBUG ONLY.
    //world_normal = vec4(avg_model_normal,1); //DEBUG ONLY
    //world_normal = u_m * vec4(avg_model_normal,1);
    pos_eyecoords = u_v * u_m * vec4(p,1); //position, ends with 1.
    normal_eyecoords = u_v * u_m * vec4(avg_model_normal,0); //direction, ends with 0.
}
