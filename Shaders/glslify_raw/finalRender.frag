#version 300 es

precision mediump float;

/* Uniforms */
uniform sampler2D Tex;
uniform vec2 resolution;

/* Varying */
in vec2 vUV;

#define texture2D texture
#pragma glslify: fxaa = require(glsl-fxaa)

out vec4 vColor;
void main() {
	vec2 fragCoord = vUV * resolution;
	vColor = fxaa(Tex, fragCoord, resolution);
}