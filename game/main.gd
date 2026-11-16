extends Node
# Port test: the meadow's ground and grass, the bull calf, and the pixel pass, drawn with the same splat method as the browser build.
#
# Layout
#   vp_col  : one low-resolution SubViewport that owns the 3D world. A depth prepass, then a blend pass that sums colour x weight into rgb and weight into alpha.
#   post    : a full-screen rectangle whose shader divides colour by weight, fills pinholes and snaps to the palette.

const LINES := 400            # pixel-art resolution: lines of height
const FOV := 24.0
const CB := 16                # bones per creature

var vp_col: SubViewport
var cam_col: Camera3D
var post_mat: ShaderMaterial
var world_mats: Array[ShaderMaterial] = []
var crit_mats: Array[ShaderMaterial] = []
var world_root: Node3D

var meta: Dictionary
var hgrid: PackedFloat32Array
var hg := {}

var cam_yaw := 0.55
var cam_pitch := 0.58
var cam_dist := 16.0
var cam_t := Vector3.ZERO
var follow := true
var wind_t := 0.0
var t_now := 0.0
var frame_n := 0
var shot_path := ""
var shot_frame := 40
var fps_label: Label
var dbg := 0
var auto_walk := 0.0
var force: PackedFloat64Array = []   # test hook: amt, stride place, air, facing
var simple := 0
var water_fx := Vector3(1, 1, 1)   # new water, caustics, foam and glints
var start_at := []

# ---- the calf ----
var calf := {}
# ---- the player ----
var hero_mats: Array = []
var hero_j := {}
var pl := {"x": 0.0, "z": 0.0, "y": 0.0, "yaw": 0.0, "vx": 0.0, "vz": 0.0, "vy": 0.0, "jy": 0.0, "phase": 0.0, "amt": 0.0, "rate": 0.0, "air": 0.0, "land": 0.0, "dyaw": 0.0}
var cam_dist_now := 18.0
# ---- speed settings ----
var detail := 0.5        # share of the world's splats drawn; the rest are skipped and the drawn ones enlarged to cover (the browser build does the same)
var blend := true        # soft blend (two views, two passes) or plain opaque splats (one view, one pass)
var extra_nodes: Array = []
var world_total := [0, 0]
var auto_detail := true
var ft_acc := 0.0
var ft_n := 0
var ft_hold := 0.0
var all_instances: Array = []
var wdata := {}

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="): shot_path = a.substr(7)
		if a.begins_with("--frames="): shot_frame = int(a.substr(9))
		if a.begins_with("--dist="): cam_dist = float(a.substr(7))
		if a.begins_with("--yaw="): cam_yaw = float(a.substr(6))
		if a.begins_with("--dbg="): dbg = int(a.substr(6))
		if a.begins_with("--auto="): auto_walk = float(a.substr(7))
		if a.begins_with("--pitch="): cam_pitch = float(a.substr(8))
		if a.begins_with("--detail="): detail = float(a.substr(9)); auto_detail = false
		if a == "--opaque": blend = false
		if a.begins_with("--pose="):
			for v in a.substr(7).split(","): force.append(float(v))
		if a.begins_with("--simple="): simple = int(a.substr(9))
		if a.begins_with("--at="):
			for v in a.substr(5).split(","): start_at.append(float(v))
		if a == "--oldwater": water_fx.x = 0.0
	var t0 := Time.get_ticks_msec()
	_setup_viewports()
	_load_world()
	_load_calf()
	_load_hero()
	if start_at.size() == 2:
		pl.x = start_at[0]; pl.z = start_at[1]; pl.y = height(pl.x, pl.z); cam_t = Vector3(pl.x, pl.y + 0.9, pl.z)
	_apply_blend()
	print("loaded in ", Time.get_ticks_msec() - t0, " ms, adapter: ", RenderingServer.get_video_adapter_name())

func _make_mat(path: String) -> ShaderMaterial:
	# Three shaders per kind of splat. Soft blend uses "prepass" (depth only) followed by "add" (weighted colour). Opaque mode uses "depth" alone.
	var pre := ShaderMaterial.new(); pre.shader = load("res://shaders/%s_prepass.gdshader" % path); pre.render_priority = -1
	var add := ShaderMaterial.new(); add.shader = load("res://shaders/%s_add.gdshader" % path); add.render_priority = 0
	var opq := ShaderMaterial.new(); opq.shader = load("res://shaders/%s_depth.gdshader" % path)
	pre.next_pass = add
	pre.set_meta("add", add); pre.set_meta("opq", opq)
	return pre

func _all(mat: ShaderMaterial) -> Array:
	return [mat, mat.get_meta("add"), mat.get_meta("opq")]

func _set_param(mats: Array, name: String, v: Variant) -> void:
	for mt in mats:
		for q in _all(mt): q.set_shader_parameter(name, v)

