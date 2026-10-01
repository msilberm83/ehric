// Progress storage. Phase 1 keeps progress in this browser (localStorage) so the
// learning center can be tried before the database exists. Phase 2 replaces the
// three functions below with Supabase calls (same names), so app.js doesn't change.
const Store = (() => {
  const KEY = "ehric_progress_v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
  return {
    get() { return load(); },
    markLesson(mod, file) {
      const d = load(); d.lessons = d.lessons || {}; d.lessons[file] = Date.now(); save(d);
    },
    recordQuiz(mod, score, total) {
      const d = load(); d.quizzes = d.quizzes || {};
      const prev = d.quizzes[mod] || { best: 0, attempts: 0 };
      d.quizzes[mod] = { best: Math.max(prev.best, score / total), attempts: prev.attempts + 1, last: Date.now() };
      save(d);
    },
  };
})();
