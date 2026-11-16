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
var npc_mats: Array[ShaderMaterial] = []
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
var water_fx := Vector3(1, 1, 1)   # see-through water, light lines, foam and glints
# ---- the player in water ----
const FLOAT_AT := 0.95            # water deeper than this and the player floats: about shoulder height
var rip: Array[Vector4] = []      # rings on the surface: x, z, start time, strength
var rip_i := 0
var rip_cd := 0.0
var splash := Vector4.ZERO        # droplets: x, z, start time, strength
var was_wet := false
var auto_dir := []                # test hook: walk in a fixed direction
var hop_at := -1                  # test hook: jump on this frame
var start_at := []

# ---- the calf ----
var calf := {}
var critters: Array = []
var npcs: Array = []
var bubbles := {}
var ui_layer: CanvasLayer
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
var cam_set := false
var hud := true
var scene := "town"          # which baked world to load: "town" (Fernhollow harbour) or "world" (the test meadow)
var props := {}              # parts of the world the game moves: the windmill sails, the boat at the pier
var solid_boxes: Array = []
var solid_rounds: Array = []
# ---- time of day ----
var tod := 0.30              # 0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset
var tod_run := true          # the clock moves by itself
const DAY_LEN := 720.0       # seconds for a full day
# keys: time, grade colour, washed-out amount, lights, sky top, sky at the horizon, cloud lit side, cloud shaded side, sun colour, stars
const TOD_KEYS := [
	[0.00, Vector3(0.20, 0.26, 0.46), 0.35, 1.0, Vector3(0.02, 0.03, 0.10), Vector3(0.07, 0.10, 0.22), Vector3(0.17, 0.21, 0.36), Vector3(0.08, 0.10, 0.20), Vector3(1.0, 0.6, 0.3), 1.0],
	[0.20, Vector3(0.22, 0.28, 0.48), 0.35, 1.0, Vector3(0.03, 0.05, 0.14), Vector3(0.12, 0.14, 0.28), Vector3(0.20, 0.23, 0.38), Vector3(0.09, 0.11, 0.22), Vector3(1.0, 0.6, 0.3), 1.0],
	[0.25, Vector3(0.92, 0.72, 0.66), 0.12, 0.5, Vector3(0.26, 0.36, 0.66), Vector3(1.00, 0.64, 0.42), Vector3(1.00, 0.78, 0.66), Vector3(0.56, 0.46, 0.60), Vector3(1.0, 0.72, 0.42), 0.15],
	[0.31, Vector3(1.03, 0.97, 0.90), 0.0, 0.0, Vector3(0.22, 0.52, 0.94), Vector3(0.74, 0.88, 0.98), Vector3(1.00, 0.98, 0.94), Vector3(0.76, 0.82, 0.94), Vector3(1.0, 0.95, 0.78), 0.0],
	[0.50, Vector3(1.00, 1.00, 1.00), 0.0, 0.0, Vector3(0.16, 0.47, 0.93), Vector3(0.62, 0.84, 0.98), Vector3(1.00, 1.00, 1.00), Vector3(0.78, 0.84, 0.94), Vector3(1.0, 0.98, 0.88), 0.0],
	[0.68, Vector3(1.03, 0.96, 0.88), 0.0, 0.0, Vector3(0.18, 0.44, 0.88), Vector3(0.70, 0.84, 0.94), Vector3(1.00, 0.97, 0.90), Vector3(0.76, 0.80, 0.90), Vector3(1.0, 0.92, 0.70), 0.0],
	[0.75, Vector3(1.00, 0.68, 0.52), 0.10, 0.5, Vector3(0.20, 0.22, 0.48), Vector3(1.00, 0.50, 0.28), Vector3(1.00, 0.62, 0.44), Vector3(0.44, 0.32, 0.50), Vector3(1.0, 0.55, 0.25), 0.1],
	[0.82, Vector3(0.24, 0.30, 0.50), 0.32, 1.0, Vector3(0.03, 0.05, 0.14), Vector3(0.16, 0.14, 0.30), Vector3(0.20, 0.23, 0.38), Vector3(0.09, 0.11, 0.22), Vector3(1.0, 0.5, 0.25), 0.9],
	[1.00, Vector3(0.20, 0.26, 0.46), 0.35, 1.0, Vector3(0.02, 0.03, 0.10), Vector3(0.07, 0.10, 0.22), Vector3(0.17, 0.21, 0.36), Vector3(0.08, 0.10, 0.20), Vector3(1.0, 0.6, 0.3), 1.0],
]

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="): shot_path = a.substr(7)
		if a.begins_with("--frames="): shot_frame = int(a.substr(9))
		if a.begins_with("--dist="): cam_dist = float(a.substr(7)); cam_set = true
		if a.begins_with("--yaw="): cam_yaw = float(a.substr(6)); cam_set = true
		if a.begins_with("--dbg="): dbg = int(a.substr(6))
		if a.begins_with("--auto="): auto_walk = float(a.substr(7))
		if a.begins_with("--pitch="): cam_pitch = float(a.substr(8)); cam_set = true
		if a.begins_with("--detail="): detail = float(a.substr(9)); auto_detail = false
		if a == "--opaque": blend = false
		if a.begins_with("--pose="):
			for v in a.substr(7).split(","): force.append(float(v))
		if a.begins_with("--simple="): simple = int(a.substr(9))
		if a.begins_with("--at="):
			for v in a.substr(5).split(","): start_at.append(float(v))
		if a == "--oldwater": water_fx.x = 0.0
		if a.begins_with("--scene="): scene = a.substr(8)
		if a.begins_with("--tod="): tod = float(a.substr(6)); tod_run = false
		if a.begins_with("--hop="): hop_at = int(a.substr(6))
		if a.begins_with("--walk="):
			for v in a.substr(7).split(","): auto_dir.append(float(v))
	var t0 := Time.get_ticks_msec()
	_setup_viewports()
	_load_world()
	_load_calf()
	_load_hero()
	_spawn_people()
	_make_water_fx()
	for i in 8: rip.append(Vector4.ZERO)
	if start_at.size() == 2:
		pl.x = start_at[0]; pl.z = start_at[1]
	elif meta.has("places"):
		pl.x = meta["places"]["home_door"][0]; pl.z = meta["places"]["home_door"][1]; pl.yaw = 0.9
		if not cam_set: cam_yaw = 0.4; cam_pitch = 0.32; cam_dist = 20.0      # open on the view down to the harbour
	pl.y = height(pl.x, pl.z); cam_t = Vector3(pl.x, pl.y + 0.9, pl.z)
	var pond: Array = meta.get("pond", [7.0, 6.0, 7.5, 5.0])
	for mats in [world_mats, crit_mats, hero_mats, npc_mats]:
		_set_param(mats, "pond", Vector4(pond[0], pond[1], pond[2], pond[3]))
		_set_param(mats, "pond_zone", float(meta.get("pond_zone", 1.5)))
		_set_param(mats, "water_y", float(meta["water"]))
	var lamp_list: Array[Vector4] = []
	for l in meta.get("lights", []): lamp_list.append(Vector4(l[0], l[1], l[2], 4.6))
	while lamp_list.size() < 8: lamp_list.append(Vector4.ZERO)
	for mats in [world_mats, crit_mats, hero_mats, npc_mats]: _set_param(mats, "lamps", lamp_list)
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
	ui_layer = layer

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
	meta = JSON.parse_string(FileAccess.get_file_as_string("res://data/%s.json" % scene))
	solid_boxes = meta.get("solid", []); solid_rounds = meta.get("solid_c", [])
	var hgm: Dictionary = meta["hgrid"]
	hg = {"gx": int(hgm["gx"]), "gz": int(hgm["gz"]), "x0": float(hgm["x0"]), "z0": float(hgm["z0"]), "d": float(hgm["d"])}
	hgrid = PackedFloat32Array(hgm["h"])
	var pj: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/%s.json" % ("palette" if scene == "world" else scene + "_palette")))   # 28 colours fitted to the world, the player and the calf together
	var pal: Array = pj["pal"]
	var pv := PackedVector3Array()
	for i in range(0, pal.size(), 3): pv.append(Vector3(pal[i], pal[i + 1], pal[i + 2]))
	while pv.size() < 32: pv.append(Vector3.ZERO)
	post_mat.set_shader_parameter("pal", pv)
	post_mat.set_shader_parameter("pal_n", int(pj["cols"]))
	var bgc: Array = meta["bg"]
	post_mat.set_shader_parameter("bg", Vector3(bgc[0], bgc[1], bgc[2]))
	wdata = {"pos": FileAccess.get_file_as_bytes("res://data/%s_pos.bin" % scene).to_float32_array(),
		"col": _bytes_to_floats(FileAccess.get_file_as_bytes("res://data/%s_col.bin" % scene), false),
		"misc": _bytes_to_floats(FileAccess.get_file_as_bytes("res://data/%s_misc.bin" % scene), false),
		"nrm": _bytes_to_floats(FileAccess.get_file_as_bytes("res://data/%s_nrm.bin" % scene), true)}
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
		if ch.has("prop"):
			# a movable part: one mesh in its own coordinates, placed by a node the game can turn
			var ppos := PackedVector3Array(); ppos.resize(c0)
			for i in c0:
				var j2 := (s0 + i) * 3
				ppos[i] = Vector3(fpos[j2], fpos[j2 + 1], fpos[j2 + 2])
			var pm := _add_mesh(_points_mesh(ppos, wdata.misc.slice(s0 * 4, (s0 + c0) * 4), wdata.col.slice(s0 * 4, (s0 + c0) * 4), wdata.nrm.slice(s0 * 4, (s0 + c0) * 4)), world_mats[0], AABB(Vector3(-6, -6, -6), Vector3(12, 12, 12)))
			var at: Array = ch["at"]
			pm.position = Vector3(at[0], at[1], at[2]); pm.rotation.y = float(ch.get("yaw", 0.0))
			props[ch["prop"]] = {"node": pm, "at": pm.position, "yaw": pm.rotation.y}
			world_total[0] += c0
			continue
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
	for mt in world_mats + crit_mats + hero_mats + npc_mats:
		var o: ShaderMaterial = mt.get_meta("opq")
		for nd in all_instances:
			if nd.material_override == mt or nd.material_override == o: nd.material_override = mt if blend else o
	post_mat.set_shader_parameter("opaque", not blend)

