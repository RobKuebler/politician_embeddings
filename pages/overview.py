from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

OUTPUTS_DIR = Path(__file__).parents[1] / "outputs"
DATA_DIR = Path(__file__).parents[1] / "data"

# Load only periods for which an embeddings CSV actually exists
_periods_df = pd.read_csv(OUTPUTS_DIR.parent / "data" / "periods.csv")


def _period_label(row: pd.Series) -> str:
    # "21. Legislaturperiode (2025-2029)", years extracted from "Bundestag YYYY - YYYY"
    parts = row["label"].split()  # ["Bundestag", "2025", "-", "2029"]
    return f"{int(row['bundestag_number'])}. Legislaturperiode ({parts[1]}-{parts[3]})"


PERIODS = {
    int(row["period_id"]): _period_label(row)
    for _, row in _periods_df.sort_values("period_id", ascending=False).iterrows()
    if (OUTPUTS_DIR / f"politician_embeddings_{row['period_id']}.csv").exists()
}

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

# Design tokens
COLOR_SECONDARY = "#999"  # labels, secondary info, details summaries
COLOR_BODY = "#666"  # body text in expanded details, descriptive labels
MARKER_OUTLINE = "rgba(255,255,255,0.4)"  # outline on all chart markers and bars

# Track which interaction happened last: "search" or "click"
if "last_action" not in st.session_state:
    st.session_state.last_action = "search"
if "prev_selection" not in st.session_state:
    st.session_state.prev_selection = None

# Header
st.markdown(
    f"""
    <div style='text-align:center; padding:32px 0 24px'>
      <h1 style='margin:0; font-size:2rem; letter-spacing:-0.5px'>
        Wer stimmt mit wem?
      </h1>
      <p style='margin:8px 0 0; color:{COLOR_SECONDARY}; font-size:0.95rem; max-width:520px; margin-left:auto; margin-right:auto; line-height:1.5'>
        Abstimmungsverhalten aller Abgeordneten als Punkte im Raum.
        Je näher zwei Punkte, desto ähnlicher das Wahlverhalten.
      </p>
    </div>
    """,
    unsafe_allow_html=True,
)

# Controls row: period selector + search side by side
col_period, col_search = st.columns([3, 2], gap="large")
with col_period:
    period_id = st.selectbox(
        "Wahlperiode",
        options=list(PERIODS.keys()),
        format_func=lambda p: PERIODS[p],
        index=0,
    )
with col_search:
    query = st.text_input(
        "Suche",
        placeholder="z. B. Müller",
        key="search_query",
        on_change=lambda: st.session_state.update(last_action="search"),
    )

df = pd.read_csv(OUTPUTS_DIR / f"politician_embeddings_{period_id}.csv")

# Party legend
present = set(df["party"].unique())
party_order = [p for p in PARTY_ORDER if p in present] + sorted(
    present - set(PARTY_ORDER)
)
color_map = {p: PARTY_COLORS.get(p, FALLBACK_COLOR) for p in present}

pills = []
for party in party_order:
    color = PARTY_COLORS.get(party, FALLBACK_COLOR)
    label = party.replace("\xad", "")
    text_color = "#fff" if color != "#FFED00" else "#333"
    pills.append(
        f"<span style='background:{color}; color:{text_color}; "
        f"padding:4px 12px; border-radius:20px; font-size:13px; "
        f"font-weight:500; white-space:nowrap'>{label}</span>"
    )
st.markdown(
    "<div style='display:flex; flex-wrap:wrap; gap:8px; margin:8px 0 16px'>"
    + "".join(pills)
    + "</div>",
    unsafe_allow_html=True,
)

# Search logic
search_idx = None
if query:
    mask = df["name"].str.contains(query, case=False, na=False)
    hits = df[mask]
    if len(hits) == 0:
        st.caption("Kein Treffer.")
    elif len(hits) > 1:
        labels = [f"{r['name']} ({r['party']})" for _, r in hits.iterrows()]
        choice = st.selectbox("Treffer", labels)
        chosen_name = choice.split(" (")[0]
        search_idx = hits.index[hits["name"] == chosen_name][0]
    else:
        search_idx = hits.index[0]

# Build scatter chart
centroids = df.groupby("party")[["x", "y"]].mean()
is_3d = "z" in df.columns

common = {
    "color": "party",
    "color_discrete_map": color_map,
    "hover_data": {"name": True, "party": True, "x": False, "y": False},
    "labels": {"party": "Partei", "name": "Name"},
    "custom_data": ["name", "party"],
    "height": 720,
}

