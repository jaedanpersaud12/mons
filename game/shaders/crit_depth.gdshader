shader_type spatial;
// Opaque mode: one pass, each splat writes its colour directly. Fastest, slightly harder edges.
render_mode unshaded, cull_disabled, skip_vertex_transform, depth_draw_always;
#define CREATURE
#include "splat.gdshaderinc"
void fragment() {
	vec2 s = splat_shape(POINT_COORD, FRAGCOORD.xy, VIEWPORT_SIZE, PROJECTION_MATRIX);
	if (s.x > 1.0) { discard; }
	ALBEDO = v_col.rgb;
	DEPTH = splat_depth(PROJECTION_MATRIX, s.y);
}
