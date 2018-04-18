#version 300 es

precision mediump float;

/* Uniforms */
uniform sampler2D EnvMap;

/* Varying */
in vec3 vCamPos;
in vec3 vUVW;

uniform float uTheta;
uniform float uPhi;

out vec4 vColor;

// Assumes radius = 1
#define PI 3.1415926535897932384626433832795
vec2 toSpherical(vec3 dir) {
    dir = normalize(dir);
    float u = atan(dir.z, dir.x) / (2.0 * PI) + .5;
    float v = asin(dir.y) / PI + .5;
    return vec2(u, (1.0 - v));
}

mat4 rotationMatrix(vec3 axis, float angle)
{
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;

    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}

void main(void) {
    vec3 L = mat3(rotationMatrix(vec3(0.0,1.0,0.0), uPhi)) * (vUVW - vCamPos);
    vColor = vec4(texture(EnvMap, toSpherical(L)).xyz, 1.0);
}
