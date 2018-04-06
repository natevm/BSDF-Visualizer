# BSDF-Visualizer
Project for scientific visualization

## Using Glslify with shaders
[Glslify](https://github.com/glslify/glslify) is quite handy and I am currently
using it for our heatmap. Our glslify-enabled shaders are in `Shaders/glslify_raw`.
In order to work with these shaders:

0. Make sure glslify is set up correctly
  1. `npm install -g glslify` to install the CLI command.
  2. `npm install` to install local glslify dependencies
1. Edit the shader in `Shaders/glslify_raw`.
2. Run `preprocess_glslify_shaders.py`. This will generate (inlined) shaders and
place them under `Shaders/glslify_processed`. :warning: Do not edit the shaders under
`glslify_processed`. They will get overwritten by `preprocess_glslify_shaders.py`

### Disney
 * Analytical BRDFs were modified from Disney's [BRDF Explorer](https://www.disneyanimation.com/technology/brdf.html).
 * Compute tangent and bitangent vector function from [BRDF explorer](https://www.disneyanimation.com/technology/brdf.html).
 * See `DISNEY_LICENSE` at the root of this repository for a complete copy of their license.

## Sources Cited
 Code snippets from: <citation needed>

### Misc
 * https://tsherif.github.io/webgl2examples/triangle.html
 * https://webgl2fundamentals.org/
