import type { Translations } from "./types";

export const de: Translations = {
  nav: {
    vote_map: "Abstimmungen",
    motions: "Initiativen",
    speeches: "Plenardebatten",
    comments: "Plenardynamik",
    party_profile: "Parteiprofil",
    trends: "Trends",
    sidejobs: "Nebeneinkünfte",
    potential_conflicts: "Konflikte",
  },
  pages: {
    vote_map: {
      label: "Abstimmungsverhalten",
      title: "Wer stimmt mit wem?",
      description:
        "Jeder Punkt ist ein Abgeordneter. Wer oft gleich abstimmt, landet nah beieinander, egal welcher Fraktion er angehört. So entstehen Muster, die Fraktionsgrenzen überschreiten.",
    },
    motions: {
      label: "Parlamentarische Initiative",
      title: "Wer fordert was?",
      description:
        "Anträge und Anfragen der Fraktionen im Vergleich — nach Themen, Volumen und aktivsten Einreichern.",
    },
    speeches: {
      label: "Wortanalyse",
      title: "Wer redet worüber?",
      description:
        "Welche Begriffe fallen bei einer Partei besonders häufig? Wordclouds zeigen die typische Sprache jeder Fraktion, dazu die redeaktivsten Abgeordneten im Vergleich.",
    },
    comments: {
      label: "Plenardynamik",
      title: "Wer reagiert auf wen?",
      description:
        "Zwischenrufe, Lachen, Applaus: Jede Reaktion im Bundestag wird protokolliert. Diese Analyse zeigt, welche Partei wie oft und bei wessen Reden reagiert.",
    },
    party_profile: {
      label: "Demografie",
      title: "Wer sitzt im Bundestag?",
      description:
        "Altersstruktur, Geschlechterverteilung, Berufsfelder und Bildungshintergrund im Vergleich: So unterscheiden sich die Fraktionen voneinander und vom Gesamtparlament.",
    },
    trends: {
      label: "Zeitverlauf",
      title: "Wann wurde welches Thema heiß?",
      description:
        "Verfolge, wie oft ein Begriff in Plenardebatten erwähnt wurde, und erkenne, wann ein Thema plötzlich an Fahrt aufnahm.",
    },
    sidejobs: {
      label: "Transparenz",
      title: "Wer verdient noch dazu?",
      description:
        "Abgeordnete müssen bezahlte Nebentätigkeiten ab 1.000 € monatlich öffentlich melden. Diese Auswertung zeigt, in welchen Parteien, Branchen und Themenfeldern solche Einkünfte besonders verbreitet sind.",
    },
    potential_conflicts: {
      label: "Interessenkonflikt",
      title: "Wer verdient im eigenen Ausschuss?",
      description:
        "Abgeordnete, die in einem parlamentarischen Ausschuss sitzen und gleichzeitig in demselben Themenfeld Geld verdienen — eine Analyse möglicher Interessenkonflikte.",
    },
  },
  home: {
    eyebrow: "Bundestag · KI-Analyse",
    subtitle:
      "Parlascanned macht die Arbeit des Deutschen Bundestags transparent. Wie ähnlich stimmen Abgeordnete ab? Wie unterscheiden sich die Fraktionen demografisch? Und wer verdient neben dem Mandat?",
    cta: "Öffnen",
    stats: {
      politicians: "Abgeordnete",
      parties: "Fraktionen",
      polls: "Abstimmungen",
      sidejobs: "Nebentätigkeiten",
    },
    period_label: "Legislaturperiode",
  },
  common: {
    no_data: "Keine Daten verfügbar.",
    period_label: "Bundestag",
    period_aria: "Wahlperiode auswählen",
    topic_labels: {
      "Arbeit und Beschäftigung": "Arbeit und Beschäftigung",
      "Außenpolitik und internationale Beziehungen":
        "Außenpolitik und internationale Beziehungen",
      Außenwirtschaft: "Außenwirtschaft",
      "Bildung und Erziehung": "Bildung und Erziehung",
      "Digitale Agenda": "Digitale Agenda",
      Energie: "Energie",
      Finanzen: "Finanzen",
      Forschung: "Forschung",
      Frauen: "Frauen",
      "Gesellschaftspolitik, soziale Gruppen":
        "Gesellschaftspolitik, soziale Gruppen",
      Gesundheit: "Gesundheit",
      Jugend: "Jugend",
      Kultur: "Kultur",
      "Landwirtschaft und Ernährung": "Landwirtschaft und Ernährung",
      Medien: "Medien",
      "Medien, Kommunikation und Informationstechnik":
        "Medien, Kommunikation und Informationstechnik",
      "Migration und Aufenthaltsrecht": "Migration und Aufenthaltsrecht",
      "Politisches Leben, Parteien": "Politisches Leben, Parteien",
      "Raumordnung, Bau- und Wohnungswesen":
        "Raumordnung, Bau- und Wohnungswesen",
      Recht: "Recht",
      "Soziale Sicherung": "Soziale Sicherung",
      Sport: "Sport",
      "Sport, Freizeit und Tourismus": "Sport, Freizeit und Tourismus",
      "Staat und Verwaltung": "Staat und Verwaltung",
      Technologiefolgenabschätzung: "Technologiefolgenabschätzung",
      Umwelt: "Umwelt",
      Verkehr: "Verkehr",
      Verteidigung: "Verteidigung",
      Wirtschaft: "Wirtschaft",
      "Wissenschaft, Forschung und Technologie":
        "Wissenschaft, Forschung und Technologie",
      "digitale Infrastruktur": "digitale Infrastruktur",
      "Öffentliche Finanzen, Steuern und Abgaben":
        "Öffentliche Finanzen, Steuern und Abgaben",
    },
  },
  vote_map: {
    coalition_label: "Regierungskoalition",
    map_title: "Abstimmungslandkarte",
    map_subtitle:
      "Klicken Sie auf einzelne Punkte oder ziehen Sie eine Auswahl, um das Abstimmungsverhalten der betreffenden Abgeordneten im Detail zu analysieren. Fraktionsnamen im Diagramm sind ebenfalls anklickbar.",
    heatmap_title: "Abstimmungsverhalten",
    heatmap_subtitle:
      "Die Heatmap zeigt, wie die ausgewählten Abgeordneten bei einzelnen Abstimmungen votiert haben. Wählen Sie zunächst Abgeordnete aus der Karte oder über die Suche aus.",
    heatmap_empty: "Abgeordnete auswählen, um ihre Abstimmungen zu sehen",
    cohesion_title: "Fraktionsdisziplin",
    cohesion_subtitle:
      "Mittlerer euklidischer Abstand jedes Abgeordneten zum Schwerpunkt seiner Fraktion. Ein kurzer Balken bedeutet geschlossenes Abstimmungsverhalten.",
    vote_yes: "Ja",
    vote_no: "Nein",
    vote_abstain: "Enthalten",
    poll_search_placeholder: "Abstimmungen suchen…",
    poll_filter_all: "Alle",
    poll_filter_divergent: "Unterschiedlich",
    poll_filter_divergent_title:
      "Abstimmungen mit unterschiedlichen Stimmen (inkl. Abwesend)",
    poll_filter_divergent_present: "Unterschiedlich, ohne Fehlen",
    poll_filter_divergent_present_title:
      "Abstimmungen mit unterschiedlichen Stimmen (ohne Abwesend)",
    politician_search_placeholder: "Politiker suchen…",
    scatter_pan_hint: "Verschieben & Zoomen",
    scatter_rect_label: "Rechteck",
    scatter_rect_hint: "Rechteck-Auswahl",
    scatter_lasso_label: "Lasso",
    scatter_lasso_hint: "Freihand-Auswahl",
    scatter_click_hint: "– Klicken zum Auswählen",
    politician_search_clear: "Auswahl aufheben",
    politician_search_remove_party: "Entferne {party}",
    politician_search_remove_pol: "Entferne {name}",
    politician_search_results: "{count} Abgeordnete",
    politician_search_no_results: "Keine Ergebnisse",
    poll_filter_remove_topic: "Entferne {topic}",
    poll_filter_results: "{count} Abstimmungen",
    poll_filter_no_results: "Keine Ergebnisse",
  },
  motions: {
    tab_motion: "Anträge",
    tab_small_inquiry: "Kleine Anfragen",
    tab_large_inquiry: "Große Anfragen",
    count_label: "Anzahl pro Fraktion",
    count_sublabel: "Eingereichte {tab} in dieser Legislaturperiode.",
    timeline_title: "Einreichungen pro Monat",
    timeline_subtitle: "Wann wurden besonders viele {tab} eingereicht?",
    top_authors: "Aktivste Einreicher",
    search_title: "Themen-Suche",
    search_subtitle:
      "Welche Fraktion hat diesen Begriff wie oft in {tab}-Titeln verwendet?",
    search_placeholder: "Begriff suchen, z.B. migration, klima …",
    search_loading: "Daten werden geladen…",
    no_data:
      "Für diese Wahlperiode sind noch keine Drucksachen-Daten verfügbar.",
    no_time_data: "Keine Zeitdaten verfügbar.",
    hits_for: "Treffer für",
    hits_sublabel: "{count} {tab} enthalten diesen Begriff.",
    no_results: 'Keine {tab} mit "{query}" gefunden.',
  },
  speeches: {
    speakers_header: "Redner nach Wortanzahl",
    words_suffix: "Wörter",
    no_data: "Für diese Wahlperiode sind noch keine Rededaten verfügbar.",
    close: "Schließen",
    top_words: "Top {count} Begriffe",
    speech_share_title: "Redeanteile",
    speech_share_subtitle:
      "Gesamtzahl der Wörter pro Fraktion in dieser Legislaturperiode.",
  },
  comments: {
    summary_title: "Gesamtübersicht",
    summary_subtitle: "Reaktionen nach Partei, jede Skala unabhängig",
    applause_title: "Beifall-Netzwerk",
    applause_subtitle:
      "Bögen = Applaus-Volumen. Bänder = Austausch zwischen Parteien.",
    reactions_title: "Reaktionen im Detail",
    reactions_subtitle: "Zeile = handelnde Partei · Spalte = Redner-Partei",
    error: "Fehler beim Laden der Daten.",
    interjection_label: "Zwischenrufe",
    applause_label: "Beifall",
    type_labels: {
      Beifall: "Beifall",
      Zwischenruf: "Zwischenruf",
      Lachen: "Lachen",
      Heiterkeit: "Heiterkeit",
      Widerspruch: "Widerspruch",
    },
    rare_reactions_label: "Seltenere Reaktionen",
    heatmap_row_hint: "↓ Zeile = handelnde Partei",
    heatmap_col_hint: "→ Spalte = Redner-Partei",
    heatmap_tooltip_all: "% aller",
    chord_claps_for: "klatscht bei anderen: ",
    chord_receives: "bekommt Beifall: ",
    chord_self_applause: "davon Eigenbeifall: ",
    chord_self_claps: "klatscht bei eigenen Reden: ",
  },
  party_profile: {
    age_title: "Altersverteilung",
    age_subtitle:
      "Jeder Punkt entspricht einem Abgeordneten. Punkte gleichen Alters sind vertikal gestapelt — je mehr Punkte auf einer Position, desto mehr Abgeordnete haben exakt dieses Alter. Die Kurve darüber zeigt die Altersverteilung als Dichteschätzung. Das Alter bezieht sich auf den Beginn der Legislaturperiode.",
    gender_title: "Geschlecht",
    gender_subtitle:
      "Geschlechterverteilung je Fraktion als prozentualer Anteil der Gesamtmitglieder.",
    occupation_title: "Berufe",
    occupation_subtitle:
      'Die Heatmap zeigt, wie stark ein Beruf in einer Fraktion über- oder unterrepräsentiert ist — gemessen als Abweichung vom Bundestag-Durchschnitt in Prozentpunkten. Blau steht für überproportional viele Abgeordnete mit diesem Beruf, rot für entsprechend wenige. Die Berufsangaben stammen aus der Abgeordnetenwatch-Datenbank und entsprechen dem Stand bei Ersterfassung. Unter "Sonstige Berufe" fallen insbesondere Abgeordnete, die als Berufsbezeichnung schlicht "Abgeordneter" angegeben haben.',
    education_field_title: "Ausbildung / Studienrichtung",
    education_field_subtitle:
      "Studienrichtungen und Ausbildungsbereiche der Abgeordneten im Fraktionsvergleich. Blau bedeutet überproportional häufig vertreten, rot unterproportional — jeweils gemessen am Bundestag-Durchschnitt. Die Angaben stammen aus der Abgeordnetenwatch-Datenbank und entsprechen dem Stand bei Ersterfassung.",
    education_degree_title: "Abschlussniveau",
    education_degree_subtitle:
      "Höchster Bildungsabschluss der Abgeordneten je Fraktion im Vergleich zum Bundestag-Durchschnitt. Die Angaben stammen aus der Abgeordnetenwatch-Datenbank und entsprechen dem Stand bei Ersterfassung.",
    gender_male: "Männlich",
    gender_female: "Weiblich",
    age_axis_label: "Alter (Jahre)",
    age_tooltip_years: "{age} Jahre",
    occupation_labels: {
      Sonstiges: "Sonstiges",
      Jurist: "Jurist",
      Geschäftsführer: "Geschäftsführer",
      Angestellter: "Angestellter",
      Handwerker: "Handwerker",
      Wissenschaftler: "Wissenschaftler",
      Referent: "Referent",
      Unternehmer: "Unternehmer",
      Gewerkschafter: "Gewerkschafter",
      Arzt: "Arzt",
      Lehrer: "Lehrer",
      Student: "Student",
      Kaufmann: "Kaufmann",
      Beamter: "Beamter",
      Professor: "Professor",
      Berater: "Berater",
      Bürgermeister: "Bürgermeister",
      Ingenieur: "Ingenieur",
      Ökonom: "Ökonom",
      Soldat: "Soldat",
      Kommunalpolitiker: "Kommunalpolitiker",
      Sozialarbeiter: "Sozialarbeiter",
      Selbstständiger: "Selbstständiger",
      Polizist: "Polizist",
      "IT/Software": "IT/Software",
      Pflegepersonal: "Pflegepersonal",
      Unbekannt: "Unbekannt",
    },
    education_field_labels: {
      Jura: "Jura",
      "Wirtschaft (BWL/VWL)": "Wirtschaft (BWL/VWL)",
      Politikwissenschaft: "Politikwissenschaft",
      "Medizin / Gesundheit": "Medizin / Gesundheit",
      Ingenieurwesen: "Ingenieurwesen",
      Naturwissenschaft: "Naturwissenschaft",
      Sonstiges: "Sonstiges",
      Sozialwissenschaft: "Sozialwissenschaft",
      "Pädagogik / Lehramt": "Pädagogik / Lehramt",
      Verwaltung: "Verwaltung",
      Geisteswissenschaft: "Geisteswissenschaft",
      "Handwerk / Technik": "Handwerk / Technik",
      "Polizei / Militär": "Polizei / Militär",
      "Informatik / IT": "Informatik / IT",
      "Medien / Kommunikation": "Medien / Kommunikation",
      "Kaufm. Ausbildung": "Kaufm. Ausbildung",
      Unbekannt: "Unbekannt",
    },
    education_degree_labels: {
      Diplom: "Diplom",
      Promotion: "Promotion",
      Ausbildung: "Ausbildung",
      "Master / Magister": "Master / Magister",
      "Meister / Fachwirt": "Meister / Fachwirt",
      Staatsexamen: "Staatsexamen",
      Bachelor: "Bachelor",
      Unbekannt: "Unbekannt",
    },
    heatmap_of: "von",
    heatmap_mps: "Abgeordneten",
    heatmap_deviation: "Abweichung:",
  },
  trends: {
    toggle_per_1000: "Pro 1.000 Wörter",
    toggle_absolute: "Absolut",
    party_comparison_title: "Begriff nach Partei",
    party_comparison_subtitle:
      "Wie oft sprechen die Fraktionen einen Begriff an?",
    search_placeholder_a: "Begriff suchen, z.B. migration, ukraine …",
    search_placeholder_b: "Begriff wählen, z.B. klimaschutz …",
    empty_a: "Gib einen Begriff ein um seinen Verlauf im Plenum zu sehen.",
    empty_b: "Wähle einen Begriff um den Partei-Vergleich zu sehen.",
    too_rare: "Zu selten verwendet — kein Parteivergleich verfügbar.",
    no_party_data: "Keine Partei-Daten verfügbar.",
    no_data: "Für diese Wahlperiode sind noch keine Verlaufsdaten verfügbar.",
    not_found: '"{term}" kommt nicht häufig genug vor oder ist nicht im Index.',
    show_hint: "{label} einblenden",
    hide_hint: "{label} ausblenden",
    remove_keyword_label: "{keyword} entfernen",
    y_axis_per_1000: "pro 1.000 Wörter",
  },
  sidejobs: {
    hero_total_label: "Gesamtes Nebeneinkommen",
    hero_income_ongoing:
      "Zahlungen in der laufenden Legislaturperiode bis jetzt",
    hero_income_closed: "Zahlungen in der gesamten Legislaturperiode",
    hero_coverage:
      "Nur bei {pct} % der Nebentätigkeiten ({with_amount} von {total}) wurde ein Betrag angegeben.",
    coverage_title: "Abgeordnete mit Nebenverdienst",
    coverage_subtitle:
      "Anteil der Abgeordneten je Fraktion, die mindestens eine meldepflichtige Nebentätigkeit ausüben. Als Nebenverdienst gilt ein gemeldetes Einkommen ab 1.000 € monatlich (§ 44a AbgG, Stufe 1). Abgeordnete mit gemeldeter Tätigkeit ohne Einkommensangabe werden gesondert ausgewiesen.",
    income_category_title: "Einkommen nach Kategorie",
    income_category_subtitle:
      "Aufteilung der Nebeneinkünfte nach den offiziellen Kategorien der Bundestagsverwaltung. Dunklere Felder stehen für höhere Einnahmen — die Farbskala ist logarithmisch, damit auch mittlere Beträge sichtbar bleiben.",
    topics_title: "Themenfelder der Nebentätigkeiten",
    topics_subtitle:
      "Die 15 Themenfelder mit dem höchsten ausgewiesenen Gesamteinkommen. Dunklere Felder stehen für höhere Einnahmen — die Farbskala ist logarithmisch, damit auch mittlere Beträge sichtbar bleiben. Die Kategorisierung basiert auf KI-gestützter Analyse der Tätigkeitsbeschreibungen. Da ein Job mehreren Themenfeldern zugeordnet sein kann, überschneiden sich die Summen.",
    top_earners_title: "Top-Verdiener",
    top_earners_subtitle:
      "Die Abgeordneten mit dem höchsten hochgerechneten Nebeneinkommen in der gewählten Legislaturperiode.",
    coverage_legend_income: "Nebenverdienst ≥ 1.000 €/Monat",
    coverage_legend_no_amount: "Ohne Einkommensangabe",
    coverage_legend_none: "Kein Nebenjob",
    coverage_tooltip_income: "Nebenverdienst: {income} von {total} ({pct}%)",
    coverage_tooltip_no_amount:
      "Ohne Einkommensangabe: {no_amount} von {total} ({pct}%)",
    coverage_tooltip_none: "Kein Nebenjob: {none} von {total} ({pct}%)",
    category_labels: {
      "Entgeltliche Tätigkeit": "Entgeltliche Tätigkeit",
      "Funktionen in öffentlichen Institutionen":
        "Funktionen in öffentlichen Institutionen",
      "Spende / Zuwendung": "Spende / Zuwendung",
      Unternehmensbeteiligung: "Unternehmensbeteiligung",
      "Unternehmensbeteiligung / Organmitglied":
        "Unternehmensbeteiligung / Organmitglied",
      "Verband / Stiftung / Verein": "Verband / Stiftung / Verein",
      "Vereinbarung über künftige Tätigkeit":
        "Vereinbarung über künftige Tätigkeit",
      "Tätigkeit vor Mitgliedschaft": "Tätigkeit vor Mitgliedschaft",
    },
  },
  potential_conflicts: {
    hero_income_label: "Konfliktiertes Nebeneinkommen gesamt",
    hero_politicians_label: "Abgeordnete betroffen",
    hero_committees_label: "Ausschüsse betroffen",
    ranked_title: "Top-Konflikte nach Abgeordneten",
    ranked_subtitle:
      "Abgeordnete mit Nebeneinkommen in einem Themenfeld, das ihr Ausschuss verantwortet. Sitzt ein Abgeordneter in mehreren betroffenen Ausschüssen, wird das Einkommen mehrfach gezählt, weil jedes Mandat einen eigenständigen Interessenkonflikt darstellt. Sortiert nach Gesamtbetrag.",
    heatmap_title: "Konflikte nach Thema & Fraktion",
    heatmap_subtitle:
      "Summiertes Nebeneinkommen je Themenfeld und Fraktion, bei dem eine Ausschuss-Überschneidung besteht. Intensivere Färbung bedeutet höheres konfliktiertes Einkommen.",
    no_conflicts: "Keine Interessenkonflikte für diese Wahlperiode gefunden.",
    methodology_title: "Wie werden Interessenkonflikte erkannt?",
    methodology_p1:
      "Ein Interessenkonflikt wird erkannt, wenn ein Abgeordneter Nebeneinkommen in einem Themenfeld erzielt und gleichzeitig Mitglied eines Ausschusses mit demselben Themenfeld ist. Die Themenfelder stammen direkt aus der API von abgeordnetenwatch (Feld field_topics), das sowohl Nebentätigkeiten als auch Ausschüsse mit Schlagwörtern versieht.",
    methodology_limitations_title: "Einschränkungen",
    methodology_l1:
      "Breite Themenfelder können zu Fehlzuordnungen führen. Schlagwörter wie \u201eWirtschaft\u201c oder \u201eStaat und Verwaltung\u201c sind sehr weit gefasst und können Treffer erzeugen, die keinen echten Interessenkonflikt darstellen – z.\u00a0B. ein Rechtsanwalt im Innenausschuss, der nichts mit Innenrecht zu tun hat.",
    methodology_l2:
      "Keine Zeitraumüberschneidung prüfbar. Ausschussmitgliedschaften enthalten in den Quelldaten keinen Zeitraum. Ein Nebeneinkommen aus der ersten Jahreshälfte kann daher rechnerisch mit einem Ausschussmandat aus der zweiten Jahreshälfte zusammentreffen, ohne dass ein tatsächlicher Überschneidungszeitraum existiert.",
    methodology_l3:
      "Einkommen wird pro Ausschuss ausgewiesen. Sitzt ein Abgeordneter in mehreren betroffenen Ausschüssen, wird dasselbe Einkommen mehrfach gezeigt – jede Zeile steht für ein eigenständiges Mandat.",
    methodology_l4:
      "Nur Nebentätigkeiten mit Themenfeld-Angabe. Tätigkeiten ohne abgeordnetenwatch-Themenfeld-Tag werden nicht erfasst, auch wenn inhaltlich eine Überschneidung bestehen könnte.",
    methodology_footer:
      "Diese Seite zeigt potenzielle Interessenkonflikte auf Basis öffentlich gemeldeter Daten. Sie ersetzt keine rechtliche oder parlamentarische Bewertung.",
    sidejob_area_label: "Nebentätigkeit in:",
    committee_labels: {},
  },
  ui: {
    menu_open: "Menü öffnen",
    menu_close: "Menü schließen",
    nav_label: "Navigation",
    footer_by: "von",
    footer_data: "Daten:",
    seat_distribution: "Sitzverteilung · {total}",
    seat_distribution_aria: "Bundestag Sitzverteilung",
  },
};