func _setup_viewports() -> void:
	var win := get_window().size
	var w := int(round(LINES * float(win.x) / float(win.y)))
	vp_col = SubViewport.new()
	vp_col.size = Vector2i(w, LINES)
	vp_col.use_hdr_2d = true                      # float buffer, so many overlapping splats can add up
	vp_col.transparent_bg = true                  # alpha collects the blend weights (or marks covered pixels in opaque mode)
	vp_col.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp_col.msaa_3d = Viewport.MSAA_DISABLED
	vp_col.own_world_3d = true
	add_child(vp_col)
	world_root = Node3D.new(); vp_col.add_child(world_root)
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_DISABLED
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	cam_col = Camera3D.new(); cam_col.fov = FOV; cam_col.environment = env; vp_col.add_child(cam_col)
	# the pixel pass
	var layer := CanvasLayer.new(); add_child(layer)
	var rect := ColorRect.new(); rect.set_anchors_preset(Control.PRESET_FULL_RECT); layer.add_child(rect)
	post_mat = ShaderMaterial.new(); post_mat.shader = load("res://shaders/post.gdshader")
	post_mat.set_shader_parameter("col_tex", vp_col.get_texture())
	post_mat.set_shader_parameter("dbg", dbg)
	rect.material = post_mat
	fps_label = Label.new(); fps_label.position = Vector2(12, 8); layer.add_child(fps_label)

func _points_mesh(pos: PackedVector3Array, misc: PackedFloat32Array, col: PackedFloat32Array, nrm: PackedFloat32Array) -> ArrayMesh:
	# misc = (sway or effect code, group or bone, size, phase or blend weight), col = rgb + glow flag, nrm = facing direction + shape code. All 0..1 (nrm -1..1).
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = pos
	arr[Mesh.ARRAY_CUSTOM0] = misc
	arr[Mesh.ARRAY_CUSTOM1] = col
	arr[Mesh.ARRAY_CUSTOM2] = nrm
	var flags := (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT) | (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM1_SHIFT) | (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM2_SHIFT)
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_POINTS, arr, [], {}, flags)
	return m

func _bytes_to_floats(b: PackedByteArray, signed: bool) -> PackedFloat32Array:
	# Four bytes per splat become four floats. Done through an Image so the conversion runs in native code instead of a script loop.
	if signed:
		for i in b.size(): b[i] = (b[i] + 128) & 255      # signed bytes: shift into 0..255 so the image step keeps their order
	var n := b.size() / 4
	var w := 2048
	var h := int(ceil(float(n) / w))
	b.resize(w * h * 4)
	var img := Image.create_from_data(w, h, false, Image.FORMAT_RGBA8, b)
	img.convert(Image.FORMAT_RGBAF)
	var f := img.get_data().to_float32_array()
	if signed:
		for i in n * 4: f[i] = (f[i] * 255.0 - 128.0) / 127.0
	return f

func _add_mesh(m: ArrayMesh, mat: ShaderMaterial, aabb: AABB) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = m
	mi.material_override = mat
	mi.custom_aabb = aabb
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world_root.add_child(mi)
	all_instances.append(mi)
	return mi

func _load_world() -> void:
	meta = JSON.parse_string(FileAccess.get_file_as_string("res://data/world.json"))
	var hgm: Dictionary = meta["hgrid"]
	hg = {"gx": int(hgm["gx"]), "gz": int(hgm["gz"]), "x0": float(hgm["x0"]), "z0": float(hgm["z0"]), "d": float(hgm["d"])}
	hgrid = PackedFloat32Array(hgm["h"])
	var pj: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/palette.json"))   # 28 colours fitted to the world, the player and the calf together
	var pal: Array = pj["pal"]
	var pv := PackedVector3Array()
	for i in range(0, pal.size(), 3): pv.append(Vector3(pal[i], pal[i + 1], pal[i + 2]))
	while pv.size() < 32: pv.append(Vector3.ZERO)
	post_mat.set_shader_parameter("pal", pv)
	post_mat.set_shader_parameter("pal_n", int(pj["cols"]))
	var bgc: Array = meta["bg"]
	post_mat.set_shader_parameter("bg", Vector3(bgc[0], bgc[1], bgc[2]))
	wdata = {"pos": FileAccess.get_file_as_bytes("res://data/world_pos.bin").to_float32_array(),
		"col": _bytes_to_floats(FileAccess.get_file_as_bytes("res://data/world_col.bin"), false),
		"misc": _bytes_to_floats(FileAccess.get_file_as_bytes("res://data/world_misc.bin"), false),
		"nrm": _bytes_to_floats(FileAccess.get_file_as_bytes("res://data/world_nrm.bin"), true)}
	world_mats = [_make_mat("world")]
	_build_world()

func _build_world() -> void:
	# Each map cell's splats are stored in shuffled order, so the first half of a cell is an even sample of it.
	# Every cell becomes two meshes: the first half (always drawn) and the second half (drawn only at full detail). Switching detail is instant.
	var fpos: PackedFloat32Array = wdata.pos
	for ch in meta["chunks"]:
		var s0 := int(ch["s"]); var c0 := int(ch["c"]); var h := maxi(1, c0 / 2)
		var mn: Array = ch["mn"]; var mx: Array = ch["mx"]
		var aabb := AABB(Vector3(mn[0], mn[1], mn[2]), Vector3(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]))
		for part in 2:
			var s := s0 + (0 if part == 0 else h); var c := h if part == 0 else c0 - h
			if c <= 0: continue
			var pos := PackedVector3Array(); pos.resize(c)
			for i in c:
				var j := (s + i) * 3
				pos[i] = Vector3(fpos[j], fpos[j + 1], fpos[j + 2])
			var mi := _add_mesh(_points_mesh(pos, wdata.misc.slice(s * 4, (s + c) * 4), wdata.col.slice(s * 4, (s + c) * 4), wdata.nrm.slice(s * 4, (s + c) * 4)), world_mats[0], aabb)
			if part == 1: extra_nodes.append(mi)
			world_total[part] += c
	wdata.clear()
	_apply_detail()

