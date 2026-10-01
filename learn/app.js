// EHRIC Learning Center — phase 2 (sign-in, saved progress, lessons, module quizzes).
const PASS = 0.8, QUIZ_SIZE = 10;
const $ = (s) => document.querySelector(s);
const main = $("#main");
let COURSE = [];

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Tiny markdown for quiz stems: tables, bold, paragraphs.
function md(src) {
  const lines = src.split("\n"); let out = "", tbl = [];
  const flush = () => {
    if (!tbl.length) return;
    const rows = tbl.filter((r) => !/^\|\s*-/.test(r)).map((r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim())));
    out += "<table><thead><tr>" + rows[0].map((c) => `<th>${c}</th>`).join("") + "</tr></thead><tbody>" +
      rows.slice(1).map((r) => "<tr>" + r.map((c) => `<td>${c}</td>`).join("") + "</tr>").join("") + "</tbody></table>";
    tbl = [];
  };
  for (const l of lines) {
    if (l.trim().startsWith("|")) { tbl.push(l); continue; }
    flush();
    if (l.trim()) out += `<p>${inline(l)}</p>`;
  }
  flush(); return out;
}
const clean = (s) => (s || "").replace(/^\s*(Correct|Not best|Incorrect|Wrong|Right)[.:!]?\s*/i, "");
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");

const unlocked = (n, p) => n === 1 || ((p.quizzes || {})[n - 1] || {}).best >= PASS;
const passed = (n, p) => ((p.quizzes || {})[n] || {}).best >= PASS;

function focusMain(title) { document.title = title + " · EHRIC Learning Center"; main.focus(); window.scrollTo(0, 0); }

function dashboard() {
  const p = Store.get();
  const done = COURSE.filter((m) => passed(m.n, p)).length;
  main.innerHTML = `<h1>My course</h1>
    <p class="muted">Electronic Health Record Implementation Certificate · ${done} of 13 modules complete</p>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="13" aria-valuenow="${done}" aria-label="Modules complete"><i style="width:${(done / 13) * 100}%"></i></div>
    <ol class="mods">${COURSE.map((m) => {
      const st = passed(m.n, p) ? `<span class="tag done">Passed</span>` : unlocked(m.n, p) ? `<span class="tag">Open</span>` : `<span class="tag lock">Locked: pass Module ${m.n - 1} quiz</span>`;
      const link = unlocked(m.n, p) ? `<a href="#/m/${m.n}">${esc(m.title)}</a>` : `<span>${esc(m.title)}</span>`;
      return `<li class="mod">${link}${st}</li>`;
    }).join("")}</ol>`;
  focusMain("My course");
}

function moduleView(n) {
  const m = COURSE[n - 1], p = Store.get();
  if (!m || !unlocked(n, p)) return dashboard();
  const q = (p.quizzes || {})[n];
  main.innerHTML = `<p><a href="#/">← My course</a></p><h1>${esc(m.title)}</h1>
    <h2>Lessons</h2><ol class="lessons">${m.lessons.map((l, i) =>
      `<li><a href="#/m/${n}/l/${i}">${esc(l.title)}</a> ${(p.lessons || {})[l.file] ? "✓" : ""}</li>`).join("")}</ol>
    <h2>Module quiz</h2>
    <p>${QUIZ_SIZE} questions drawn from a larger pool, so each try is different. Pass mark 80%. Unlimited tries, with an explanation after every question.</p>
    <p>${q ? `Best score: <b>${Math.round(q.best * 100)}%</b> (${q.attempts} ${q.attempts === 1 ? "try" : "tries"})` : "Not taken yet."}</p>
    <a class="btn" href="#/m/${n}/quiz">${q ? "Take the quiz again" : "Start the quiz"}</a>`;
  focusMain(m.title);
}

async function lessonView(n, i) {
  const m = COURSE[n - 1]; const l = m && m.lessons[i];
  if (!l || !unlocked(n, Store.get())) return dashboard();
  const html = await (await fetch(l.file)).text();
  const prev = i > 0 ? `<a class="btn sec" href="#/m/${n}/l/${i - 1}">← Previous</a>` : `<a class="btn sec" href="#/m/${n}">← Module</a>`;
  const next = i < m.lessons.length - 1 ? `<a class="btn" href="#/m/${n}/l/${i + 1}">Next →</a>` : `<a class="btn" href="#/m/${n}/quiz">Take the module quiz →</a>`;
  main.innerHTML = `<p><a href="#/m/${n}">← ${esc(m.title)}</a></p><article class="lesson">${html}</article><div class="pager">${prev}${next}</div>`;
  main.querySelectorAll("img").forEach((img) => { img.loading = "lazy"; });
  Store.markLesson(n, l.file);
  focusMain(l.title);
}

