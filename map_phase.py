import json
from pathlib import Path
import re

IN = Path("structured_keywords.json")
OUT = Path("structured_keywords_phased.json")

PHASES = ["Discover", "Define", "Develop", "Deliver"]

discover_kw = [
    "interview","survey","feedback","research","usability","test",
    "workshop","frage","umfrage","evaluation","bericht","quotes","responses"
]
define_kw = [
    "priorit","priority","zusammenfassung","analyse","problem","concern",
    "bedarf","priorisier","synthes","define","summary"
]
develop_kw = [
    "design","prototype","mockup","widget","interaction","ux","ui",
    "layout","skizzen","feature","funktion","karte","filter",
    "visual","gamification"
]
deliver_kw = [
    "deploy","pilot","rollout","implement","integration","publish",
    "veroeffentlichung","launch","betrieb","operate","produktion",
    "plan","planung","ticketing"
]

# compile regexes for whole-word matching
def compile_patterns(words):
    return [re.compile(r"\b" + re.escape(w) + r"\b", re.I) for w in words]

discover_pat = compile_patterns(discover_kw)
define_pat = compile_patterns(define_kw)
develop_pat = compile_patterns(develop_kw)
deliver_pat = compile_patterns(deliver_kw)

def score_phase(full_text, designer_text, planner_text, citizen_text):
    t = full_text or ""
    scores = {"Discover": 0.0, "Define": 0.0, "Develop": 0.0, "Deliver": 0.0}

    # count normalized hits (matches / set size)
    def norm_count(patterns):
        cnt = 0
        for p in patterns:
            if p.search(t):
                cnt += 1
        return cnt / max(1, len(patterns))

    scores['Discover'] += norm_count(discover_pat)
    scores['Define'] += norm_count(define_pat)
    scores['Develop'] += norm_count(develop_pat)
    scores['Deliver'] += norm_count(deliver_pat)

    # boost if citizen text contains discovery signals
    if any(p.search(citizen_text or "") for p in discover_pat):
        scores['Discover'] += 0.5
    # designer text is a strong signal for Develop
    if designer_text and len(designer_text.strip())>0:
        scores['Develop'] += 0.4
    # planner text signals Deliver
    if planner_text and len(planner_text.strip())>0:
        scores['Deliver'] += 0.4

    # pick best; tie-breaker order Discover, Define, Develop, Deliver
    best = max(scores.values())
    if best == 0:
        return 'Discover'
    for p in ['Discover','Define','Develop','Deliver']:
        if scores[p] == best:
            return p


def main():
    if not IN.exists():
        print(f"{IN} not found")
        return
    data = json.loads(IN.read_text(encoding="utf-8"))
    out = []
    for item in data:
        text_parts = []
        keyword = item.get("keyword","")
        text_parts.append(keyword)
        citizen = item.get("roles",{}).get("citizen",{}).get("exact_sentence","") or item.get("roles",{}).get("citizen",{}).get("original_sentence","")
        text_parts.append(citizen)
        designer = item.get("roles",{}).get("designer",{}).get("design_suggestion","") or ""
        planner = item.get("roles",{}).get("planner",{}).get("planning_suggestion","") or ""
        text_parts.extend([designer, planner, item.get("source","")])

        full = " ".join([str(p) for p in text_parts if p])
        # pass individual texts so scorer can weight designer/planner/citizen separately
        designer_text = designer
        planner_text = planner
        citizen_text = citizen
        phase = score_phase(full, designer_text, planner_text, citizen_text)
        item["phase"] = phase
        if "day" in item:
            del item["day"]
        out.append(item)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Wrote {len(out)} entries to {OUT}")

if __name__ == "__main__":
    main()
