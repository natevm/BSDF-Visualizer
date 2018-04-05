#version 300 es

precision mediump float;

/* Uniforms */
uniform sampler2D EnvMap;

/* Varying */
in vec3 vCamPos;
in vec3 vUVW;

out vec4 vColor;

// Assumes radius = 1
#define PI 3.1415926535897932384626433832795
vec2 toSpherical(vec3 dir) {
    dir = normalize(dir);
    float u = atan(dir.z, dir.x) / (2.0 * PI) + .5;
    float v = asin(dir.y) / PI + .5;
    return vec2(u, 1.0 - v);
}

void main(void) {
    vColor = vec4(texture(EnvMap, toSpherical(vUVW - vCamPos)).xyz, 0.0);
}
