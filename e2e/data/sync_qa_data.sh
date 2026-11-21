#!/usr/bin/env bash
# Sincroniza os dados do plano de testes do QA (fonte da verdade em ../qa) com a suíte e2e.
# Uso (na raiz do worktree): bash e2e/data/sync_qa_data.sh [caminho/para/qa]
set -euo pipefail
QA="${1:-../qa}"
HERE="$(cd "$(dirname "$0")" && pwd)"
cp "$QA/excel_formulas/formulas.json" "$HERE/qa/formulas.json"
cp "$QA/excel_formulas/contexts.json" "$HERE/qa/contexts.json"
python3 "$HERE/build_tc_index.py" "$QA/test_cases.json"
echo "formulas: $(python3 -c "import json;print(len(json.load(open('$HERE/qa/formulas.json'))))") casos"
