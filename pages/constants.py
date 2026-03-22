# Shared presentation constants for all dashboard pages.
# Party colors and order are official/conventional values not stored in the CSVs.

PARTY_COLORS: dict[str, str] = {
    "CDU/CSU": "#2a2a2a",
    "SPD": "#E3000F",
    "AfD": "#009EE0",
    "BÜNDNIS 90/\xadDIE GRÜNEN": "#46962B",
    "Die Linke": "#FF69B4",
    "Die Linke.": "#FF69B4",
    "BSW": "#722EA5",
    "FDP": "#FFED00",
    "fraktionslos": "#888888",
}

FALLBACK_COLOR = "#888888"

# Preferred display order (most seats first); unknown parties are appended alphabetically.
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

# Party whose marker needs a white outline because its fill color is black.
DARK_FILL_PARTY = "CDU/CSU"

# Label for politicians not belonging to any faction; excluded from cohesion charts.
NO_FACTION_LABEL = "fraktionslos"

# Design tokens
COLOR_SECONDARY = "#999"  # secondary labels, detail summaries
COLOR_BODY = "#666"  # body text in expanded detail sections
MARKER_OUTLINE = "rgba(255,255,255,0.4)"  # scatter marker outline (semi-transparent)
BAR_LINE_COLOR = "rgba(0,0,0,0)"  # transparent; CDU visibility handled by #2a2a2a fill
BAR_LINE_WIDTH = 0