func _apply_detail() -> void:
	for nd in extra_nodes: nd.visible = detail > 0.75
	_set_param(world_mats, "size_mul", 1.0 if detail > 0.75 else sqrt(2.0))

func _apply_blend() -> void:
	# soft blend: depth prepass + weighted colour pass. Opaque: one pass.
	for mt in world_mats + crit_mats + hero_mats:
		var o: ShaderMaterial = mt.get_meta("opq")
		for nd in all_instances:
			if nd.material_override == mt or nd.material_override == o: nd.material_override = mt if blend else o
	post_mat.set_shader_parameter("opaque", not blend)

func _load_skinned(name: String) -> Dictionary:
	# splats with a bone index and a blend weight each; returns the metadata and the two materials (colour view, weight view)
	var M: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/%s.json" % name))
	var b := FileAccess.get_file_as_bytes("res://data/%s.bin" % name)
	var n := int(M["n"])
	var mn: Array = M["mn"]; var ext: Array = M["ext"]
	var pos := PackedVector3Array(); pos.resize(n)
	var misc := PackedFloat32Array(); misc.resize(n * 4)
	var nrm := PackedFloat32Array(); nrm.resize(n * 4)
	var col := PackedFloat32Array(); col.resize(n * 4)
	var sz := clampi(int(round(float(M["diam"]) / 0.004)), 1, 255) / 255.0
	for i in n:
		pos[i] = Vector3(mn[0] + b.decode_u16(i * 6) / 65535.0 * ext[0], mn[1] + b.decode_u16(i * 6 + 2) / 65535.0 * ext[1], mn[2] + b.decode_u16(i * 6 + 4) / 65535.0 * ext[2])
		var k := n * 10 + i * 3
		misc[i * 4] = b[k + 2] / 255.0; misc[i * 4 + 1] = b[k] / 255.0; misc[i * 4 + 2] = sz; misc[i * 4 + 3] = b[k + 1] / 255.0
		for q in 4: col[i * 4 + q] = b[n * 6 + i * 4 + q] / 255.0
	var mats: Array[ShaderMaterial] = [_make_mat("crit")]
	var par := PackedInt32Array(M.get("parents", [0, 0, 0, 0, 14, 14, 2, 3, 4, 5, 14, 10, 1, 1, 0, 0]))
	_set_param(mats, "parents", par)
	_add_mesh(_points_mesh(pos, misc, col, nrm), mats[0], AABB(Vector3(-200, -50, -200), Vector3(400, 100, 400)))
	print(name, " splats: ", n)
	return {"M": M, "mats": mats}

func _set_bones(mats: Array, B: Array) -> void:
	var arr: Array[Projection] = []
	for k in CB: arr.append(Projection(B[k]))
	_set_param(mats, "bones", arr)

func _load_calf() -> void:
	var r := _load_skinned("calf")
	crit_mats = r.mats
	var start: Dictionary = meta["crit"][0]
	calf = {"M": r.M, "x": float(start["x"]), "z": float(start["z"]), "hx": float(start["x"]), "hz": float(start["z"]), "y": 0.0, "yaw": 1.0, "phase": 0.0, "amt": 0.0, "v": 0.0, "w": 0.0,
		"t": 1.5, "mode": "idle", "tx": 0.0, "tz": 0.0, "gz": 0.0, "sp": 0.0, "sr": 0.0, "wp": 0.0, "seed": 3.7, "aware": 0.0, "look": 0.0}

func _load_hero() -> void:
	var r := _load_skinned("hero")
	hero_mats = r.mats; hero_j = r.M["joints"]

func height(x: float, z: float) -> float:
	var fx: float = clampf((x - hg.x0) / hg.d, 0.0, hg.gx - 1.001); var fz: float = clampf((z - hg.z0) / hg.d, 0.0, hg.gz - 1.001)
	var i := int(fx); var k := int(fz); var u := fx - i; var v := fz - k
	var a := hgrid[i + hg.gx * k]; var b := hgrid[i + 1 + hg.gx * k]; var c := hgrid[i + hg.gx * (k + 1)]; var d := hgrid[i + 1 + hg.gx * (k + 1)]
	return lerpf(lerpf(a, b, u), lerpf(c, d, u), v)

