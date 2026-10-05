"""Regenerate the editable KiCad schematic and PCB with KiCad's Python runtime.

Run with C:/Program Files/KiCad/10.0/bin/python.exe build.py.
"""

from __future__ import annotations

import csv
import json
import math
import re
import uuid
from pathlib import Path

import pcbnew as pcb


ROOT = Path(__file__).resolve().parent
KICAD = Path("C:/Program Files/KiCad/10.0/share/kicad")
NAME = "rc-lowpass-lab"
RESISTORS = [("R1", "16k", "FC_1K", 16000), ("R2", "5.1k", "FC_3K", 5100),
             ("R3", "3.3k", "FC_5K", 3300), ("R4", "1.8k", "FC_9K", 1800),
             ("R5", "820", "FC_19K", 820)]
R_FP = "Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal"
C_FP = "Capacitor_THT:C_Disc_D5.0mm_W2.5mm_P5.00mm"
J_FP = "Connector_PinHeader_2.54mm:PinHeader_1x01_P2.54mm_Vertical"
H_FP = "MountingHole:MountingHole_3.2mm_M3"
uid = lambda: str(uuid.uuid4())


def sexp_symbol(library: str, name: str) -> str:
    text = (KICAD / "symbols" / f"{library}.kicad_sym").read_text(encoding="utf-8")
    start = text.index(f'\t(symbol "{name}"')
    depth, quoted, escaped = 0, False, False
    for i in range(start, len(text)):
        char = text[i]
        if escaped:
            escaped = False
        elif char == "\\" and quoted:
            escaped = True
        elif char == '"':
            quoted = not quoted
        elif not quoted:
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    return text[start:i+1].replace(f'(symbol "{name}"', f'(symbol "{library}:{name}"', 1)
    raise ValueError(name)


def q(s):
    return json.dumps(s, ensure_ascii=False)


def pt(x):
    return f"{x:.4f}".rstrip("0").rstrip(".")


sheet_id = uid()
sch = [f'(kicad_sch (version 20250114) (generator "eeschema")\n (uuid "{sheet_id}")\n'
       ' (paper "A4")\n (lib_symbols\n']
for lib, sym in [("Device", "R"), ("Device", "C"), ("Connector_Generic", "Conn_01x01")]:
    sch.append(sexp_symbol(lib, sym) + "\n")
sch.append(' )\n')
instance_ids = {}


def symbol(lib, name, ref, val, fp, x, y, angle=0, mpn=""):
    ident = uid()
    instance_ids[ref] = ident
    # Explicit property positions keep labels readable when opened in Eeschema.
    if ref.startswith("R"):
        ref_xy, val_xy = (x, y-3.3), (x, y+3.3)
    elif ref.startswith("C"):
        ref_xy, val_xy = (x+5.0, y-2.0), (x+6.0, y+1.0)
    else:
        ref_xy, val_xy = (x, y-3.0), (x, y+3.0)
    props = [f'(property "Reference" {q(ref)} (at {pt(ref_xy[0])} {pt(ref_xy[1])} 0) (effects (font (size 1.0 1.0))))',
             f'(property "Value" {q(val)} (at {pt(val_xy[0])} {pt(val_xy[1])} 0) (effects (font (size 1.0 1.0))))',
             f'(property "Footprint" {q(fp)} (at {pt(x)} {pt(y)} 0) (effects (font (size 1.0 1.0)) (hide yes)))']
    if mpn:
        props.append(f'(property "MPN" {q(mpn)} (at {pt(x)} {pt(y)} 0) (effects (font (size 1.0 1.0)) (hide yes)))')
    sch.append(f' (symbol (lib_id "{lib}:{name}") (at {pt(x)} {pt(y)} {angle}) (unit 1) '
               f'(exclude_from_sim no) (in_bom yes) (on_board yes) (dnp no) (fields_autoplaced no) (uuid "{ident}")\n'
               + " ".join(props) + '\n (pin "1" (uuid "' + uid() + '"))'
               + ((' (pin "2" (uuid "' + uid() + '"))') if name != "Conn_01x01" else "")
               + f' (instances (project "{NAME}" (path "/{sheet_id}" (reference "{ref}") (unit 1)))) )\n')


