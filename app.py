import streamlit as st

st.set_page_config(
    page_title="Wer stimmt mit wem?",
    page_icon=":material/how_to_vote:",
    layout="wide",
)

pages = [
    st.Page(
        "pages/overview.py",
        title="Abstimmungslandkarte",
        icon=":material/scatter_plot:",
    ),
    st.Page(
        "pages/vote_comparison.py",
        title="Abstimmungsvergleich",
        icon=":material/compare_arrows:",
    ),
]

pg = st.navigation(pages)
pg.run()
