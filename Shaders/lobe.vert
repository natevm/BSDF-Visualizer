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

out vec3 vColor;
out vec4 world_normal;

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

//TODO: Disney's tool doesn't incorporate the dot product / cosine weight because
//that's not part of the BRDF, it's the "form factor" in the rendering equation.

//TODO: Disney's tool assumes BRDF returns a vec3? But I don't see where the color
//input is?

//L, V, N assumed to be unit vectors
float BRDF(vec3 L, vec3 V, vec3 N){
  //TODO: These should actually be uniforms.
  const float k_d = 0.7;
  const float k_s = 0.3;
  const float spec_power = 20.0;

  vec3 R = get_reflected(L, N);
  float spec_val = pow(max(dot(R,V),0.0), spec_power);
  float diffuse_val = max(0.0, dot(L,N));

  return k_d*diffuse_val + k_s*spec_val;
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
    //float shade = BRDF(u_l, normalize(p), u_n);
    p *= BRDF(u_l, normalize(p), u_n);
    p_U *= BRDF(u_l, normalize(p_U), u_n);
    p_D *= BRDF(u_l, normalize(p_D), u_n);
    p_L *= BRDF(u_l, normalize(p_L), u_n);
    p_R *= BRDF(u_l, normalize(p_R), u_n);

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
    world_normal = u_m * vec4(avg_model_normal,1);
}