# ---- behaviour: wander, graze, idle. A cut-down port of the browser version ----
func _step_calf(dt: float) -> void:
	var c := calf
	c.t -= dt
	var want := 0.0; var tyaw: float = c.yaw
	var dxp: float = pl.x - c.x; var dzp: float = pl.z - c.z; var dp := Vector2(dxp, dzp).length(); var to_p := atan2(dxp, dzp)
	var seen := dp < 4.2
	c.aware += ((1.0 if seen else 0.0) - c.aware) * minf(1.0, dt * (1.5 if seen else 0.45))
	if c.aware > 0.55:
		c.mode = "watch"; tyaw = to_p
		if dp > 1.75: want = 0.85
	elif c.mode == "watch":
		c.mode = "idle"; c.t = 1.0 + randf() * 2.0
	elif c.mode == "walk":
		var dx: float = c.tx - c.x; var dz: float = c.tz - c.z
		if Vector2(dx, dz).length() < 0.3 or c.t <= 0.0:
			c.mode = "graze" if randf() < 0.4 else "idle"; c.t = 2.0 + randf() * 4.0
		else:
			want = 0.85; tyaw = atan2(dx, dz)
	elif c.t <= 0.0:
		var a := randf() * TAU; var r := 1.2 + randf() * 3.5
		c.tx = c.hx + cos(a) * r; c.tz = c.hz + sin(a) * r; c.mode = "walk"; c.t = 10.0
	var da: float = wrapf(tyaw - c.yaw, -PI, PI)
	var dy: float = clampf(da * minf(1.0, dt * 4.0), -dt * 3.0, dt * 3.0)
	c.yaw += dy
	c.w += (dy / maxf(dt, 0.001) - c.w) * minf(1.0, dt * 7.0)
	c.v += (want * smoothstep(0.55, 0.95, cos(da)) - c.v) * minf(1.0, dt * (2.2 if want > 0.0 else 4.0))
	if c.v > 0.02:
		var nx: float = c.x + sin(c.yaw) * c.v * dt; var nz: float = c.z + cos(c.yaw) * c.v * dt
		if height(nx, nz) > float(meta["water"]) + 0.04 and Vector2(nx - pl.x, nz - pl.z).length() > 0.74: c.x = nx; c.z = nz
		else: c.t = 0.0
	var L: float = c.M["hip"][0][1]
	var stride := 2.0 * L * sin(0.6) / 0.5
	c.amt += (minf(1.0, c.v / 0.85) - c.amt) * minf(1.0, dt * 6.0)
	c.phase += dt * c.v / stride
	c.gz += ((1.0 if c.mode == "graze" else 0.0) - c.gz) * minf(1.0, dt * 2.0)
	var lk := clampf(wrapf(to_p - c.yaw, -PI, PI), -1.05, 1.05) * minf(1.0, c.aware * 1.6) if c.aware > 0.2 else 0.0
	c.look += (lk - c.look) * minf(1.0, dt * 4.5)
	if dp < 0.72 and dp > 0.0001: pl.x = c.x + dxp / dp * 0.72; pl.z = c.z + dzp / dp * 0.72   # solid: the player is pushed out

func _joint(par: Transform3D, p: Array, rx: float, ry: float, rz: float) -> Transform3D:
	var pv := Vector3(p[0], p[1], p[2])
	var r := Basis(Vector3.UP, ry) * Basis(Vector3.RIGHT, rx) * Basis(Vector3.BACK, rz)
	return par * Transform3D(Basis.IDENTITY, pv) * Transform3D(r, Vector3.ZERO) * Transform3D(Basis.IDENTITY, -pv)

func _drift(t: float, s: float) -> float:
	return sin(t + s) * 0.5 + sin(t * 0.37 + s * 2.1) * 0.3 + sin(t * 0.131 + s * 5.3) * 0.2

func _leg(cc: float, a: float) -> Vector2:
	const ST := 0.5; const F := 0.6; const K := 1.1
	if cc < ST:
		var u := cc / ST
		return Vector2(a * F * (2.0 * u - 1.0), a * 0.1 * sin(u * PI))
	var u2 := (cc - ST) / (1.0 - ST); var e := u2 * u2 * (3.0 - 2.0 * u2)
	return Vector2(a * F * (1.0 - 2.0 * e) - a * 0.14 * sin(u2 * PI), a * K * sin(PI * pow(u2, 0.75)))

