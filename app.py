import streamlit as st

st.set_page_config(
    page_title="Parlascanned",
    page_icon="🏛️",
    layout="wide",
)

pages = [
    st.Page(
        "pages/vote_map.py",
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
