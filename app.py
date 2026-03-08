from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

OUTPUTS_DIR = Path(__file__).parent / "outputs"

# Load available periods from CSV written by fetch_data.py
_periods_df = pd.read_csv(OUTPUTS_DIR.parent / "data" / "periods.csv")
PERIODS = dict(zip(_periods_df["period_id"], _periods_df["label"], strict=True))

# Official German party colors; unknown parties fall back to gray
PARTY_COLORS = {
    "CDU/CSU": "#000000",
    "SPD": "#E3000F",
    "AfD": "#009EE0",
    "BÜNDNIS 90/\xadDIE GRÜNEN": "#46962B",
    "Die Linke": "#BE3075",
    "BSW": "#722EA5",
    "FDP": "#FFED00",
    "fraktionslos": "#888888",
}
FALLBACK_COLOR = "#888888"

st.set_page_config(page_title="Politiker-Embeddings", layout="wide")

st.markdown(
    "<h1 style='text-align:center; margin-bottom:0'>Politiker-Embeddings</h1>",
    unsafe_allow_html=True,
)
st.markdown(
    "<p style='text-align:center; color:#888; margin-top:4px'>"
    "Abstimmungsverhalten als Vektoren, auf 2D reduziert"
    "</p>",
    unsafe_allow_html=True,
)

period_id = st.radio(
    "Wahlperiode",
    options=list(PERIODS.keys()),
    format_func=lambda p: PERIODS[p],
    index=1,
    horizontal=True,
)

df = pd.read_csv(OUTPUTS_DIR / f"politician_embeddings_{period_id}.csv")

# Legend above the chart — derived from data, known parties in fixed order first
PARTY_ORDER = [
    "CDU/CSU",
    "SPD",
    "AfD",
    "BÜNDNIS 90/\xadDIE GRÜNEN",
    "Die Linke",
    "BSW",
    "FDP",
    "fraktionslos",
]
present = set(df["party"].unique())
party_order = [p for p in PARTY_ORDER if p in present] + sorted(
    present - set(PARTY_ORDER)
)
pills = []
for party in party_order:
    color = PARTY_COLORS.get(party, FALLBACK_COLOR)
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

color_map = {p: PARTY_COLORS.get(p, FALLBACK_COLOR) for p in present}

# Centroid per party (mean x/y position)
centroids = df.groupby("party")[["x", "y"]].mean()

is_3d = "z" in df.columns
common = {
    "color": "party",
    "color_discrete_map": color_map,
    "hover_data": {"name": True, "party": True, "x": False, "y": False},
    "labels": {"party": "Partei", "name": "Name"},
    "custom_data": ["party", "name"],
    "height": 820,
}

if is_3d:
    common["hover_data"]["z"] = False
    fig = px.scatter_3d(df, x="x", y="y", z="z", **common)
    fig.update_traces(marker={"size": 4, "opacity": 0.88, "line": {"width": 0}})
    fig.update_layout(
        scene={
            "xaxis": {"showticklabels": False, "title": "", "showgrid": False},
            "yaxis": {"showticklabels": False, "title": "", "showgrid": False},
            "zaxis": {"showticklabels": False, "title": "", "showgrid": False},
        },
        showlegend=False,
        margin={"l": 0, "r": 0, "t": 10, "b": 10},
    )
else:
    fig = px.scatter(df, x="x", y="y", **common)
    fig.update_traces(
        marker={"size": 8, "opacity": 0.88, "line": {"width": 0}},
        hovertemplate="<b>%{customdata[0]}</b><br>%{customdata[1]}<extra></extra>",
    )
    # Centroid overlay: diamond marker + party name label
    for party, row in centroids.iterrows():
        color = color_map.get(party, FALLBACK_COLOR)
        label = str(party).replace("\xad", "")
        fig.add_trace(
            go.Scatter(
                x=[row["x"]],
                y=[row["y"]],
                mode="markers+text",
                marker={
                    "size": 16,
                    "color": color,
                    "symbol": "diamond",
                    "line": {"width": 2, "color": "#fff"},
                },
                text=[label],
                textposition="top center",
                textfont={"size": 11, "color": color},
                hovertemplate=f"<b>{label}</b> (Zentroid)<extra></extra>",
                showlegend=False,
            )
        )
    fig.update_layout(
        xaxis={
            "showticklabels": False,
            "title": "",
            "showgrid": False,
            "zeroline": False,
        },
        yaxis={
            "showticklabels": False,
            "title": "",
            "showgrid": False,
            "zeroline": False,
        },
        plot_bgcolor="#F7F4EF",  # warm off-white — all party colors incl. black pop
        paper_bgcolor="rgba(0,0,0,0)",  # transparent, blends with page
        showlegend=False,
        margin={"l": 0, "r": 0, "t": 10, "b": 10},
    )

