#version 300 es
precision highp float;

//uniform vec3 u_world_light_pos; 

//float k_a = 0.1;
//float k_d = 0.9;

in vec3 vColor;
//in vec4 world_position; 
in vec4 world_normal; 

out vec4 fragColor;

void main() {
    vec3 norm = normalize(world_normal.xyz);
    //vec3 to_light = normalize((u_world_light_pos.xyz - world_position.xyz)); 
    //fragColor = k_a*vColor + k_d*dot(norm, to_light)*vColor;
    //vec3 final_color = 0.01 * norm + 0.99 * vColor;
    //vec3 final_color = 0.99 * norm + 0.01 * vColor;  
    fragColor = vec4(world_normal.xyz, 1.0); 
}
