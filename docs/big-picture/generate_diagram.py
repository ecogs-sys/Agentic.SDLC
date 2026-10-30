"""Generate a box-free SVG infographic and a draw.io copy with movable vector art."""
from pathlib import Path
from html import escape
from urllib.parse import quote
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
W, H = 1800, 2460
BLUE, TEAL, ORANGE = '#0caee0', '#087f9f', '#ce731b'
INK, MUTED = '#334155', '#64748b'
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc">',
       '<title id="title">Agent-assisted delivery — human-approved progress</title>',
       '<desc id="desc">Repository-defined program workflow: planning, human eval approval, spec freeze, serial development and testing, eval coverage, corpus replay, final verification, PR review and next phase.</desc>',
       f'<rect width="{W}" height="{H}" fill="white"/>']
doc = ET.Element('mxfile', host='app.diagrams.net')
diagram = ET.SubElement(doc, 'diagram', name='Review loops', id='big-picture')
model = ET.SubElement(diagram, 'mxGraphModel', page='1', pageWidth=str(W), pageHeight=str(H), background='#ffffff')
root = ET.SubElement(model, 'root')
ET.SubElement(root, 'mxCell', id='0')
ET.SubElement(root, 'mxCell', id='1', parent='0')
counter = 1

def cell(value, style, x, y, w, h):
    global counter
    counter += 1
    c = ET.SubElement(root, 'mxCell', id=str(counter), value=value, style=style, vertex='1', parent='1')
    ET.SubElement(c, 'mxGeometry', x=str(x), y=str(y), width=str(w), height=str(h), **{'as': 'geometry'})

def art(x, y, w, h, content):
    """One movable vector element in draw.io, preserving exact SVG appearance."""
    # Unique marker IDs prevent cross-element marker collisions in SVG browsers.
    content = content.replace('id="a"', f'id="a{counter}"').replace('url(#a)', f'url(#a{counter})')
    svg.append(f'<svg x="{x}" y="{y}" width="{w}" height="{h}" viewBox="0 0 {w} {h}" overflow="visible">{content}</svg>')
    source = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{content}</svg>'
    uri = 'data:image/svg+xml,' + quote(source, safe='')
    cell('', f'shape=image;imageAspect=0;aspect=fixed;image={uri};', x, y, w, h)

def label(x, y, lines, size=18, color=INK, anchor='middle', bold=False, width=280):
    for i, line in enumerate(lines):
        svg.append(f'<text x="{x}" y="{y+i*(size+7)}" font-family="Arial, sans-serif" font-size="{size}" fill="{color}" text-anchor="{anchor}" font-weight="{700 if bold else 400}">{escape(line)}</text>')
    cell('\n'.join(lines), f'text;html=0;align={"center" if anchor == "middle" else "left"};verticalAlign=top;fontFamily=Arial;fontSize={size};fontColor={color};fontStyle={1 if bold else 0};spacing=0;', x-width/2 if anchor=='middle' else x, y-size, width, len(lines)*(size+7))

