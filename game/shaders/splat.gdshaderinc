// Splat renderer, ported from the browser build.
// Every splat is one point. Pass A writes depth only, pushed back a little. Pass B adds colour weighted by a soft falloff, so neighbours blend.
// A second viewport runs pass B with white instead of colour to collect the weights; the post shader divides one by the other.
uniform float wind_t = 0.0;
uniform float size_mul = 1.0;   // splats are enlarged when only part of them is drawn
uniform vec4 sh_a[4];   // contact shadows: x, z, ground y, yaw
uniform vec4 sh_b[4];   // radius x, radius z, strength
#ifdef CREATURE
uniform mat4 bones[16];
uniform int parents[16];   // each bone's parent: a splat blends between its bone and this one
uniform float snort = 9.0;
#endif
// ---- water ----
// The water is not drawn. Anything below the waterline inside the lake is tinted by how deep it is, so the bed and what stands on it show through.
uniform vec3 water_fx = vec3(1.0);            // see-through water on, caustics on, foam and glints on
uniform vec4 wader = vec4(0.0);               // player x, z, unused, 1 while standing in water
uniform vec4 pond = vec4(7.0, 6.0, 7.5, 5.0); // lake centre x, z and radii
uniform float pond_zone = 1.5;
uniform float water_y = -0.2;
uniform float water_t = 0.0;

float pond_r(vec2 w) { vec2 q = (w - pond.xy) / pond.zw; return dot(q, q); }

// how far the waterline has pulled back from its rest height at this spot (it breathes in and out)
float water_lap(vec2 w, float t) {
	return max(0.004, 0.034 + 0.028 * sin(t * 0.9 + w.x * 0.6 + w.y * 0.45) + 0.012 * sin(t * 1.7 + w.x * 1.9 - w.y * 1.3));
}

vec3 water_tint(vec3 c, vec3 p) {
	vec2 w = p.xz; float t = water_t;
	if (pond_r(w) > pond_zone) { return c; }
	float rest = water_y - p.y;                      // depth below the resting waterline
	if (rest <= 0.0) { return c; }
	float wd = rest - water_lap(w, t);               // depth below the waterline right now
	if (wd <= 0.0) { return c * mix(0.9, 0.74, smoothstep(0.0, 0.05, rest)); }   // just uncovered: wet
	if (water_fx.x < 0.5) {
		// the old look: a flat blue that hides everything
		return mix(vec3(0.525, 0.839, 0.824), vec3(0.184, 0.525, 0.678), clamp(wd / 0.38, 0.0, 1.0)) * (0.84 + 0.1 * sin(t * 2.1 + w.x * 3.1 + w.y * 2.3));
	}
	// Under water a thing keeps its own colour but the water's colour lies over it like a veil: thin at the surface, thicker with depth.
	// Mixing toward one colour (and not absorbing each channel) is what keeps a pink coral pink and a dark rock dark, so shapes stay readable.
	c.r *= exp(-0.5 * wd);                                   // red still fades first
	c *= 1.0 - 0.45 * smoothstep(0.9, 3.0, wd);              // and everything dims in deep water
	vec3 body = mix(vec3(0.20, 0.74, 0.80), vec3(0.02, 0.13, 0.40), smoothstep(0.35, 2.6, wd));
	float veil = 0.16 + 0.5 * (1.0 - exp(-wd * 0.8));
	vec3 col = mix(c, body, veil);
	// The surface: a net of light lines that sits at the same place whatever is under it, so it reads as lying on top.
	vec2 q = w * 2.6;
	float ca = sin(q.x * 1.3 + 1.4 * sin(q.y * 1.1 + t * 0.7) + t * 0.5) + sin(q.y * 1.5 + 1.4 * sin(q.x * 0.9 - t * 0.6) - t * 0.35) + sin((q.x + q.y) * 0.9 + 1.2 * sin((q.x - q.y) * 0.8 + t * 0.5));
	ca = pow(1.0 - abs(ca) / 3.0, 9.0) * water_fx.y;
	col += vec3(0.15, 0.19, 0.17) * ca * (0.3 + 0.7 * exp(-wd * 0.5)) * smoothstep(0.0, 0.08, wd);
	// slow light bands across the surface
	col *= 1.0 + 0.05 * sin(w.x * 1.1 + w.y * 0.7 + t * 0.8) * sin(w.x * 0.5 - w.y * 1.3 - t * 0.6);
	// rings around the player while wading
	if (wader.w > 0.5) {
		float r = length(w - wader.xy), ring = sin(r * 15.0 - t * 7.0) * (1.0 - smoothstep(0.25, 1.7, r)) * smoothstep(0.05, 0.3, r);
		col += vec3(0.2, 0.24, 0.24) * max(ring, 0.0);
	}
	return col;
}

