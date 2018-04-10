#version 300 es

precision mediump float;

/* Uniforms */
uniform sampler2D Tex;

/* Varying */
in vec2 vUV;

out vec4 vColor;

void main(void) {
    vColor = texture(Tex, vUV);
}
