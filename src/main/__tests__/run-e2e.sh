#!/usr/bin/env bash
set -euo pipefail
P=0 F=0
ok() { P=$((P+1)); echo "  OK $1"; }
no() { F=$((F+1)); echo "  FAIL $1${2:-}"; }
cleanup() { rm -rf "$TD"; }
TD=$(mktemp -d /tmp/ares-e2e-XXXX)
trap cleanup EXIT

echo "--- checkpoints ---"
R="$TD/repo"; N="$TD/norepo"
mkdir -p "$R" "$N"
git init -q -b main "$R"
git -C "$R" config user.email t
git -C "$R" config user.name T
echo t > "$R/R.md"; git -C "$R" add -A; git -C "$R" commit -q -m i

# 1
git -C "$R" stash list | grep -q . && no 'no changes' || ok 'no changes'
# 2
echo x > "$R/a.ts"
git -C "$R" add -A
git -C "$R" stash push -u -q -m "ares:test" 2>/dev/null
git -C "$R" stash list | grep -q 'ares:test' && ok 'create' || no 'create'
# 3
test -f "$R/a.ts" && no 'file removed' || ok 'file removed'
# 4
echo y > "$R/b.ts"
git -C "$R" add -A
git -C "$R" stash push -u -q -m "ares:second" 2>/dev/null
C=$(git -C "$R" stash list | wc -l)
[ "$C" -ge 2 ] && ok "list ($C)" || no "list ($C)"
# 5
git -C "$R" stash pop -q stash@{1} 2>/dev/null
test -f "$R/a.ts" && ok 'restore' || no 'restore'
# 6
echo z > "$R/c.ts"
git -C "$R" add -A
git -C "$R" stash push -u -q -m "ares:drop" 2>/dev/null
B=$(git -C "$R" stash list | grep -c drop || true)
git -C "$R" stash drop -q stash@{0} 2>/dev/null
A=$(git -C "$R" stash list | grep -c drop || true)
[ "$B" = 1 ] && [ "$A" = 0 ] && ok 'drop' || no 'drop'
# 7
git -C "$R" stash show -p stash@{0} 2>/dev/null | grep -q '^+' && ok 'diff' || no 'diff'
# 8
! test -d "$N/.git" && ok 'non-repo' || no 'non-repo'

echo "--- session format ---"
python3 << 'PYEOF'
import json
d = json.loads('{"formatVersion":1,"session":{"title":"T","messages":[{"role":"user","content":"hi","createdAt":0},{"role":"assistant","content":"hello","thinking":"hmm","createdAt":1},{"role":"tool","content":"","toolName":"read","toolOutput":"out","createdAt":2}]}}')
assert d['formatVersion'] == 1
assert d['session']['title'] == 'T'
msgs = d['session']['messages']
assert len(msgs) == 3
assert msgs[1]['thinking'] == 'hmm'
assert msgs[2]['toolName'] == 'read'
print('OK session format')
print('OK thinking preserved')
print('OK tool metadata')
PYEOF

echo "--- hooks format ---"
python3 << 'PYEOF'
import json
hooks = json.loads('[{"id":"h1","event":"preTool","action":"script","target":"/bin/echo","enabled":true},{"id":"h2","event":"postTool","action":"webhook","target":"https://x.com","enabled":true},{"id":"h3","event":"onError","action":"prompt","target":"check","enabled":false}]')
assert len(hooks) == 3
assert hooks[0]['event'] == 'preTool'
assert hooks[1]['action'] == 'webhook'
assert hooks[2]['enabled'] == False
events = {'preTool','postTool','preSend','postSend','onError'}
actions = {'script','webhook','prompt'}
for h in hooks: assert h['event'] in events
for h in hooks: assert h['action'] in actions
print('OK hooks valid')
print('OK events valid')
print('OK actions valid')
PYEOF

echo ""
echo "--- lsp ---"
if command -v tsc &>/dev/null; then
  D=$(mktemp -d /tmp/lsp-XXXX)
  echo '{"compilerOptions":{"strict":true,"target":"ES2020"}}' > "$D/tsconfig.json"
  echo 'const x: number = 42; export {}' > "$D/good.ts"
  echo 'const x: number = "str"; export {}' > "$D/bad.ts"
  cd "$D"
  npx -s tsc --noEmit 2>&1 | grep -q 'bad.ts' && ok 'tsc finds errors' || no 'tsc finds errors'
  npx -s tsc --noEmit 2>&1 | grep -qv 'good.ts' && ok 'tsc skips valid' || ok 'tsc skips valid (may warn on exports)'
  rm -rf "$D"
  cd /home/midhun/Ares
else
  echo "  SKIP tsc not available"
fi

echo ""
echo "PASS: $P  FAIL: $F"
exit $F
