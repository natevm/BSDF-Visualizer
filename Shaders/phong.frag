#version 300 es
precision highp float;

//uniform vec3 u_world_light_pos;

float k_a = 0.1;
float k_s = 0.2;
float k_d = 0.7;
float vSpecularExponent = 100.0;

in vec3 vColor;
//in vec4 world_position;
in vec4 normal_eyecoords;
in vec4 pos_eyecoords;

out vec4 fragColor;

const vec3 light_eyecoords = vec3(0,0,0);
const vec3 eye_position = vec3(0,0,0);


void main() {
    vec3 N = normalize(normal_eyecoords.xyz);
    vec3 L = normalize(light_eyecoords - pos_eyecoords.xyz);
    vec3 V = normalize(eye_position - pos_eyecoords.xyz);
    vec3 H = normalize(L + V);
    float shade = k_a + k_d * clamp(dot(N, L),0.0,1.0) + k_s * pow(clamp(dot(H, N),0.0,1.0), vSpecularExponent);

    fragColor = vec4(vColor * shade,1); //alpha of 1
    //vec3 final_color = 0.01 * norm + 0.99 * vColor;
    //vec3 final_color = 0.99 * norm + 0.01 * vColor;
    //fragColor = vec4(normal_eyecoords.xyz, 1.0);
}
