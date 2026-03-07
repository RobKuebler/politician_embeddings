import logging
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st
import umap

log = logging.getLogger(__name__)

EMBEDDINGS_PATH = Path(__file__).parent / "outputs" / "politician_embeddings_161.csv"

# Official German party colors
PARTY_COLORS = {
    "CDU/CSU": "#000000",
    "SPD": "#E3000F",
    "AfD": "#009EE0",
    "BÜNDNIS 90/\xadDIE GRÜNEN": "#46962B",
    "Die Linke": "#BE3075",
    "fraktionslos": "#888888",
}


@st.cache_data
def load_and_reduce() -> pd.DataFrame:
    """Load embeddings CSV and reduce to 2D with UMAP."""
    df = pd.read_csv(EMBEDDINGS_PATH)
    dim_cols = [c for c in df.columns if c.startswith("dim_")]
    reducer = umap.UMAP(n_components=2, random_state=42)
    coords = reducer.fit_transform(df[dim_cols].values)
    df["x"] = coords[:, 0]
    df["y"] = coords[:, 1]
    return df


st.set_page_config(page_title="Politiker-Embeddings", layout="wide")

st.markdown(
    "<h1 style='text-align:center; margin-bottom:0'>Politiker-Embeddings</h1>",
    unsafe_allow_html=True,
)
st.markdown(
    "<p style='text-align:center; color:#888; margin-top:4px'>"
    "Abstimmungsverhalten als Vektoren, auf 2D reduziert via UMAP — Bundestag 2025"
    "</p>",
    unsafe_allow_html=True,
)

with st.spinner("UMAP läuft..."):
    df = load_and_reduce()

# Legend above the chart as colored pills
party_order = [
    "CDU/CSU",
    "SPD",
    "AfD",
    "BÜNDNIS 90/\xadDIE GRÜNEN",
    "Die Linke",
    "fraktionslos",
]
pills = []
for party in party_order:
    color = PARTY_COLORS[party]
    label = party.replace("\xad", "")  # strip soft hyphen for display
    text_color = "#fff" if color != "#FFED00" else "#000"
    pills.append(
        f"<span style='background:{color}; color:{text_color}; "
        f"padding:5px 14px; border-radius:20px; font-size:13px; font-weight:500'>"
        f"{label}</span>"
    )
pills_html = (
    "<div style='display:flex; flex-wrap:wrap; justify-content:center;"
    " gap:10px; margin:16px 0 8px'>" + "".join(pills) + "</div>"
)
st.markdown(pills_html, unsafe_allow_html=True)

fig = px.scatter(
    df,
    x="x",
    y="y",
    color="party",
    color_discrete_map=PARTY_COLORS,
    hover_data={"name": True, "party": True, "x": False, "y": False},
    labels={"party": "Partei", "name": "Name"},
    height=820,
)
fig.update_traces(marker={"size": 8, "opacity": 0.9})
fig.update_layout(
    xaxis={"showticklabels": False, "title": "", "showgrid": False, "zeroline": False},
    yaxis={"showticklabels": False, "title": "", "showgrid": False, "zeroline": False},
    plot_bgcolor="#0f1117",
    paper_bgcolor="#0f1117",
    showlegend=False,
    margin={"l": 0, "r": 0, "t": 10, "b": 10},
)

st.plotly_chart(fig, use_container_width=True)
