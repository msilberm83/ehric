// Progress storage (phase 2): Supabase sign-in + saved records.
// Learners sign in with an emailed link (no password). Each learner can read and write
// only their own rows (enforced by Row Level Security in supabase/01_setup.sql).
// The publishable key below is meant to be public; it cannot bypass those rules.
const SUPABASE_URL = "https://ryctzlhhqthgtebyktjn.supabase.co";
const SUPABASE_KEY = "sb_publishable_vmibEIKqsBPxcHqN68uOog_5QkyVMOI";

const Store = (() => {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
  });
  let user = null;
  let cache = { lessons: {}, quizzes: {} };

  async function load() {
    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null;
    cache = { lessons: {}, quizzes: {} };
    if (!user) return;
    const [les, qz] = await Promise.all([
      sb.from("lesson_progress").select("lesson_file, read_at").eq("user_id", user.id),
      sb.from("quiz_attempts").select("module, score, total").eq("user_id", user.id),
    ]);
    (les.data || []).forEach((r) => { cache.lessons[r.lesson_file] = r.read_at; });
    (qz.data || []).forEach((r) => {
      const q = cache.quizzes[r.module] || { best: 0, attempts: 0 };
      cache.quizzes[r.module] = { best: Math.max(q.best, r.score / r.total), attempts: q.attempts + 1 };
    });
  }

  return {
    load,
    user: () => user,
    get: () => cache,
    async signIn(email, fullName) {
      return sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + "/learn/", data: fullName ? { full_name: fullName } : undefined },
      });
    },
    async signOut() { await sb.auth.signOut(); user = null; cache = { lessons: {}, quizzes: {} }; },
    async markLesson(mod, file) {
      if (!user || cache.lessons[file]) return;
      cache.lessons[file] = new Date().toISOString();
      await sb.from("lesson_progress").upsert({ user_id: user.id, module: mod, lesson_file: file });
    },
    async recordQuiz(mod, score, total) {
      const q = cache.quizzes[mod] || { best: 0, attempts: 0 };
      cache.quizzes[mod] = { best: Math.max(q.best, score / total), attempts: q.attempts + 1 };
      if (user) {
        const { error } = await sb.from("quiz_attempts").insert({ user_id: user.id, module: mod, score, total });
        if (error) console.error("quiz save failed", error);
      }
    },
    onChange(cb) { sb.auth.onAuthStateChange(() => cb()); },
  };
})();