var skin_cache := {}

func _skin_data(name: String, step: int) -> Dictionary:
	# splats with a bone index and a blend weight each. step > 1 keeps every step-th splat and enlarges it to cover: a lighter copy for townsfolk
	var key := "%s/%d" % [name, step]
	if skin_cache.has(key): return skin_cache[key]
	var M: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/%s.json" % name))
	var b := FileAccess.get_file_as_bytes("res://data/%s.bin" % name)
	var n := int(M["n"]); var m := n / step
	var mn: Array = M["mn"]; var ext: Array = M["ext"]
	var pos := PackedVector3Array(); pos.resize(m)
	var misc := PackedFloat32Array(); misc.resize(m * 4)
	var nrm := PackedFloat32Array(); nrm.resize(m * 4)
	var col := PackedFloat32Array(); col.resize(m * 4)
	var sz := clampi(int(round(float(M["diam"]) * sqrt(float(step)) / 0.004)), 1, 255) / 255.0
	for q in m:
		var i := q * step
		pos[q] = Vector3(mn[0] + b.decode_u16(i * 6) / 65535.0 * ext[0], mn[1] + b.decode_u16(i * 6 + 2) / 65535.0 * ext[1], mn[2] + b.decode_u16(i * 6 + 4) / 65535.0 * ext[2])
		var k := n * 10 + i * 3
		misc[q * 4] = b[k + 2] / 255.0; misc[q * 4 + 1] = b[k] / 255.0; misc[q * 4 + 2] = sz; misc[q * 4 + 3] = b[k + 1] / 255.0
		for w in 4: col[q * 4 + w] = b[n * 6 + i * 4 + w] / 255.0
	var d := {"M": M, "mesh": _points_mesh(pos, misc, col, nrm)}
	skin_cache[key] = d
	return d