def wire(x1, y1, x2, y2):
    sch.append(f' (wire (pts (xy {pt(x1)} {pt(y1)}) (xy {pt(x2)} {pt(y2)})) (stroke (width 0) (type default)) (uuid "{uid()}"))\n')


def label(name, x, y):
    sch.append(f' (label {q(name)} (at {pt(x)} {pt(y)} 0) (effects (font (size 1 1)) (justify left bottom)) (uuid "{uid()}"))\n')


def junction(x, y):
    sch.append(f' (junction (at {pt(x)} {pt(y)}) (diameter 0) (color 0 0 0 0) (uuid "{uid()}"))\n')


for idx, (ref, val, net, ohm) in enumerate(RESISTORS):
    y = 50.8 + idx * 12.7
    symbol("Connector_Generic", "Conn_01x01", f"J{idx+1}", net, J_FP, 63.5, y, 180)
    symbol("Device", "R", ref, val, R_FP, 88.9, y, 90)
    wire(68.58, y, 85.09, y)
    label(net, 71.12, y)
    wire(92.71, y, 127, y)
    if idx:
        junction(127, y)
    if idx < 4:
        wire(127, y, 127, y+12.7)
symbol("Device", "C", "C1", "10n", C_FP, 127, 127, 0, "TS170R1H103K8BBB0R")
wire(127, 101.6, 127, 123.19)
junction(127, 101.6)
symbol("Connector_Generic", "Conn_01x01", "J6", "OUT", J_FP, 152.4, 76.2)
wire(127, 76.2, 147.32, 76.2)
junction(127, 76.2)
symbol("Connector_Generic", "Conn_01x01", "J7", "GND", J_FP, 152.4, 127)
symbol("Connector_Generic", "Conn_01x01", "J8", "GND", J_FP, 152.4, 139.7)
symbol("Connector_Generic", "Conn_01x01", "J9", "GND", J_FP, 152.4, 152.4)
wire(127, 130.81, 127, 139.7)
wire(127, 139.7, 147.32, 139.7)
wire(139.7, 139.7, 139.7, 127)
wire(139.7, 127, 147.32, 127)
junction(139.7, 139.7)
wire(139.7, 139.7, 139.7, 152.4)
wire(139.7, 152.4, 147.32, 152.4)
label("OUT", 132.08, 76.2)
label("GND", 127, 139.7)
sch.append(')\n')
(ROOT / f"{NAME}.kicad_sch").write_text("".join(sch), encoding="utf-8")


board = pcb.BOARD()
board.SetTitleBlock(pcb.TITLE_BLOCK())
board.SetCopperLayerCount(2)
nets = {name: pcb.NETINFO_ITEM(board, name) for name in ["FC_1K", "FC_3K", "FC_5K", "FC_9K", "FC_19K", "OUT", "GND"]}
for net in nets.values():
    board.Add(net)


def xy(x, y):
    return pcb.VECTOR2I(pcb.FromMM(x), pcb.FromMM(y))


def add_fp(ref, val, library_id, x, y, pad_nets):
    lib, name = library_id.split(":")
    fp = pcb.FootprintLoad(str(KICAD / "footprints" / f"{lib}.pretty"), name)
    if not fp:
        raise RuntimeError(library_id)
    fp.SetReference(ref)
    fp.SetValue(val)
    fp.SetPosition(xy(x, y))
    fp.SetPath(pcb.KIID_PATH([pcb.KIID(instance_ids[ref])]))
    for pad in fp.Pads():
        pad.SetNet(nets[pad_nets[pad.GetNumber()]])
    fp.Reference().SetVisible(False)
    board.Add(fp)
    return fp


for idx, (ref, val, net, ohm) in enumerate(RESISTORS):
    y = 5.5 + idx * 5.5
    add_fp(f"J{idx+1}", net, J_FP, 5, y, {"1": net})
    add_fp(ref, val, R_FP, 11.5, y, {"1": net, "2": "OUT"})
add_fp("C1", "10n", C_FP, 24.12, 16.5, {"1": "OUT", "2": "GND"})
add_fp("J6", "OUT", J_FP, 29.12, 5.5, {"1": "OUT"})
add_fp("J7", "GND", J_FP, 29.12, 22, {"1": "GND"})
add_fp("J8", "GND", J_FP, 29.12, 27.5, {"1": "GND"})
add_fp("J9", "GND", J_FP, 24.12, 25, {"1": "GND"})


