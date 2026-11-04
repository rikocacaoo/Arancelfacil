"""
CONSTRUIR DATOS DEL ARANCEL 2022
Une el PDF oficial (títulos, jerarquía, notas) con el Excel (códigos y Ad Valorem).
Uso (desde la carpeta datos/):  python construir_datos.py
Necesita: pandas, openpyxl y la herramienta pdftotext (poppler).
Genera: ../js/arancel_data.js, ../js/estructura_data.js y arancel_2022_completo.csv
"""
import re, json, subprocess
import pandas as pd

PDF = "Arancel_2022.pdf"
EXCEL = "Cap01-98-Descripcion.xlsx"
raw = subprocess.run(["pdftotext", "-layout", PDF, "-"], capture_output=True, text=True, encoding="utf-8").stdout
raw = raw.replace("\f", "\n")
lines = [l.rstrip() for l in raw.split("\n")]

HDR = re.compile(r'NORMAS LEGALES|^\s*Código\s+(Designación|Descripción)')
CAP = re.compile(r'^\s+Capítulo (\d+)\s*$')
PART = re.compile(r'^\s*(\d\d\.\d\d)\s{2,}(\S.*)$')
CODE = re.compile(r'^(\d{4}\.\d{2}(?:\.\d{2}(?:\.\d{2})?)?)\s+(?![a-záéíóúñ])(.*)$')
DASH = re.compile(r'^((?:-\s*)+)(.*)$')
AVRE = re.compile(r'^(.*?)\s{2,}(\d{1,2})$')

# ---- localizar capítulos en el cuerpo
caps = [(i, int(CAP.match(l).group(1))) for i, l in enumerate(lines) if CAP.match(l)]
print('capítulos hallados:', len(caps), caps[0], caps[-1])

filas, partidas, capitulos = [], {}, {}
sec_notas = {}
for n, (start, num) in enumerate(caps):
    end = caps[n+1][0] if n+1 < len(caps) else len(lines)
    blk = lines[start+1:end]
    # título = primeras líneas no vacías hasta línea vacía
    j = 0
    while j < len(blk) and not blk[j].strip(): j += 1
    titulo = []
    while j < len(blk) and blk[j].strip():
        titulo.append(blk[j].strip()); j += 1
    # tabla: desde la primera línea 'Código Designación'
    t0 = next((k for k, l in enumerate(blk) if re.match(r'^\s*Código\s+(Designación|Descripción)', l)), None)
    notas = '\n'.join(l for l in blk[j:t0] if not HDR.search(l)).strip() if t0 else ''
    capitulos[num] = {'codigo': f'{num:02d}', 'titulo': ' '.join(titulo), 'notas': notas}
    if t0 is None: continue
    stack, last, mode = [], None, 'tabla'
    cur_sec = None
    for l in blk[t0:]:
        if not l.strip() or HDR.search(l): continue
        ms = re.match(r'^\s*(?:SECCIÓN|Sección) ([IVXL]+)\s*$', l)
        if ms: mode = 'seccion'; cur_sec = ms.group(1); sec_notas[cur_sec] = []; continue
        if mode == 'seccion': sec_notas[cur_sec].append(l.rstrip()); continue
        if re.match(r'^\s*Notas? (Complementarias|de Subpartida)', l): mode = 'notas'; continue
        if mode == 'notas':
            if CODE.match(l.strip()) or PART.match(l): mode = 'tabla'
            else: continue
        s = l.strip()
        m = PART.match(l)
        if m:
            stack = [m.group(2)]; last = {'tipo': 'part', 'cod': m.group(1), 'ref': 0}
            last['stack_idx'] = 0; partidas[m.group(1)] = last; last['txt'] = m.group(2); continue
        m = CODE.match(s)
        if m:
            cod, rest = m.groups(); d = DASH.match(rest)
            depth = d.group(1).count('-') if d else 0
            txt = d.group(2) if d else rest
            av = AVRE.match(txt)
            avv = None
            if av and len(cod) == 13: txt, avv = av.group(1), int(av.group(2))
            txt = txt.strip()
            stack = stack[:depth] + [txt] if depth else [txt]
            last = {'tipo': 'leaf' if len(cod) == 13 else 'mid', 'cod': cod, 'depth': depth, 'av': avv, 'stack': None}
            last['idx'] = len(stack)-1
            last['_stack'] = stack
            if last['tipo'] == 'leaf': filas.append(last)
            continue
        d = DASH.match(s)
        if d and not re.match(r'^[-–]\s*$', s):
            depth = d.group(1).count('-'); txt = d.group(2).strip()
            stack = stack[:depth] + [txt]
            last = {'tipo': 'hdr', 'depth': depth, '_stack': stack, 'idx': len(stack)-1}
            continue
        # continuación de la línea anterior
        if last is not None:
            av = AVRE.match(s)
            if av and last.get('tipo') == 'leaf' and last['av'] is None:
                s, last['av'] = av.group(1), int(av.group(2))
            if last['tipo'] == 'part': stack[0] += ' ' + s; last['txt'] = stack[0]
            else:
                stack[last['idx']] += ' ' + s