if is_3d:
    common["hover_data"]["z"] = False
    fig = px.scatter_3d(df, x="x", y="y", z="z", **common)
    fig.update_traces(
        marker={
            "size": 4,
            "opacity": 0.85,
            "line": {"width": 1, "color": MARKER_OUTLINE},
        }
    )
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
        marker={
            "size": 7,
            "opacity": 0.82,
            "line": {"width": 1, "color": MARKER_OUTLINE},
        },
        hovertemplate=(
            "<b>%{customdata[0]}</b><br>"
            f"<span style='color:{COLOR_SECONDARY}'>%{{customdata[1]}}</span>"
            "<extra></extra>"
        ),
    )

    # Centroid: diamond marker + party name label
    for party, row in centroids.iterrows():
        color = color_map.get(party, FALLBACK_COLOR)
        label = str(party).replace("\xad", "")
        fig.add_trace(
            go.Scatter(
                x=[row["x"]],
                y=[row["y"]],
                mode="markers+text",
                marker={
                    "size": 14,
                    "color": color,
                    "symbol": "diamond",
                    "line": {"width": 2, "color": "rgba(255,255,255,0.9)"},
                },
                text=[f"<b>{label}</b>"],
                textposition="top center",
                textfont={"size": 11, "color": color},
                hovertemplate=f"<b>{label}</b> (Partei-Zentrum)<extra></extra>",
                showlegend=False,
            )
        )

    # Highlight ring for searched politician
    if search_idx is not None:
        row = df.loc[search_idx]
        color = color_map.get(row["party"], FALLBACK_COLOR)
        fig.add_trace(
            go.Scatter(
                x=[row["x"]],
                y=[row["y"]],
                mode="markers",
                marker={
                    "size": 20,
                    "color": "rgba(0,0,0,0)",
                    "line": {"width": 3, "color": color},
                    "symbol": "circle",
                },
                hovertemplate=f"<b>{row['name']}</b><extra></extra>",
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
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        showlegend=False,
        margin={"l": 0, "r": 0, "t": 16, "b": 16},
    )


# Reusable HTML snippet for the collapsible "Wie lese ich das?" details element
def _info_details(body: str) -> str:
    return (
        f"<details style='margin:0 0 12px'>"
        f"<summary style='cursor:pointer; list-style:none; color:{COLOR_SECONDARY}; font-size:12px'>ℹ Wie lese ich das?</summary>"
        f"<div style='color:{COLOR_BODY}; font-size:13px; margin-top:6px; line-height:1.6'>{body}</div>"
        f"</details>"
    )


with st.container(border=True):
    st.markdown("##### Abstimmungslandkarte")
    st.markdown(
        _info_details(
            "Jeder Punkt steht für einen Abgeordneten. Je näher zwei Punkte beieinander "
            "liegen, desto ähnlicher haben die beiden abgestimmt.<br><br>"
            "Aus allen namentlichen Abstimmungen der Wahlperiode wird für jeden Abgeordneten "
            "ein Profil berechnet, das zeigt, wie er oder sie typischerweise abstimmt. "
            "Ein KI-Modell verdichtet diese Profile so auf zwei Dimensionen, dass "
            "ähnliche Abstimmungsmuster nah beieinander landen.<br><br>"
            "Die Achsen selbst haben keine Bedeutung. Nur die relative <b>Nähe</b> der "
            "Punkte zueinander zählt. ◆ markiert jeweils den Mittelpunkt einer Fraktion."
        ),
        unsafe_allow_html=True,
    )
    event = st.plotly_chart(
        fig, width="stretch", on_select="rerun", selection_mode="points"
    )

# Detect if the plotly selection changed this rerun → user clicked
current_sel = event.selection.points[0] if event.selection.points else None  # ty: ignore[unresolved-attribute]
if current_sel != st.session_state.prev_selection:
    st.session_state.prev_selection = current_sel
    if current_sel is not None:
        st.session_state.last_action = "click"

# Resolve active selection: whichever action happened last wins
active_idx = None
if not is_3d:
    if st.session_state.last_action == "click" and current_sel is not None:
        dists = (df["x"] - current_sel["x"]) ** 2 + (df["y"] - current_sel["y"]) ** 2
        active_idx = dists.idxmin()
    elif st.session_state.last_action == "search" and search_idx is not None:
        active_idx = search_idx

# Bottom section: neighbors (left) + cohesion (right)
st.markdown("<div style='height:32px'></div>", unsafe_allow_html=True)
col_neighbors, col_cohesion = st.columns(2, gap="large")

with col_neighbors, st.container(border=True):
    st.markdown("##### Ähnlichste Abgeordnete")
    st.markdown(
        _info_details(
            "Die fünf Abgeordneten mit dem ähnlichsten Abstimmungsverhalten, "
            "unabhängig von der Parteizugehörigkeit. Manchmal stimmen Abgeordnete "
            "verschiedener Fraktionen häufiger überein als Mitglieder derselben Partei."
        ),
        unsafe_allow_html=True,
    )
    if active_idx is not None:
        selected = df.loc[active_idx]
        coords = df[["x", "y"]].to_numpy()
        all_dists = np.linalg.norm(
            coords - coords[df.index.get_loc(active_idx)], axis=1
        )
        neighbor_idx = df.index[np.argsort(all_dists)[1:6]]
        neighbors = df.loc[neighbor_idx]

        st.markdown(
            f"<p style='color:{COLOR_BODY}; font-size:13px; margin:0 0 12px'>Ähnlichstes Abstimmungsverhalten "
            f"wie <b>{selected['name']}</b>:</p>",
            unsafe_allow_html=True,
        )

        rows_html = []
        for _, n in neighbors.iterrows():
            color = color_map.get(n["party"], FALLBACK_COLOR)
            label = n["party"].replace("\xad", "")
            text_color = "#fff" if color != "#FFED00" else "#333"
            badge = (
                f"<span style='background:{color}; color:{text_color}; "
                f"padding:2px 9px; border-radius:20px; font-size:11px; "
                f"font-weight:500; white-space:nowrap'>{label}</span>"
            )
            rows_html.append(
                f"<div style='display:flex; align-items:center; justify-content:space-between; "
                f"gap:12px; padding:8px 0; border-bottom:1px solid #ebebeb'>"
                f"<span style='font-size:14px'>{n['name']}</span>"
                f"{badge}</div>"
            )
        st.markdown("".join(rows_html), unsafe_allow_html=True)

        # Button: selected + neighbors in Vergleich öffnen
        st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)
        if st.button("In Vergleich öffnen →", key="compare_btn"):
            all_names = [selected["name"], *neighbors["name"].tolist()]
            pols_df = pd.read_csv(DATA_DIR / str(period_id) / "politicians.csv")
            matched_ids = pols_df[pols_df["name"].isin(all_names)][
                "politician_id"
            ].tolist()
            st.session_state["preselect_pol_ids"] = matched_ids
            st.session_state["preselect_period_id"] = period_id
            st.switch_page("pages/vote_comparison.py")
    else:
        st.markdown(
            f"<p style='color:{COLOR_SECONDARY}; font-size:14px; margin-top:8px'>"
            "Wähle einen Abgeordneten im Diagramm aus.</p>",
            unsafe_allow_html=True,
        )

