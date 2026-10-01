#!/usr/bin/env python3
"""Rebuild the ehric.org learning center from the current course files.
Run after any chapter, quiz, caption, or picture change:
    python3 build_learn.py && git add -A && git commit -m "Update lessons" && git push
Reads:  ../09 Course edition/moduleNN.md, images/captions.tsv, images/*.svg
        ../11 LearnWorlds build/quiz_pools/quiz_MNN.md
Writes: learn/lessons/, learn/data/, learn/img/ (PNG renders of the SVGs, via Chrome)
"""
import re, os, json, csv, html, shutil, subprocess, glob
H = os.path.dirname(os.path.abspath(__file__))
CE = os.path.join(H, "..", "09 Course edition")
QP = os.path.join(H, "..", "11 LearnWorlds build", "quiz_pools")
L = os.path.join(H, "learn")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CAP = 1900
cap = {r[0]: r[1] for r in csv.reader(open(os.path.join(CE, "images", "captions.tsv"), encoding="utf-8"), delimiter="\t") if len(r) > 1}

def figure(m):
    i = m.group(1); num = "Intro" if i.startswith("INTRO") else f"{int(i[1:3])}.{int(i[4:6])}"
    c = html.escape(cap.get(i, ""))
    return f'\n<figure><img src="../../img/{i}.png" alt="Figure {num}. {c}" loading="lazy"><figcaption><b>Figure {num}.</b> {c}</figcaption></figure>\n'

def md2html(md):
    md = re.sub(r"^> \[ILLUSTRATION ([A-Z0-9-]+): .*\]\s*$", figure, md, flags=re.M)
    md = md.replace('<div style="page-break-before: always;"></div>', "")
    return subprocess.run(["pandoc", "-f", "gfm", "-t", "html"], input=md, capture_output=True, text=True).stdout

def build_lessons():
    shutil.rmtree(os.path.join(L, "lessons"), ignore_errors=True)
    course = []
    for i in range(1, 14):
        t = open(os.path.join(CE, f"module{i:02d}.md"), encoding="utf-8").read()
        title = t.split("\n", 1)[0].lstrip("# ").strip()
        core = t.split("\n## Practice exam questions", 1)[0]
        core, _, answers = core.partition("\n## Answers for this chapter")
        parts = re.split(r"\n(?=## )", core)
        start = [p for p in parts if p.startswith("## Chapter outline") or p.startswith("## The problem")]
        body = [p for p in parts[1:] if p not in start]
        src = []
        for k, p in enumerate(body):
            if "### Sources for this module" in p:
                a, b = p.split("### Sources for this module", 1); body[k] = a; src.append("### Sources for this module" + b)
        groups, cur, n = [], [], 0
        for p in body:
            w = len(p.split())
            if cur and n + w > CAP: groups.append(cur); cur, n = [], 0
            cur.append(p); n += w
        if cur: groups.append(cur)
        d = os.path.join(L, "lessons", f"M{i:02d}"); os.makedirs(d, exist_ok=True); les = []
        def write(name, lt, md):
            open(os.path.join(d, name + ".html"), "w", encoding="utf-8").write(f"<h1>{html.escape(lt)}</h1>\n" + md2html(md))
            les.append({"file": f"lessons/M{i:02d}/{name}.html", "title": lt})
        write("L00_start_here", f"Module {i} — Start here: outline and the problem", "\n\n".join(start))
        for k, g in enumerate(groups, 1):
            write(f"L{k:02d}", f"Module {i}, Lesson {k}: " + g[0].split("\n", 1)[0].lstrip("# ").strip(), "\n\n".join(g))
        if answers: write("L98_answers", f"Module {i} — Answers", "## Answers for this chapter" + answers)
        if src: write("L99_sources", f"Module {i} — Sources", "\n\n".join(src))
        course.append({"n": i, "title": title, "lessons": les})
    os.makedirs(os.path.join(L, "data"), exist_ok=True)
    json.dump(course, open(os.path.join(L, "data", "course.json"), "w"), indent=0)
    return sum(len(c["lessons"]) for c in course)

def build_quizzes():
    for i in range(1, 14):
        t = open(os.path.join(QP, f"quiz_M{i:02d}.md"), encoding="utf-8").read(); out = []
        for b in re.split(r"\n(?=### Q )", "\n" + t)[1:]:
            pre = b.split("\nA. ")[0]
            stem = "\n".join(l for l in pre.split("\n")[1:] if not l.startswith("- **")).strip()
            opts = dict(re.findall(r"^([ABCD])\. (.+?)\s*$", b, re.M))
            k = re.search(r"\*\*Key:\*\*\s*([ABCD])", b).group(1)
            fb = {x: (re.search(rf"\*\*Feedback {x}:\*\*\s*(.+)", b) or [None, ""])[1].strip() for x in "ABCD"}
            out.append({"stem": stem, "options": opts, "key": k, "feedback": fb})
        json.dump(out, open(os.path.join(L, "data", f"quiz_M{i:02d}.json"), "w"), indent=0)

def build_images():
    img = os.path.join(L, "img"); shutil.rmtree(img, ignore_errors=True); os.makedirs(img)
    for svg in sorted(glob.glob(os.path.join(CE, "images", "*.svg"))):
        iid = os.path.basename(svg)[:-4]; png = os.path.join(img, iid + ".png")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1920,1080",
                        f"--screenshot={png}", "file://" + svg], capture_output=True)
        subprocess.run(["sips", "-Z", "1600", png], capture_output=True)
    return len(os.listdir(img))

if __name__ == "__main__":
    print("lessons:", build_lessons()); build_quizzes(); print("images:", build_images())