varying flat vec4 v_col;
varying flat vec3 v_c;
varying flat vec3 v_n;
varying flat float v_r;
varying flat vec2 v_s;

void vertex() {
	vec3 p = VERTEX;
	vec4 c = CUSTOM1;
	float g = floor(CUSTOM0.y * 255.0 + 0.5), ph = CUSTOM0.w, size = CUSTOM0.z * 255.0 * 0.004, sw = CUSTOM0.x;
	bool kill = false;
#ifdef CREATURE
	{
		int l = int(g);
		float fx = floor(CUSTOM0.x * 255.0 + 0.5), wt = ph;
		sw = 0.0;
		if (fx > 191.5) { float a = fract(TIME * 0.28 + ph); p += vec3(sin(ph * 40.0 + a * 4.0) * 0.07 * a, a * 0.42, cos(ph * 33.0 + a * 3.0) * 0.07 * a); size *= (1.0 - a) * smoothstep(0.0, 0.15, a); c.rgb *= 1.0 - 0.5 * a; wt = 1.0; }
		else if (fx > 159.5) { float a = fract(TIME * 0.2 + ph), q = ph * 61.0; p += vec3(sin(q + a * 4.0) * 0.16 * a - 0.25 * a * a, a * 1.5, cos(q * 1.3 + a * 3.0) * 0.16 * a); size *= (0.5 + 2.2 * a) * smoothstep(1.0, 0.45, a) * smoothstep(0.0, 0.1, a); wt = 1.0; }
		else if (fx > 127.5) { float a = (snort - ph * 0.3) / 0.8; if (a < 0.0 || a > 1.0) { kill = true; } float sd = sign(p.x), q = ph * 61.0, e = 1.0 - (1.0 - a) * (1.0 - a); p += vec3(sd * (0.05 + 0.3 * e) + sin(q) * 0.1 * e, -0.07 * e + 0.2 * a * a + cos(q * 1.7) * 0.09 * e, 0.18 * e + sin(q * 2.3) * 0.1 * e); size *= (0.5 + 1.9 * a) * smoothstep(1.0, 0.5, a) * smoothstep(0.0, 0.08, a); wt = 1.0; }
		else if (fx > 99.5) { float h = (fx - 100.0) / 27.0; p += h * vec3(0.05 * sin(TIME * 1.1 + p.z * 5.0 + p.y * 3.0), 0.035 * sin(TIME * 1.4 + p.x * 6.0 + p.z * 4.0), 0.04 * sin(TIME * 0.9 + p.y * 5.0 + p.x * 3.0)); }
		else if (fx > 0.5) { float h = fx / 99.0, h2 = h * h; p.x += h2 * (0.06 * sin(TIME * 2.3 + p.y * 9.0) + 0.02 * sin(TIME * 4.1 + p.y * 19.0 + p.z * 6.0)); p.z += h2 * 0.05 * sin(TIME * 1.9 + p.y * 8.0 + 1.7); p.y += h * 0.04 * sin(TIME * 3.1 + p.x * 14.0 + p.z * 11.0); size *= 1.0 - 0.35 * h * (0.5 + 0.5 * sin(TIME * 3.7 + p.x * 25.0 + p.y * 17.0)); c.rgb *= 0.94 + 0.1 * sin(TIME * 2.6 + p.y * 12.0); }
		else if (c.a > 0.5) { c.rgb *= 0.93 + 0.07 * sin(TIME * 1.8 + p.x * 17.0 + p.z * 13.0); }
		vec3 q2 = (bones[l] * vec4(p, 1.0)).xyz;
		if (l > 0 && wt < 0.999) {
			q2 = mix((bones[parents[l]] * vec4(p, 1.0)).xyz, q2, wt);
		}
		p = q2;
	}
#else
	if (g == 5.0) {
		// The surface layer. Inside the lake these splats are only ever foam or glints; the rest of the time they are not drawn.
		float d = sw * sw * 3.0, t = water_t; vec2 w = p.xz;
		sw = 0.0;
		if (pond_r(w) > pond_zone) {
			// a puddle outside the lake: plain flat water
			c.rgb = mix(vec3(0.525, 0.839, 0.824), vec3(0.184, 0.525, 0.678), clamp(d / 0.38, 0.0, 1.0)) * (0.84 + 0.1 * sin(t * 2.1 + w.x * 3.1 + w.y * 2.3));
		} else {
			float s = d - water_lap(w, t), show = 0.0;
			if (water_fx.z > 0.5 && water_fx.x > 0.5) {
				// glints: a few splats flash white along the bright bands
				float band = sin(w.x * 1.1 + w.y * 0.7 + t * 0.8) * sin(w.x * 0.5 - w.y * 1.3 - t * 0.6);
				float pick = step(0.5, fract(ph * 91.7)), tw = fract(ph * 7.31 + t * 0.33);
				float gli = pick * smoothstep(0.0, 0.04, tw) * (1.0 - smoothstep(0.07, 0.13, tw)) * smoothstep(0.0, 0.5, band) * smoothstep(0.1, 0.24, d);
				// foam: a solid line at the waterline, a broken one trailing behind it
				float br = 0.5 + 0.5 * sin(w.x * 7.0 + w.y * 5.0 + t * 1.3) * sin(w.x * 3.1 - w.y * 6.3 - t * 0.9);
				float f1 = 1.0 - smoothstep(0.004, 0.034, abs(s - 0.012) + 0.012 * br);
				float f2 = (1.0 - smoothstep(0.0, 0.014, abs(s - 0.085 - 0.03 * sin(t * 0.6 + w.x * 0.8 + w.y * 0.5)))) * smoothstep(0.6, 0.85, br) * step(0.45, fract(ph * 53.3));
				show = max(gli, max(f1, f2));
				if (gli > max(f1, f2)) { size *= 0.4; }   // a glint is a pinprick, foam is a full splat
			}
			if (show < 0.5) { kill = true; }
			c.rgb = vec3(0.97, 0.99, 1.0);
		}
	}
	if (sw > 0.0) {
		float w = sin(wind_t * 1.5 + p.x * 0.9 + p.z * 0.7 + ph * 6.283) * 0.5 + sin(wind_t * 0.6 + p.x * 0.25) * 0.9;
		p.x += sw * w * 0.09; c.rgb *= 1.0 + sw * w * 0.07; p.z += sw * cos(wind_t * 1.2 + p.z * 0.8 + ph * 5.0) * 0.05; p.y += sw * sin(wind_t * 1.9 + ph * 9.0) * 0.015;
	}
	// refraction: things under the water shimmer a little, more the deeper they are
	if (g != 5.0 && water_fx.x > 0.5) {
		float uw = water_y - p.y;
		if (uw > 0.03 && pond_r(p.xz) < pond_zone) {
			float k = min(uw, 0.7) * 0.03;
			p.x += k * sin(water_t * 1.7 + p.z * 3.1 + p.x * 1.3); p.z += k * cos(water_t * 1.4 + p.x * 2.7 - p.z * 1.1);
		}
	}
	if (c.a < 0.5) {
		for (int i = 0; i < 4; i++) {
			if (sh_b[i].z > 0.0) {
				vec2 d = p.xz - sh_a[i].xy; float s = sin(sh_a[i].w), co = cos(sh_a[i].w), hh = p.y - sh_a[i].z;
				d = vec2(co * d.x - s * d.y, s * d.x + co * d.y) / sh_b[i].xy; float k = dot(d, d);
				if (k < 1.0 && hh < 0.75 && hh > -0.6) { c.rgb *= 1.0 - sh_b[i].z * (1.0 - smoothstep(0.1, 1.0, k)) * (1.0 - smoothstep(0.25, 0.75, hh)); }
			}
		}
	}
#endif
#ifdef CREATURE
	if (c.a < 0.5) { c.rgb = water_tint(c.rgb, p); }   // legs in the water
#else
	if (g != 5.0 && c.a < 0.5) { c.rgb = water_tint(c.rgb, p); }
#endif
	vec4 vc = MODELVIEW_MATRIX * vec4(p, 1.0);
	float R = 0.5 * size * size_mul;
	vec3 vn = vec3(0.0);
#ifndef CREATURE
	vec3 n3 = CUSTOM2.xyz;
	if (dot(n3, n3) > 0.2) {
		vn = normalize(mat3(MODELVIEW_MATRIX) * n3);
		vec3 v = normalize(-vc.xyz); float cs = dot(vn, v);
		if (cs < -0.15) { kill = true; }
		if (cs < 0.3) { vn = normalize(vn + v * (0.3 - cs) * 1.5); }
	}
	v_s = vec2(floor(CUSTOM2.w * 127.0 + 0.5), ph * 3.1416);
#else
	v_s = vec2(0.0);
#endif
	v_c = vc.xyz; v_n = vn; v_r = R; v_col = c;
	VERTEX = vc.xyz;
	POINT_SIZE = max(1.5, 2.0 * R * VIEWPORT_SIZE.y * 0.5 * abs(PROJECTION_MATRIX[1][1]) / max(0.01, -vc.z));
	POSITION = kill ? vec4(2.0, 2.0, 2.0, 1.0) : PROJECTION_MATRIX * vec4(vc.xyz, 1.0);   // once POSITION is written it must be written for every vertex
}