def path(x,y,w,h,d,color=TEAL,thickness=4,dashed=False,head=True):
    marker = f'<defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="{3 if thickness>6 else 4}" markerHeight="{3 if thickness>6 else 4}" orient="auto"><path d="M0 0 L10 5 L0 10Z" fill="{color}"/></marker></defs>'
    dash = 'stroke-dasharray="7 8"' if dashed else ''
    end = 'marker-end="url(#a)"' if head else ''
    art(x,y,w,h,marker + f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{thickness}" stroke-linecap="round" stroke-linejoin="round" {dash} {end}/>')

def robot(x,y,color,reviewer=False):
    badge = '<path d="M42 48 L49 55 L62 40" stroke="white" stroke-width="4" fill="none"/>' if reviewer else ''
    art(x-36,y-36,72,72,f'<circle cx="36" cy="36" r="35" fill="{color}"/><g stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"><path d="M36 15V20 M22 47V54H47 M18 30H14V39H18 M54 30H58V39H54"/><rect x="20" y="22" width="32" height="24" rx="6"/><path d="M29 38H43"/></g><g fill="white"><circle cx="36" cy="13" r="2.5"/><circle cx="29" cy="31" r="2"/><circle cx="43" cy="31" r="2"/></g>{badge}')

def human(x,y):
    art(x-32,y-38,64,76,f'<g fill="white" stroke="{ORANGE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="19" r="12"/><path d="M9 67V52C9 32 55 32 55 52V67 M21 53V68 M43 53V68 M26 38L32 48L38 38"/></g>')

def document(x,y):
    art(x-15,y-20,30,40,f'<g fill="none" stroke="{MUTED}" stroke-width="2" stroke-linejoin="round"><path d="M4 2H19L27 10V37H4Z M19 2V11H27 M9 18H21 M9 24H21 M9 30H18"/></g>')

def circle(x,y,text,color=TEAL):
    art(x-28,y-28,56,56,f'<circle cx="28" cy="28" r="26" fill="white" stroke="{color}" stroke-width="3"/>')
    label(x,y+7,[text],21,color,bold=True,width=50)

def automatic(x,y):
    art(x-34,y-34,68,68,f'<circle cx="34" cy="34" r="32" fill="#eef8fb" stroke="{TEAL}" stroke-width="2"/><g fill="none" stroke="{TEAL}" stroke-width="3"><path d="M17 34L28 46L51 22 M21 15H46 M21 54H46"/></g>')

def heading(y,title,subtitle):
    path(65,y-36,1668,8,'M2 4H1664','#e2e8f0',1,head=False)
    label(65,y,[title],25,INK,anchor='start',bold=True,width=1660)
    label(65,y+32,[subtitle],17,MUTED,anchor='start',width=1660)

def loop(cx,y,role,reviewer='AI Validator',gate=True,output=None):
    path(cx-112,y-6,224,268,'M144 20 C242 62 237 200 145 242',BLUE,10)
    path(cx-112,y-6,224,268,'M80 242 C-10 202 -10 65 77 22',TEAL,10)
    robot(cx,y+20,BLUE)
    label(cx,y+85,[role],20,bold=True,width=285)
    label(cx,y+139,['Review & refine'],20,TEAL,bold=True)
    label(cx,y+167,['Up to 5 iterations'],14,MUTED)
    robot(cx,y+235,TEAL,True)
    label(cx,y+292,[reviewer],16,TEAL,width=290)
    if gate:
        path(cx-12,y+300,24,40,'M12 2V32',TEAL,3)
        human(cx,y+380)
        label(cx,y+438,['Human approval'],18,ORANGE,bold=True)
        path(cx-156,y-36,160,430,'M124 416 C8 416 8 354 8 300 V42 Q8 10 52 10 H145',ORANGE,2.5,True)
    if output:
        label(cx,y+475 if gate else y+335,output,16,MUTED,width=295)

def proceed(cx,nextcx,y,from_y):
    gap=nextcx-cx
    path(cx+28,y-55,gap+10,from_y-y+75,
         f'M5 {from_y-y+55} H{gap/2-28} Q{gap/2-5} {from_y-y+55} {gap/2-5} {from_y-y+32} V20 Q{gap/2-5} 8 {gap/2+16} 8 H{gap-45} Q{gap-28} 8 {gap-28} 27 V39',TEAL,4)
    label(cx+95,from_y-14,['Approved' if from_y-y>300 else 'Pass'],14,TEAL,width=120)

def finish(name):
    (ROOT/f'{name}.svg').write_text('\n'.join(svg+['</svg>']),encoding='utf-8')

def new_page(name,w,h,description):
    global svg,W,H,diagram,model,root
    W,H=w,h
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc">',f'<title id="title">{escape(name)}</title><desc id="desc">{escape(description)}</desc>',f'<rect width="{w}" height="{h}" fill="white"/>']
    diagram=ET.SubElement(doc,'diagram',name=name,id=f'page-{counter}')
    model=ET.SubElement(diagram,'mxGraphModel',page='1',pageWidth=str(w),pageHeight=str(h),background='#ffffff')
    root=ET.SubElement(model,'root')
    ET.SubElement(root,'mxCell',id='0')
    ET.SubElement(root,'mxCell',id='1',parent='0')

def final_loop(cx,y,title,creator,reviewer,detail):
    label(cx,y,[title],21,TEAL,bold=True,width=470)
    robot(cx-100,y+70,BLUE)
    robot(cx+100,y+70,TEAL,True)
    path(cx-66,y+26,140,50,'M3 32Q70 0 129 32',BLUE,5)
    path(cx-70,y+88,145,63,'M138 5Q70 80 4 5',TEAL,5)
    label(cx-100,y+132,[creator],17,bold=True,width=220)
    label(cx+100,y+132,[reviewer],17,TEAL,width=220)
    label(cx,y+184,detail,16,MUTED,width=480)

# Layout is maintained separately from the reusable vector drawing primitives.
exec(compile((ROOT/'diagram_layout.py').read_text(encoding='utf-8'), str(ROOT/'diagram_layout.py'), 'exec'))