func _pose_calf(t: float) -> void:
	var c := calf; var M: Dictionary = c.M
	var sy := sin(c.yaw); var cy := cos(c.yaw)
	c.y = height(c.x, c.z)
	var dl: float = M["len"] * 0.3; var dw: float = M["wid"] * 0.25
	var hf := height(c.x + sy * dl, c.z + cy * dl); var hb := height(c.x - sy * dl, c.z - cy * dl)
	var hl := height(c.x + cy * dw, c.z - sy * dw); var hr := height(c.x - cy * dw, c.z + sy * dw)
	c.sp += (atan2(hb - hf, 2.0 * dl) - c.sp) * 0.12; c.sr += (atan2(hl - hr, 2.0 * dw) - c.sr) * 0.12
	c.y = maxf(c.y, (hf + hb) * 0.5)
	var a: float = c.amt; var s: float = c.seed; var cyc := fposmod(c.phase, 1.0); var gz: float = c.gz
	var breath := sin(t * 1.5 + s) + 0.3 * sin(t * 0.4 + s * 2.0)
	var calm := (1.0 - a) * (1.0 - gz)
	var bob := a * 0.03 * (0.5 - 0.5 * cos(2.0 * TAU * cyc)) + 0.004 * breath
	var dyn := a * 0.022 * sin(2.0 * TAU * cyc + 1.0) + gz * 0.03
	var roll_d := a * 0.03 * 0.6 * sin(TAU * cyc) - clampf(c.w, -2.5, 2.5) * 0.04 * (a + 0.35) + calm * 0.014 * _drift(t * 0.45, s)
	var root := Transform3D(Basis(Vector3.UP, c.yaw) * Basis(Vector3.RIGHT, dyn + c.sp) * Basis(Vector3.BACK, roll_d + c.sr) * Basis.from_scale(Vector3(1.0 + 0.006 * breath, 1.0 + 0.011 * breath, 1.0)), Vector3(c.x, c.y + bob, c.z))
	var B: Array[Transform3D] = []; B.resize(CB)
	B[0] = root
	B[14] = _joint(root, M["pelP"], 0.0, -clampf(c.w, -2.5, 2.5) * 0.11 + a * 0.05 * sin(TAU * cyc + PI), -a * 0.03 * sin(TAU * cyc + 0.5) + calm * 0.02 * _drift(t * 0.31, s + 11.0))
	var hx := gz * (0.42 + 0.04 * sin(t * 3.1 + s)) + a * 0.055 * sin(2.0 * TAU * cyc + 0.5) + 0.012 * breath + calm * 0.03 * _drift(t * 0.4, s + 3.0)
	var hy: float = calm * 0.25 * _drift(t * 0.5, s) * (1.0 - c.aware) + clampf(c.w * 0.28, -0.5, 0.5) + gz * 0.07 * sin(t * 2.3 + s) + c.look
	B[1] = _joint(root, M["neck"], hx, hy, calm * 0.02 * _drift(t * 0.3, s + 7.0))
	var off := [0.0, 0.5, 0.5, 0.0]
	for k in 4:
		var lg := _leg(fposmod(cyc + off[k], 1.0), a)
		var H: Array = M["hip"][k]; var Kn: Array = M["knee"][k]
		var phi := atan2(H[2] - Kn[2], H[1] - Kn[1]); var Lr: float = H[1] / cos(phi)
		var lift := maxf(0.0, Lr * (cos(phi + lg.x) - cos(phi))) + maxf(0.0, dyn * H[2] - bob)
		var par: Transform3D = root if k < 2 else B[14]
		var up := _joint(par * Transform3D(Basis.IDENTITY, Vector3(0, lift, 0)), H, lg.x, 0.0, 0.0)
		B[2 + k] = up; B[6 + k] = _joint(up, Kn, maxf(0.0, lg.y), 0.0, 0.0)
	var happy := clampf(c.aware * 1.2 - 0.3, 0.0, 1.0)
	var wa := lerpf(0.1 + 0.22 * maxf(0.0, _drift(t * 0.33, s + 1.0)), 0.7, happy)
	c.wp += lerpf(2.3, 11.5, happy) * get_process_delta_time()
	B[10] = _joint(B[14], M["tailP"], 0.08 * _drift(t * 0.8, s + 4.0) - a * 0.15, wa * sin(c.wp) + a * 0.2 * sin(TAU * cyc), 0.0)
	B[11] = _joint(B[10], M["tailP2"], 0.1 * _drift(t * 0.8, s + 4.6), wa * 0.9 * sin(c.wp - 0.9), 0.0)
	var ev := 0.05 * _drift(t * 1.1, s + 9.0) - a * 0.24 * sin(2.0 * TAU * cyc - 0.9) - gz * 0.2 + 0.45 * pow(maxf(0.0, sin(t * 0.83 + s * 3.0)), 40.0)
	B[12] = _joint(B[1], M["earP"][0], 0.0, 0.0, ev); B[13] = _joint(B[1], M["earP"][1], 0.0, 0.0, -ev)
	B[15] = root
	_set_bones(crit_mats, B)
	# soft shadow under the calf
	var sa: Array[Vector4] = [Vector4(c.x - sy * M["len"] * 0.04, c.z - cy * M["len"] * 0.04, c.y, c.yaw), Vector4(pl.x, pl.z, pl.y, pl.yaw), Vector4(), Vector4()]
	var sb: Array[Vector4] = [Vector4(M["wid"] * 0.4, M["len"] * 0.44, 0.45, 0), Vector4(0.36 / (1.0 + pl.jy * 0.4), 0.3 / (1.0 + pl.jy * 0.4), 0.42 / (1.0 + pl.jy * 1.5), 0), Vector4(), Vector4()]
	_set_param(world_mats, "sh_a", sa); _set_param(world_mats, "sh_b", sb)

