shader_type canvas_item;
// Pixel pass: divide summed colour by summed weight, fill pinholes, snap to the palette with ordered dither.
// Where nothing was drawn it paints the sky, or the open sea out to the horizon.
uniform sampler2D col_tex : filter_nearest;
uniform vec3 pal[32];
uniform int pal_n = 28;
uniform vec3 bg = vec3(0.043, 0.039, 0.078);
uniform float dither = 1.0;
uniform bool raw = false;      // show the blended colour before palette snapping
uniform bool opaque = false;   // opaque mode: the view holds plain colour, alpha marks covered pixels
uniform int dbg = 0;
// ---- time of day: the same grade the splats get, applied to the palette ----
uniform vec3 tod_mul = vec3(1.0);
uniform float tod_desat = 0.0;
uniform float lights_on = 0.0;
// ---- sky and sea ----
uniform bool sky_on = false;
uniform mat3 cam_basis;        // camera right, up, back
uniform vec3 cam_pos;
uniform vec2 cam_tan;          // tan of half the field of view: x, y
uniform float sea_y = 0.0;
uniform float sky_t = 0.0;
uniform vec3 sun_dir = vec3(0.3, 0.8, 0.4);
uniform vec3 moon_dir = vec3(-0.3, -0.8, -0.4);
uniform vec3 zenith = vec3(0.16, 0.47, 0.93);
uniform vec3 horizon = vec3(0.62, 0.84, 0.98);
uniform vec3 cloud_lit = vec3(1.0);
uniform vec3 cloud_dark = vec3(0.78, 0.84, 0.94);
uniform vec3 sun_col = vec3(1.0, 0.96, 0.8);
uniform float stars = 0.0;
const float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
const vec3 W_NAVY = vec3(0.031, 0.173, 0.408);
const vec3 W_BLUE = vec3(0.078, 0.376, 0.588);

vec3 grade(vec3 c) { return mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))), tod_desat) * tod_mul; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { return 0.5 * noise(p) + 0.25 * noise(p * 2.03 + 7.1) + 0.125 * noise(p * 4.1 + 3.3) + 0.0625 * noise(p * 8.3 + 1.7); }

// the outline of land far across the water: other islands of the chain, and hills behind the town
float far_land(float az, out float kind) {
	float h = 0.0; kind = 0.0;
	float a;
	a = az - 0.55; float peak = 0.115 * exp(-a * a / 0.004) + 0.045 * exp(-a * a / 0.03);                 // the peak: tall and narrow
	a = az + 0.5; float fire = 0.07 * exp(-a * a / 0.02) * (1.0 - 0.35 * exp(-a * a / 0.0012)) + 0.02 * exp(-a * a / 0.09);   // the fire mountain: broad, with a notched top
	a = az - 1.55; float green = 0.028 * exp(-a * a / 0.12) * (0.85 + 0.15 * sin(az * 40.0));           // the green island: long and low
	a = az + 1.45; float crater = 0.04 * smoothstep(0.26, 0.2, abs(a)) * (0.9 + 0.1 * sin(az * 33.0));  // the crater: flat-topped
	float back = abs(az) > 1.9 ? (0.05 + 0.03 * sin(az * 3.0) + 0.02 * sin(az * 7.3 + 1.0) + 0.012 * sin(az * 17.0)) * smoothstep(1.9, 2.3, abs(az)) : 0.0;   // hills behind the town
	h = peak; kind = 1.0;
	if (fire > h) { h = fire; kind = 2.0; }
	if (green > h) { h = green; kind = 3.0; }
	if (crater > h) { h = crater; kind = 4.0; }
	if (back > h) { h = back; kind = 5.0; }
	h *= 0.5;
	return h;
}

vec3 sky_colour(vec3 d, ivec2 t) {
	float e = max(d.y, 0.0);
	vec3 c = mix(horizon, zenith, pow(e, 0.55));
	// stars
	if (stars > 0.01) {
		vec2 sp = d.xz / (abs(d.y) + 0.35) * 55.0; vec2 cell = floor(sp);
		float pick = hash(cell);
		if (pick > 0.965 && length(fract(sp) - 0.5) < 0.2) { c += vec3(0.9, 0.9, 1.0) * stars * (0.5 + 0.5 * sin(sky_t * (1.0 + pick * 3.0) + pick * 40.0)) * smoothstep(0.02, 0.2, e); }
	}
	// sun and moon
	float sd = dot(d, sun_dir);
	c += sun_col * 0.35 * pow(max(sd, 0.0), 24.0);
	if (sd > 0.9978) { c = sun_col; }
	float md = dot(d, moon_dir);
	if (md > 0.9984) { vec3 off = normalize(moon_dir + vec3(0.03, 0.012, 0.0)); c = dot(d, off) > 0.99865 ? c + vec3(0.05) : vec3(0.93, 0.95, 1.0); }
	// clouds: puffs on a flat layer, lit from the sun's side
	if (d.y > 0.015) {
		vec2 uv = d.xz / (d.y + 0.16) * 0.9 + vec2(sky_t * 0.006, sky_t * 0.002);
		float n = fbm(uv);
		float cover = smoothstep(0.52, 0.56, n) * smoothstep(0.015, 0.09, d.y);
		if (cover > 0.5) {
			float n2 = fbm(uv + normalize(sun_dir.xz + vec2(0.001)) * 0.12);
			vec3 cc = n > 0.62 ? (n2 < n ? cloud_lit : mix(cloud_lit, cloud_dark, 0.5)) : (n2 < n - 0.01 ? mix(cloud_lit, cloud_dark, 0.5) : cloud_dark);
			c = mix(c, cc, 0.94);
		}
	}
	// land far away, hazed toward the horizon colour
	float kind; float az = atan(d.x, d.z);
	float h = far_land(az, kind);
	if (d.y < h) {
		vec3 land = kind == 5.0 ? vec3(0.30, 0.50, 0.36) : (kind == 3.0 ? vec3(0.24, 0.44, 0.36) : vec3(0.30, 0.36, 0.48));
		if (kind == 1.0 && d.y > 0.041) { land = vec3(0.92, 0.95, 1.0); }                       // snow on the peak
		if (kind == 2.0 && d.y > 0.029 && lights_on > 0.3) { land = vec3(1.0, 0.45, 0.2) / max(tod_mul, vec3(0.05)); }   // the fire mountain glows at night
		c = mix(grade(land), horizon, kind == 5.0 ? 0.35 : 0.55);
	}
	return c;
}

