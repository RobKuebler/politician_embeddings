from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

DATA_DIR = Path(__file__).parents[1] / "data"
OUTPUTS_DIR = Path(__file__).parents[1] / "outputs"

# Design tokens (same as app.py)
COLOR_SECONDARY = "#999"
COLOR_BODY = "#666"

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

st.set_page_config(page_title="Abstimmungsvergleich", layout="wide")

# Header
st.markdown(
    f"""
    <div style='text-align:center; padding:32px 0 24px'>
      <h1 style='margin:0; font-size:2rem; letter-spacing:-0.5px'>
        Abstimmungsvergleich
      </h1>
      <p style='margin:8px 0 0; color:{COLOR_SECONDARY}; font-size:0.95rem;
                max-width:520px; margin-left:auto; margin-right:auto; line-height:1.5'>
        Vergleiche das Abstimmungsverhalten einzelner Abgeordneter zu konkreten Themen.
      </p>
    </div>
    """,
    unsafe_allow_html=True,
)

# Load available periods (only those with embeddings, same logic as app.py)
_periods_df = pd.read_csv(DATA_DIR.parent / "data" / "periods.csv")


def _period_label(row: pd.Series) -> str:
    parts = row["label"].split()
    return f"{int(row['bundestag_number'])}. Legislaturperiode ({parts[1]}-{parts[3]})"


PERIODS = {
    int(row["period_id"]): _period_label(row)
    for _, row in _periods_df.sort_values("period_id", ascending=False).iterrows()
    if (OUTPUTS_DIR / f"politician_embeddings_{row['period_id']}.csv").exists()
}

period_id = st.selectbox(
    "Wahlperiode",
    options=list(PERIODS.keys()),
    format_func=lambda p: PERIODS[p],
    index=0,
)

# Load raw data for selected period
politicians = pd.read_csv(DATA_DIR / str(period_id) / "politicians.csv")
polls = pd.read_csv(DATA_DIR / str(period_id) / "polls.csv")
votes = pd.read_csv(DATA_DIR / str(period_id) / "votes.csv")

# Sort politicians by party order, then name
politicians["_party_rank"] = politicians["party"].apply(
    lambda p: PARTY_ORDER.index(p) if p in PARTY_ORDER else len(PARTY_ORDER)
)
politicians = politicians.sort_values(["_party_rank", "name"]).drop(
    columns="_party_rank"
)

# Selection controls
st.markdown("<div style='height:8px'></div>", unsafe_allow_html=True)
col_pol, col_poll = st.columns(2, gap="large")

with col_pol:

    def _pol_label(row: pd.Series) -> str:
        # "Name (Partei)" — used as multiselect option label
        party = row["party"].replace("\xad", "")
        return f"{row['name']} ({party})"

    pol_options = {
        row["politician_id"]: _pol_label(row) for _, row in politicians.iterrows()
    }
    selected_pol_ids = st.multiselect(
        "Abgeordnete",
        options=list(pol_options.keys()),
        format_func=lambda i: pol_options[i],
        placeholder="Abgeordnete suchen und auswählen …",
    )

with col_poll:
    poll_options = {row["poll_id"]: row["topic"] for _, row in polls.iterrows()}
    selected_poll_ids = st.multiselect(
        "Abstimmungen",
        options=list(poll_options.keys()),
        format_func=lambda i: poll_options[i],
        placeholder="Abstimmungen suchen und auswählen …",
    )

# Show placeholder when selection is incomplete
if not selected_pol_ids or not selected_poll_ids:
    st.markdown(
        f"<p style='color:{COLOR_SECONDARY}; font-size:14px; margin-top:24px; text-align:center'>"
        "Wähle mindestens einen Abgeordneten und eine Abstimmung aus.</p>",
        unsafe_allow_html=True,
    )
    st.stop()

# Build pivot table: rows = polls, columns = politicians
subset_votes = votes[
    votes["politician_id"].isin(selected_pol_ids)
    & votes["poll_id"].isin(selected_poll_ids)
]
pivot = subset_votes.pivot_table(
    index="poll_id", columns="politician_id", values="answer", aggfunc="first"
)
pivot = pivot.reindex(index=selected_poll_ids, columns=selected_pol_ids)


# Map answers to numeric values; missing entries fall back to no_show
def _to_num(v: object) -> int:
    if not isinstance(v, str):
        return 0
    return int(VOTE_META.get(v, VOTE_META["no_show"])["value"])


def _to_label(v: object) -> str:
    if not isinstance(v, str):
        return "–"
    return str(VOTE_META.get(v, VOTE_META["no_show"])["label"])


numeric = pivot.map(_to_num)
hover_text = pivot.map(_to_label).values.tolist()  # noqa: PD011

y_labels = [poll_options[pid] for pid in selected_poll_ids]
x_labels = [pol_options[pid] for pid in selected_pol_ids]

# Dynamic height: grows with number of selected polls
chart_height = max(300, 48 * len(selected_poll_ids) + 80)

fig = go.Figure(
    go.Heatmap(
        z=numeric.values,
        x=x_labels,
        y=y_labels,
        text=hover_text,
        texttemplate="%{text}",
        colorscale=COLORSCALE,
        zmin=0,
        zmax=3,
        showscale=False,
        xgap=3,
        ygap=3,
        hovertemplate="<b>%{x}</b><br>%{y}<br>%{text}<extra></extra>",
    )
)
fig.update_layout(
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
    },
)

# Color legend: Ja / Nein / Enthalten / keine Angabe
st.markdown("<div style='height:16px'></div>", unsafe_allow_html=True)
with st.container(border=True):
    st.markdown("##### Abstimmungsverhalten")

    legend_items = []
    for key in ("yes", "no", "abstain", "no_show"):
        meta = VOTE_META[key]
        color = meta["color"]
        label = meta["label"]
        legend_items.append(
            f"<span style='display:inline-flex; align-items:center; gap:6px; margin-right:16px'>"
            f"<span style='width:14px; height:14px; border-radius:3px; background:{color}; display:inline-block'></span>"
            f"<span style='font-size:13px; color:{COLOR_BODY}'>{label}</span></span>"
        )
    st.markdown(
        "<div style='display:flex; flex-wrap:wrap; gap:4px; margin-bottom:12px'>"
        + "".join(legend_items)
        + "</div>",
        unsafe_allow_html=True,
    )

    st.plotly_chart(fig, width="stretch")
