import sys
from pathlib import Path

import streamlit as st

# Ensure pages/ is on sys.path so constants can be imported on Streamlit Cloud.
sys.path.insert(0, str(Path(__file__).parent))
from constants import COLOR_SECONDARY

st.html(
    f"""
    <div style='text-align:center; padding:48px 0 32px'>
      <h1 style='margin:0; font-size:2.4rem; letter-spacing:-0.5px'>
        🏛️ Parlascanned
      </h1>
      <p style='margin:12px 0 0; color:{COLOR_SECONDARY}; font-size:1rem;
                max-width:580px; margin-left:auto; margin-right:auto; line-height:1.7'>
        Abstimmungsverhalten, politische Trennlinien, demografische Profile:
        Parlascanned macht öffentliche Daten über Bundestagsabgeordnete interaktiv erkundbar.
        Alle Wahlperioden ab 2021, laufend erweitert.
      </p>
    </div>
    """
)

# Make all three cards the same height.
st.html(
    """
    <style>
    div[data-testid="stHorizontalBlock"] > div[data-testid="stColumn"] > div[data-testid="stVerticalBlockBorderWrapper"] {
        height: 100%;
    }
    div[data-testid="stHorizontalBlock"] > div[data-testid="stColumn"] > div[data-testid="stVerticalBlockBorderWrapper"] > div {
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    </style>
    """
)

col1, col2, col3 = st.columns(3)

with col1, st.container(border=True):
    st.markdown("#### :material/scatter_plot: Abstimmungslandkarte")
    st.markdown(
        "Ein KI-Modell ordnet jeden Abgeordneten als Punkt im Raum an. "
        "Je näher zwei Punkte, desto ähnlicher das Abstimmungsverhalten. "
        "Wähle Abgeordnete aus und vergleiche ihre Stimmen direkt."
    )
    st.page_link(
        "pages/vote_map.py",
        label="Zur Abstimmungslandkarte",
        icon=":material/arrow_forward:",
    )

with col2, st.container(border=True):
    st.markdown("#### :material/groups: Parteiprofil")
    st.markdown(
        "Demografische und berufliche Profile der Bundestagsfraktionen im Vergleich: "
        "Berufe, Altersverteilung, Geschlecht, akademische Titel."
    )
    st.page_link(
        "pages/party_profile.py",
        label="Zum Parteiprofil",
        icon=":material/arrow_forward:",
    )

with col3, st.container(border=True):
    st.markdown("#### :material/payments: Nebeneinkünfte")
    st.markdown(
        "Offengelegte Nebentätigkeiten und Einkünfte der Abgeordneten nach Partei: "
        "Anzahl der Tätigkeiten, Einkommensniveaus, Top-Verdiener."
    )
    st.page_link(
        "pages/sidejobs.py",
        label="Zu den Nebeneinkünften",
        icon=":material/arrow_forward:",
    )

st.html(
    "<p style='text-align:center; color:#ccc; font-size:12px; margin-top:48px'>"
    "von <a href='https://robkuebler.github.io' style='color:#ccc'>Robert Kübler</a>"
    " | Code auf <a href='https://github.com/RobKuebler/politician_embeddings' style='color:#ccc'>GitHub</a>"
    " | Daten von <a href='https://www.abgeordnetenwatch.de' style='color:#ccc'>"
    "abgeordnetenwatch.de</a>"
    "</p>"
)
