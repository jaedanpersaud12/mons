shader_type spatial;
// Depth only: writes each splat's depth, pushed back a little, and leaves colour untouched (alpha 0), so the blend pass that follows can add onto a clean buffer.
render_mode unshaded, cull_disabled, skip_vertex_transform, depth_draw_always, blend_mix;

#include "splat.gdshaderinc"
void fragment() {
	vec2 s = splat_shape(POINT_COORD, FRAGCOORD.xy, VIEWPORT_SIZE, PROJECTION_MATRIX);
	if (s.x > 1.0) { discard; }
	ALBEDO = vec3(0.0);
	ALPHA = 0.0;
	DEPTH = splat_depth(PROJECTION_MATRIX, s.y - v_r * 1.2 - 0.02);
}
