shader_type spatial;
// Blend pass: each splat is laid over what is already there with a soft-edged alpha, only where it lies close to the front surface (the prepass depth).
// The view is transparent, so rgb ends up as blended colour x coverage and alpha as coverage; the pixel pass divides one by the other.
render_mode unshaded, cull_disabled, skip_vertex_transform, depth_draw_never, blend_mix;
#define CREATURE
uniform float gain = 0.6;
#include "splat.gdshaderinc"
void fragment() {
	vec2 s = splat_shape(POINT_COORD, FRAGCOORD.xy, VIEWPORT_SIZE, PROJECTION_MATRIX);
	if (s.x > 1.0) { discard; }
	ALBEDO = v_col.rgb;
	ALPHA = (exp(-7.0 * s.x) + 0.006) * gain;
	DEPTH = splat_depth(PROJECTION_MATRIX, s.y);
}
