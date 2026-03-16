import sys
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# Ensure pages/ is on sys.path so constants can be imported on Streamlit Cloud.
sys.path.insert(0, str(Path(__file__).parent))
from constants import (
    BAR_LINE_COLOR,
    BAR_LINE_WIDTH,
    COLOR_SECONDARY,
    FALLBACK_COLOR,
    PARTY_COLORS,
    PARTY_ORDER,
)

from src.storage import DATA_DIR
from src.transforms import (
    compute_education_degree_pivot,
    compute_education_field_pivot,
    compute_occupation_pivot,
    compute_sex_counts,
)

CURRENT_YEAR = datetime.now(tz=UTC).year


@st.cache_data
def _load_csv(path: Path) -> pd.DataFrame:
    """Load a CSV from disk; result is cached and reused across reruns until the file changes."""
    return pd.read_csv(path)


# Header
st.html(
    f"""
    <div style='text-align:center; padding:32px 0 24px'>
      <h1 style='margin:0; font-size:2rem; letter-spacing:-0.5px'>
        Parteiprofil
      </h1>
      <p style='margin:8px 0 0; color:{COLOR_SECONDARY}; font-size:0.95rem; max-width:520px; margin-left:auto; margin-right:auto; line-height:1.6'>
        Demografische und berufliche Profile der Bundestagsfraktionen im Vergleich.
      </p>
    </div>
    """
)

period_id: int = st.session_state["period_id"]

pols_df = _load_csv(DATA_DIR / str(period_id) / "politicians.csv").copy()

# Ensure detail columns exist (backwards compatible with old CSVs that lack them)
for col in ["occupation", "year_of_birth", "field_title", "sex", "education"]:
    if col not in pols_df.columns:
        pols_df[col] = pd.NA

# Normalize party display labels (strip soft hyphen used in Grünen party name)
pols_df["party_label"] = pols_df["party"].str.replace("\xad", "", regex=False)

# Drop fraktionslos — too few members for meaningful comparison
pols_df = pols_df[pols_df["party"] != "fraktionslos"]

# Determine display order for this period
present = set(pols_df["party"].unique())
party_order_present = [p for p in PARTY_ORDER if p in present] + sorted(
    present - set(PARTY_ORDER)
)
party_labels_ordered = [p.replace("\xad", "") for p in party_order_present]
color_map = {
    p.replace("\xad", ""): PARTY_COLORS.get(p, FALLBACK_COLOR)
    for p in party_order_present
}

# Diverging colorscale for deviation heatmaps (red = below avg, blue = above avg)
_DEV_COLORSCALE = [
    [0.0, "#c0392b"],
    [0.35, "#e8a0a0"],
    [0.5, "#f5f5f5"],
    [0.65, "#a0c4e8"],
    [1.0, "#2471a3"],
]


def _deviation_heatmap(
    pivot_pct: pd.DataFrame,
    pct_z: np.ndarray,
    dev_z: np.ndarray,
    hover_label: str,
) -> go.Figure:
    """Create a heatmap colored by deviation from average, with %-text overlay."""
    dev_max = float(np.nanmax(np.abs(dev_z)))
    text = [[f"{v:+.0f}" if not np.isnan(v) else "" for v in row] for row in dev_z]
    # Custom data for hover: pct and deviation side by side
    custom = np.stack([np.round(pct_z, 1), np.round(dev_z, 0)], axis=-1)
    fig = go.Figure(
        go.Heatmap(
            z=dev_z,
            x=pivot_pct.columns.tolist(),
            y=pivot_pct.index.tolist(),
            colorscale=_DEV_COLORSCALE,
            showscale=False,
            zmid=0,
            zmin=-dev_max,
            zmax=dev_max,
            text=text,
            texttemplate="%{text}",
            textfont={"size": 11},
            customdata=custom,
            hovertemplate=(
                f"<b>%{{x}}</b> – %{{y}}<br>"
                f"<b>%{{customdata[0]:.1f}}%</b> {hover_label}<br>"
                f"%{{customdata[1]:+.0f}} Pp. vs. Ø Bundestag"
                f"<extra></extra>"
            ),
            hoverongaps=False,
            xgap=2,
            ygap=2,
        )
    )
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin={"l": 0, "r": 0, "t": 8, "b": 0},
        height=max(300, len(pivot_pct) * 40 + 60),
        xaxis={"side": "top", "showgrid": False},
        yaxis={"showgrid": False, "autorange": "reversed"},
    )
    return fig