func _spawn_skinned(name: String, step := 1) -> Dictionary:
	# one more copy of a skinned model, with its own materials so it can hold its own pose
	var d := _skin_data(name, step)
	var mats: Array[ShaderMaterial] = [_make_mat("crit")]
	_set_param(mats, "parents", PackedInt32Array(d.M.get("parents", [0, 0, 0, 0, 14, 14, 2, 3, 4, 5, 14, 10, 1, 1, 0, 0])))
	var node := _add_mesh(d.mesh, mats[0], AABB(Vector3(-200, -50, -200), Vector3(400, 100, 400)))
	return {"M": d.M, "mats": mats, "node": node}

func _set_bones(mats: Array, B: Array) -> void:
	var arr: Array[Projection] = []
	for k in CB: arr.append(Projection(B[k]))
	_set_param(mats, "bones", arr)

func _new_critter(x: float, z: float, kind: String, scale: float) -> Dictionary:
	var r := _spawn_skinned("calf")
	crit_mats.append_array(r.mats)
	return {"M": r.M, "mats": r.mats, "kind": kind, "scale": scale, "x": x, "z": z, "hx": x, "hz": z, "y": 0.0, "yaw": randf() * TAU, "phase": 0.0, "amt": 0.0, "v": 0.0, "w": 0.0,
		"t": 1.5, "mode": "idle", "tx": 0.0, "tz": 0.0, "gz": 0.0, "sp": 0.0, "sr": 0.0, "wp": 0.0, "seed": randf() * 9.0, "aware": 0.0, "look": 0.0, "fast": 1.0, "plan": "roam", "plan_t": 12.0 + randf() * 8.0}

func _load_calf() -> void:
	# the warden's rescue: the bull calf, kept in the pen beside the hall
	var start: Dictionary = meta["crit"][0]
	calf = _new_critter(float(start["x"]), float(start["z"]), "calf", 1.0)
	critters.append(calf)
	# strays: for now the calf's body, small, without its fire, in another coat
	for d in meta.get("places", {}).get("strays", []):
		var c := _new_critter(float(d["x"]), float(d["z"]), d["kind"], float(d["scale"]))
		_set_param(c.mats, "plain", 1.0)
		var f: Array = d["fur"]; _set_param(c.mats, "fur", Vector3(f[0], f[1], f[2]))
		if d.has("stall"): c["stall"] = d["stall"]
		critters.append(c)

func _load_hero() -> void:
	var r := _spawn_skinned("hero")
	hero_mats = r.mats; hero_j = r.M["joints"]

func height(x: float, z: float) -> float:
	var fx: float = clampf((x - hg.x0) / hg.d, 0.0, hg.gx - 1.001); var fz: float = clampf((z - hg.z0) / hg.d, 0.0, hg.gz - 1.001)
	var i := int(fx); var k := int(fz); var u := fx - i; var v := fz - k
	var a := hgrid[i + hg.gx * k]; var b := hgrid[i + 1 + hg.gx * k]; var c := hgrid[i + hg.gx * (k + 1)]; var d := hgrid[i + 1 + hg.gx * (k + 1)]
	return lerpf(lerpf(a, b, u), lerpf(c, d, u), v)

# ---- behaviour: wander, graze, idle. A cut-down port of the browser version ----
func _thief_plan(c: Dictionary, dt: float, dp: float) -> void:
	# roam the beach, sneak up to the fruit stall, eat, get shooed, run for it, and start again
	c.plan_t -= dt
	if c.plan == "roam" and c.plan_t <= 0.0 and tod > 0.26 and tod < 0.8:
		c.plan = "sneak"; c.mode = "walk"; c.tx = c.stall[0]; c.tz = c.stall[1]; c.t = 30.0; c.fast = 1.0
	elif c.plan == "sneak":
		c.mode = "walk"; c.tx = c.stall[0]; c.tz = c.stall[1]
		if Vector2(c.tx - c.x, c.tz - c.z).length() < 0.45:
			c.plan = "eat"; c.plan_t = 5.0
			for n in npcs:
				if n.d["id"] == "seller" and n.node.visible: _say("seller", n.P, 1.75 * float(n.d["scale"]), "Hey! Shoo! That's the third one this morning!", 4.0)
		elif c.t < 2.0: c.plan = "roam"; c.plan_t = 15.0
	elif c.plan == "eat":
		c.mode = "graze"; c.t = 1.0
		if c.plan_t <= 3.6 or dp < 2.0: c.plan = "flee"; c.mode = "walk"; c.tx = c.hx; c.tz = c.hz; c.t = 20.0; c.fast = 3.2
	elif c.plan == "flee":
		c.mode = "walk"; c.tx = c.hx; c.tz = c.hz
		if Vector2(c.tx - c.x, c.tz - c.z).length() < 0.6 or c.t < 2.0: c.plan = "roam"; c.plan_t = 22.0 + randf() * 14.0; c.fast = 1.0; c.mode = "idle"; c.t = 3.0