func _process(dt: float) -> void:
	dt = minf(dt, 0.1); t_now += dt; wind_t += dt; frame_n += 1
	var mv := Vector2(Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_up", "ui_down"))
	if Input.is_key_pressed(KEY_A): mv.x -= 1.0
	if Input.is_key_pressed(KEY_D): mv.x += 1.0
	if Input.is_key_pressed(KEY_W): mv.y -= 1.0
	if Input.is_key_pressed(KEY_S): mv.y += 1.0
	if auto_walk > 0.0: mv = Vector2(sin(t_now * 0.5), cos(t_now * 0.5))
	var mx := cos(cam_yaw) * mv.x + sin(cam_yaw) * mv.y; var mz := -sin(cam_yaw) * mv.x + cos(cam_yaw) * mv.y
	_step_player(dt, mx, mz, Input.is_key_pressed(KEY_SHIFT) or auto_walk > 1.0, Input.is_key_pressed(KEY_SPACE))
	if force.size() == 4: pl.amt = force[0]; pl.phase = force[1] * TAU; pl.air = force[2]; pl.jy = force[2] * 0.5; pl.yaw = force[3]; pl.vx = 0.0; pl.vz = 0.0
	_step_calf(dt); _pose_calf(t_now); _pose_hero(t_now)
	_set_param(world_mats, "wind_t", wind_t)
	_set_param(world_mats, "water_fx", water_fx)
	_set_param(world_mats, "wader", Vector4(pl.x, pl.z, 0.0, 1.0 if height(pl.x, pl.z) < float(meta["water"]) + 0.02 and pl.jy < 0.05 else 0.0))
	# camera: follows the player with a little lead, eases to a stop, pulls back when running. Q and E turn, the wheel zooms
	if Input.is_key_pressed(KEY_Q): cam_yaw -= dt * 1.6
	if Input.is_key_pressed(KEY_E): cam_yaw += dt * 1.6
	var k := 1.0 - exp(-dt * 4.5); var spd := Vector2(pl.vx, pl.vz).length()
	cam_t.x += (pl.x + pl.vx * 0.32 - cam_t.x) * k; cam_t.z += (pl.z + pl.vz * 0.32 - cam_t.z) * k; cam_t.y += (pl.y + 0.9 - cam_t.y) * k
	cam_dist_now += (cam_dist + spd * 0.55 - cam_dist_now) * (1.0 - exp(-dt * 2.5))
	var cp := cos(cam_pitch)
	var eye := cam_t + Vector3(sin(cam_yaw) * cp, sin(cam_pitch), cos(cam_yaw) * cp) * cam_dist_now
	cam_col.near = 1.5; cam_col.far = cam_dist_now + 70.0
	cam_col.look_at_from_position(eye, cam_t, Vector3.UP)
	# frame-time watch: if the game cannot hold 55 fps at full detail it drops to half; it only climbs back with clear headroom
	ft_acc += dt; ft_n += 1; ft_hold = maxf(0.0, ft_hold - dt)
	if ft_n >= 30:
		var fps := ft_n / ft_acc; ft_acc = 0.0; ft_n = 0
		if auto_detail and ft_hold <= 0.0:
			if fps < 55.0 and detail > 0.75: detail = 0.5; _apply_detail(); ft_hold = 8.0
			elif fps > 110.0 and detail < 0.75: detail = 1.0; _apply_detail(); ft_hold = 8.0
		var drawn: int = world_total[0] + (world_total[1] if detail > 0.75 else 0)
		fps_label.text = "%d fps  %.1f ms   %s detail%s   %s   %.2fM world splats   %d draw calls\n1/2 detail   G auto detail   B blend   P palette   3 new water   4 caustics   5 foam   WASD walk   Shift run   Space jump   Q/E turn" % [
			Engine.get_frames_per_second(), 1000.0 / maxf(fps, 0.01), "full" if detail > 0.75 else "half", " (auto)" if auto_detail else "", "soft blend" if blend else "opaque", drawn / 1000000.0,
			RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)]
	if shot_path != "" and frame_n == shot_frame:
		get_viewport().get_texture().get_image().save_png(shot_path)
		print("shot saved ", shot_path)
		get_tree().quit()

func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo:
		if e.keycode == KEY_B: blend = not blend; _apply_blend()
		if e.keycode == KEY_1: detail = 0.5; auto_detail = false; _apply_detail()
		if e.keycode == KEY_2: detail = 1.0; auto_detail = false; _apply_detail()
		if e.keycode == KEY_G: auto_detail = not auto_detail
		if e.keycode == KEY_P: post_mat.set_shader_parameter("raw", not post_mat.get_shader_parameter("raw"))
		if e.keycode == KEY_3: water_fx.x = 1.0 - water_fx.x
		if e.keycode == KEY_4: water_fx.y = 1.0 - water_fx.y
		if e.keycode == KEY_5: water_fx.z = 1.0 - water_fx.z
	if e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_WHEEL_UP: cam_dist = maxf(5.0, cam_dist - 1.0)
		if e.button_index == MOUSE_BUTTON_WHEEL_DOWN: cam_dist = minf(40.0, cam_dist + 1.0)

# ---- the player: movement and a keyframed skeleton, ported from the browser build ----
const QRT := [[0, .55], [.08, .35], [.2, -.35], [.28, -.7], [.38, -.6], [.5, -.2], [.6, .4], [.72, .95], [.86, .85]]
const QRK := [[0, .25], [.08, .9], [.2, .12], [.28, .1], [.38, .9], [.5, 1.6], [.6, 1.75], [.72, 1.25], [.86, .5]]
const QRH := [[0, -.03], [.08, -.1], [.2, -.03], [.27, .04], [.39, .15], [.5, -.03], [.58, -.1], [.7, -.03], [.77, .04], [.89, .15]]
const QWT := [[0, .45], [.25, 0], [.5, -.45], [.62, -.25], [.76, .25], [.9, .52]]
const QWK := [[0, .08], [.07, .3], [.25, .1], [.45, .25], [.6, .85], [.75, .95], [.9, .25]]
const QWH := [[0, -.025], [.07, -.05], [.25, 0], [.37, .035], [.5, -.025], [.57, -.05], [.75, 0], [.87, .035]]

