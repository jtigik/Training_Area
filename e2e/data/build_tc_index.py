"""Regera e2e/data/tc-index.json a partir de qa/test_cases.json (plano de testes do QA)."""
import collections
import json
import sys
from pathlib import Path

src = Path(sys.argv[1] if len(sys.argv) > 1 else "../qa/test_cases.json")
idx = collections.defaultdict(list)
for case in json.loads(src.read_text()):
    if case.get("e2e_candidate"):
        idx[f"{case['story']} {case['ac']}"].append(case["id"])
out = {
    "$comment": "Gerado de qa/test_cases.json: história+AC → IDs TC candidatos a E2E. "
    "Regerar com: python3 e2e/data/build_tc_index.py ../qa/test_cases.json",
    "index": dict(sorted(idx.items())),
}
Path(__file__).with_name("tc-index.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
print(f"{len(idx)} critérios mapeados")