func _step_calf(c: Dictionary, dt: float) -> void:
	var sc: float = c.scale
	c.t -= dt
	var want := 0.0; var tyaw: float = c.yaw
	var dxp: float = pl.x - c.x; var dzp: float = pl.z - c.z; var dp := Vector2(dxp, dzp).length(); var to_p := atan2(dxp, dzp)
	var busy: bool = c.kind == "thief" and c.plan != "roam"
	if c.kind == "thief": _thief_plan(c, dt, dp)
	var seen := dp < 4.2 and not busy
	c.aware += ((1.0 if seen else 0.0) - c.aware) * minf(1.0, dt * (1.5 if seen else 0.45))
	if c.kind == "sleeper":
		# dozing in the sun: head down until somebody comes close, then it lifts its head and watches
		if c.aware > 0.55: c.mode = "watch"; tyaw = to_p
		else: c.mode = "graze"
	elif c.aware > 0.55 and not busy:
		c.mode = "watch"; tyaw = to_p
		if dp > 1.75 * maxf(sc, 0.7): want = 0.85
	elif c.mode == "watch":
		c.mode = "idle"; c.t = 1.0 + randf() * 2.0
	elif c.mode == "walk":
		var dx: float = c.tx - c.x; var dz: float = c.tz - c.z
		if Vector2(dx, dz).length() < 0.3 or c.t <= 0.0:
			c.mode = "graze" if randf() < 0.4 else "idle"; c.t = 2.0 + randf() * 4.0
		else:
			want = 0.85 * c.fast; tyaw = atan2(dx, dz)
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
		if height(nx, nz) > float(meta["water"]) + 0.04 and Vector2(nx - pl.x, nz - pl.z).length() > 0.74 * sc and not _blocked(nx, nz): c.x = nx; c.z = nz
		elif not _blocked(nx, c.z) and height(nx, c.z) > float(meta["water"]) + 0.04: c.x = nx
		elif not _blocked(c.x, nz) and height(c.x, nz) > float(meta["water"]) + 0.04: c.z = nz
		else: c.t = 0.0
	var L: float = c.M["hip"][0][1] * sc
	var stride := 2.0 * L * sin(0.6) / 0.5
	c.amt += (minf(1.0, c.v / 0.85) - c.amt) * minf(1.0, dt * 6.0)
	if c.kind == "sleeper": c.t = 5.0
	c.phase += dt * c.v / stride
	c.gz += ((1.0 if c.mode == "graze" else 0.0) - c.gz) * minf(1.0, dt * 2.0)
	var lk := clampf(wrapf(to_p - c.yaw, -PI, PI), -1.05, 1.05) * minf(1.0, c.aware * 1.6) if c.aware > 0.2 else 0.0
	c.look += (lk - c.look) * minf(1.0, dt * 4.5)
	var push := 0.72 * maxf(sc, 0.6)
	if dp < push and dp > 0.0001: pl.x = c.x + dxp / dp * push; pl.z = c.z + dzp / dp * push   # solid: the player is pushed out

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

func _pose_calf(c: Dictionary, t: float) -> void:
	var M: Dictionary = c.M; var sc: float = c.scale
	var sy := sin(c.yaw); var cy := cos(c.yaw)
	c.y = height(c.x, c.z)
	var dl: float = M["len"] * 0.3 * sc; var dw: float = M["wid"] * 0.25 * sc
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
	var root := Transform3D(Basis(Vector3.UP, c.yaw) * Basis(Vector3.RIGHT, dyn + c.sp) * Basis(Vector3.BACK, roll_d + c.sr) * Basis.from_scale(Vector3(1.0 + 0.006 * breath, 1.0 + 0.011 * breath, 1.0) * sc), Vector3(c.x, c.y + bob * sc, c.z))
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
	_set_bones(c.mats, B)

func _set_shadows() -> void:
	# soft shadows under the player, every creature and everyone in town
	var sa: Array[Vector4] = [Vector4(pl.x, pl.z, pl.y, pl.yaw)]
	var sb: Array[Vector4] = [Vector4(0.36 / (1.0 + pl.jy * 0.4), 0.3 / (1.0 + pl.jy * 0.4), 0.42 / (1.0 + pl.jy * 1.5), 0)]
	for c in critters:
		var sc: float = c.scale
		sa.append(Vector4(c.x, c.z, c.y, c.yaw)); sb.append(Vector4(c.M["wid"] * 0.4 * sc, c.M["len"] * 0.44 * sc, 0.45, 0))
	for n in npcs:
		if sa.size() < 16 and n.node.visible:
			var k: float = n.d["scale"]
			sa.append(Vector4(n.P.x, n.P.z, n.P.y, n.P.yaw)); sb.append(Vector4(0.36 * k, 0.3 * k, 0.4, 0))
	while sa.size() < 16: sa.append(Vector4()); sb.append(Vector4())
	_set_param(world_mats, "sh_a", sa); _set_param(world_mats, "sh_b", sb)

