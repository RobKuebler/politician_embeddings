import pandas as pd
import streamlit as st

from src.storage import DATA_DIR, OUTPUTS_DIR

st.set_page_config(
    page_title="Parlascanned",
    page_icon="🏛️",
    layout="wide",
)

pages = [
    st.Page(
        "pages/home.py",
        title="Start",
        icon=":material/home:",
    ),
    st.Page(
        "pages/vote_map.py",
        title="Abstimmungslandkarte",
        icon=":material/scatter_plot:",
        url_path="vote_map",
    ),
    st.Page(
        "pages/party_profile.py",
        title="Parteiprofil",
        icon=":material/groups:",
        url_path="party_profile",
    ),
    st.Page(
        "pages/sidejobs.py",
        title="Nebeneinkünfte",
        icon=":material/payments:",
        url_path="sidejobs",
    ),
]

pg = st.navigation(pages)


@st.cache_data
def _load_periods() -> dict[int, str]:
    # Returns periods where both politicians.csv and embeddings CSV exist (needed by both pages).
    df = pd.read_csv(DATA_DIR / "periods.csv")

    def _label(row: pd.Series) -> str:
        parts = row["label"].split()
        return (
            f"{int(row['bundestag_number'])}. Legislaturperiode ({parts[1]}-{parts[3]})"
        )

    return {
        int(row["period_id"]): _label(row)
        for _, row in df.sort_values("period_id", ascending=False).iterrows()
        if (DATA_DIR / str(int(row["period_id"])) / "politicians.csv").exists()
        and (OUTPUTS_DIR / f"politician_embeddings_{row['period_id']}.csv").exists()
    }


_PERIODS = _load_periods()

# Initialize period_id before pg.run() so pages can safely read it on the first render.
if "period_id" not in st.session_state and _PERIODS:
    st.session_state["period_id"] = next(iter(_PERIODS))

st.sidebar.selectbox(
    "Wahlperiode",
    options=list(_PERIODS.keys()),
    format_func=lambda p: _PERIODS[p],
    key="period_id",
)

st.markdown(
    """
    <style>
    [data-testid="stSidebarNav"]::before {
        content: "🏛️ Parlascanned";
        display: block;
        font-size: 1.2rem;
        font-weight: 700;
        padding: 1.5rem 1rem 0.75rem;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

pg.run()
