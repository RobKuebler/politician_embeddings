import type { Translations } from "./types";

export const en: Translations = {
  nav: {
    vote_map: "Votes",
    motions: "Motions",
    speeches: "Plenary Debates",
    comments: "Plenary Dynamics",
    party_profile: "Party Profile",
    trends: "Trends",
    sidejobs: "Side Income",
    potential_conflicts: "Conflicts",
  },
  pages: {
    vote_map: {
      label: "Voting Behaviour",
      title: "Who votes with whom?",
      description:
        "Each dot is an MP. Those who vote alike end up close together, regardless of party. This reveals cross-party patterns that cut across faction lines.",
    },
    motions: {
      label: "Parliamentary Motions",
      title: "Who demands what?",
      description:
        "Motions and enquiries submitted by the parliamentary groups, compared by topic, volume, and most active sponsors.",
    },
    speeches: {
      label: "Word Analysis",
      title: "Who speaks about what?",
      description:
        "Which words come up most often for each party? Word clouds show the characteristic language of each parliamentary group, alongside the most active speakers.",
    },
    comments: {
      label: "Plenary Dynamics",
      title: "Who reacts to whom?",
      description:
        "Interjections, laughter, applause — every reaction in the Bundestag is recorded in the official transcript. This analysis shows which party reacts how often, and to whose speeches. Zwischenrufe (interjections) are a formal and lively part of German parliamentary tradition.",
    },
    party_profile: {
      label: "Demographics",
      title: "Who sits in the Bundestag?",
      description:
        "Age distribution, gender balance, occupational backgrounds, and education compared across parties: how the parliamentary groups differ from each other and from parliament as a whole.",
    },
    trends: {
      label: "Over Time",
      title: "When did a topic heat up?",
      description:
        "Track how often a term appears in plenary debates and spot when a topic suddenly gained momentum.",
    },
    sidejobs: {
      label: "Transparency",
      title: "Who earns on the side?",
      description:
        "German MPs are legally required to disclose paid side activities earning above €1,000 per month (§ 44a AbgG). This analysis shows which parties, industries, and topic areas such income is most prevalent in.",
    },
    potential_conflicts: {
      label: "Conflicts of Interest",
      title: "Who earns in their own committee?",
      description:
        "MPs who sit on a parliamentary Ausschuss (committee) and simultaneously earn income in the same topic area — an analysis of potential conflicts of interest. Each Ausschuss oversees a specific policy domain, making overlap with side income a notable transparency concern.",
    },
  },
  home: {
    eyebrow: "Bundestag · AI Analysis",
    subtitle:
      "Parlascanned makes the work of the German Bundestag — Germany's federal parliament — transparent. How similarly do MPs vote? How do the parliamentary groups differ demographically? And who earns money on the side?",
    cta: "Open",
    stats: {
      politicians: "MPs",
      parties: "Parliamentary Groups",
      polls: "Votes",
      sidejobs: "Side Activities",
    },
    period_label: "Legislative Period",
  },
  common: {
    no_data: "No data available.",
    period_label: "Bundestag",
    period_aria: "Select legislative period",
  },
  vote_map: {
    coalition_label: "Governing Coalition",
    map_title: "Vote Map",
    map_subtitle:
      "Click individual dots or drag a selection to analyse the voting behaviour of those MPs in detail. Party names in the chart are also clickable.",
    heatmap_title: "Voting Behaviour",
    heatmap_subtitle:
      "The heatmap shows how selected MPs voted on individual ballots. First select MPs from the map or via the search.",
    heatmap_empty: "Select MPs to see their votes",
    cohesion_title: "Party Discipline",
    cohesion_subtitle:
      "Mean Euclidean distance of each MP from their group's centroid. A short bar means cohesive voting behaviour.",
    vote_yes: "Yes",
    vote_no: "No",
    vote_abstain: "Abstain",
    poll_search_placeholder: "Search votes…",
    poll_filter_all: "All",
    poll_filter_divergent: "Divergent",
    poll_filter_divergent_title: "Votes with differing choices (incl. absent)",
    poll_filter_divergent_present: "Divergent, excl. absent",
    poll_filter_divergent_present_title:
      "Votes with differing choices (excl. absent)",
    politician_search_placeholder: "Search MPs…",
  },
  motions: {
    tab_motion: "Motions",
    tab_small_inquiry: "Minor Enquiries",
    tab_large_inquiry: "Major Enquiries",
    count_label: "Count by group",
    count_sublabel: "{tab} submitted in this legislative period.",
    timeline_title: "Submissions per month",
    timeline_subtitle: "When were the most {tab} submitted?",
    top_authors: "Most active sponsors",
    search_title: "Topic search",
    search_subtitle: "How often did each group use this term in {tab} titles?",
    search_placeholder: "Search term, e.g. migration, climate …",
    search_loading: "Loading data…",
    no_data: "No motions data available for this legislative period.",
    no_time_data: "No timeline data available.",
    hits_for: "Matches for",
    hits_sublabel: "{count} {tab} contain this term.",
    no_results: 'No {tab} found containing "{query}".',
  },
  speeches: {
    speakers_header: "Speakers by word count",
    words_suffix: "words",
    no_data: "No speech data available for this legislative period.",
    close: "Close",
    top_words: "Top {count} terms",
  },
  comments: {
    summary_title: "Overview",
    summary_subtitle: "Reactions by party, each scale independent",
    applause_title: "Applause Network",
    applause_subtitle:
      "Arcs = applause volume. Ribbons = exchange between parties.",
    reactions_title: "Reactions in Detail",
    reactions_subtitle: "Row = acting party · Column = speaker's party",
    error: "Error loading data.",
    interjection_label: "Interjections",
    applause_label: "Applause",
    type_labels: {
      Lachen: "Laughter",
      Heiterkeit: "Amusement",
      Widerspruch: "Objection",
    },
    rare_reactions_label: "Rarer Reactions",
  },
  party_profile: {
    age_title: "Age Distribution",
    age_subtitle:
      "Each dot represents one MP. Dots of the same age are stacked vertically — the more dots at a position, the more MPs share that exact age. The curve above is a density estimate. Age is measured at the start of the legislative period.",
    gender_title: "Gender",
    gender_subtitle:
      "Gender distribution per parliamentary group as a share of total members.",
    occupation_title: "Occupations",
    occupation_subtitle:
      "The heatmap shows how over- or under-represented an occupation is within a party, measured as deviation from the Bundestag average in percentage points. Blue = over-represented, red = under-represented. Data from Abgeordnetenwatch, reflecting the state at first registration. 'Other occupations' mainly covers MPs who listed 'Member of Parliament' as their profession.",
    education_field_title: "Field of Study / Training",
    education_field_subtitle:
      "Fields of study and vocational training of MPs compared across parliamentary groups. Blue = over-represented, red = under-represented, both relative to the Bundestag average. Data from Abgeordnetenwatch at time of first registration.",
    education_degree_title: "Degree Level",
    education_degree_subtitle:
      "Highest educational qualification of MPs per parliamentary group, compared to the Bundestag average. Data from Abgeordnetenwatch at time of first registration.",
  },
  trends: {
    toggle_per_1000: "Per 1,000 words",
    toggle_absolute: "Absolute",
    party_comparison_title: "Term by party",
    party_comparison_subtitle:
      "How often do the parliamentary groups use this term?",
    search_placeholder_a: "Search term, e.g. migration, ukraine …",
    search_placeholder_b: "Select term, e.g. climate …",
    empty_a: "Enter a term to see its trend in plenary debates.",
    empty_b: "Select a term to see the party comparison.",
    too_rare: "Used too rarely — no party comparison available.",
    no_party_data: "No party data available.",
    no_data: "No trend data available for this legislative period.",
    not_found:
      '"{term}" does not appear frequently enough or is not in the index.',
    show_hint: "Show {label}",
    hide_hint: "Hide {label}",
    remove_keyword_label: "Remove {keyword}",
  },
  sidejobs: {
    hero_total_label: "Total side income",
    hero_income_ongoing: "Payments in the current legislative period up to now",
    hero_income_closed: "Payments over the entire legislative period",
    hero_coverage:
      "Only {pct}% of side activities ({with_amount} of {total}) included a disclosed amount.",
    coverage_title: "MPs with side income",
    coverage_subtitle:
      "Share of MPs per parliamentary group who hold at least one notifiable side activity. Side income is defined as a declared income of at least €1,000 per month (§ 44a AbgG, level 1). MPs with a declared activity but no amount given are shown separately.",
    income_category_title: "Income by category",
    income_category_subtitle:
      "Breakdown of side income by the Bundestag administration's official categories. Darker cells mean higher income — the colour scale is logarithmic so mid-range amounts remain visible.",
    topics_title: "Topic areas of side activities",
    topics_subtitle:
      "The 15 topic areas with the highest declared total income. Darker cells mean higher income — the colour scale is logarithmic. Categorisation is based on AI analysis of activity descriptions. Since a single job can span multiple topic areas, totals may overlap.",
    top_earners_title: "Top earners",
    top_earners_subtitle:
      "The MPs with the highest projected side income in the selected legislative period.",
    coverage_legend_income: "Side income ≥ €1,000/month",
    coverage_legend_no_amount: "No amount disclosed",
    coverage_legend_none: "No side job",
    coverage_tooltip_income: "Side income: {income} of {total} ({pct}%)",
    coverage_tooltip_no_amount: "No amount: {no_amount} of {total} ({pct}%)",
    coverage_tooltip_none: "No side job: {none} of {total} ({pct}%)",
  },
  potential_conflicts: {
    hero_income_label: "Total conflicted side income",
    hero_politicians_label: "MPs affected",
    hero_committees_label: "Committees affected",
    ranked_title: "Top conflicts by MP",
    ranked_subtitle:
      "MPs with side income in a topic area overseen by their committee. If an MP sits on multiple affected committees, the income is counted multiple times — each mandate constitutes an independent conflict of interest. Sorted by total amount.",
    heatmap_title: "Conflicts by topic & party",
    heatmap_subtitle:
      "Aggregated side income per topic area and party where a committee overlap exists. Darker colour means higher conflicted income.",
    no_conflicts: "No conflicts of interest found for this legislative period.",
    methodology_title: "How are conflicts of interest detected?",
    methodology_p1:
      "A conflict of interest is identified when an MP earns side income in a topic area and simultaneously sits on a committee responsible for that same topic area. Topic tags come directly from the Abgeordnetenwatch API (field_topics), which labels both side activities and committees with keywords.",
    methodology_limitations_title: "Limitations",
    methodology_l1:
      'Broad topic tags can lead to false matches. Tags like "Economy" or "State and Administration" are very wide-ranging and may produce hits that do not represent a genuine conflict of interest — e.g. a lawyer on the Interior Affairs committee with no connection to interior law.',
    methodology_l2:
      "No time-overlap verification is possible. Committee memberships in the source data carry no date range. Side income from the first half of a year can therefore appear alongside a committee seat from the second half, without any actual overlap.",
    methodology_l3:
      "Income is shown per committee. If an MP sits on multiple affected committees, the same income appears multiple times — each row represents an independent mandate.",
    methodology_l4:
      "Only side activities with a topic tag are included. Activities without an Abgeordnetenwatch topic tag are not captured, even if a substantive overlap exists.",
    methodology_footer:
      "This page surfaces potential conflicts of interest based on publicly disclosed data. It does not replace a legal or parliamentary assessment.",
  },
  ui: {
    menu_open: "Open menu",
    menu_close: "Close menu",
    nav_label: "Navigation",
    footer_by: "by",
    footer_data: "Data:",
    seat_distribution: "Seat Distribution · {total}",
    seat_distribution_aria: "Bundestag Seat Distribution",
  },
};