func _process(dt: float) -> void:
	dt = minf(dt, 0.1); t_now += dt; wind_t += dt; frame_n += 1
	var mv := Vector2(Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_up", "ui_down"))
	if Input.is_key_pressed(KEY_A): mv.x -= 1.0
	if Input.is_key_pressed(KEY_D): mv.x += 1.0
	if Input.is_key_pressed(KEY_W): mv.y -= 1.0
	if Input.is_key_pressed(KEY_S): mv.y += 1.0
	if auto_walk > 0.0: mv = Vector2(sin(t_now * 0.5), cos(t_now * 0.5))
	if auto_dir.size() == 2: mv = Vector2(auto_dir[0], auto_dir[1])
	var mx := cos(cam_yaw) * mv.x + sin(cam_yaw) * mv.y; var mz := -sin(cam_yaw) * mv.x + cos(cam_yaw) * mv.y
	_step_player(dt, mx, mz, Input.is_key_pressed(KEY_SHIFT) or auto_walk > 1.0, Input.is_key_pressed(KEY_SPACE) or frame_n == hop_at)
	if force.size() == 4: pl.amt = force[0]; pl.phase = force[1] * TAU; pl.air = force[2]; pl.jy = force[2] * 0.5; pl.yaw = force[3]; pl.vx = 0.0; pl.vz = 0.0
	for c in critters: _step_calf(c, dt); _pose_calf(c, t_now)
	for n in npcs: _step_npc(n, dt)
	_pose_person(pl, hero_mats, t_now, 1.0, "", 0.0)
	_set_shadows()
	_set_param(world_mats, "wind_t", wind_t)
	var wet := world_mats + crit_mats + hero_mats + npc_mats   # everything that can be under water
	_set_param(wet, "water_t", wind_t)
	_set_param(wet, "water_fx", water_fx)
	var body_wet: bool = water_depth(pl.x, pl.z) > 0.1 and pl.y + pl.jy < float(meta["water"]) - 0.08   # the body, not just the feet, is in the water
	_set_param(wet, "wader", Vector4(pl.x, pl.z, 0.27, 1.0 if body_wet else 0.0))
	_set_param(world_mats, "ripples", rip)
	_set_param(world_mats, "splash", splash)
	# camera: follows the player with a little lead, eases to a stop, pulls back when running. Q and E turn, the wheel zooms
	if Input.is_key_pressed(KEY_Q): cam_yaw -= dt * 1.6
	if Input.is_key_pressed(KEY_E): cam_yaw += dt * 1.6
	if Input.is_key_pressed(KEY_R): cam_pitch = minf(1.2, cam_pitch + dt * 0.9)     # look down from higher up
	if Input.is_key_pressed(KEY_F): cam_pitch = maxf(0.06, cam_pitch - dt * 0.9)    # drop the camera to see the horizon
	var k := 1.0 - exp(-dt * 4.5); var spd := Vector2(pl.vx, pl.vz).length()
	cam_t.x += (pl.x + pl.vx * 0.32 - cam_t.x) * k; cam_t.z += (pl.z + pl.vz * 0.32 - cam_t.z) * k; cam_t.y += (pl.y + 0.9 - cam_t.y) * k
	cam_dist_now += (cam_dist + spd * 0.55 - cam_dist_now) * (1.0 - exp(-dt * 2.5))
	var cp := cos(cam_pitch)
	var eye := cam_t + Vector3(sin(cam_yaw) * cp, sin(cam_pitch), cos(cam_yaw) * cp) * cam_dist_now
	# The near plane sits just in front of the nearest ground on screen, so a roof or a tree crown between the camera and the player is cut away instead of filling the view.
	var near_ground := cam_dist_now * sin(cam_pitch) / sin(minf(1.5, cam_pitch + deg_to_rad(FOV) * 0.5))
	cam_col.near = maxf(1.0, minf(cam_dist_now * 0.62, near_ground * 0.7)); cam_col.far = cam_dist_now + 160.0
	cam_col.look_at_from_position(eye, cam_t, Vector3.UP)
	_apply_time(dt)
	_move_props(dt)
	_place_bubbles()
	# frame-time watch: if the game cannot hold 55 fps at full detail it drops to half; it only climbs back with clear headroom
	ft_acc += dt; ft_n += 1; ft_hold = maxf(0.0, ft_hold - dt)
	if ft_n >= 30:
		var fps := ft_n / ft_acc; ft_acc = 0.0; ft_n = 0
		if auto_detail and ft_hold <= 0.0:
			if fps < 55.0 and detail > 0.75: detail = 0.5; _apply_detail(); ft_hold = 8.0
			elif fps > 110.0 and detail < 0.75: detail = 1.0; _apply_detail(); ft_hold = 8.0
		var drawn: int = world_total[0] + (world_total[1] if detail > 0.75 else 0)
		fps_label.text = "%s   %d fps  %.1f ms   %s detail%s   %s   %.2fM world splats   %d draw calls\nN next part of day   T (hold) run time   M stop/start clock   R/F camera height   H hide this\n1/2 detail   G auto detail   B blend   P palette   3 clear water   4 light lines   5 foam   WASD walk   Shift run   Space jump   Q/E turn" % [
			clock_text(), Engine.get_frames_per_second(), 1000.0 / maxf(fps, 0.01), "full" if detail > 0.75 else "half", " (auto)" if auto_detail else "", "soft blend" if blend else "opaque", drawn / 1000000.0,
			RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)]
	if shot_path != "" and frame_n == shot_frame:
		get_viewport().get_texture().get_image().save_png(shot_path)
		print("shot saved ", shot_path)
		get_tree().quit()

func _apply_time(dt: float) -> void:
	# The clock, the colour of the light, and everything the sky needs.
	if tod_run: tod = fposmod(tod + dt / DAY_LEN, 1.0)
	if Input.is_key_pressed(KEY_T): tod = fposmod(tod + dt * 0.08, 1.0)        # hold T to run the day forward
	var k := 0
	while k < TOD_KEYS.size() - 2 and TOD_KEYS[k + 1][0] <= tod: k += 1
	var a: Array = TOD_KEYS[k]; var b: Array = TOD_KEYS[k + 1]
	var u: float = clampf((tod - a[0]) / (b[0] - a[0]), 0.0, 1.0)
	var mul: Vector3 = a[1].lerp(b[1], u); var desat: float = lerpf(a[2], b[2], u); var lights: float = lerpf(a[3], b[3], u)
	var all_mats := world_mats + crit_mats + hero_mats + npc_mats
	_set_param(all_mats, "tod_mul", mul); _set_param(all_mats, "tod_desat", desat); _set_param(all_mats, "lights_on", lights)
	post_mat.set_shader_parameter("tod_mul", mul); post_mat.set_shader_parameter("tod_desat", desat); post_mat.set_shader_parameter("lights_on", lights)
	var th := (tod - 0.25) * TAU
	var sun := Vector3(cos(th) * 0.9 + 0.2, sin(th), 0.45).normalized()
	post_mat.set_shader_parameter("sun_dir", sun)
	post_mat.set_shader_parameter("moon_dir", Vector3(-cos(th) * 0.8 - 0.1, -sin(th), 0.55).normalized())
	post_mat.set_shader_parameter("zenith", a[4].lerp(b[4], u)); post_mat.set_shader_parameter("horizon", a[5].lerp(b[5], u))
	post_mat.set_shader_parameter("cloud_lit", a[6].lerp(b[6], u)); post_mat.set_shader_parameter("cloud_dark", a[7].lerp(b[7], u))
	post_mat.set_shader_parameter("sun_col", a[8].lerp(b[8], u)); post_mat.set_shader_parameter("stars", lerpf(a[9], b[9], u))
	post_mat.set_shader_parameter("sky_t", t_now)
	post_mat.set_shader_parameter("sky_on", meta.has("sea"))
	post_mat.set_shader_parameter("sea_y", float(meta["water"]))
	post_mat.set_shader_parameter("cam_basis", cam_col.global_transform.basis)
	post_mat.set_shader_parameter("cam_pos", cam_col.global_position)
	var th_y := tan(deg_to_rad(FOV) * 0.5)
	post_mat.set_shader_parameter("cam_tan", Vector2(th_y * float(vp_col.size.x) / float(vp_col.size.y), th_y))