with col_cohesion, st.container(border=True):
    st.markdown("##### Fraktionsdisziplin")
    st.markdown(
        _info_details(
            "Der Balken zeigt, wie weit die Abgeordneten einer Fraktion im Diagramm "
            "durchschnittlich vom Fraktionsmittelpunkt entfernt sind.<br><br>"
            "<b>Kurzer Balken:</b> Die Fraktion stimmt fast immer geschlossen ab.<br>"
            "<b>Langer Balken:</b> Es gibt starke Abweichler."
        ),
        unsafe_allow_html=True,
    )

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
        labels={"streuung": "", "label": ""},
        height=300,
        custom_data=["label", "streuung"],
    )
    fig_coh.update_traces(
        hovertemplate=(
            "<b>%{customdata[0]}</b><br>Ø Abstand: %{customdata[1]:.3f}<extra></extra>"
        ),
        marker_line_width=1,
        marker_line_color=MARKER_OUTLINE,
    )
    fig_coh.update_layout(
        showlegend=False,
        margin={"l": 0, "r": 0, "t": 0, "b": 0},
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        xaxis={"showgrid": False, "zeroline": False, "showticklabels": False},
        yaxis={"showgrid": False},
    )
    st.plotly_chart(fig_coh, width="stretch")

# Footer
st.markdown(
    "<p style='text-align:center; color:#ccc; font-size:12px; margin-top:48px'>"
    "Daten: <a href='https://www.abgeordnetenwatch.de' style='color:#ccc'>"
    "abgeordnetenwatch.de</a>"
    "</p>",
    unsafe_allow_html=True,
)
