import sys
from datetime import UTC, date, datetime
from pathlib import Path

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


def _active_months(
    date_start_str: str | None,
    date_end_str: str | None,
    period_start: date,
    period_end: date,
) -> int:
    """Compute the number of active months within a period.

    Clamps the job's date range to the period boundaries:
      start = max(date_start or period_start, period_start)
      end   = min(date_end or today or period_end, period_end, today)
    """
    today = datetime.now(tz=UTC).date()
    job_start = date.fromisoformat(date_start_str) if date_start_str else period_start
    job_end = date.fromisoformat(date_end_str) if date_end_str else today

    start = max(job_start, period_start)
    end = min(job_end, period_end, today)
    if start > end:
        return 0
    return (end.year - start.year) * 12 + (end.month - start.month) + 1


@st.cache_data
def _load_csv(path: Path) -> pd.DataFrame:
    """Load a CSV from disk; result is cached until the file changes."""
    return pd.read_csv(path)


# Header
st.html(
    f"""
    <div style='text-align:center; padding:32px 0 24px'>
      <h1 style='margin:0; font-size:2rem; letter-spacing:-0.5px'>
        Nebeneinkünfte
      </h1>
      <p style='margin:8px 0 0; color:{COLOR_SECONDARY}; font-size:0.95rem;
                max-width:520px; margin-left:auto; margin-right:auto; line-height:1.6'>
        Offengelegte Nebentätigkeiten und Einkünfte der Bundestagsabgeordneten
        nach Partei. Datenquelle: abgeordnetenwatch.de.
      </p>
    </div>
    """
)

period_id: int = st.session_state["period_id"]
sidejobs_path = DATA_DIR / str(period_id) / "sidejobs.csv"

if not sidejobs_path.exists():
    st.info(
        "Noch keine Nebeneinkünfte-Daten für diese Periode. "
        "Bitte `fetch_data.py` ausführen."
    )
    st.stop()

pols_df = _load_csv(DATA_DIR / str(period_id) / "politicians.csv")
sj_df = _load_csv(sidejobs_path).copy()

# Join with politicians to get name and party.
df = sj_df.merge(
    pols_df[["politician_id", "name", "party"]],
    on="politician_id",
    how="left",
)
df["party_label"] = df["party"].str.replace("\xad", "", regex=False)

# Determine display order for parties present in this period.
present = set(df["party_label"].dropna().unique())
party_order_present = [
    p.replace("\xad", "") for p in PARTY_ORDER if p.replace("\xad", "") in present
] + sorted(present - {p.replace("\xad", "") for p in PARTY_ORDER})
color_map = {
    p.replace("\xad", ""): PARTY_COLORS.get(p, FALLBACK_COLOR)
    for p in PARTY_ORDER
    if p.replace("\xad", "") in present
}
color_map.update({p: FALLBACK_COLOR for p in present if p not in color_map})

# ── Data-coverage note ────────────────────────────────────────────────────────
n_total = len(df)
n_with_income = df["income"].notna().sum()
n_without = n_total - n_with_income
pct_without = n_without / n_total * 100 if n_total else 0
st.info(
    f"**{n_without} von {n_total}** Nebentätigkeiten ({pct_without:.0f} %) "
    "haben keine Betragsangabe (unentgeltlich oder nicht offengelegt) "
    "und fließen nicht in die Einkommens-Auswertungen ein."
)

# ── Central income computation ────────────────────────────────────────────────
# Prorate monthly and yearly entries to the period duration. Used by Charts 2-4.
periods_df = _load_csv(DATA_DIR / "periods.csv")
period_row = periods_df[periods_df["period_id"] == period_id]
has_period_dates = (
    not period_row.empty
    and "start_date" in period_row.columns
    and "interval" in df.columns
)

sj_income = df[df["income"].notna()].copy()
sj_income["income"] = pd.to_numeric(sj_income["income"], errors="coerce")