vec3 sea_colour(vec3 d) {
	float dist = (cam_pos.y - sea_y) / max(-d.y, 1e-4);
	vec2 w = cam_pos.xz + d.xz * dist;
	if (w.y < 7.0) {
		// past the edge of the town the land carries on: plain green country, hazed with distance
		float patch = step(0.5, noise(w * 0.06));
		return mix(grade(mix(vec3(0.43, 0.71, 0.25), vec3(0.52, 0.79, 0.29), patch)), horizon, smoothstep(60.0, 700.0, dist) * 0.8);
	}
	vec3 c = grade(mix(W_NAVY, W_BLUE, smoothstep(40.0, 260.0, dist) * 0.7));
	// long glints toward the sun, and a path of light under it
	float band = sin(w.x * 0.13 + w.y * 0.31 + sky_t * 0.5) * sin(w.x * 0.07 - w.y * 0.19 - sky_t * 0.3);
	vec3 r = reflect(d, vec3(0.0, 1.0, 0.0));
	float glit = pow(max(dot(r, sun_dir), 0.0), 60.0) + 0.6 * pow(max(dot(r, moon_dir), 0.0), 90.0);
	float lines = step(0.93, fract(w.y * 0.35 + 0.4 * sin(w.x * 0.2 + sky_t * 0.4)) ) * step(0.2, band);
	c = mix(c, sun_col * max(tod_mul, vec3(0.5)), clamp(glit * 2.0 * step(0.45, fract(w.y * 0.9 + sin(w.x * 0.7 + sky_t)))  + 0.10 * lines * smoothstep(300.0, 30.0, dist), 0.0, 1.0));
	return mix(c, horizon, smoothstep(120.0, 900.0, dist) * 0.85);
}

vec4 fetch(ivec2 t, ivec2 res) {
	vec4 c = texelFetch(col_tex, clamp(t, ivec2(0), res - 1), 0);
	return opaque ? vec4(c.rgb * c.a, c.a) : c;   // soft blend: rgb is blended colour x coverage, alpha is coverage
}
void fragment() {
	ivec2 res = textureSize(col_tex, 0);
	ivec2 t = ivec2(floor(UV * vec2(res)));
	vec4 s = fetch(t, res);
	float lo = opaque ? 1e-3 : 2e-3, hi = lo * 6.0;
	float bb = (B[(t.x & 3) + 4 * (t.y & 3)] + 0.5) / 16.0;
	if (dbg == 1) { COLOR = vec4(s.rgb * 20.0, 1.0); }
	else if (dbg == 2) { COLOR = vec4(vec3(s.a * 4.0), 1.0); }
	else {
		if (s.a < lo) {
			vec4 a = fetch(t + ivec2(1, 0), res), b = fetch(t - ivec2(1, 0), res), e = fetch(t + ivec2(0, 1), res), g = fetch(t - ivec2(0, 1), res);
			if (step(hi, a.a) + step(hi, b.a) + step(hi, e.a) + step(hi, g.a) >= 2.0) { s = a + b + e + g; }
		}
		if (s.a < lo) {
			if (!sky_on) { COLOR = vec4(bg, 1.0); }
			else {
				vec2 ndc = (vec2(t) + 0.5) / vec2(res) * 2.0 - 1.0;
				vec3 d = normalize(cam_basis * vec3(ndc.x * cam_tan.x, -ndc.y * cam_tan.y, -1.0));
				vec3 c = d.y < 0.0 ? sea_colour(d) : sky_colour(d, t);
				// bands with ordered dither between them, so the sky is pixel art too
				COLOR = vec4(floor(c * 14.0 + bb) / 14.0, 1.0);
			}
		}
		else {
			vec3 c = s.rgb / s.a;
			if (raw) { COLOR = vec4(c, 1.0); }
			else {
				float th = mix(0.5, bb, dither * 0.45);
				float d1 = 1e9, d2 = 1e9; vec3 c1 = pal[0], c2 = pal[0];
				int variants = lights_on > 0.01 ? 3 : 1;
				for (int v = 0; v < variants; v++) {
					for (int i = 0; i < 32; i++) {
						if (i >= pal_n) { break; }
						// by day: the graded palette. at night also: the same colours as lantern light falls on them, and the two light colours themselves
						vec3 pc = grade(pal[i]);
						if (v > 0) { pc = i >= pal_n - 2 && v == 2 ? pal[i] : mix(pc, pal[i] * vec3(1.0, 0.82, 0.55), lights_on * 0.85 * (v == 1 ? 1.0 : 0.5)); }
						vec3 e2 = c - pc; float q = dot(e2 * e2, vec3(0.3, 0.59, 0.11));
						if (q < d1) { d2 = d1; c2 = c1; d1 = q; c1 = pc; } else if (q < d2) { d2 = q; c2 = pc; }
					}
				}
				vec3 ab = c2 - c1; float tt = clamp(dot(c - c1, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
				COLOR = vec4(tt > th ? c2 : c1, 1.0);
			}
		}
	}
}
