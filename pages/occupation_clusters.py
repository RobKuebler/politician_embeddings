# Keyword rules for normalizing raw occupation strings into canonical categories.
# Order matters: first matching rule wins. Matching is case-insensitive substring search.
_OCCUPATION_RULES: list[tuple[list[str], str]] = [
    (
        [
            "rechtsanwalt",
            "rechtsanwältin",
            "syndikusrecht",
            "anwältin",
            "anwalt",
            "jurist",
            "justiziarin",
            "justiziar",
            "kanzlei",
        ],
        "Jurist",
    ),
    (
        [
            "arzt",
            "ärztin",
            "notfallmediziner",
            "mediziner",
            "chirurg",
            "hausarzt",
            "kinderarzt",
        ],
        "Arzt",
    ),
    (
        [
            "krankenschwester",
            "krankenpfleger",
            "pflegefach",
            "fachkrankenpflege",
            "gesundheits- und krankenpflege",
        ],
        "Pflegepersonal",
    ),
    (["professor", "hochschullehr", "juniorprofessor"], "Professor"),
    (
        ["lehrer", "lehrerin", "oberstudienrat", "schulleiter", "berufsschullehr"],
        "Lehrer",
    ),
    (
        ["sozialarbeiter", "sozialarbeiterin", "schulsozialarbeiter", "sozialreferent"],
        "Sozialarbeiter",
    ),
    (["polizei", "kriminalhauptkommissar", "kriminal"], "Polizist"),
    (["soldat", "offizier", "bundeswehr", "berufssoldat"], "Soldat"),
    (
        [
            "softwareentwickler",
            "softwareentwicklerin",
            "informatiker",
            "informatikerin",
            "it-",
        ],
        "IT/Software",
    ),
    (["ingenieur", "ingenieurin", "bauingenieur"], "Ingenieur"),
    (
        ["geschäftsführer", "geschäftsführerin", "co-geschäftsführerin"],
        "Geschäftsführer",
    ),
    (["unternehmer", "unternehmerin", "familienunternehmerin"], "Unternehmer"),
    (["selbstständig"], "Selbstständiger"),
    (
        [
            "wissenschaftlich",
            "politikwissenschaft",
            "doktorand",
            "wissenschaftsbasiert",
            "marktforscher",
            "marktforscherin",
        ],
        "Wissenschaftler",
    ),
    (["volkswirt", "betriebswirt", "ökonom"], "Ökonom"),
    (["berater", "beraterin"], "Berater"),
    (["referent", "referentin", "referatsleiter", "referatsleiterin"], "Referent"),
    (["student", "studentin", "studierende"], "Student"),
    (["gewerkschaft", "betriebsrat"], "Gewerkschafter"),
    (["bürgermeister", "bürgermeisterin"], "Bürgermeister"),
    (
        [
            "landrat",
            "bezirksstadtrat",
            "bezirksbürgermeister",
            "dezernent",
            "dezernentin",
        ],
        "Kommunalpolitiker",
    ),
    (
        [
            "beamter",
            "beamtin",
            "regierungsrät",
            "regierungsrat",
            "verwaltungsangest",
            "gemeindeprüf",
            "prüfer",
            "prüferin",
        ],
        "Beamter",
    ),
    (
        [
            "kaufmann",
            "kauffrau",
            "kaufmännisch",
            "bankkauffrau",
            "versicherungsvermittler",
            "versicherungskaufm",
            "einkäufer",
            "einkäuferin",
            "filialleiter",
            "filialleiterin",
        ],
        "Kaufmann",
    ),
    (
        [
            "mechatroniker",
            "metallbaumeister",
            "tischler",
            "dachdecker",
            "elektroniker",
            "schornsteinfeger",
            "kanalsteuerer",
            "facharbeiter",
            "technischer fachwirt",
        ],
        "Handwerker",
    ),
    (
        [
            "mdb",
            "mdhb",
            "bundestagsabgeordnet",
            "mitglied des bundestag",
            "mitglied des deutschen bundestag",
            "mitglied im deutschen bundestag",
            "mitglied deutschen bundestag",
            "mitglied deutscher bundestag",
            "abgeordnete",
            "mdl",
            "mda",
            "mdep",
            "staatssekretär",
            "staatssekretärin",
        ],
        "Abgeordneter",
    ),
    (["angestellte", "angestellter"], "Angestellter"),
]


def normalize_occupation(occ: str | None) -> str:
    """Map a raw occupation string to a canonical category via keyword matching.

    Returns "Keine Angabe" for null values, "Sonstiges" if no rule matches.
    """
    if not isinstance(occ, str) or not occ.strip():
        return "Keine Angabe"
    o = occ.lower()
    for keywords, label in _OCCUPATION_RULES:
        if any(k in o for k in keywords):
            return label
    return "Sonstiges"
