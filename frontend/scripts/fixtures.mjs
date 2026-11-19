// Fake API responses so signed-in pages can be rendered and audited without the backend.
const progress = (o = {}) => ({ status: 'new', difficult: false, saved: false, first_lesson_date: '2026-11-17', learned_on: null, my_sentences: [], ...o })

const word = (id, w, pos, pron, def, extra = {}) => ({
  id, word: w, part_of_speech: pos, pronunciation: pron, definition: def,
  definition_source: { book_title: 'Essential Vocabulary', page: 12 },
  examples: [{ text: `A sentence using ${w}.`, source: 'book' }],
  synonyms: ['frank', 'honest'], antonyms: ['evasive'], level: 'intermediate',
  sources: [{ book_title: 'Essential Vocabulary', page: 12 }], progress: progress(), ...extra,
})

const words = [
  word('w1', 'candid', 'adjective', '/ˈkændɪd/', 'truthful and straightforward; frank.', { progress: progress({ status: 'learned', learned_on: '2026-11-17' }) }),
  word('w2', 'meticulous', 'adjective', '/məˈtɪkjələs/', 'showing great attention to detail; very careful and precise.', { definition_source: null, examples: [{ text: 'She keeps meticulous notes.', source: 'ai' }] }),
  word('w3', 'resilient', 'adjective', null, 'able to recover quickly from difficult conditions.', { synonyms: [], antonyms: [] }),
]

const me = (role) => ({
  user: { id: 'u1', email: role === 'admin' ? 'admin@example.com' : 'ana@example.com', role, email_verified: true, created_at: '2026-11-17T08:00:00Z' },
  profile: { full_name: 'Ana Silva', proficiency_level: 'intermediate', accent: 'british', reminder_time: '08:00', timezone: 'Asia/Kolkata', learning_goals: ['Travel abroad'], notifications: { email: false, push: false, in_app: true } },
})

const adminWord = (id, w, status, needs, def) => ({
  id, word: w, part_of_speech: 'adjective', pronunciation: null, definition: def, examples: [], synonyms: [], antonyms: [],
  level: null, status, needs_review: needs, review_reasons: needs ? ['missing_definition'] : [], admin_edited: false,
  sources: [{ book_id: 'b1', book_slot: 1, book_title: 'Essential Vocabulary', page: 4, definition: def, raw_text: `${w} (adj.) ${def ?? ''}`, confidence: needs ? 0.5 : 0.9 }],
  starter_rank: null, updated_at: '2026-11-17T08:00:00Z',
})