func _move_props(_dt: float) -> void:
	if props.has("sails"):
		var sl: Dictionary = props["sails"]
		sl.node.basis = Basis(Vector3.UP, sl.yaw) * Basis(Vector3.BACK, t_now * 0.55)
	if props.has("boat"):
		var bt: Dictionary = props["boat"]
		bt.node.position = bt.at + Vector3(0, 0.03 * sin(t_now * 1.3), 0)
		bt.node.basis = Basis(Vector3.UP, bt.yaw) * Basis(Vector3.RIGHT, 0.05 * sin(t_now * 1.1)) * Basis(Vector3.BACK, 0.03 * sin(t_now * 0.8 + 1.0))

func clock_text() -> String:
	var mins := int(tod * 1440.0)
	return "%02d:%02d" % [mins / 60, mins % 60]

func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo:
		if e.keycode == KEY_N:      # jump to the next part of the day: morning, noon, dusk, night
			var stops := [0.31, 0.5, 0.755, 0.92]
			var nxt: float = stops[0]
			for sp in stops:
				if sp > tod + 0.01: nxt = sp; break
			tod = nxt
		if e.keycode == KEY_M: tod_run = not tod_run      # stop or start the clock
		if e.keycode == KEY_H: hud = not hud; fps_label.visible = hud
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
	if meta.has("bounds"):
		var b: Array = meta["bounds"]
		if x < b[0] or x > b[1] or z < b[2] or z > b[3]: return true
		for c in solid_rounds:
			if Vector2(x - c[0], z - c[1]).length_squared() < pow(c[2] + 0.22, 2.0): return true
		for q in solid_boxes:
			var dx: float = x - q[0]; var dz: float = z - q[1]; var cs := cos(q[4]); var sn := sin(q[4])
			if absf(cs * dx - sn * dz) < q[2] + 0.22 and absf(sn * dx + cs * dz) < q[3] + 0.22: return true
		return false
	return pow(absf(x / 24.0), 3.2) + pow(absf(z / 20.0), 3.2) > 0.9   # only the island's edge stops you now: water you wade or float through

func water_depth(x: float, z: float) -> float:
	# how deep the lake is here; 0 on land
	var pond: Array = meta.get("pond", [7.0, 6.0, 7.5, 5.0])
	var qx: float = (x - pond[0]) / pond[2]; var qz: float = (z - pond[1]) / pond[3]
	if qx * qx + qz * qz > float(meta.get("pond_zone", 1.5)): return 0.0
	if meta.has("sea") and height(x, z) > float(meta["water"]) + 0.3: return 0.0   # standing on the pier or the quay
	return maxf(0.0, float(meta["water"]) - height(x, z))

func _ripple(x: float, z: float, strength: float) -> void:
	rip[rip_i] = Vector4(x, z, wind_t, strength); rip_i = (rip_i + 1) % 8

func _splash(x: float, z: float, strength: float) -> void:
	splash = Vector4(x, z, wind_t, strength); _ripple(x, z, 1.0)

func _make_water_fx() -> void:
	# One small mesh of loose splats for the foam collar round the player and for splash droplets. The shader places them (group 7).
	var n := 150
	var pos := PackedVector3Array(); pos.resize(n)
	var misc := PackedFloat32Array(); misc.resize(n * 4)
	var col := PackedFloat32Array(); col.resize(n * 4)
	var nrm := PackedFloat32Array(); nrm.resize(n * 4)
	for i in n:
		var droplet := i >= 70
		misc[i * 4] = 0.0; misc[i * 4 + 1] = 7.0 / 255.0; misc[i * 4 + 2] = 18.0 / 255.0; misc[i * 4 + 3] = randf()
		col[i * 4] = randf() if droplet else float(i) / 70.0   # angle round the player
		col[i * 4 + 1] = 1.0 if droplet else 0.0
		col[i * 4 + 2] = randf()
	_add_mesh(_points_mesh(pos, misc, col, nrm), world_mats[0], AABB(Vector3(-200, -50, -200), Vector3(400, 100, 400)))