def track(net, points, width=0.8):
    for a, b in zip(points, points[1:]):
        t = pcb.PCB_TRACK(board)
        t.SetStart(xy(*a))
        t.SetEnd(xy(*b))
        t.SetWidth(pcb.FromMM(width))
        t.SetLayer(pcb.F_Cu)
        t.SetNet(nets[net])
        board.Add(t)


for idx, (_, _, net, _) in enumerate(RESISTORS):
    y = 5.5 + idx*5.5
    track(net, [(5, y), (11.5, y)])
track("OUT", [(19.12, 5.5), (19.12, 27.5)])
track("OUT", [(19.12, 5.5), (29.12, 5.5)])
track("OUT", [(19.12, 16.5), (24.12, 16.5)])
track("GND", [(29.12, 16.5), (29.12, 27.5)])
track("GND", [(24.12, 25), (29.12, 25)])


def edge(x1, y1, x2, y2):
    shape = pcb.PCB_SHAPE(board)
    shape.SetShape(pcb.SHAPE_T_SEGMENT)
    shape.SetStart(xy(x1, y1))
    shape.SetEnd(xy(x2, y2))
    shape.SetLayer(pcb.Edge_Cuts)
    shape.SetWidth(pcb.FromMM(0.05))
    board.Add(shape)


for a, b in [((0,0),(33,0)), ((33,0),(33,33)), ((33,33),(0,33)), ((0,33),(0,0))]:
    edge(*a, *b)


def silk(s, x, y, size=1.15, thick=0.16):
    t = pcb.PCB_TEXT(board)
    t.SetText(s)
    t.SetPosition(xy(x, y))
    t.SetLayer(pcb.F_SilkS)
    t.SetTextSize(xy(size, size))
    t.SetTextThickness(pcb.FromMM(thick))
    board.Add(t)


silk("RC LOW-PASS FILTER", 16.7, 2.3, 0.9, 0.14)
for idx, (ref, val, _, _) in enumerate(RESISTORS):
    y = 5.5 + idx*5.5
    silk(f"fc≈{[1,3,5,9,19][idx]} kHz", 5, y-2.2, 0.80, 0.12)
    silk(f"{ref} {val}", 15.3, y+2.05, 0.80, 0.12)
silk("OUT", 29.12, 2.8, 0.95, 0.14)
silk("GND", 31.1, 22, 0.8, 0.12)
silk("GND", 31.1, 27.5, 0.8, 0.12)
silk("GND", 24.12, 29.4, 0.8, 0.12)
silk("C = 10 nF", 26.7, 13.7, 0.8, 0.12)

zone = pcb.ZONE(board)
zone.SetLayer(pcb.B_Cu)
zone.SetNet(nets["GND"])
zone.SetLocalClearance(pcb.FromMM(0.5))
zone.SetThermalReliefGap(pcb.FromMM(0.5))
zone.SetThermalReliefSpokeWidth(pcb.FromMM(0.5))
outline = zone.Outline()
outline.NewOutline()
for x, y in [(0.5,0.5),(32.5,0.5),(32.5,32.5),(0.5,32.5)]:
    outline.Append(int(pcb.FromMM(x)), int(pcb.FromMM(y)))
board.Add(zone)
pcb.ZONE_FILLER(board).Fill(board.Zones())
pcb.SaveBoard(str(ROOT / f"{NAME}.kicad_pcb"), board)

with (ROOT / "BOM.csv").open("w", encoding="utf-8", newline="") as stream:
    writer = csv.writer(stream)
    writer.writerow(["References", "Quantity", "Value", "Footprint", "Specification / note"])
    for ref, val, _, _ in RESISTORS:
        writer.writerow([ref, 1, val, R_FP, "THT metal film, 0.25 W, 1% preferred"])
    writer.writerow(["C1", 1, "10n", C_FP, "TS170R1H103K8BBB0R; ceramic X7R, 50 V, +/-10%; verify body and lead pitch before purchase"])
    writer.writerow(["J1-J9", 9, "1x01", J_FP, "2.54 mm THT pin header, accessible from top"])
