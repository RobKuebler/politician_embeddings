export type NavKey =
  | "vote_map"
  | "motions"
  | "speeches"
  | "comments"
  | "party_profile"
  | "trends"
  | "sidejobs"
  | "potential_conflicts";

export type PageKey = NavKey;

export type Translations = {
  nav: Record<NavKey, string>;
  pages: Record<PageKey, { label: string; title: string; description: string }>;
  home: {
    eyebrow: string;
    subtitle: string;
    cta: string;
    stats: {
      politicians: string;
      parties: string;
      polls: string;
      sidejobs: string;
    };
    period_label: string;
  };
  common: {
    no_data: string;
    period_label: string;
    period_aria: string;
    topic_labels: Record<string, string>;
  };
  vote_map: {
    coalition_label: string;
    map_title: string;
    map_subtitle: string;
    heatmap_title: string;
    heatmap_subtitle: string;
    heatmap_empty: string;
    cohesion_title: string;
    cohesion_subtitle: string;
    vote_yes: string;
    vote_no: string;
    vote_abstain: string;
    poll_search_placeholder: string;
    poll_filter_all: string;
    poll_filter_divergent: string;
    poll_filter_divergent_title: string;
    poll_filter_divergent_present: string;
    poll_filter_divergent_present_title: string;
    politician_search_placeholder: string;
    scatter_pan_hint: string;
    scatter_rect_label: string;
    scatter_rect_hint: string;
    scatter_lasso_label: string;
    scatter_lasso_hint: string;
    scatter_click_hint: string;
    politician_search_clear: string;
    /** Template: {party} */
    politician_search_remove_party: string;
    /** Template: {name} */
    politician_search_remove_pol: string;
    /** Template: {count} */
    politician_search_results: string;
    politician_search_no_results: string;
    /** Template: {topic} */
    poll_filter_remove_topic: string;
    /** Template: {count} */
    poll_filter_results: string;
    poll_filter_no_results: string;
  };
  motions: {
    tab_motion: string;
    tab_small_inquiry: string;
    tab_large_inquiry: string;
    count_label: string;
    count_sublabel: string;
    timeline_title: string;
    timeline_subtitle: string;
    top_authors: string;
    search_title: string;
    search_subtitle: string;
    search_placeholder: string;
    search_loading: string;
    no_data: string;
    no_time_data: string;
    hits_for: string;
    hits_sublabel: string;
    no_results: string;
  };
  speeches: {
    speakers_header: string;
    words_suffix: string;
    no_data: string;
    close: string;
    top_words: string;
    speech_share_title: string;
    speech_share_subtitle: string;
  };
  comments: {
    summary_title: string;
    summary_subtitle: string;
    applause_title: string;
    applause_subtitle: string;
    reactions_title: string;
    reactions_subtitle: string;
    error: string;
    interjection_label: string;
    applause_label: string;
    type_labels: Record<"Beifall" | "Zwischenruf" | "Lachen" | "Heiterkeit" | "Widerspruch", string>;
    rare_reactions_label: string;
    heatmap_row_hint: string;
    heatmap_col_hint: string;
    heatmap_tooltip_all: string;
    chord_claps_for: string;
    chord_receives: string;
    chord_self_applause: string;
    chord_self_claps: string;
  };
  party_profile: {
    age_title: string;
    age_subtitle: string;
    gender_title: string;
    gender_subtitle: string;
    occupation_title: string;
    occupation_subtitle: string;
    education_field_title: string;
    education_field_subtitle: string;
    education_degree_title: string;
    education_degree_subtitle: string;
    gender_male: string;
    gender_female: string;
    age_axis_label: string;
    /** Template: {age} */
    age_tooltip_years: string;
    occupation_labels: Record<string, string>;
    education_field_labels: Record<string, string>;
    education_degree_labels: Record<string, string>;
    heatmap_of: string;
    heatmap_mps: string;
    heatmap_deviation: string;
  };
  trends: {
    toggle_per_1000: string;
    toggle_absolute: string;
    party_comparison_title: string;
    party_comparison_subtitle: string;
    search_placeholder_a: string;
    search_placeholder_b: string;
    empty_a: string;
    empty_b: string;
    too_rare: string;
    no_party_data: string;
    no_data: string;
    not_found: string;
    show_hint: string;
    hide_hint: string;
    remove_keyword_label: string;
    y_axis_per_1000: string;
  };
  sidejobs: {
    hero_total_label: string;
    hero_income_ongoing: string;
    hero_income_closed: string;
    hero_coverage: string;
    coverage_title: string;
    coverage_subtitle: string;
    income_category_title: string;
    income_category_subtitle: string;
    topics_title: string;
    topics_subtitle: string;
    top_earners_title: string;
    top_earners_subtitle: string;
    coverage_legend_income: string;
    coverage_legend_no_amount: string;
    coverage_legend_none: string;
    coverage_tooltip_income: string;
    coverage_tooltip_no_amount: string;
    coverage_tooltip_none: string;
    category_labels: Record<string, string>;
  };
  potential_conflicts: {
    hero_income_label: string;
    hero_politicians_label: string;
    hero_committees_label: string;
    ranked_title: string;
    ranked_subtitle: string;
    heatmap_title: string;
    heatmap_subtitle: string;
    no_conflicts: string;
    methodology_title: string;
    methodology_p1: string;
    methodology_limitations_title: string;
    methodology_l1: string;
    methodology_l2: string;
    methodology_l3: string;
    methodology_l4: string;
    methodology_footer: string;
    sidejob_area_label: string;
  };
  ui: {
    menu_open: string;
    menu_close: string;
    nav_label: string;
    footer_by: string;
    footer_data: string;
    /** Template: {total} */
    seat_distribution: string;
    seat_distribution_aria: string;
  };
};