func _kf(K: Array, c: float) -> float:
	# value at place c (0..1) in a looping set of keys, on a smooth curve through them
	var n := K.size(); var i := n - 1
	for k in n:
		if K[k][0] <= c: i = k
	var g := func(k: int) -> Vector2:
		var q := posmod(k, n)
		return Vector2(K[q][0] + floorf(float(k) / n), K[q][1])
	var a: Vector2 = g.call(i - 1); var b: Vector2 = g.call(i); var d: Vector2 = g.call(i + 1); var e: Vector2 = g.call(i + 2)
	var u := (c - b.x) / (d.x - b.x); var m0 := (d.y - a.y) / (d.x - a.x) * (d.x - b.x); var m1 := (e.y - b.y) / (e.x - b.x) * (d.x - b.x)
	var u2 := u * u; var u3 := u2 * u
	return (2 * u3 - 3 * u2 + 1) * b.y + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * d.y + (u3 - u2) * m1

func _blocked(x: float, z: float) -> bool:
	return height(x, z) < float(meta["water"]) - 0.3 or pow(absf(x / 24.0), 3.2) + pow(absf(z / 20.0), 3.2) > 0.9

func _step_player(dt: float, mx: float, mz: float, run: bool, jump: bool) -> void:
	dt = maxf(dt, 0.001)
	var l := Vector2(mx, mz).length(); var top := 5.8 if run else 3.5
	var tx := 0.0; var tz := 0.0
	if l > 0.0001: tx = mx / l * top; tz = mz / l * top
	# ease toward the wanted velocity: quick to start, a short slide to stop
	var dv := Vector2(tx - pl.vx, tz - pl.vz); var sv := (26.0 if l > 0.0001 else 20.0) * dt
	if dv.length() <= sv: pl.vx = tx; pl.vz = tz
	else: dv = dv.normalized() * sv; pl.vx += dv.x; pl.vz += dv.y
	var nx: float = pl.x + pl.vx * dt; var nz: float = pl.z + pl.vz * dt
	if _blocked(nx, nz):
		if not _blocked(nx, pl.z): nz = pl.z
		elif not _blocked(pl.x, nz): nx = pl.x
		else: nx = pl.x; nz = pl.z
	pl.vx = (nx - pl.x) / dt; pl.vz = (nz - pl.z) / dt; pl.x = nx; pl.z = nz
	var sp := Vector2(pl.vx, pl.vz).length()
	var dy := 0.0
	if sp > 0.3: dy = wrapf(atan2(pl.vx, pl.vz) - pl.yaw, -PI, PI) * minf(1.0, dt * 13.0); pl.yaw += dy
	pl.dyaw += (dy / dt - pl.dyaw) * minf(1.0, dt * 4.0)
	pl.y = height(pl.x, pl.z)
	if jump and pl.jy <= 0.0: pl.vy = 5.4
	var was: bool = pl.jy > 0.0
	pl.vy -= 17.0 * dt; pl.jy += pl.vy * dt
	if pl.jy <= 0.0:
		pl.jy = 0.0; pl.vy = 0.0
		if was: pl.land = 1.0
	pl.air += ((1.0 if pl.jy > 0.02 else 0.0) - pl.air) * minf(1.0, dt * 16.0)
	pl.land = maxf(0.0, pl.land - dt / 0.26)
	pl.amt += (minf(1.4, sp / 3.5) - pl.amt) * minf(1.0, dt * 10.0)
	# shorter legs than the old hand-built hero, so the stride turns over a little faster for the same speed
	pl.rate += (lerpf(minf(sp, 3.6) * 3.2, 12.0, clampf((sp - 3.6) / 2.0, 0.0, 1.0)) - pl.rate) * minf(1.0, dt * 9.0)
	pl.phase += dt * pl.rate * (0.3 if pl.jy > 0.0 else 1.0)

func _jr(par: Transform3D, p: Array, sx: float, rot: Basis) -> Transform3D:
	# rotate about a joint; sx mirrors the joint position for the right side
	var pv := Vector3(p[0] * sx, p[1], p[2])
	return par * Transform3D(Basis.IDENTITY, pv) * Transform3D(rot, Vector3.ZERO) * Transform3D(Basis.IDENTITY, -pv)

