"""Synthwave's towers (models/synth/towers.glb) from Kenney's CC0 City Kit (Commercial).

(The car and the palms are made in code, in fx/synth.js; only the towers are models.)
Kenney's GLBs are textured with a small colour map. This turns the towers into one lean file for fx/synth.js:
triangles split into primitives by what they are (glass, frame, wall, dark), no textures, UVs, tangents,
normals or vertex colours (the page recomputes normals; vertices stay split where the original had hard edges),
and positions stored as normalised int16 (KHR_mesh_quantization, so the file stays valid glTF).

usage (from the repo root; Pillow needed):
  python -P tools/synth/conv.py --src <folder with the Kenney files> [--out models/synth] [--towers a,c,e]

The source folder needs building-skyscraper-<x>.glb for each tower, and the kit's Textures/colormap.png
renamed colormap-city.png. Run with -P, never from inside the source folder: the downloads are data, not code."""
import struct, json, sys, os, colorsys, argparse
from PIL import Image

CT = {5126: ('f', 4), 5123: ('H', 2), 5125: ('I', 4), 5121: ('B', 1)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def load(f):
    """a GLB's JSON, and a reader for its accessors (lists of tuples)"""
    b = open(f, 'rb').read()
    jl = struct.unpack_from('<I', b, 12)[0]; j = json.loads(b[20:20+jl])
    bo = 20 + jl; bl = struct.unpack_from('<I', b, bo)[0]; bin_ = b[bo+8:bo+8+bl]
    def acc(i):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
        fmt, sz = CT[a['componentType']]; n = NC[a['type']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); st = bv.get('byteStride', sz*n)
        return [struct.unpack_from('<' + fmt*n, bin_, off + k*st) for k in range(a['count'])]
    return j, acc

def quat_mat(q):
    x, y, z, w = q
    return [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]

def xf(n, p):
    s = n.get('scale', [1, 1, 1]); r = n.get('rotation', [0, 0, 0, 1]); t = n.get('translation', [0, 0, 0])
    m = quat_mat(r); v = [p[0]*s[0], p[1]*s[1], p[2]*s[2]]
    return [sum(m[i][k]*v[k] for k in range(3)) + t[i] for i in range(3)]

def hsv(c):
    return colorsys.rgb_to_hsv(*[x/255 for x in c])

def extract(f, cmap):
    im = Image.open(cmap).convert('RGB'); W, H = im.size
    j, acc = load(f)
    out = {}
    for n in j['nodes']:
        if 'mesh' not in n: continue
        m = j['meshes'][n['mesh']]
        tris = []
        for p in m['primitives']:
            uv = acc(p['attributes']['TEXCOORD_0']); pos = acc(p['attributes']['POSITION']); nr = acc(p['attributes']['NORMAL'])
            idx = [i[0] for i in acc(p['indices'])]
            for t in range(0, len(idx), 3):
                tri = []
                for a in idx[t:t+3]:
                    u, v = uv[a]
                    col = im.getpixel((min(W-1, int(u % 1 * W)), min(H-1, int(v % 1 * H))))
                    tri.append((list(pos[a]), list(nr[a]), col))
                tris.append(tri)
        out[n['name']] = (n, tris)
    return out

def classify(kind, name, tri):
    cs = [hsv(v[2]) for v in tri]
    h = sum(c[0] for c in cs)/3; s = sum(c[1] for c in cs)/3; v = sum(c[2] for c in cs)/3
    hd = h*360
    if s > .3 and 200 < hd < 240 and v > .7: return 'glass'
    if v > .7: return 'frame'
    if v > .5: return 'wall'
    return 'dark'

def build(meshes, cols=True):
    """meshes: [(name, pivot or None, {cls: [tri]})]. Positions are stored as normalised int16 (KHR_mesh_quantization):
       each node's scale and translation turn them back into the model's units (pivot + centre + v * half)."""
    binb = bytearray(); bviews = []; accs = []; jm = []; nodes = []; mats = []; matidx = {}
    def add(data, target, stride=None):
        while len(binb) % 4: binb.append(0)
        off = len(binb); binb.extend(data)
        bv = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data), 'target': target}
        if stride: bv['byteStride'] = stride
        bviews.append(bv); return len(bviews)-1
    for name, pivot, groups in meshes:
        allp = [v[0] for cls in groups for tri in groups[cls] for v in tri]
        lo = [min(p[k] for p in allp) for k in range(3)]; hi = [max(p[k] for p in allp) for k in range(3)]
        c = [(lo[k] + hi[k]) / 2 for k in range(3)]; h = [max((hi[k] - lo[k]) / 2, 1e-4) for k in range(3)]
        q = lambda p: [max(-32767, min(32767, round((p[k] - c[k]) / h[k] * 32767))) for k in range(3)]
        prims = []
        for cls in sorted(groups):
            tris = groups[cls]
            if cls not in matidx:
                matidx[cls] = len(mats); mats.append({'name': cls, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': .8}})
            vmap = {}; verts = []; idx = []
            for tri in tris:
                for p, n, col in tri:
                    qp = tuple(q(p))
                    key = qp + (round(n[0], 1), round(n[1], 1), round(n[2], 1)) + ((col,) if cols else ())
                    if key not in vmap: vmap[key] = len(verts); verts.append((qp, col))
                    idx.append(vmap[key])
            pb = bytearray(); cb = bytearray()
            mn = [32767]*3; mx = [-32767]*3
            for qp, col in verts:
                pb += struct.pack('<4h', qp[0], qp[1], qp[2], 0)
                if cols: cb += struct.pack('<4B', col[0], col[1], col[2], 255)
                for k in range(3): mn[k] = min(mn[k], qp[k]); mx[k] = max(mx[k], qp[k])
            assert len(verts) < 65536
            bp = add(pb, 34962, 8)
            accs.append({'bufferView': bp, 'componentType': 5122, 'normalized': True, 'count': len(verts), 'type': 'VEC3', 'min': mn, 'max': mx}); ap = len(accs)-1
            attrs = {'POSITION': ap}
            if cols:
                bc = add(cb, 34962)
                accs.append({'bufferView': bc, 'componentType': 5121, 'normalized': True, 'count': len(verts), 'type': 'VEC4'}); attrs['COLOR_0'] = len(accs)-1
            bi = add(struct.pack('<%dH' % len(idx), *idx), 34963)
            accs.append({'bufferView': bi, 'componentType': 5123, 'count': len(idx), 'type': 'SCALAR'}); ai = len(accs)-1
            prims.append({'attributes': attrs, 'indices': ai, 'material': matidx[cls]})
        jm.append({'name': name, 'primitives': prims})
        pv = pivot or [0, 0, 0]
        nd = {'name': name, 'mesh': len(jm)-1, 'translation': [round(pv[k] + c[k], 6) for k in range(3)], 'scale': [round(h[k], 6) for k in range(3)]}
        if pivot: nd['extras'] = {'pivot': [round(x, 6) for x in pivot]}
        nodes.append(nd)
    while len(binb) % 4: binb.append(0)
    j = {'asset': {'version': '2.0', 'generator': 'MSC Unofficial synthwave converter', 'copyright': 'Kenney (www.kenney.nl), CC0 1.0'},
         'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
         'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': jm, 'materials': mats,
         'accessors': accs, 'bufferViews': bviews, 'buffers': [{'byteLength': len(binb)}]}
    js = json.dumps(j, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    total = 12 + 8 + len(js) + 8 + len(binb)
    return struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binb), 0x004E4942) + bytes(binb)

def group(kind, name, tris):
    g = {}
    for t in tris: g.setdefault(classify(kind, name, t), []).append(t)
    return g

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description="Synthwave's towers from Kenney's CC0 City Kit")
    ap.add_argument('--src', required=True, help='folder with building-skyscraper-<x>.glb and colormap-city.png')
    ap.add_argument('--out', default=os.path.normpath(os.path.join(here, '..', '..', 'models', 'synth')), help='where the .glb files go (default: models/synth)')
    ap.add_argument('--towers', default='a,c,e', help='which building-skyscraper-<x> to include (fx/synth.js names tower-a, tower-c, tower-e)')
    a = ap.parse_args(); S = a.src; O = a.out
    os.makedirs(O, exist_ok=True)
    towers = []
    for tn in a.towers.split(','):
        nm = 'building-skyscraper-' + tn
        d = extract(os.path.join(S, nm + '.glb'), os.path.join(S, 'colormap-city.png')); n, t = d[nm]
        towers.append(('tower-' + tn, None, group('tower', nm, t)))
    open(os.path.join(O, 'towers.glb'), 'wb').write(build(towers, cols=False))
    for f in ['towers']:
        b = open(os.path.join(O, f + '.glb'), 'rb').read(); jl = struct.unpack_from('<I', b, 12)[0]; j = json.loads(b[20:20+jl])
        print(f + '.glb', len(b), 'bytes,', sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes'] for p in m['primitives']), 'triangles')
