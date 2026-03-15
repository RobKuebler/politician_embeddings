import streamlit as st

st.set_page_config(
    page_title="Parlascanned",
    page_icon="🏛️",
    layout="wide",
)

pages = [
    st.Page(
        "pages/overview.py",
        title="Abstimmungslandkarte",
        icon=":material/scatter_plot:",
    ),
    st.Page(
        "pages/party_profile.py",
        title="Parteiprofil",
        icon=":material/groups:",
    ),
]

pg = st.navigation(pages)
pg.run()