# ── Altersverteilung ─────────────────────────────────────────────────────────
with st.container(border=True):
    st.markdown("##### Altersverteilung")
    st.caption(
        "Altersverteilung pro Fraktion. Halbe Violine zeigt die Dichteverteilung, "
        "jeder Punkt ist ein Abgeordneter. Alter berechnet aus dem Geburtsjahr."
    )
    # Raincloud: half violin (distribution) above + jittered points below.
    # Computed inline to include name for tooltip (compute_age_df omits it).
    # Uses a numeric y-axis so violin and points can be offset from the baseline.
    age_df = (
        pols_df[["party_label", "year_of_birth", "name"]]
        .dropna(subset=["year_of_birth"])
        .copy()
    )
    age_df["alter"] = CURRENT_YEAR - age_df["year_of_birth"].astype(int)

    fig_age = go.Figure()
    rng = np.random.RandomState(42)

    parties_with_data = [
        p
        for p in reversed(party_labels_ordered)
        if len(age_df[age_df["party_label"] == p]) > 0
    ]
    # Space parties far enough apart so violin + rain don't overlap the row below.
    STEP = 2.5
    for idx, party in enumerate(parties_with_data):
        y_base = idx * STEP
        subset = age_df[age_df["party_label"] == party]
        ages = subset["alter"].to_numpy()
        names = subset["name"].to_numpy()
        color = color_map.get(party, FALLBACK_COLOR)

        # Half violin on the positive side (extends upward from baseline)
        fig_age.add_trace(
            go.Violin(
                x=ages,
                y=np.full(len(ages), y_base),
                orientation="h",
                side="positive",
                fillcolor=color,
                line_color=color,
                opacity=0.55,
                width=1.8,
                points=False,
                showlegend=False,
                hoverinfo="skip",
            )
        )

        # Jittered points below the baseline; carry politician name in tooltip
        jitter = rng.uniform(-0.15, 0.15, len(ages))
        fig_age.add_trace(
            go.Scatter(
                x=ages,
                y=np.full(len(ages), y_base) - 0.55 + jitter,
                mode="markers",
                marker={"color": color, "size": 3, "opacity": 0.45},
                customdata=names,
                showlegend=False,
                hovertemplate=(
                    "<b>%{customdata}</b><br>"
                    f"<span style='color:#999'>{party}</span><br>"
                    "Alter: %{x} Jahre"
                    "<extra></extra>"
                ),
            )
        )

    tick_positions = [idx * STEP for idx in range(len(parties_with_data))]
    fig_age.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin={"l": 0, "r": 0, "t": 8, "b": 0},
        height=max(300, len(parties_with_data) * 90 + 60),
        showlegend=False,
        violingap=0,
        violinmode="overlay",
        xaxis={"showgrid": False, "title": "Alter"},
        yaxis={
            "showgrid": False,
            "title": "",
            "tickmode": "array",
            "tickvals": tick_positions,
            "ticktext": parties_with_data,
        },
    )
    st.plotly_chart(fig_age, width="stretch", config={"displayModeBar": True})