if has_period_dates:
    p_start = date.fromisoformat(str(period_row["start_date"].iloc[0]))
    p_end = date.fromisoformat(str(period_row["end_date"].iloc[0]))

    def _effective_income(row: pd.Series) -> float:
        """Return total income for the period, prorated by interval type.

        Monthly (1): income * active months.
        Yearly (2): income * (active months / 12).
        One-time (0) or unspecified (NaN): income as-is.
        """
        interval = str(row.get("interval", ""))
        ds = row.get("date_start") if pd.notna(row.get("date_start")) else None
        de = row.get("date_end") if pd.notna(row.get("date_end")) else None
        if interval == "1":
            return row["income"] * _active_months(ds, de, p_start, p_end)
        if interval == "2":
            return row["income"] * (_active_months(ds, de, p_start, p_end) / 12)
        return row["income"]

    sj_income["income"] = sj_income.apply(_effective_income, axis=1)

# Per-politician total income (only those with at least one exact disclosure).
pol_income = (
    sj_income.groupby(["politician_id", "name", "party_label"], as_index=False)[
        "income"
    ]
    .sum()
    .query("income > 0")
)

# ── Chart 2: Income by party ──────────────────────────────────────────────────
with st.container(border=True):
    st.markdown("##### Einkommen nach Partei")
    st.caption(
        "Nur Abgeordnete mit mindestens einem exakt offengelegten Betrag (Brutto). "
        "Monatliche und jährliche Zahlungen werden auf die Periodendauer hochgerechnet."
    )

    if pol_income.empty:
        st.info("Keine genauen Einkommensdaten verfügbar.")
    else:
        party_income = pol_income.groupby("party_label", as_index=False).agg(
            total=("income", "sum"), mean=("income", "mean")
        )
        party_income = party_income[
            party_income["party_label"].isin(party_order_present)
        ]

        def _income_bar(y_col: str, y_label: str, height: int = 300) -> go.Figure:
            fig = px.bar(
                party_income,
                x="party_label",
                y=y_col,
                color="party_label",
                color_discrete_map=color_map,
                labels={"party_label": "", y_col: y_label},
                category_orders={"party_label": party_order_present},
                height=height,
            )
            fig.update_traces(
                hovertemplate="<b>%{x}</b><br><b>%{y:,.0f} €</b><extra></extra>",
                showlegend=False,
                marker_line_width=BAR_LINE_WIDTH,
                marker_line_color=BAR_LINE_COLOR,
            )
            fig.update_layout(
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                margin={"l": 0, "r": 0, "t": 8, "b": 0},
                xaxis={"showgrid": False},
                yaxis={"showgrid": False, "tickformat": ",.0f"},
            )
            return fig

        st.markdown("###### Summe")
        st.plotly_chart(
            _income_bar("total", "Gesamteinkommen (€)"),
            width="stretch",
            config={"displayModeBar": True},
        )
        st.markdown("###### Ø pro Abgeordnetem")
        st.plotly_chart(
            _income_bar("mean", "Ø Einkommen (€)"),
            width="stretch",
            config={"displayModeBar": True},
        )

# ── Chart 4: Top earners ─────────────────────────────────────────────────────
with st.container(border=True):
    st.markdown("##### Top-Verdiener")
    st.caption(
        "Einmalzahlungen (Brutto). Monatliche und jährliche Zahlungen werden "
        "auf die Periodendauer hochgerechnet (max. bis Periodenende bzw. heute)."
    )

    if pol_income.empty:
        st.info("Keine genauen Einkommensdaten verfügbar.")
    else:
        top = pol_income.nlargest(15, "income")

        fig_top = go.Figure(
            go.Bar(
                x=top["income"],
                y=top["name"],
                orientation="h",
                marker={
                    "color": [
                        color_map.get(p, FALLBACK_COLOR) for p in top["party_label"]
                    ],
                    "line": {"color": BAR_LINE_COLOR, "width": BAR_LINE_WIDTH},
                },
                customdata=list(zip(top["party_label"], top["income"], strict=False)),
                hovertemplate=(
                    "<b>%{y}</b> (%{customdata[0]})<br>"
                    "<b>%{customdata[1]:,.0f} €</b><extra></extra>"
                ),
            )
        )
        fig_top.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            margin={"l": 0, "r": 0, "t": 8, "b": 0},
            height=max(300, len(top) * 28 + 60),
            xaxis={"showgrid": False, "title": "Einkommen (€)", "tickformat": ",.0f"},
            yaxis={"showgrid": False, "title": "", "autorange": "reversed"},
        )
        st.plotly_chart(fig_top, width="stretch", config={"displayModeBar": True})

