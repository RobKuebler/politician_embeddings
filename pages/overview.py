import contextlib
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
import streamlit.components.v1 as components

OUTPUTS_DIR = Path(__file__).parents[1] / "outputs"
DATA_DIR = Path(__file__).parents[1] / "data"


@st.cache_data
def _load_csv(path: Path) -> pd.DataFrame:
    # Cached CSV loader; result is reused across reruns until the file changes
    return pd.read_csv(path)


# Load only periods for which an embeddings CSV actually exists
_periods_df = _load_csv(OUTPUTS_DIR.parent / "data" / "periods.csv")


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

# Vote answer → display label, numeric value for colorscale, hex color
VOTE_META = {
    "yes": {"label": "Ja", "value": 3, "color": "#46962B"},
    "abstain": {"label": "Enthalten", "value": 2, "color": "#F5A623"},
    "no": {"label": "Nein", "value": 1, "color": "#E3000F"},
    "no_show": {"label": "–", "value": 0, "color": "#E0E0E0"},
}

# Discrete 4-step colorscale: no_show → no → abstain → yes
COLORSCALE = [
    [0.00, "#E0E0E0"],
    [0.25, "#E0E0E0"],  # no_show
    [0.25, "#E3000F"],
    [0.50, "#E3000F"],  # no
    [0.50, "#F5A623"],
    [0.75, "#F5A623"],  # abstain
    [0.75, "#46962B"],
    [1.00, "#46962B"],  # yes
]

# Design tokens
COLOR_SECONDARY = "#999"  # labels, secondary info, details summaries
COLOR_BODY = "#666"  # body text in expanded details, descriptive labels
MARKER_OUTLINE = "rgba(255,255,255,0.4)"  # outline on all chart markers and bars

# Color politician multiselect tags by party, poll tags neutral grey.
# Uses a zero-height iframe component so the script can access window.parent DOM.
# A MutationObserver keeps tags colored as the user adds/removes selections.
_PARTY_COLORS_JS = {k.replace("\xad", ""): v for k, v in PARTY_COLORS.items()}
components.html(
    f"""
    <script>
    const COLORS = {_PARTY_COLORS_JS};
    function colorize() {{
        window.parent.document.querySelectorAll('[data-baseweb="tag"]').forEach(tag => {{
            const text = (tag.querySelector('span')?.textContent ?? '').trim();
            let matched = false;
            for (const [party, color] of Object.entries(COLORS)) {{
                if (text.endsWith('(' + party + ')')) {{
                    tag.style.setProperty('background-color', color, 'important');
                    tag.style.setProperty('color', party === 'FDP' ? '#333' : '#fff', 'important');
                    matched = true;
                    break;
                }}
            }}
            if (!matched) {{
                tag.style.setProperty('background-color', '#555', 'important');
                tag.style.setProperty('color', '#fff', 'important');
            }}
        }});
    }}
    const obs = new MutationObserver(colorize);
    obs.observe(window.parent.document.body, {{childList: true, subtree: true}});
    colorize();
    </script>
    """,
    height=0,
)

# Session state for bidirectional scatter ↔ politician multiselect sync
if "heatmap_pol_ids" not in st.session_state:
    st.session_state.heatmap_pol_ids = []
if "prev_scatter_pol_ids" not in st.session_state:
    st.session_state.prev_scatter_pol_ids = []

# Restore poll selection that was saved before a forced st.rerun() (widget state would
# otherwise be cleared because the poll multiselect hasn't rendered yet in that run).
if "preserved_poll_ids" in st.session_state:
    st.session_state.heatmap_poll_ids = st.session_state.pop("preserved_poll_ids")

# Header
st.markdown(
    f"""
    <div style='text-align:center; padding:32px 0 24px'>
      <h1 style='margin:0; font-size:2rem; letter-spacing:-0.5px'>
        Wer stimmt mit wem?
      </h1>
      <p style='margin:8px 0 0; color:{COLOR_SECONDARY}; font-size:0.95rem; max-width:520px; margin-left:auto; margin-right:auto; line-height:1.6'>
        Wie ähnlich stimmen Bundestagsabgeordnete ab, und wo verlaufen die echten Trennlinien?
        Alle namentlichen Abstimmungen einer Wahlperiode, visualisiert als Punkte im Raum.
        Je näher zwei Punkte, desto ähnlicher das Abstimmungsverhalten.
      </p>
    </div>
    """,
    unsafe_allow_html=True,
)

period_id = st.selectbox(
    "Wahlperiode",
    options=list(PERIODS.keys()),
    format_func=lambda p: PERIODS[p],
    index=0,
)

df = _load_csv(OUTPUTS_DIR / f"politician_embeddings_{period_id}.csv")
pols_df = _load_csv(DATA_DIR / str(period_id) / "politicians.csv")
polls_df = _load_csv(DATA_DIR / str(period_id) / "polls.csv")