func _pose_hero(t: float) -> void:
	var J := hero_j
	var m: float = pl.amt; var w := minf(1.0, m); var run := clampf((m - 1.0) / 0.4, 0.0, 1.0); var ph: float = pl.phase
	var air: float = pl.air; var ld: float = pl.land * pl.land; var idle := 1.0 - w
	# c0 is the place in the stride (0 = left foot strikes the ground); the right leg runs half a cycle behind
	var c0 := fposmod(ph / TAU, 1.0); var c1 := fposmod(c0 + 0.5, 1.0); var A := w * (0.48 + 0.3 * run)
	var fL := w * lerpf(_kf(QWT, c0), _kf(QRT, c0), run); var fR := w * lerpf(_kf(QWT, c1), _kf(QRT, c1), run)
	var kL := w * lerpf(_kf(QWK, c0), _kf(QRK, c0), run); var kR := w * lerpf(_kf(QWK, c1), _kf(QRK, c1), run)
	# arms swing opposite the legs: widest at foot strike when walking, at the top of the airborne phase when running, elbows bent
	var aL := w * lerpf(-0.55 * cos(TAU * c0), 0.95 * cos(TAU * (c0 - 0.4)), run); var aR := w * lerpf(-0.55 * cos(TAU * c1), 0.95 * cos(TAU * (c1 - 0.4)), run)
	var eL := 0.14 + w * lerpf(0.32 - 0.2 * cos(TAU * c0), 1.35 + 0.28 * cos(TAU * (c0 - 0.4)), run); var eR := 0.14 + w * lerpf(0.32 - 0.2 * cos(TAU * c1), 1.35 + 0.28 * cos(TAU * (c1 - 0.4)), run)
	var ab := 0.05 + 0.04 * run + idle * 0.015 * sin(t * 1.8)
	var hgt := lerpf(_kf(QWH, c0), _kf(QRH, c0), run)
	var lean := w * (0.05 + 0.2 * run) - w * run * 0.25 * hgt; var bob := w * hgt - idle * 0.006 * (1.0 + sin(t * 1.8))
	var sway := w * 0.012 * cos(TAU * c0); var twist := w * (0.12 + 0.07 * run) * cos(TAU * (c0 - 0.78 * run))
	# in the air the knees tuck unevenly and the arms lift; landing is a quick squash
	fL = lerpf(fL, 0.75, air); kL = lerpf(kL, 1.25, air); fR = lerpf(fR, -0.15, air); kR = lerpf(kR, 0.9, air)
	aL = lerpf(aL, -0.5, air); aR = lerpf(aR, 0.4, air); ab = lerpf(ab, 1.05, air); eL = lerpf(eL, 0.5, air); eR = lerpf(eR, 0.5, air)
	lean = lerpf(lean, -0.06 + 0.18 * clampf(-pl.vy / 6.0, 0.0, 1.0), air)
	fL += 0.5 * ld; fR += 0.5 * ld; kL += 0.95 * ld; kR += 0.95 * ld; bob -= 0.1 * ld; lean += 0.16 * ld; ab += 0.35 * ld
	# idle: breathing, a slow look around, small weight shifts, arms settling
	var look := idle * 0.28 * sin(t * 0.45) + idle * 0.1 * sin(t * 1.3); var nod := idle * 0.04 * sin(t * 0.9) - lean * 0.55 - 0.25 * w * hgt
	var shift := idle * 0.02 * _drift(t * 0.35, 2.0)
	var X := func(a: float) -> Basis: return Basis(Vector3.RIGHT, a)
	var Y := func(a: float) -> Basis: return Basis(Vector3.UP, a)
	var Z := func(a: float) -> Basis: return Basis(Vector3.BACK, a)
	var root := Transform3D(Y.call(pl.yaw) * Z.call(clampf(-pl.dyaw * 0.02, -0.1, 0.1) * w + shift), Vector3(pl.x, pl.y + pl.jy, pl.z)) * Transform3D(Basis.IDENTITY, Vector3(sway, bob, 0))
	var sq := 1.0 + w * (0.15 + 0.3 * run) * hgt - 0.12 * ld; var tin := 0.1 * w * (1.0 - air)
	var B: Array[Transform3D] = []; B.resize(CB)
	B[0] = _jr(root, J["hips"], 1.0, Y.call(twist) * Basis.from_scale(Vector3(1.0 / sqrt(sq), sq, 1.0 / sqrt(sq))))
	B[1] = _jr(B[0], J["waist"], 1.0, Y.call(-twist * 1.7) * X.call(lean + idle * 0.012 * sin(t * 1.8)) * Z.call(-shift * 1.5))
	B[2] = _jr(B[1], J["neck"], 1.0, Y.call(look + twist * 0.7) * X.call(nod))
	B[3] = B[2]
	# the model stands in a T-pose, so each arm first drops to the side (hang), then swings and bends from there
	var hangL: Basis = Z.call(-PI / 2 + 0.16); var hangR: Basis = Z.call(PI / 2 - 0.16)
	B[4] = _jr(B[1], J["shL"], 1.0, X.call(-aL) * Z.call(ab) * hangL)
	B[5] = _jr(B[4], J["elL"], 1.0, hangL.inverse() * X.call(-eL) * hangL)
	B[6] = _jr(B[1], J["shL"], -1.0, X.call(-aR) * Z.call(-ab) * hangR)
	B[7] = _jr(B[6], J["elL"], -1.0, hangR.inverse() * X.call(-eR) * hangR)
	B[8] = _jr(B[0], J["hipL"], 1.0, X.call(-fL) * Z.call(-tin)); B[9] = _jr(B[8], J["kneeL"], 1.0, X.call(kL))
	B[10] = _jr(B[0], J["hipL"], -1.0, X.call(-fR) * Z.call(tin)); B[11] = _jr(B[10], J["kneeL"], -1.0, X.call(kR))
	# backpack bounces a beat behind the body; the sash swings with the stride
	B[12] = _jr(B[1], J["pack"], 1.0, X.call(w * 0.09 * sin(2.0 * ph + 1.0) - 0.25 * air + 0.3 * ld)) * Transform3D(Basis.IDENTITY, Vector3(0, w * 0.014 * sin(2.0 * ph + 0.8), 0))
	B[13] = _jr(B[0], J["sash"], 1.0, X.call(0.45 * A * sin(ph + 0.9) - lean - 0.5 * air + 0.3 * ld + idle * 0.03 * sin(t * 1.4)) * Z.call(w * 0.1 * cos(ph)))
	B[14] = root; B[15] = root
	_set_bones(hero_mats, B)