func _step_player(dt: float, mx: float, mz: float, run: bool, jump: bool) -> void:
	dt = maxf(dt, 0.001)
	# Water: the deeper you stand, the slower you go. Past shoulder depth your feet leave the bottom and you float.
	var wl := float(meta["water"])
	var depth := water_depth(pl.x, pl.z)
	var floating := depth > FLOAT_AT
	var sub := clampf(depth / FLOAT_AT, 0.0, 1.0) if pl.jy < 0.3 else 0.0   # how much of the body the water is holding back
	var l := Vector2(mx, mz).length(); var top := (5.8 if run else 3.5) * (1.0 - 0.55 * sub * sub - (0.1 if floating else 0.0))
	var tx := 0.0; var tz := 0.0
	if l > 0.0001: tx = mx / l * top; tz = mz / l * top
	# ease toward the wanted velocity: quick to start, a short slide to stop
	var dv := Vector2(tx - pl.vx, tz - pl.vz); var sv := (26.0 if l > 0.0001 else 20.0) * dt * (1.0 - 0.6 * sub)   # water also makes you slow to start and slow to stop
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
	depth = water_depth(pl.x, pl.z)
	var ground := height(pl.x, pl.z)
	var afloat := wl - FLOAT_AT + 0.035 * sin(t_now * 2.1) + 0.02 * sin(t_now * 3.7)   # where the feet hang when floating, bobbing a little
	var target_y := maxf(ground, afloat) if depth > 0.0 else ground
	pl.y = target_y if absf(target_y - pl.y) > 1.0 else lerpf(pl.y, target_y, minf(1.0, dt * (6.0 if target_y > ground else 14.0)))   # ease on and off the bottom
	if jump and pl.jy <= 0.0: pl.vy = 5.4 * (1.0 - 0.6 * sub)                         # a jump out of deep water is barely a hop
	var was: bool = pl.jy > 0.0
	pl.vy -= 17.0 * dt; pl.jy += pl.vy * dt
	if pl.jy <= 0.0:
		pl.jy = 0.0; pl.vy = 0.0
		if was:
			pl.land = 1.0
			if depth > 0.05: _splash(pl.x, pl.z, clampf(0.55 + depth, 0.6, 1.3))             # landing in water
	# rings and splashes
	var wet_now: bool = depth > 0.04 and pl.jy < 0.05
	var sp_now := Vector2(pl.vx, pl.vz).length()
	if wet_now and not was_wet and sp_now > 2.0: _splash(pl.x, pl.z, clampf(sp_now / 5.0, 0.5, 1.0))   # running in from the shore
	was_wet = wet_now
	rip_cd -= dt
	if wet_now and rip_cd <= 0.0:
		if sp_now > 0.4: _ripple(pl.x, pl.z, clampf(0.55 + sp_now / 6.0, 0.6, 1.0)); rip_cd = lerpf(0.42, 0.2, clampf(sp_now / 4.0, 0.0, 1.0))
		else: _ripple(pl.x, pl.z, 0.5); rip_cd = 1.5                                         # standing still: a slow ring now and then
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

func _pose_person(P: Dictionary, mats: Array, t: float, sc: float, act: String, aware: float) -> void:
	var J := hero_j
	var m: float = P.amt; var w := minf(1.0, m); var run := clampf((m - 1.0) / 0.4, 0.0, 1.0); var ph: float = P.phase
	var air: float = P.air; var ld: float = P.land * P.land; var idle := 1.0 - w
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
	lean = lerpf(lean, -0.06 + 0.18 * clampf(-P.vy / 6.0, 0.0, 1.0), air)
	fL += 0.5 * ld; fR += 0.5 * ld; kL += 0.95 * ld; kR += 0.95 * ld; bob -= 0.1 * ld; lean += 0.16 * ld; ab += 0.35 * ld
	# idle: breathing, a slow look around, small weight shifts, arms settling
	var look := idle * 0.28 * sin(t * 0.45) + idle * 0.1 * sin(t * 1.3); var nod := idle * 0.04 * sin(t * 0.9) - lean * 0.55 - 0.25 * w * hgt
	var shift := idle * 0.02 * _drift(t * 0.35, 2.0)
	# what the hands are busy with
	if act == "sweep":
		var sw := sin(t * 3.2); aL = 0.75 + 0.3 * sw; aR = 0.6 + 0.3 * sw; eL = 0.5; eR = 0.75; lean += 0.22; twist += 0.22 * sw; look = 0.0; nod = 0.25
	elif act == "work":
		aL = 0.55 + 0.35 * sin(t * 2.1); eL = 0.9 + 0.3 * sin(t * 2.1 + 1.0); aR = 0.35 + 0.2 * sin(t * 1.3); eR = 0.7; lean += 0.12; nod = 0.2; look *= 0.4
	elif act == "fish":
		aL = 0.95 + 0.03 * sin(t * 0.9); aR = 0.85; eL = 0.3; eR = 0.45; lean -= 0.05; look = 0.12 * sin(t * 0.3)
	elif act == "talk":
		aR = 0.2 + 0.45 * maxf(0.0, sin(t * 1.7)); eR = 0.95 + 0.3 * sin(t * 2.3); look = 0.18 * sin(t * 0.8); nod = 0.06 * sin(t * 2.9)
	look *= 1.0 - aware; nod = lerpf(nod, -0.05, aware)
	var X := func(a: float) -> Basis: return Basis(Vector3.RIGHT, a)
	var Y := func(a: float) -> Basis: return Basis(Vector3.UP, a)
	var Z := func(a: float) -> Basis: return Basis(Vector3.BACK, a)
	var root := Transform3D(Y.call(P.yaw) * Z.call(clampf(-P.dyaw * 0.02, -0.1, 0.1) * w + shift), Vector3(P.x, P.y + P.jy, P.z)) * Transform3D(Basis.IDENTITY, Vector3(sway, bob, 0))
	root = root * Transform3D(Basis.from_scale(Vector3(sc, sc, sc)), Vector3.ZERO)
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
	_set_bones(mats, B)