# Merge politician_id into the embeddings df if not already present
if "politician_id" not in df.columns:
    df = df.merge(pols_df[["name", "politician_id"]], on="name", how="left")

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
    "<div style='display:flex; flex-wrap:wrap; gap:8px; margin:16px 0 16px'>"
    + "".join(pills)
    + "</div>",
    unsafe_allow_html=True,
)

# Build scatter chart
centroids = df.groupby("party")[["x", "y"]].mean()
is_3d = "z" in df.columns

common = {
    "color": "party",
    "color_discrete_map": color_map,
    "hover_data": {"name": True, "party": True, "x": False, "y": False},
    "labels": {"party": "Partei", "name": "Name"},
    "custom_data": ["name", "party", "politician_id"],
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

    # Highlight rings for multiselect-selected politicians (state from previous rerun)
    # Two rings per politician: white outer for contrast, party-colored inner
    _highlighted = df[df["politician_id"].isin(st.session_state.heatmap_pol_ids)]
    for _, row in _highlighted.iterrows():
        color = color_map.get(row["party"], FALLBACK_COLOR)
        for size, ring_color in ((22, "white"), (17, color)):
            fig.add_trace(
                go.Scatter(
                    x=[row["x"]],
                    y=[row["y"]],
                    mode="markers",
                    marker={
                        "size": size,
                        "color": "rgba(0,0,0,0)",
                        "line": {"width": 3, "color": ring_color},
                        "symbol": "circle",
                    },
                    customdata=[[row["name"], row["party"], row["politician_id"]]],
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
        f"<summary style='cursor:pointer; list-style:none; color:{COLOR_SECONDARY}; font-size:12px'>ⓘ Wie lese ich das?</summary>"
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
            "Punkte zueinander zählt. ◆ markiert jeweils den Mittelpunkt einer Fraktion.<br><br>"
            "Mit Box- oder Lasso-Auswahl (Toolbar rechts oben) können mehrere Abgeordnete "
            "gleichzeitig ausgewählt werden, sie erscheinen dann in der Heatmap unten."
        ),
        unsafe_allow_html=True,
    )
    event = st.plotly_chart(
        fig,
        width="stretch",
        on_select="rerun",
        selection_mode=["points", "box", "lasso"],
    )

# Resolve politician IDs from scatter selection; sync to multiselect when selection changes
_scatter_pol_ids: list[int] = []
for pt in event.selection.points:  # ty: ignore[unresolved-attribute]
    cd = pt.get("customdata", [])
    if len(cd) >= 3 and cd[2] is not None:
        with contextlib.suppress(ValueError, TypeError):
            _scatter_pol_ids.append(int(cd[2]))
_scatter_pol_ids = list(dict.fromkeys(_scatter_pol_ids))

# Sync scatter selection → multiselect.
# Box/lasso: replace the selection entirely.
# Single point click: toggle the politician (add if new, remove if already selected).
# In both cases rerun immediately so highlight rings appear in the same cycle.
if _scatter_pol_ids and _scatter_pol_ids != st.session_state.prev_scatter_pol_ids:
    is_box_or_lasso = bool(
        event.selection.get("box") or event.selection.get("lasso")  # ty: ignore[unresolved-attribute]
    )
    if is_box_or_lasso:
        new_ids = _scatter_pol_ids
    else:
        existing = list(st.session_state.heatmap_pol_ids)
        new_ids = existing[:]
        for pid in _scatter_pol_ids:
            if pid in new_ids:
                new_ids.remove(pid)
            else:
                new_ids.append(pid)
    st.session_state.heatmap_pol_ids = new_ids
    st.session_state.prev_scatter_pol_ids = _scatter_pol_ids
    st.session_state.preserved_poll_ids = list(
        st.session_state.get("heatmap_poll_ids", [])
    )
    st.rerun()
st.session_state.prev_scatter_pol_ids = _scatter_pol_ids

# ─── Abstimmungsverhalten heatmap ────────────────────────────────────────────
st.markdown("<div style='height:24px'></div>", unsafe_allow_html=True)
with st.container(border=True):
    st.markdown("##### Abstimmungsverhalten")

    pol_options = {
        int(r["politician_id"]): f"{r['name']} ({r['party'].replace(chr(173), '')})"
        for _, r in pols_df.sort_values("name").iterrows()
    }
    selected_pol_ids: list[int] = st.multiselect(
        "Abgeordnete",
        options=list(pol_options.keys()),
        format_func=lambda i: pol_options[i],
        key="heatmap_pol_ids",
        placeholder="Abgeordnete suchen und auswählen …",
    )

    poll_options = {row["poll_id"]: row["topic"] for _, row in polls_df.iterrows()}
    selected_poll_ids = st.multiselect(
        "Abstimmungen",
        options=list(poll_options.keys()),
        format_func=lambda i: poll_options[i],
        key="heatmap_poll_ids",
        placeholder="Abstimmungen suchen und auswählen …",
    )

    if not selected_pol_ids:
        st.markdown(
            f"<p style='color:{COLOR_SECONDARY}; font-size:14px; margin-top:4px; text-align:center'>"
            "Wähle Abgeordnete im Dropdown oben oder per Box-/Lasso-Auswahl im Diagramm aus.</p>",
            unsafe_allow_html=True,
        )
    elif not selected_poll_ids:
        st.markdown(
            f"<p style='color:{COLOR_SECONDARY}; font-size:14px; margin-top:4px; text-align:center'>"
            "Wähle mindestens eine Abstimmung aus.</p>",
            unsafe_allow_html=True,
        )
    else:
        votes_df = _load_csv(DATA_DIR / str(period_id) / "votes.csv")

        # Build name labels for selected politicians
        pol_rows = pols_df[pols_df["politician_id"].isin(selected_pol_ids)]
        pol_labels = {
            int(r["politician_id"]): f"{r['name']} ({r['party'].replace(chr(173), '')})"
            for _, r in pol_rows.iterrows()
        }

        subset = votes_df[
            votes_df["politician_id"].isin(selected_pol_ids)
            & votes_df["poll_id"].isin(selected_poll_ids)
        ]
        pivot = subset.pivot_table(
            index="poll_id", columns="politician_id", values="answer", aggfunc="first"
        )
        pivot = pivot.reindex(index=selected_poll_ids, columns=selected_pol_ids)

        def _to_num(v: object) -> float:
            # no_show and missing → NaN so the cell renders transparent
            if not isinstance(v, str) or v == "no_show":
                return np.nan
            return float(VOTE_META.get(v, VOTE_META["no_show"])["value"])

        def _to_label(v: object) -> str:
            if not isinstance(v, str):
                return "–"
            return str(VOTE_META.get(v, VOTE_META["no_show"])["label"])

        numeric = pivot.map(_to_num)
        hover_labels = pivot.map(_to_label).values.tolist()  # noqa: PD011

        y_labels = [poll_options[pid] for pid in selected_poll_ids]
        y_tick_text = [t if len(t) <= 50 else t[:47] + "…" for t in y_labels]
        x_labels = [pol_labels.get(pid, str(pid)) for pid in selected_pol_ids]
        chart_height = max(300, 48 * len(selected_poll_ids) + 80)

        fig_heat = go.Figure(
            go.Heatmap(
                z=numeric.values,
                x=x_labels,
                y=y_labels,
                text=hover_labels,
                colorscale=[
                    [0.00, "#E3000F"],
                    [0.33, "#E3000F"],
                    [0.33, "#F5A623"],
                    [0.67, "#F5A623"],
                    [0.67, "#46962B"],
                    [1.00, "#46962B"],
                ],
                zmin=1,
                zmax=3,
                showscale=False,
                xgap=3,
                ygap=3,
                hoverongaps=False,
                hovertemplate="<b>%{x}</b><br>%{y}<br>%{text}<extra></extra>",
            )
        )
        fig_heat.update_layout(
            height=chart_height,
            margin={"l": 0, "r": 0, "t": 8, "b": 0},
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            xaxis={
                "side": "top",
                "tickangle": -30,
                "tickfont": {"size": 12},
                "showgrid": False,
            },
            yaxis={
                "autorange": "reversed",
                "tickfont": {"size": 12},
                "showgrid": False,
                "tickmode": "array",
                "tickvals": y_labels,
                "ticktext": y_tick_text,
            },
        )

        # Color legend
        legend_items = []
        for key in ("yes", "no", "abstain"):
            meta = VOTE_META[key]
            legend_items.append(
                f"<span style='display:inline-flex; align-items:center; gap:6px; margin-right:16px'>"
                f"<span style='width:14px; height:14px; border-radius:3px; background:{meta['color']}; display:inline-block'></span>"
                f"<span style='font-size:13px; color:{COLOR_BODY}'>{meta['label']}</span></span>"
            )
        st.markdown(
            "<div style='display:flex; flex-wrap:wrap; gap:16px; margin-bottom:12px'>"
            + "".join(legend_items)
            + "</div>",
            unsafe_allow_html=True,
        )

        st.plotly_chart(fig_heat, width="stretch")

st.markdown("<div style='height:32px'></div>", unsafe_allow_html=True)
with st.container(border=True):
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
    "von <a href='https://robkuebler.github.io' style='color:#ccc'>Robert Kübler</a>"
    " | Code auf <a href='https://github.com/RobKuebler/politician_embeddings' style='color:#ccc'>GitHub</a>"
    " | Daten von <a href='https://www.abgeordnetenwatch.de' style='color:#ccc'>"
    "abgeordnetenwatch.de</a>"
    "</p>",
    unsafe_allow_html=True,
)
