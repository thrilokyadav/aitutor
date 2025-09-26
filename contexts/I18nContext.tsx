import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

export type Lang = 'en' | 'kn';

type Dict = Record<string, Record<Lang, string>>;

const STRINGS: Dict = {
  // Common
  logout: { en: 'Logout', kn: 'ಲಾಗ್ ಔಟ್' },
  language: { en: 'Language', kn: 'ಭಾಷೆ' },
  assistant: { en: 'Global Assistant', kn: 'ಗ್ಲೋಬಲ್ ಸಹಾಯಕ' },
  loading: { en: 'Loading…', kn: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…' },
  ready: { en: 'Ready', kn: 'ಸಿದ್ಧ' },
  close: { en: 'Close', kn: 'ಮುಚ್ಚಿ' },
  refresh: { en: 'Refresh', kn: 'ರಿಫ್ರೆಶ್' },

  // Sidebar menu
  menu_dashboard: { en: 'Dashboard', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' },
  menu_ai_tutor: { en: 'AI Tutor', kn: 'ಎಐ ಶಿಕ್ಷಕ' },
  menu_subjects: { en: 'Subjects', kn: 'ವಿಷಯಗಳು' },
  menu_topic_explainer: { en: 'Topic Explainer', kn: 'ವಿಷಯ ವಿವರಣೆ' },
  menu_quiz_generator: { en: 'Quiz Generator', kn: 'ಪ್ರಶ್ನೋತ್ತರ ನಿರ್ಮಾಪಕ' },
  menu_competitive: { en: 'Competitive', kn: 'ಸ್ಪರ್ಧಾತ್ಮಕ' },
  menu_current_affairs: { en: 'Current Affairs', kn: 'ಸಾಮಯಿಕ ವಿಷಯಗಳು' },
  menu_planner: { en: 'Planner', kn: 'ಯೋಜಕ' },
  menu_notes: { en: 'Notes', kn: 'ಟಿಪ್ಪಣಿಗಳು' },
  menu_help: { en: 'Help', kn: 'ಸಹಾಯ' },
  menu_admin: { en: 'Admin', kn: 'ನಿರ್ವಹಣೆ' },

  // Quiz generator & results
  quiz_results_for: { en: 'Quiz Results for', kn: 'ಈ ವಿಷಯದ ಪ್ರಶ್ನೋತ್ತರ ಫಲಿತಾಂಶ' },
  your_score: { en: 'Your Score', kn: 'ನಿಮ್ಮ ಅಂಕ' },
  accuracy: { en: 'Accuracy', kn: 'ನಿಖರತೆ' },
  start_new_quiz: { en: 'Start New Quiz', kn: 'ಹೊಸ ಪ್ರಶ್ನೋತ್ತರ ಪ್ರಾರಂಭಿಸಿ' },
  quiz_on: { en: 'Quiz on', kn: 'ಈ ವಿಷಯದ ಪ್ರಶ್ನೋತ್ತರ' },
  next_question: { en: 'Next Question', kn: 'ಮುಂದಿನ ಪ್ರಶ್ನೆ' },
  show_results: { en: 'Show Results', kn: 'ಫಲಿತಾಂಶ ತೋರಿಸಿ' },
  generate_quiz: { en: 'Generate Quiz', kn: 'ಪ್ರಶ್ನೋತ್ತರ ರಚಿಸಿ' },
  topic_label: { en: 'Topic', kn: 'ವಿಷಯ' },
  number_of_questions: { en: 'Number of Questions', kn: 'ಪ್ರಶ್ನೆಗಳ ಸಂಖ್ಯೆ' },
  difficulty: { en: 'Difficulty', kn: 'ಕಷ್ಟಸ್ತರ' },
  back_to_history: { en: 'Back to History', kn: 'ಇತಿಹಾಸಕ್ಕೆ ಹಿಂತಿರುಗಿ' },
  explanation_label: { en: 'Explanation', kn: 'ವಿವರಣೆ' },
  correct_answer: { en: 'Correct answer', kn: 'ಸರಿಯಾದ ಉತ್ತರ' },
  your_answer: { en: 'Your answer', kn: 'ನಿಮ್ಮ ಉತ್ತರ' },
  not_answered: { en: 'Not answered', kn: 'ಉತ್ತರಿಸಲಿಲ್ಲ' },
  quiz_history_stats: { en: 'Quiz History & Stats', kn: 'ಪ್ರಶ್ನೋತ್ತರ ಇತಿಹಾಸ ಮತ್ತು ಅಂಕಿಅಂಶ' },
  total_quizzes: { en: 'Total Quizzes', kn: 'ಒಟ್ಟು ಪ್ರಶ್ನೋತ್ತರಗಳು' },
  average_score: { en: 'Average Score', kn: 'ಸರಾಸರಿ ಅಂಕ' },
  review: { en: 'Review', kn: 'ಪುನರ್ವೀಕ್ಷಣೆ' },
  no_quiz_history: { en: 'No quiz history yet. Take a quiz to see your stats!', kn: 'ಇನ್ನೂ ಪ್ರಶ್ನೋತ್ತರ ಇತಿಹಾಸ ಇಲ್ಲ. ನಿಮ್ಮ ಅಂಕಿಅಂಶಗಳನ್ನು ನೋಡಲು ಒಂದು ಪ್ರಶ್ನೋತ್ತರ ತೆಗೆದುಕೊಳ್ಳಿ!' },

  // Competitive
  competitive_quizzes: { en: 'Competitive Quizzes', kn: 'ಸ್ಪರ್ಧಾತ್ಮಕ ಪ್ರಶ್ನೋತ್ತರಗಳು' },
  sign_in_competitive: { en: 'Sign in to participate in competitive quizzes.', kn: 'ಸ್ಪರ್ಧಾತ್ಮಕ ಪ್ರಶ್ನೋತ್ತರಗಳಲ್ಲಿ ಭಾಗವಹಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.' },
  sign_in_with_google: { en: 'Sign in with Google', kn: 'ಗೂಗಲ್ ಮೂಲಕ ಸೈನ್ ಇನ್' },
  time_left: { en: 'Time left', kn: 'ಉಳಿದ ಸಮಯ' },
  question_n: { en: 'Question', kn: 'ಪ್ರಶ್ನೆ' },
  submit: { en: 'Submit', kn: 'ಸಲ್ಲಿಸು' },
  cancel: { en: 'Cancel', kn: 'ರದ್ದುಮಾಡು' },
  tabs_live: { en: 'Live', kn: 'ಲೈವ್' },
  tabs_upcoming: { en: 'Upcoming', kn: 'ಬರುತ್ತಿದೆ' },
  tabs_past: { en: 'Past', kn: 'ಕಳೆದವು' },
  search_title_desc: { en: 'Search title/desc', kn: 'ಶೀರ್ಷಿಕೆ/ವಿವರಣೆ ಹುಡುಕಿ' },
  all_subjects: { en: 'All subjects', kn: 'ಎಲ್ಲಾ ವಿಷಯಗಳು' },
  newest: { en: 'Newest', kn: 'ಹೊಸದವು' },
  oldest: { en: 'Oldest', kn: 'ಹಳೆಯವು' },
  no_quizzes: { en: 'No quizzes.', kn: 'ಪ್ರಶ್ನೋತ್ತರಗಳಿಲ್ಲ.' },
  start: { en: 'Start', kn: 'ಪ್ರಾರಂಭಿಸಿ' },
  ends_in: { en: 'Ends in', kn: 'ಮುಗಿಯಲು' },
  starts_in: { en: 'Starts in', kn: 'ಆರಂಬಕ್ಕೆ' },
  closed: { en: 'Closed', kn: 'ಮುಚ್ಚಲಾಗಿದೆ' },
  focus: { en: 'Focus', kn: 'ಕೇಂದ್ರೀಕರಣ' },
  already_taken: { en: "You have already taken this quiz. You can't retake it.", kn: 'ನೀವು ಈ ಪ್ರಶ್ನೋತ್ತರವನ್ನು ಈಗಾಗಲೇ ತೆಗೆದುಕೊಂಡಿದ್ದೀರಿ. ಮರುಪರೀಕ್ಷೆ ಸಾಧ್ಯವಿಲ್ಲ.' },
  view_my_results: { en: 'View My Results', kn: 'ನನ್ನ ಫಲಿತಾಂಶ ನೋಡಿ' },
  view_leaderboard: { en: 'View Leaderboard', kn: 'ಲೀಡರ್‍ಬೋರ್ಡ್ ನೋಡಿ' },
  published: { en: 'Published', kn: 'ಪ್ರಕಟಿಸಲಾಗಿದೆ' },
  unpublished: { en: 'Unpublished', kn: 'ಪ್ರಕಟಿಸಲಾಗಿಲ್ಲ' },
  page_of: { en: 'Page {0} of {1}', kn: 'ಪುಟ {0} / {1}' },
  prev: { en: 'Prev', kn: 'ಹಿಂದೆ' },
  next: { en: 'Next', kn: 'ಮುಂದೆ' },
  leaderboard_for: { en: 'Leaderboard — {0}', kn: 'ಲೀಡರ್‍ಬೋರ್ಡ್ — {0}' },
  no_leaderboard: { en: 'No leaderboard yet or not published.', kn: 'ಲೀಡರ್‍ಬೋರ್ಡ್ ಇನ್ನೂ ಇಲ್ಲ ಅಥವಾ ಪ್ರಕಟಿಸಲಿಲ್ಲ.' },
  tbl_rank: { en: 'Rank', kn: 'ಸ್ಥಾನ' },
  tbl_user: { en: 'User', kn: 'ಬಳಕೆದಾರ' },
  tbl_state: { en: 'State', kn: 'ರಾಜ್ಯ' },
  tbl_district: { en: 'District', kn: 'ಜಿಲ್ಲೆ' },
  tbl_score: { en: 'Score', kn: 'ಅಂಕ' },
  tbl_time_s: { en: 'Time (s)', kn: 'ಸಮಯ (ಸೆ)' },
  tbl_submitted: { en: 'Submitted', kn: 'ಸಲ್ಲಿಸಲಾಗಿದೆ' },

  // Topic Explainer
  topic_explainer: { en: 'Topic Explainer', kn: 'ವಿಷಯ ವಿವರಣೆ' },
  dive_deep: { en: 'Dive deep into any ALL GOV topic.', kn: 'ಯಾವುದೇ ALL GOV ವಿಷಯವನ್ನು ಆಳವಾಗಿ ತಿಳಿದುಕೊಳ್ಳಿ.' },
  explain: { en: 'Explain', kn: 'ವಿವರಿಸಿ' },
  view_history: { en: 'View History', kn: 'ಇತಿಹಾಸ ನೋಡಿ' },
  history: { en: 'History', kn: 'ಇತಿಹಾಸ' },
  no_history_yet: { en: 'No history yet.', kn: 'ಇನ್ನೂ ಇತಿಹಾಸ ಇಲ್ಲ.' },
  result: { en: 'Result', kn: 'ಫಲಿತಾಂಶ' },
  copy: { en: 'Copy', kn: 'ಪ್ರತಿಮಾಡು' },
  export_md: { en: 'Export MD', kn: 'MD ಎಕ್ಸ್‌ಪೋರ್ಟ್' },
  save_to_notes: { en: 'Save to Notes', kn: 'ಟಿಪ್ಪಣಿಗಳಿಗೆ ಉಳಿಸಿ' },
  fullscreen: { en: 'Fullscreen', kn: 'ಪೂರ್ಣ ಪರದೆ' },
  exit_fullscreen: { en: 'Exit Fullscreen', kn: 'ಪೂರ್ಣ ಪರದೆಯಿಂದ ನಿರ್ಗಮಿಸಿ' },
  top: { en: 'Top', kn: 'ಮೇಲಕ್ಕೆ' },
  more: { en: 'More', kn: 'ಇನ್ನಷ್ಟು' },
  generating_explainer: { en: 'Generating explanation for "{0}"...', kn: '"{0}" ಗೆ ವಿವರಣೆ ರಚಿಸಲಾಗುತ್ತಿದೆ...' },
  confirm_topic_title: { en: 'Confirm Topic', kn: 'ವಿಷಯ ದೃಢೀಕರಿಸಿ' },
  confirm_topic_desc: { en: 'Generate an explanation for "{0}"?', kn: '"{0}"ಗಾಗಿ ವಿವರಣೆ ರಚಿಸಬೇಕೇ?' },
  confirm: { en: 'Confirm', kn: 'ದೃಢೀಕರಿಸಿ' },
  refine_explanation: { en: 'Refine Explanation', kn: 'ವಿವರಣೆಯನ್ನು ಸುಧಾರಿಸಿ' },
  depth: { en: 'Depth', kn: 'ಆಳ' },
  format: { en: 'Format', kn: 'ರೂಪ' },
  specific_focus_optional: { en: 'Specific Focus (optional)', kn: 'ನಿರ್ದಿಷ್ಟ ಕೇಂದ್ರೀಕರಣ (ಐಚ್ಛಿಕ)' },
  specific_focus_placeholder: { en: 'e.g., Economic Impact, Constitutional Articles', kn: 'ಉದಾ., ಆರ್ಥಿಕ ಪರಿಣಾಮ, ಸಂವಿಧಾನಾತ್ಮಕ ವಿಧಿಗಳು' },

  // Current Affairs
  search_current_affairs: { en: 'Search Current Affairs', kn: 'ಸಾಮಯಿಕ ವಿಷಯಗಳನ್ನು ಹುಡುಕಿ' },
  date: { en: 'Date', kn: 'ದಿನಾಂಕ' },
  keywords_optional: { en: 'Keywords (optional)', kn: 'ಮುಖ್ಯಪದಗಳು (ಐಚ್ಛಿಕ)' },
  keywords_placeholder: { en: "e.g., 'RBI monetary policy'", kn: "ಉದಾ., 'ಆರ್ಬಿಐ ಹಣಕಾಸು ನೀತಿ'" },
  region: { en: 'Region', kn: 'ಪ್ರದೇಶ' },
  region_national: { en: 'National', kn: 'ರಾಷ್ಟ್ರೀಯ' },
  region_international: { en: 'International', kn: 'ಅಂತರಾಷ್ಟ್ರೀಯ' },
  region_global: { en: 'Global', kn: 'ಗ್ಲೋಬಲ್' },
  get_summary: { en: 'Get Summary', kn: 'ಸಾರಾಂಶ ಪಡೆಯಿರಿ' },
  summary_for: { en: 'Summary for', kn: 'ಈ ದಿನದ ಸಾರಾಂಶ' },
  sources: { en: 'Sources', kn: 'ಮೂಲಗಳು' },
  use_form_hint: { en: 'Use the form to get the latest current affairs summary.', kn: 'ಇತ್ತೀಚಿನ ಸಾಮಯಿಕ ವಿಷಯಗಳ ಸಾರಾಂಶ ಪಡೆಯಲು ಫಾರ್ಮ್ ಬಳಸಿ.' },
  gemini_tip: { en: 'Gemini is available by default. Add a Perplexity API key in settings for an alternative news source.', kn: 'ಜಿಮಿನಿ ಡೀಫಾಲ್ಟ್ ಆಗಿ ಲಭ್ಯ. ಪರ್ಯಾಯ ಸುದ್ದಿ ಮೂಲಕ್ಕಾಗಿ ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ Perplexity API ಕೀ ಸೇರಿಸಿ.' },
  no_search_history: { en: 'No search history yet.', kn: 'ಇನ್ನೂ ಹುಡುಕಾಟ ಇತಿಹಾಸ ಇಲ್ಲ.' },

  // Notes
  notes: { en: 'Notes', kn: 'ಟಿಪ್ಪಣಿಗಳು' },
  sign_in_notes: { en: 'Sign in to manage your notes.', kn: 'ನಿಮ್ಮ ಟಿಪ್ಪಣಿಗಳನ್ನು ನಿರ್ವಹಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.' },
  new_note: { en: 'New Note', kn: 'ಹೊಸ ಟಿಪ್ಪಣಿ' },
  loading_notes: { en: 'Loading notes…', kn: 'ಟಿಪ್ಪಣಿಗಳು ಲೋಡ್ ಆಗುತ್ತಿದೆ…' },
  no_notes_yet: { en: 'No notes yet. Save from Global Assistant or Topic Explainer.', kn: 'ಇನ್ನೂ ಟಿಪ್ಪಣಿಗಳಿಲ್ಲ. ಗ್ಲೋಬಲ್ ಸಹಾಯಕ ಅಥವಾ ವಿಷಯ ವಿವರಣೆಕಾರದಿಂದ ಉಳಿಸಿ.' },
  create_new_note: { en: 'Create New Note', kn: 'ಹೊಸ ಟಿಪ್ಪಣಿ ರಚಿಸಿ' },
  save_note: { en: 'Save Note', kn: 'ಟಿಪ್ಪಣಿ ಉಳಿಸಿ' },
  title: { en: 'Title', kn: 'ಶೀರ್ಷಿಕೆ' },
  content: { en: 'Content', kn: 'ವಿಷಯ' },
  enter_note_title: { en: 'Enter note title...', kn: 'ಟಿಪ್ಪಣಿ ಶೀರ್ಷಿಕೆ ನಮೂದಿಸಿ...' },
  enter_note_content: { en: 'Enter your note content...', kn: 'ನಿಮ್ಮ ಟಿಪ್ಪಣಿಯ ವಿಷಯ ನಮೂದಿಸಿ...' },

  // Admin (selected common strings)
  admin_title: { en: 'Admin — Competitive Quizzes', kn: 'ನಿರ್ವಹಣೆ — ಸ್ಪರ್ಧಾತ್ಮಕ ಪ್ರಶ್ನೋತ್ತರಗಳು' },
  working: { en: 'Working…', kn: 'ಕೆಲಸ ನಡೆಯುತ್ತಿದೆ…' },
  create_quiz: { en: 'Create Quiz', kn: 'ಪ್ರಶ್ನೋತ್ತರ ರಚಿಸಿ' },
  subject: { en: 'Subject', kn: 'ವಿಷಯ' },
  description_optional: { en: 'Description (optional)', kn: 'ವಿವರಣೆ (ಐಚ್ಛಿಕ)' },
  focus_hint: { en: 'Focus (how the quiz should be focused)', kn: 'ಕೇಂದ್ರೀಕರಣ (ಪ್ರಶ್ನೋತ್ತರ ಯಾವ ದಿಕ್ಕಿನಲ್ಲಿ ಇರಬೇಕು)' },
  start_time: { en: 'Start time', kn: 'ಪ್ರಾರಂಭ ಸಮಯ' },
  duration_seconds: { en: 'Duration seconds', kn: 'ಅವಧಿ ಸೆಕೆಂಡುಗಳು' },
  auto_generate: { en: 'Auto-generate', kn: 'ಸ್ವಯಂ ರಚಿಸಿ' },
  generate: { en: 'Generate', kn: 'ರಚಿಸಿ' },
  questions: { en: 'Questions', kn: 'ಪ್ರಶ್ನೆಗಳು' },
  remove: { en: 'Remove', kn: 'ತೆಗೆದುಹಾಕಿ' },
  correct_index: { en: 'Correct index', kn: 'ಸರಿಯಾದ ಸೂಚ್ಯಂಕ' },
  points: { en: 'Points', kn: 'ಅಂಕಗಳು' },
  add_question: { en: 'Add Question', kn: 'ಪ್ರಶ್ನೆ ಸೇರಿಸಿ' },
  leaderboards: { en: 'Leaderboards', kn: 'ಲೀಡರ್‍ಬೋರ್ಡ್ಸ್' },
  no_quizzes_yet: { en: 'No quizzes yet.', kn: 'ಇನ್ನೂ ಪ್ರಶ್ನೋತ್ತರಗಳಿಲ್ಲ.' },
  publish: { en: 'Publish', kn: 'ಪ್ರಕಟಿಸಿ' },
  unpublish: { en: 'Unpublish', kn: 'ಪ್ರಕಟಿಸದಿರಿ' },
  user_management: { en: 'User Management', kn: 'ಬಳಕೆದಾರ ನಿರ್ವಹಣೆ' },
  all_users: { en: 'All Users', kn: 'ಎಲ್ಲಾ ಬಳಕೆದಾರರು' },
  active_users: { en: 'Active Users', kn: 'ಸಕ್ರಿಯ ಬಳಕೆದಾರರು' },
  inactive_users: { en: 'Inactive Users', kn: 'ನಿಷ್ಕ್ರಿಯ ಬಳಕೆದಾರರು' },
  search_users_placeholder: { en: 'Search users by email...', kn: 'ಇಮೇಲ್ ಮೂಲಕ ಬಳಕೆದಾರರನ್ನು ಹುಡುಕಿ...' },
  showing_users: { en: 'Showing {0} of {1} users', kn: '{1}ರಲ್ಲಿ {0} ಬಳಕೆದಾರರು ತೋರಿಸಲಾಗುತ್ತಿದೆ' },
  no_users_found: { en: 'No users found.', kn: 'ಯಾವ ಬಳಕೆದಾರರೂ ಕಂಡುಬಂದಿಲ್ಲ.' },
  user_results_and_leaderboards: { en: 'User Results & Leaderboards', kn: 'ಬಳಕೆದಾರ ಫಲಿತಾಂಶಗಳು ಮತ್ತು ಲೀಡರ್‍ಬೋರ್ಡ್ಸ್' },
  search_results_placeholder: { en: 'Search results by user email, quiz title, or subject...', kn: 'ಬಳಕೆದಾರ ಇಮೇಲ್, ಪ್ರಶ್ನೋತ್ತರ ಶೀರ್ಷಿಕೆ ಅಥವಾ ವಿಷಯದ ಮೂಲಕ ಫಲಿತಾಂಶ ಹುಡುಕಿ...' },
  all_results: { en: 'All Results', kn: 'ಎಲ್ಲ ಫಲಿತಾಂಶಗಳು' },
  most_recent: { en: 'Most Recent', kn: 'ಇತ್ತೀಚಿನವು' },
  top_scores: { en: 'Top Scores', kn: 'ಅತ್ಯುತ್ತಮ ಅಂಕಗಳು' },
  showing_results: { en: 'Showing {0} of {1} results', kn: '{1}ರಲ್ಲಿ {0} ಫಲಿತಾಂಶಗಳು ತೋರಿಸಲಾಗುತ್ತಿದೆ' },
  no_results_found: { en: 'No results found.', kn: 'ಯಾವ ಫಲಿತಾಂಶವೂ ಕಂಡುಬಂದಿಲ್ಲ.' },
};

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof STRINGS) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem('easyway-lang') as Lang | null;
    if (saved === 'en' || saved === 'kn') setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('easyway-lang', l); } catch {}
  };

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    setLang,
    t: (key) => STRINGS[key]?.[lang] ?? key,
  }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};