# ── Geschlecht ───────────────────────────────────────────────────────────────
with st.container(border=True):
    st.markdown("##### Geschlecht")
    st.caption(
        "Geschlechterverteilung pro Fraktion in Prozent. "
        "Balken zeigen den Anteil Männlich, Weiblich und Divers."
    )
    sex_counts = compute_sex_counts(pols_df)

    fig_sex = px.bar(
        sex_counts,
        x="party_label",
        y="pct",
        color="geschlecht",
        barmode="group",
        custom_data=["count"],
        labels={"party_label": "", "pct": "Anteil (%)", "geschlecht": "Geschlecht"},
        category_orders={"party_label": party_labels_ordered},
        height=360,
    )
    fig_sex.update_traces(
        hovertemplate=(
            "<b>%{x}</b> – %{fullData.name}<br>"
            "<b>%{y:.1f}%</b>"
            "<span style='color:#999'> (%{customdata[0]} Abgeordnete)</span>"
            "<extra></extra>"
        ),
        marker_line_width=BAR_LINE_WIDTH,
        marker_line_color=BAR_LINE_COLOR,
    )
    fig_sex.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin={"l": 0, "r": 0, "t": 8, "b": 0},
        xaxis={"showgrid": False},
        yaxis={"showgrid": False},
    )
    st.plotly_chart(fig_sex, width="stretch", config={"displayModeBar": True})

# ── Berufe (Heatmap) ────────────────────────────────────────────────────────
with st.container(border=True):
    st.markdown("##### Berufe")
    st.caption(
        "Welche Berufe sind in welcher Fraktion über- oder unterrepräsentiert? "
        "Zahl = Abweichung vom Bundestag-Ø in Prozentpunkten. "
        "Blau = überproportional, rot = unterproportional. "
        'Die Berufsbezeichnung "Abgeordneter" wurde entfernt.'
    )
    pivot, pct_z, dev_z = compute_occupation_pivot(pols_df, party_labels_ordered)
    st.plotly_chart(
        _deviation_heatmap(pivot, pct_z, dev_z, "der Fraktion"),
        width="stretch",
        config={"displayModeBar": True},
    )

# ── Ausbildung / Studienrichtung (Heatmap) ──────────────────────────────────
with st.container(border=True):
    st.markdown("##### Ausbildung / Studienrichtung")
    st.caption(
        "Welche Studienrichtungen sind in welcher Fraktion über- oder unterrepräsentiert? "
        "Zahl = Abweichung vom Bundestag-Ø in Prozentpunkten. "
        "Blau = überproportional, rot = unterproportional."
    )
    edu_pivot, edu_pct_z, edu_dev_z = compute_education_field_pivot(
        pols_df, party_labels_ordered
    )
    st.plotly_chart(
        _deviation_heatmap(edu_pivot, edu_pct_z, edu_dev_z, "der Fraktion"),
        width="stretch",
        config={"displayModeBar": True},
    )

# ── Abschlussniveau (Heatmap) ────────────────────────────────────────────────
with st.container(border=True):
    st.markdown("##### Abschlussniveau")
    st.caption(
        "Welche Abschlüsse sind in welcher Fraktion über- oder unterrepräsentiert? "
        "Zahl = Abweichung vom Bundestag-Ø in Prozentpunkten. "
        "Blau = überproportional, rot = unterproportional. Höchster erkennbarer Abschluss pro Abgeordnetem."
    )
    deg_pivot, deg_pct_z, deg_dev_z = compute_education_degree_pivot(
        pols_df, party_labels_ordered
    )
    st.plotly_chart(
        _deviation_heatmap(deg_pivot, deg_pct_z, deg_dev_z, "der Fraktion"),
        width="stretch",
        config={"displayModeBar": True},
    )

# Footer
st.html(
    "<p style='text-align:center; color:#ccc; font-size:12px; margin-top:48px'>"
    "von <a href='https://robkuebler.github.io' style='color:#ccc'>Robert Kübler</a>"
    " | Code auf <a href='https://github.com/RobKuebler/politician_embeddings' style='color:#ccc'>GitHub</a>"
    " | Daten von <a href='https://www.abgeordnetenwatch.de' style='color:#ccc'>"
    "abgeordnetenwatch.de</a>"
    "</p>"
)