async function quizView(n) {
  const m = COURSE[n - 1];
  if (!m || !unlocked(n, Store.get())) return dashboard();
  const pool = await (await fetch(`data/quiz_M${String(n).padStart(2, "0")}.json`)).json();
  const qs = pool.map((q) => [Math.random(), q]).sort((a, b) => a[0] - b[0]).slice(0, QUIZ_SIZE).map((x) => x[1]);
  let i = 0, score = 0;
  const show = () => {
    const q = qs[i];
    const letters = Object.keys(q.options).sort(() => Math.random() - 0.5); // shuffle option order
    main.innerHTML = `<p><a href="#/m/${n}">← ${esc(m.title)}</a></p><h1>Module ${n} quiz</h1>
      <p class="muted">Question ${i + 1} of ${qs.length} · Score so far: ${score}</p>
      <div class="q"><div>${md(q.stem)}</div>
      <div role="group" aria-label="Answer choices">${letters.map((L, j) =>
        `<button class="opt" data-l="${L}">${"ABCD"[j]}. ${inline(q.options[L])}</button>`).join("")}</div>
      <div class="fb" id="fb" aria-live="polite" hidden></div></div>
      <div class="pager"><span></span><button class="btn" id="next" disabled>${i < qs.length - 1 ? "Next question →" : "See my score"}</button></div>`;
    main.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
      const pick = b.dataset.l, right = pick === q.key;
      if (right) score++;
      main.querySelectorAll(".opt").forEach((o) => { o.disabled = true; if (o.dataset.l === q.key) o.classList.add("right"); });
      if (!right) b.classList.add("wrong");
      const fb = $("#fb"); fb.hidden = false;
      fb.innerHTML = `<b class="${right ? "ok" : "no"}">${right ? "Correct." : "Not quite."}</b> ${inline(clean(q.feedback[pick]))}` +
        (right ? "" : `<p><b>Why the right answer is right:</b> ${inline(clean(q.feedback[q.key]))}</p>`);
      const nx = $("#next"); nx.disabled = false; nx.focus();
    }));
    $("#next").addEventListener("click", () => { i++; i < qs.length ? show() : finish(); });
    focusMain(`Module ${n} quiz`);
  };
  const finish = () => {
    Store.recordQuiz(n, score, qs.length);
    const pct = Math.round((score / qs.length) * 100), ok = score / qs.length >= PASS;
    main.innerHTML = `<h1>Module ${n} quiz: ${pct}%</h1>
      <p>${ok ? "You passed. The next module is open." : "Not yet at 80%. Review the lessons for the questions you missed, then try again. You'll get a different set of questions."}</p>
      <div class="pager"><a class="btn sec" href="#/m/${n}/quiz">Try again</a>${ok && n < 13 ? `<a class="btn" href="#/m/${n + 1}">Go to Module ${n + 1} →</a>` : `<a class="btn" href="#/">My course</a>`}</div>`;
    focusMain(`Module ${n} quiz result`);
  };
  show();
}

function signInView(msg) {
  main.innerHTML = `<h1>Sign in to your course</h1>
    <p>Enter your email and we'll send you a sign-in link. No password needed. Open the link on this same device and browser.</p>
    ${msg ? `<p class="fb" role="status">${msg}</p>` : ""}
    <form id="si" class="q" style="max-width:520px">
      <label for="si-name">Full name (first time only)</label><input id="si-name" autocomplete="name" style="width:100%;padding:10px;margin:4px 0 12px">
      <label for="si-email">Email</label><input id="si-email" type="email" required autocomplete="email" style="width:100%;padding:10px;margin:4px 0 14px">
      <button class="btn" type="submit">Email me a sign-in link</button>
    </form>`;
  $("#si").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#si-email").value.trim(), name = $("#si-name").value.trim();
    const { error } = await Store.signIn(email, name);
    signInView(error ? "Sorry, that didn't work: " + esc(error.message) + " Please try again in a minute."
      : "Check your email for a sign-in link from EHRIC (check Junk too). Open it on this device to continue.");
  });
  focusMain("Sign in");
}

function showWho() {
  const u = Store.user(); const w = $("#who");
  w.innerHTML = u ? `${esc(u.email)} · <a href="#/signout" style="color:#fff">Sign out</a>` : "";
}

async function route() {
  const h = location.hash.replace(/^#\/?/, "").split("/");
  if (h[0] === "signout") { await Store.signOut(); showWho(); location.hash = "#/"; return; }
  showWho();
  if (!Store.user()) return signInView();
  if (h[0] === "m" && h[2] === "l") return lessonView(+h[1], +h[3]);
  if (h[0] === "m" && h[2] === "quiz") return quizView(+h[1]);
  if (h[0] === "m") return moduleView(+h[1]);
  dashboard();
}
(async () => {
  COURSE = await (await fetch("data/course.json")).json();
  await Store.load();
  Store.onChange(async () => { await Store.load(); route(); });
  window.addEventListener("hashchange", route);
  route();
})();