float splat_depth(mat4 proj, float zv) {
	vec4 cp = proj * vec4(0.0, 0.0, zv, 1.0);
	float nd = cp.z / cp.w;
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
	return nd * 0.5 + 0.5;
#else
	return nd;
#endif
}

// returns squared radius within the disc (above 1 = outside) and the view-space depth of this fragment on the disc
vec2 splat_shape(vec2 pc, vec2 frag, vec2 vp, mat4 proj) {
	float r2, zv;
	if (dot(v_n, v_n) < 0.5) {
		vec2 d = pc * 2.0 - 1.0;
		if (v_s.x == 1.0) { d.x *= 3.4; }
		else if (v_s.x == 2.0) { float a = v_s.y, s = sin(a), c = cos(a); d = vec2(c * d.x - s * d.y, (s * d.x + c * d.y) * 1.9); }
		r2 = dot(d, d); zv = v_c.z;
	} else {
		vec2 ndc = frag / vp * 2.0 - 1.0;
		vec3 dir = vec3(ndc.x / proj[0][0], ndc.y / proj[1][1], -1.0);
		float dn = dot(v_n, dir);
		if (abs(dn) < 1e-5) { return vec2(2.0, 0.0); }
		float t = dot(v_n, v_c) / dn;
		if (t <= 0.0) { return vec2(2.0, 0.0); }
		vec3 q = dir * t - v_c; r2 = dot(q, q) / (v_r * v_r); zv = -t;
	}
	return vec2(r2, zv);
}
