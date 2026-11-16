import sys,json,struct
for p in sys.argv[1:]:
    d=open(p,'rb').read()
    magic,ver,ln=struct.unpack('<III',d[:12]); off=12; js=None; binlen=0
    while off<ln:
        cl,ct=struct.unpack('<II',d[off:off+8]); 
        if ct==0x4E4F534A: js=json.loads(d[off+8:off+8+cl])
        else: binlen=cl
        off+=8+cl
    print('==',p,len(d),'bin',binlen)
    print(' asset',js.get('asset'),'ext',js.get('extensionsUsed'),js.get('extensionsRequired'))
    for k in ['scenes','nodes','meshes','materials','textures','images','skins','animations','accessors']:
        print(' ',k,len(js.get(k,[])))
    for n in js.get('nodes',[])[:40]: print('  node',{k:v for k,v in n.items() if k!='children'}, 'ch',len(n.get('children',[])))
    for m in js.get('meshes',[]):
        for pr in m['primitives']:
            print('  prim',pr.get('attributes'),'idx',pr.get('indices'),'mat',pr.get('material'),'mode',pr.get('mode'),pr.get('extensions'))
            a=js['accessors'][pr['attributes']['POSITION']];print('   pos',a['count'],a.get('min'),a.get('max'))
            if 'indices' in pr: print('   tris',js['accessors'][pr['indices']]['count']//3)
    for m in js.get('materials',[]): print('  mat',json.dumps(m)[:400])
    for i in js.get('images',[]): print('  img',{k:v for k,v in i.items()}, js['bufferViews'][i['bufferView']]['byteLength'] if 'bufferView' in i else '')
    for a in js.get('animations',[]): print('  anim',a.get('name'),len(a['channels']))
    for s in js.get('skins',[]): print('  skin joints',len(s['joints']))