# ── Chart 5: Top topics by income, stacked by party ─────────────────────────
with st.container(border=True):
    st.markdown("##### Themenfelder der Nebentätigkeiten")
    st.caption(
        "Top-Themenfelder nach Gesamteinkommen, aufgeschlüsselt nach Partei. "
        "Ein Nebenjob kann mehreren Themen zugeordnet sein."
    )

    # Explode pipe-separated topics into individual rows.
    sj_topics = sj_income[sj_income["topics"].notna()].copy()
    sj_topics["topic"] = sj_topics["topics"].str.split("|")
    sj_topics = sj_topics.explode("topic")
    sj_topics["topic"] = sj_topics["topic"].str.strip()
    sj_topics = sj_topics[sj_topics["topic"] != ""]

    if sj_topics.empty:
        st.info("Keine Themendaten verfügbar.")
    else:
        # Aggregate income and count per topic x party.
        topic_party = sj_topics.groupby(["topic", "party_label"], as_index=False).agg(
            income=("income", "sum"), count=("income", "size")
        )

        # Total income per topic for ranking and tooltip.
        topic_totals = topic_party.groupby("topic", as_index=False).agg(
            income_total=("income", "sum"), count_total=("count", "sum")
        )
        topic_totals = topic_totals.nlargest(15, "income_total")
        top_topics = topic_totals["topic"].tolist()
        topic_party = topic_party[topic_party["topic"].isin(top_topics)]

        # Merge totals for tooltip.
        topic_party = topic_party.merge(topic_totals, on="topic", how="left")

        # Sort topics by total income (highest on top in horizontal bar).
        topic_order = topic_totals.sort_values("income_total", ascending=False)[
            "topic"
        ].tolist()

        fig_topics = go.Figure()
        for party in party_order_present:
            subset = topic_party[topic_party["party_label"] == party]
            if subset.empty:
                continue
            fig_topics.add_trace(
                go.Bar(
                    y=subset["topic"],
                    x=subset["income"],
                    orientation="h",
                    name=party,
                    marker={
                        "color": color_map.get(party, FALLBACK_COLOR),
                        "line": {"color": BAR_LINE_COLOR, "width": BAR_LINE_WIDTH},
                    },
                    customdata=list(
                        zip(
                            subset["party_label"],
                            subset["count"],
                            subset["income_total"],
                            subset["count_total"],
                            strict=False,
                        )
                    ),
                    hovertemplate=(
                        "<b>%{y}</b><br>"
                        "%{customdata[0]}: <b>%{x:,.0f} €</b> "
                        "(%{customdata[1]} Tätigkeiten)<br>"
                        "<span style='color:#999'>Gesamt: %{customdata[2]:,.0f} € · "
                        "%{customdata[3]} Tätigkeiten</span>"
                        "<extra></extra>"
                    ),
                )
            )
        fig_topics.update_layout(
            height=max(300, len(top_topics) * 32 + 80),
            yaxis_categoryorder="array",
            yaxis_categoryarray=list(reversed(topic_order)),
        )
        fig_topics.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            margin={"l": 0, "r": 0, "t": 8, "b": 0},
            xaxis={"showgrid": False, "tickformat": ",.0f"},
            yaxis={"showgrid": False},
            legend={
                "title": "",
                "orientation": "h",
                "y": -0.15,
                "x": 0.5,
                "xanchor": "center",
            },
            barmode="stack",
        )
        st.plotly_chart(fig_topics, width="stretch", config={"displayModeBar": True})

# Footer
st.html(
    "<p style='text-align:center; color:#ccc; font-size:12px; margin-top:48px'>"
    "von <a href='https://robkuebler.github.io' style='color:#ccc'>Robert Kübler</a>"
    " | Code auf <a href='https://github.com/RobKuebler/politician_embeddings' style='color:#ccc'>GitHub</a>"
    " | Daten von <a href='https://www.abgeordnetenwatch.de' style='color:#ccc'>"
    "abgeordnetenwatch.de</a>"
    "</p>"
)