func _spawn_people() -> void:
	# everyone who lives in town: the hero's body in other clothes, each on their own round
	for d in meta.get("places", {}).get("npcs", []):
		var r := _spawn_skinned("hero", 3)
		npc_mats.append_array(r.mats)
		_set_param(r.mats, "npc_on", 1.0)
		for part in ["top", "bot", "hair"]:
			var v: Array = d[part]; _set_param(r.mats, "npc_" + part, Vector3(v[0], v[1], v[2]))
		var st: Array = d["loop"][0]
		npcs.append({"d": d, "mats": r.mats, "node": r.node, "i": 0, "wait": float(st[2]), "arrived": true, "stuck": 0.0, "aware": 0.0, "line": 0, "said": 0.0, "home": false, "seed": randf() * 20.0,
			"P": {"x": float(st[0]), "z": float(st[1]), "y": 0.0, "yaw": float(st[4]), "vx": 0.0, "vz": 0.0, "vy": 0.0, "jy": 0.0, "phase": 0.0, "amt": 0.0, "rate": 0.0, "air": 0.0, "land": 0.0, "dyaw": 0.0}})

func _step_npc(n: Dictionary, dt: float) -> void:
	dt = maxf(dt, 0.001)
	var P: Dictionary = n.P; var d: Dictionary = n.d; var loop: Array = d["loop"]
	var night := tod > 0.85 or tod < 0.24
	if not night and n.home:
		n.home = false; n.node.visible = true; n.arrived = false       # morning: out of the front door
	if n.home: return
	var st: Array = loop[n.i]
	var tx: float = d["home"][0] if night else st[0]; var tz: float = d["home"][1] if night else st[1]
	var dx: float = tx - P.x; var dz: float = tz - P.z; var dist := Vector2(dx, dz).length()
	var dpx: float = pl.x - P.x; var dpz: float = pl.z - P.z; var dp := Vector2(dpx, dpz).length()
	var near := dp < 2.3 and not night
	n.aware += ((1.0 if near else 0.0) - n.aware) * minf(1.0, dt * 4.0)
	var want := 0.0; var tyaw: float = P.yaw; var act := "stand"
	if near:
		# stop what they are doing, turn to you and say something
		tyaw = atan2(dpx, dpz)
		if n.said <= 0.0:
			var lines: Array = d["lines"]
			_say(d["id"], P, 1.75 * float(d["scale"]), lines[n.line % lines.size()], 4.5); n.line += 1; n.said = 6.0
	elif dist > 0.3:
		want = float(d["speed"]); tyaw = atan2(dx, dz); n.arrived = false
	elif night:
		n.home = true; n.node.visible = false; return                  # in for the night
	else:
		if not n.arrived: n.arrived = true; n.wait = float(st[2]) * randf_range(0.8, 1.25)
		act = st[3]; tyaw = float(st[4])
		n.wait -= dt
		if n.wait <= 0.0: n.i = (n.i + 1) % loop.size(); n.arrived = false
	if not near: n.said = maxf(0.0, n.said - dt)
	var da := wrapf(tyaw - P.yaw, -PI, PI); var dy := da * minf(1.0, dt * 7.0)
	P.yaw += dy; P.dyaw += (dy / dt - P.dyaw) * minf(1.0, dt * 4.0)
	var sp := want * smoothstep(0.3, 0.9, cos(da))
	var nx: float = P.x + sin(P.yaw) * sp * dt; var nz: float = P.z + cos(P.yaw) * sp * dt
	if sp > 0.01 and (_blocked(nx, nz) or height(nx, nz) < float(meta["water"]) - 0.25):
		# something in the way: slide along it, and if that fails for a while, give up on this stop
		if not _blocked(nx, P.z): nz = P.z
		elif not _blocked(P.x, nz): nx = P.x
		else: nx = P.x; nz = P.z
		n.stuck += dt
		if n.stuck > 2.5:
			n.stuck = 0.0
			if not night: n.i = (n.i + 1) % loop.size()
	else: n.stuck = maxf(0.0, n.stuck - dt * 0.5)
	P.vx = (nx - P.x) / dt; P.vz = (nz - P.z) / dt; P.x = nx; P.z = nz
	P.y = lerpf(P.y, height(P.x, P.z), minf(1.0, dt * 14.0))
	var spd := Vector2(P.vx, P.vz).length()
	P.amt += (minf(1.4, spd / (3.5 if float(d["speed"]) > 2.5 else 1.5)) - P.amt) * minf(1.0, dt * 8.0)
	P.rate += (minf(spd, 3.6) * (3.2 if float(d["speed"]) > 2.5 else 3.6) - P.rate) * minf(1.0, dt * 9.0)
	P.phase += dt * P.rate
	if dp < 0.55 and dp > 0.0001: pl.x = P.x + dpx / dp * 0.55; pl.z = P.z + dpz / dp * 0.55
	_pose_person(P, n.mats, t_now + n.seed, float(d["scale"]), act, n.aware)

# ---- speech: a line of text over someone's head ----
func _say(key: String, who: Dictionary, head: float, text: String, secs: float) -> void:
	var b: Dictionary = bubbles.get(key, {})
	if b.is_empty():
		var lab := Label.new()
		var box := StyleBoxFlat.new(); box.bg_color = Color(0.07, 0.06, 0.10, 0.9); box.set_corner_radius_all(6); box.set_content_margin_all(8)
		box.border_color = Color(1, 1, 1, 0.18); box.set_border_width_all(1)
		lab.add_theme_stylebox_override("normal", box); lab.add_theme_font_size_override("font_size", 15)
		lab.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; lab.custom_minimum_size = Vector2(230, 0); lab.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		ui_layer.add_child(lab)
		b = {"label": lab}; bubbles[key] = b
	b["who"] = who; b["head"] = head; b["until"] = t_now + secs
	b.label.text = text; b.label.visible = true

func _place_bubbles() -> void:
	var k := Vector2(get_window().size) / Vector2(vp_col.size)
	for key in bubbles:
		var b: Dictionary = bubbles[key]
		if not b.label.visible: continue
		var at := Vector3(b.who.x, b.who.y + b.head, b.who.z)
		if t_now > b.until or cam_col.is_position_behind(at): b.label.visible = false; continue
		var s2 := cam_col.unproject_position(at) * k
		b.label.position = s2 - Vector2(b.label.size.x * 0.5, b.label.size.y + 10.0)