print(len(filas), 'hojas; partidas:', len(partidas))

# ---------------- Sección I (su encabezado queda antes del capítulo 1) ----------------
i0 = next(i for i, l in enumerate(lines) if re.match(r"^\s*Sección I\s*$", l) and i > 600)
i1 = caps[0][0]
sec_notas["I"] = [l for l in lines[i0 + 1:i1] if not HDR.search(l)]

def limpia(t):
    return re.sub(r"\s+", " ", t).strip().rstrip(":").strip()

def texto(bloque):
    return "\n".join(re.sub(r"[ \t]+", " ", l).strip() for l in bloque if not HDR.search(l)).strip()

# ---------------- Secciones (agrupación oficial del Sistema Armonizado) ----------------
RANGOS = {"I": (1, 5), "II": (6, 14), "III": (15, 15), "IV": (16, 24), "V": (25, 27), "VI": (28, 38),
          "VII": (39, 40), "VIII": (41, 43), "IX": (44, 46), "X": (47, 49), "XI": (50, 63), "XII": (64, 67),
          "XIII": (68, 70), "XIV": (71, 71), "XV": (72, 83), "XVI": (84, 85), "XVII": (86, 89),
          "XVIII": (90, 92), "XIX": (93, 93), "XX": (94, 96), "XXI": (97, 97)}
def seccion_de(n):
    for r, (a, b) in RANGOS.items():
        if a <= n <= b: return r
    return "Especial"

secciones = []
for r in RANGOS:
    nl = [l.strip() for l in sec_notas.get(r, []) if l.strip()]
    secciones.append({"numero": r, "titulo": limpia(nl[0]) if nl else "", "notas": texto(sec_notas.get(r, [])[1:])})

caps_out = [{"codigo": c["codigo"], "titulo": limpia(c["titulo"]), "seccion": seccion_de(n), "notas": texto(c["notas"].split("\n"))}
            for n, c in sorted(capitulos.items())]

# ---------------- Reglas Generales de Interpretación ----------------
r0 = next(i for i, l in enumerate(lines) if "REGLAS GENERALES PARA LA INTERPRETACIÓN" in l and i > 400)
r1 = next(i for i, l in enumerate(lines) if "ABREVIATURAS Y SÍMBOLOS" in l and i > r0)
reglas = texto(lines[r0 + 1:r1])

# ---------------- Hojas: Excel manda (códigos y A/V), el PDF aporta la jerarquía ----------------
x = pd.read_excel(EXCEL, dtype=str); x.columns = ["codigo", "desc", "av"]
pdf_hojas = {f["cod"]: f for f in filas}
pdf_hojas.setdefault("0208.90.00.10", pdf_hojas.get("0208.90.00.00"))   # el Excel subdivide esta línea
pdf_hojas.setdefault("0208.90.00.90", pdf_hojas.get("0208.90.00.00"))

out, partida_titulo = [], {}
for k, v in partidas.items():
    partida_titulo[k] = limpia(v["txt"])
for r in x.itertuples():
    cod = re.sub(r"\s+", "", r.codigo)
    own = limpia(re.sub(r"^[-\s]+", "", r.desc.replace("\xa0", " ")))
    nivel = r.desc.replace("\xa0", " ").lstrip().split(own[:1])[0].count("-") if own else 0
    f = pdf_hojas.get(cod)
    extra = cod in ("0208.90.00.10", "0208.90.00.90")          # el .00 del PDF pasa a ser su "padre"
    anc = [limpia(a) for a in (f["_stack"] if extra else f["_stack"][:-1])] if f else []
    p = f"{cod[:2]}.{cod[2:4]}" if False else cod[:4][:2] + "." + cod[2:4]
    if p not in partida_titulo: partida_titulo[p] = anc[0] if anc else own
    out.append({"c": cod, "p": p, "t": " › ".join(anc + [own]), "a": int(r.av.strip())})

pd.DataFrame(out).rename(columns={"c": "codigo", "p": "partida", "t": "descripcion_completa", "a": "advalorem"}).to_csv(
    "arancel_2022_completo.csv", index=False, encoding="utf-8-sig")
with open("../js/arancel_data.js", "w", encoding="utf-8") as fh:
    fh.write("const ARANCEL = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";")
with open("../js/estructura_data.js", "w", encoding="utf-8") as fh:
    fh.write("const SECCIONES = " + json.dumps(secciones, ensure_ascii=False) + ";\n")
    fh.write("const CAPITULOS = " + json.dumps(caps_out, ensure_ascii=False) + ";\n")
    fh.write("const PARTIDAS = " + json.dumps(partida_titulo, ensure_ascii=False) + ";\n")
    fh.write("const REGLAS_GENERALES = " + json.dumps(reglas, ensure_ascii=False) + ";\n")
print(len(out), "subpartidas |", len(caps_out), "capítulos |", len(partida_titulo), "partidas |", len(secciones), "secciones")
