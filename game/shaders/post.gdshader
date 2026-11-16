shader_type canvas_item;
// Pixel pass: divide summed colour by summed weight, fill pinholes, snap to the palette with ordered dither.
uniform sampler2D col_tex : filter_nearest;
uniform vec3 pal[32];
uniform int pal_n = 28;
uniform vec3 bg = vec3(0.043, 0.039, 0.078);
uniform float dither = 1.0;
uniform bool raw = false;      // show the blended colour before palette snapping
uniform bool opaque = false;   // opaque mode: the view holds plain colour, alpha marks covered pixels
uniform int dbg = 0;
const float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
vec4 fetch(ivec2 t, ivec2 res) {
	vec4 c = texelFetch(col_tex, clamp(t, ivec2(0), res - 1), 0);
	return opaque ? vec4(c.rgb * c.a, c.a) : c;   // soft blend: rgb is blended colour x coverage, alpha is coverage
}
void fragment() {
	ivec2 res = textureSize(col_tex, 0);
	ivec2 t = ivec2(floor(UV * vec2(res)));
	vec4 s = fetch(t, res);
	float lo = opaque ? 1e-3 : 2e-3, hi = lo * 6.0;
	if (dbg == 1) { COLOR = vec4(s.rgb * 20.0, 1.0); }
	else if (dbg == 2) { COLOR = vec4(vec3(s.a * 4.0), 1.0); }
	else {
		if (s.a < lo) {
			vec4 a = fetch(t + ivec2(1, 0), res), b = fetch(t - ivec2(1, 0), res), e = fetch(t + ivec2(0, 1), res), g = fetch(t - ivec2(0, 1), res);
			if (step(hi, a.a) + step(hi, b.a) + step(hi, e.a) + step(hi, g.a) >= 2.0) { s = a + b + e + g; }
		}
		if (s.a < lo) { COLOR = vec4(bg, 1.0); }
		else {
			vec3 c = s.rgb / s.a;
			if (raw) { COLOR = vec4(c, 1.0); }
			else {
				float bb = (B[(t.x & 3) + 4 * (t.y & 3)] + 0.5) / 16.0, th = mix(0.5, bb, dither * 0.45);
				float d1 = 1e9, d2 = 1e9; vec3 c1 = pal[0], c2 = pal[0];
				for (int i = 0; i < 32; i++) { if (i >= pal_n) { break; } vec3 e2 = c - pal[i]; float q = dot(e2 * e2, vec3(0.3, 0.59, 0.11)); if (q < d1) { d2 = d1; c2 = c1; d1 = q; c1 = pal[i]; } else if (q < d2) { d2 = q; c2 = pal[i]; } }
				vec3 ab = c2 - c1; float tt = clamp(dot(c - c1, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
				COLOR = vec4(tt > th ? c2 : c1, 1.0);
			}
		}
	}
}
