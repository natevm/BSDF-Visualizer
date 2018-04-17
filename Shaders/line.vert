#version 300 es

layout (location=0) in vec4 position;
layout (location=1) in vec3 color;

uniform mat4 u_m;
uniform mat4 u_v;
uniform mat4 u_p;

out vec3 vColor;

void main() {
    vColor = color;
    gl_PointSize = 10.0;
    gl_Position = u_p * u_v * u_m * position;
}