# Search box — find a politician by name (case-insensitive substring match)
query = st.text_input("Politiker suchen", placeholder="z. B. Scholz")
search_idx = None
if query:
    mask = df["name"].str.contains(query, case=False, na=False)
    hits = df[mask]
    if len(hits) == 0:
        st.caption("Kein Treffer.")
    elif len(hits) > 1:
        # Let user pick when multiple names match
        choice = st.selectbox("Treffer", hits["name"].tolist())
        search_idx = hits.index[hits["name"] == choice][0]
    else:
        search_idx = hits.index[0]

# Highlight searched politician in the 2D chart
if not is_3d and search_idx is not None:
    row = df.loc[search_idx]
    color = color_map.get(row["party"], FALLBACK_COLOR)
    fig.add_trace(
        go.Scatter(
            x=[row["x"]],
            y=[row["y"]],
            mode="markers",
            marker={
                "size": 18,
                "color": "rgba(0,0,0,0)",
                "line": {"width": 3, "color": color},
                "symbol": "circle",
            },
            hovertemplate=f"<b>{row['name']}</b><extra></extra>",
            showlegend=False,
        )
    )

event = st.plotly_chart(
    fig, width="stretch", on_select="rerun", selection_mode="points"
)

# Nearest neighbors: shown when user clicks a point or searches a name (2D only)
active_idx = None
if not is_3d:
    if search_idx is not None:
        active_idx = search_idx
    elif event.selection.points:  # ty: ignore[unresolved-attribute]
        sel = event.selection.points[0]  # ty: ignore[unresolved-attribute]
        dists = (df["x"] - sel["x"]) ** 2 + (df["y"] - sel["y"]) ** 2
        active_idx = dists.idxmin()

if active_idx is not None:
    selected = df.loc[active_idx]
    coords = df[["x", "y"]].to_numpy()
    all_dists = np.linalg.norm(coords - coords[df.index.get_loc(active_idx)], axis=1)
    neighbor_idx = df.index[np.argsort(all_dists)[1:6]]
    neighbors = df.loc[neighbor_idx, ["name", "party"]].rename(
        columns={"name": "Name", "party": "Partei"}
    )
    st.markdown(f"**Nächste Nachbarn von {selected['name']}**")
    st.dataframe(neighbors, hide_index=True, use_container_width=True)

st.markdown("---")

# --- Party cohesion: mean distance of each politician from their party centroid ---
st.markdown("#### Partei-Kohäsion")
cx = df["party"].map(centroids["x"])
cy = df["party"].map(centroids["y"])
coh = (
    np.sqrt((df["x"] - cx) ** 2 + (df["y"] - cy) ** 2)
    .groupby(df["party"])
    .mean()
    .reset_index(name="streuung")
)
coh = coh[coh["party"] != "fraktionslos"]
coh["label"] = coh["party"].str.replace("\xad", "", regex=False)
coh = coh.sort_values("streuung")
fig_coh = px.bar(
    coh,
    x="streuung",
    y="label",
    orientation="h",
    color="party",
    color_discrete_map=color_map,
    labels={"streuung": "Abstand vom Zentroid", "label": ""},
    height=350,
    custom_data=["label", "streuung"],
)
fig_coh.update_traces(
    hovertemplate=(
        "<b>%{customdata[0]}</b><br>Ø Abstand: %{customdata[1]:.3f}<extra></extra>"
    )
)
fig_coh.update_layout(showlegend=False, margin={"l": 0, "r": 0, "t": 0, "b": 0})
st.plotly_chart(fig_coh, width="stretch")

st.markdown(
    "<p style='text-align:center; color:#aaa; font-size:12px; margin-top:16px'>"
    "Daten: <a href='https://www.abgeordnetenwatch.de' style='color:#aaa'>"
    "abgeordnetenwatch.de</a>"
    "</p>",
    unsafe_allow_html=True,
)
