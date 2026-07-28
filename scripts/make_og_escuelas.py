"""Genera la imagen OpenGraph (1200x630) del informe de infraestructura escolar.
Tarjeta editorial oscura: mapa geolocalizado de Morón a la izquierda + titular
y stat principal a la derecha. Lee los mismos snapshots que el processor.

Uso: python scripts/make_og_escuelas.py
"""
import csv, os, json
from collections import Counter
import geopandas as gpd
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "data-sources")
OUT = os.path.join(BASE, "..", "public", "infraestructura", "og-escuelas.png")
MERC = "EPSG:3857"

BG = "#0b1020"
CARD = "#0f172a"
CREAM = "#f1f5f9"
MUTED = "#94a3b8"
EST_COLOR = {"rojo": "#ef4444", "amarillo": "#f59e0b", "verde": "#22c55e"}
EST_LABEL = {"rojo": "Rojo (crítico)", "amarillo": "Amarillo", "verde": "Verde"}
Z = ["verde", "amarillo", "rojo"]


def build():
    gj = json.load(open(os.path.join(SRC, "moron.geojson"), encoding="utf-8"))
    part = gpd.GeoDataFrame.from_features([gj], crs="EPSG:4326").to_crs(MERC)

    rows = []
    with open(os.path.join(SRC, "moron-escuelas.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            try:
                r["lat"] = float(r["lat"]); r["lon"] = float(r["lon"])
            except (ValueError, KeyError):
                continue
            if r["estado"] in EST_COLOR:
                rows.append(r)
    df = pd.DataFrame(rows)
    pts = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df["lon"], df["lat"]),
                           crs="EPSG:4326").to_crs(MERC)
    cnt = Counter(df["estado"]); total = len(df)
    pct_rojo = round(cnt.get("rojo", 0) / total * 100, 1)

    fig = plt.figure(figsize=(12, 6.3), dpi=100)
    fig.patch.set_facecolor(BG)

    # ── Mapa (izquierda) ──
    ax = fig.add_axes([0.02, 0.06, 0.5, 0.88])
    ax.set_facecolor(BG)
    part.plot(ax=ax, facecolor="#16203a", edgecolor="#3b4a6b", linewidth=2.2)
    for i, e in enumerate(Z):
        sub = pts[pts["estado"] == e]
        if sub.empty:
            continue
        ax.scatter(sub.geometry.x, sub.geometry.y, s=70, c=EST_COLOR[e],
                   edgecolors=BG, linewidths=0.8, zorder=4 + i, alpha=0.96)
    ax.set_axis_off(); ax.set_aspect("equal")
    minx, miny, maxx, maxy = part.total_bounds
    px = (maxx - minx) * 0.06; py = (maxy - miny) * 0.06
    ax.set_xlim(minx - px, maxx + px); ax.set_ylim(miny - py, maxy + py)

    # ── Texto (derecha) ──
    x0 = 0.55
    fig.text(x0, 0.855, "RADAR-PBA · DASHBOARD MORÓN", fontsize=13,
             color=MUTED, fontweight="bold")
    fig.text(x0, 0.755, "Estado edilicio", fontsize=39, color=CREAM, fontweight="bold")
    fig.text(x0, 0.67, "de las escuelas", fontsize=39, color=CREAM, fontweight="bold")

    fig.text(x0, 0.45, f"{str(pct_rojo).replace('.', ',')}%", fontsize=80,
             color=EST_COLOR["rojo"], fontweight="bold")
    fig.text(x0 + 0.004, 0.40, "de las escuelas están en estado rojo",
             fontsize=15, color=CREAM)

    fig.text(x0, 0.305, f"{total} escuelas relevadas, una por una",
             fontsize=14, color=MUTED)

    # leyenda (etiquetas cortas para que no se pisen)
    short = {"rojo": "Rojo", "amarillo": "Amarillo", "verde": "Verde"}
    lx = x0
    for e in ["rojo", "amarillo", "verde"]:
        fig.text(lx, 0.195, "●", fontsize=19, color=EST_COLOR[e], va="center")
        fig.text(lx + 0.016, 0.195, f"{cnt.get(e, 0)} {short[e]}",
                 fontsize=13, color=CREAM, va="center")
        lx += 0.12

    fig.text(x0, 0.08, "moron.openarg.org", fontsize=13, color=MUTED, fontweight="bold")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    fig.savefig(OUT, facecolor=BG)
    plt.close(fig)
    print("OK OG:", os.path.abspath(OUT), "|", total, "escuelas |", pct_rojo, "% rojo")


if __name__ == "__main__":
    build()