const days = (month, n, special) =>
  Array.from({ length: n }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`
    return { date, due: special[date]?.due ?? 0, reviewed: special[date]?.reviewed ?? 0 }
  })

const note = (id, category, title, content, extra = {}) => ({
  id, category, title, content, tags: [], favourite: false, word_id: null, video_id: null,
  created_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T08:00:00Z', ...extra,
})

const video = (id, vid, key, channel, title, questions = []) => ({
  id, video_id: vid, channel_key: key, channel_name: channel, title, thumbnail_url: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
  duration_seconds: 375, published_at: '2026-11-10T08:00:00Z', questions,
})

export function fixtures(role) {
  return {
    'GET /api/auth/me': me(role),
    'GET /api/dashboard': {
      lesson_date: '2026-11-18', lesson_kind: 'new', streak_days: 4, words_learned_total: 23, revisions_due_today: 3, speaking_challenge_done: false, quiz_done: true, next_reminder: { time: '08:00', channels: ['in_app', 'email'] },
      words_today: words.map((w) => ({ id: w.id, word: w.word, part_of_speech: w.part_of_speech, definition: w.definition, level: w.level, learned: w.progress.status !== 'new' })),
      videos_today: [
        { id: 'v1', title: 'Learn English with Friends: ordering coffee', channel_name: 'Learn English with TV Series', thumbnail_url: 'https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg', duration_seconds: 375, completed: false },
        { id: 'v2', title: 'Why do we dream?', channel_name: 'BBC Learning English — 6 Minute English', thumbnail_url: 'https://i.ytimg.com/vi/bbbbbbbbbbb/hqdefault.jpg', duration_seconds: 375, completed: true },
      ],
    },
    'GET /api/lessons/today': { lesson_date: '2026-11-17', kind: 'new', level: 'intermediate', words, revision_words: [], learned_count: 1, target: 7, can_add_more: true },
    'GET /api/vocabulary/w1': words[0],
    'GET /api/revision/queue': { today: '2026-11-18', words: [{ ...words[0], progress: progress({ status: 'learned', difficult: true }) }] },
    'GET /api/revision/calendar': { month: '2026-11', today: '2026-11-18', total_stages: 4, days: days('2026-11', 30, { '2026-11-16': { due: 2, reviewed: 0 }, '2026-11-17': { reviewed: 5 }, '2026-11-18': { due: 1 }, '2026-11-20': { due: 4 }, '2026-11-25': { due: 3 } }) },
    'GET /api/notebook': {
      items: [
        note('n1', 'mistakes', 'Since vs for', 'I have lived here for three years — not “since three years”.', { tags: ['grammar'], favourite: true }),
        note('n2', 'expressions', 'a night owl', 'Someone who likes to stay up late.\n\nHeard in: Why do we dream?', { tags: ['listening'] }),
        note('n3', 'vocabulary', 'candid', 'truthful and straightforward; frank.', { word_id: 'w1' }),
      ],
      total: 3, page: 1, page_size: 100, counts: { vocabulary: 1, expressions: 1, sentences: 0, mistakes: 1 },
    },
    'GET /api/notebook/tags': ['grammar', 'listening'],
    'GET /api/listening/today': {
      lesson_date: '2026-11-18',
      items: [
        { video: video('v1', 'aaaaaaaaaaa', 'tv_series', 'Learn English with TV Series', 'Learn English with Friends: ordering coffee'), progress: { watched_seconds: 120, completed: false, completed_at: null, notes: '', quiz: null } },
        { video: video('v2', 'bbbbbbbbbbb', 'bbc_6min', 'BBC Learning English — 6 Minute English', 'Why do we dream?', [{ id: 'q1', prompt: 'What is the programme about?', options: ['Dreams', 'Cooking', 'Football'] }]), progress: { watched_seconds: 375, completed: true, completed_at: '2026-11-18T07:00:00Z', notes: 'night owl', quiz: null } },
      ],
    },
    'GET /api/pronunciation/today': {
      today: '2026-11-18', accent: 'british', completed: false,
      words: words.map((w, i) => ({ id: w.id, word: w.word, part_of_speech: w.part_of_speech, pronunciation: w.pronunciation, definition: w.definition, example: w.examples[0]?.text ?? null, attempts_today: i === 0 ? 2 : 0, recognised_today: i === 0 })),
    },
    'GET /api/pronunciation/history': {
      total_attempts: 2, recognised_attempts: 1, days_practised: 1,
      items: [
        { id: 'p2', word_id: 'w1', word: 'candid', accent: 'british', heard: 'candid', recognised: true, method: 'browser_recognition', practice_date: '2026-11-18', created_at: '2026-11-18T08:05:00Z' },
        { id: 'p1', word_id: 'w1', word: 'candid', accent: 'american', heard: 'candy did', recognised: false, method: 'browser_recognition', practice_date: '2026-11-18', created_at: '2026-11-18T08:04:00Z' },
      ],
    },
    'GET /api/quiz/today': {
      today: '2026-11-18', learned_words: 23, min_words: 4,
      attempt: {
        id: 'qa1', quiz_date: '2026-11-18', kind: 'daily', result: null,
        questions: [
          { id: 'q1', type: 'match', prompt: 'Match each word with its meaning.', sentence: null, hint: null, speak_text: null, items: ['candid', 'meticulous', 'brisk', 'serene'], options: ['calm and peaceful', 'truthful and straightforward; frank.', 'quick and energetic', 'showing great attention to detail'] },
          { id: 'q2', type: 'meaning', prompt: 'What does “candid” mean?', sentence: null, hint: null, speak_text: null, items: [], options: ['calm and peaceful', 'truthful and straightforward; frank.', 'quick and energetic', 'careful with money'] },
        ],
      },
    },
    'GET /api/quiz/history': { quizzes_taken: 2, accuracy: 0.81, items: [
      { id: 'qh2', quiz_date: '2026-11-17', kind: 'practice', score: 7, total: 8, submitted_at: '2026-11-17T09:00:00Z' },
      { id: 'qh1', quiz_date: '2026-11-17', kind: 'daily', score: 6, total: 8, submitted_at: '2026-11-17T08:00:00Z' },
    ] },
    'GET /api/progress': {
      today: '2026-11-18', words_learned: 23, words_mastered: 4, revisions_due: 3, in_revision: 19, listening_minutes: 74, videos_completed: 11,
      quizzes_taken: 2, quiz_accuracy: 0.81, speaking_attempts: 17, streak_days: 4, longest_streak: 6,
      weekly: ['12', '13', '14', '15', '16', '17', '18'].map((d, i) => ({ date: `2026-11-${d}`, words_learned: [7, 0, 5, 7, 6, 7, 1][i], revisions: [0, 0, 2, 3, 4, 5, 1][i], videos: [2, 0, 1, 2, 2, 2, 1][i], quizzes: [0, 0, 0, 1, 0, 2, 0][i], speaking: [0, 0, 3, 5, 0, 7, 2][i] })),
      monthly: ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map((month, i) => ({ month, words_learned: [0, 0, 0, 0, 0, 23][i], words_mastered: [0, 0, 0, 0, 0, 4][i], total_learned: [0, 0, 0, 0, 0, 23][i] })),
      levels: [{ level: 'beginner', count: 5 }, { level: 'intermediate', count: 15 }, { level: 'advanced', count: 2 }, { level: null, count: 1 }],
    },
    'GET /api/notifications/unread-count': { unread: 1 },
    'GET /api/notifications/push/config': { enabled: false, public_key: null },
    'GET /api/notifications': { unread: 1, items: [
      { id: 'nt2', kind: 'daily_reminder', title: 'Good morning, Ana! Your FluentDay lesson is ready.', body: "Today's plan:\n7 new words\n2 listening lessons\n1 pronunciation challenge\n1 daily quiz\n\nStart learning today!", link: '/app', created_at: '2026-11-18T02:30:00Z', read: false },
      { id: 'nt1', kind: 'daily_reminder', title: 'Good morning, Ana! Your FluentDay lesson is ready.', body: "Today's plan:\n7 new words\n2 listening lessons\n\nStart learning today!", link: '/app', created_at: '2026-11-17T02:30:00Z', read: true },
    ] },
    'GET /api/admin/youtube/channels': [
      { key: 'tv_series', name: 'Learn English with TV Series', url: '', channel_id: '', title_filter: '', active: true, last_imported_at: null },
      { key: 'bbc_6min', name: 'BBC Learning English — 6 Minute English', url: 'https://www.youtube.com/@bbclearningenglish', channel_id: 'UCHaHD477h-FeBbVh9Sh7syA', title_filter: '6 Minute English', active: true, last_imported_at: '2026-11-17T06:00:00Z' },
    ],
    'GET /api/admin/youtube/videos': {
      items: [
        { id: 'v2', video_id: 'bbbbbbbbbbb', channel_key: 'bbc_6min', title: '6 Minute English: Why do we dream?', thumbnail_url: 'https://i.ytimg.com/vi/bbbbbbbbbbb/hqdefault.jpg', duration_seconds: 375, published_at: '2026-11-10T08:00:00Z', active: true, scheduled_for: '2026-11-19', questions: [{ id: 'q1', prompt: 'What is the programme about?', options: ['Dreams', 'Cooking'], answer_index: 0, explanation: '' }], source: 'rss', times_assigned: 12 },
        { id: 'v1', video_id: 'aaaaaaaaaaa', channel_key: 'tv_series', title: 'Learn English with Friends: ordering coffee', thumbnail_url: 'https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg', duration_seconds: null, published_at: null, active: false, scheduled_for: null, questions: [], source: 'manual', times_assigned: 0 },
      ],
      total: 2, page: 1, page_size: 50,
    },
    'GET /api/admin/overview': { users_total: 42, users_verified: 38, books_ready: 2, words_total: 1250, words_approved: 900, words_pending: 350, words_needing_review: 41 },
    'GET /api/admin/books': [
      { slot: 1, book: { id: 'b1', slot: 1, title: 'Essential Vocabulary', filename: 'essential-vocabulary.pdf', size_bytes: 4200000, page_count: 220, status: 'ready', error: null, word_count: 812, new_word_count: 812, flagged_count: 23, uploaded_at: '2026-11-16T10:00:00Z', processed_at: '2026-11-16T10:02:00Z' } },
      { slot: 2, book: { id: 'b2', slot: 2, title: 'Scanned Workbook', filename: 'workbook.pdf', size_bytes: 9100000, page_count: 80, status: 'failed', error: 'No text could be read from this PDF. It may be scanned images — OCR is not supported yet.', word_count: 0, new_word_count: 0, flagged_count: 0, uploaded_at: '2026-11-16T11:00:00Z', processed_at: '2026-11-16T11:00:30Z' } },
      { slot: 3, book: null },
    ],
    'GET /api/admin/vocabulary/starter': { words_in_file: 2739, loaded: 0, added: 0, updated: 0 },
    'GET /api/admin/vocabulary': { items: [adminWord('a1', 'abundant', 'approved', false, 'existing in large quantities.'), adminWord('a2', 'gregarious', 'pending', true, null)], total: 2, page: 1, page_size: 25 },
    'GET /api/admin/users': { items: [{ id: 'u1', email: 'ana@example.com', full_name: 'Ana Silva', role: 'subscriber', email_verified: true, proficiency_level: 'intermediate', timezone: 'Asia/Kolkata', notifications: { email: true, push: false, in_app: true }, created_at: '2026-11-10T08:00:00Z', last_login_at: '2026-11-17T07:30:00Z' }], total: 1, page: 1, page_size: 25 },
  }
}
