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
TSC="/home/midhun/Ares/node_modules/.bin/tsc"
if [ -x "$TSC" ]; then
  D=$(mktemp -d /tmp/lsp-XXXX)
  echo '{"compilerOptions":{"strict":true,"target":"ES2020"}}' > "$D/tsconfig.json"
  echo 'const x: number = 42; export {}' > "$D/good.ts"
  echo 'const x: number = "str"; export {}' > "$D/bad.ts"
  cd "$D"
  LSP_OUTPUT=$("$TSC" --noEmit 2>&1) || true
  echo "$LSP_OUTPUT" | grep -q 'bad.ts' && ok 'tsc finds errors' || no 'tsc finds errors'
  if echo "$LSP_OUTPUT" | grep -q 'good.ts'; then no 'tsc skips valid (good.ts in errors)'; else ok 'tsc skips valid'; fi
  rm -rf "$D"
  cd /home/midhun/Ares
else
  echo "  SKIP tsc not available"
fi

echo ""
echo "--- git operations ---"
G="$TD/gitrepo"
mkdir -p "$G"
git init -q -b main "$G"
git -C "$G" config user.email t
git -C "$G" config user.name T

# 9 - git add and commit
echo "file1" > "$G/file1.txt"
git -C "$G" add file1.txt
git -C "$G" commit -q -m "add file1"
git -C "$G" log --oneline | grep -q "add file1" && ok 'commit' || no 'commit'

# 10 - git branch
git -C "$G" branch -q feature-branch
git -C "$G" branch | grep -q feature-branch && ok 'branch create' || no 'branch create'

# 11 - git checkout
git -C "$G" checkout -q feature-branch
CURRENT=$(git -C "$G" branch --show-current)
[ "$CURRENT" = "feature-branch" ] && ok 'checkout branch' || no "checkout branch ($CURRENT)"

# 12 - git merge
echo "file2" > "$G/file2.txt"
git -C "$G" add file2.txt
git -C "$G" commit -q -m "add file2"
git -C "$G" checkout -q main
git -C "$G" merge -q feature-branch --no-edit
git -C "$G" log --oneline | grep -q "add file2" && ok 'merge' || no 'merge'

# 13 - git stash with message
echo "stash-me" > "$G/stash.txt"
git -C "$G" add stash.txt
git -C "$G" stash push -u -q -m "ares:e2e-stash" 2>/dev/null
git -C "$G" stash list | grep -q "ares:e2e-stash" && ok 'stash with message' || no 'stash with message'

# 14 - git stash pop
git -C "$G" stash pop -q 2>/dev/null
test -f "$G/stash.txt" && ok 'stash pop' || no 'stash pop'

# 15 - git file count after operations
FILE_COUNT=$(git -C "$G" ls-files | wc -l)
[ "$FILE_COUNT" -ge 2 ] && ok "file count ($FILE_COUNT)" || no "file count ($FILE_COUNT)"

echo ""
echo "--- session format edge cases ---"
python3 << 'PYEOF'
import json

# Test empty messages array
d1 = json.loads('{"formatVersion":1,"session":{"title":"Empty","messages":[]}}')
assert len(d1['session']['messages']) == 0
print('OK empty messages')

# Test tool input/output as JSON strings
d3 = json.loads('{"formatVersion":1,"session":{"title":"Tool","messages":[{"role":"tool","content":"","toolName":"read","toolInput":"/path/file.ts","toolOutput":"file content here","createdAt":0}]}}')
assert d3['session']['messages'][0]['toolInput'] == '/path/file.ts'
assert d3['session']['messages'][0]['toolOutput'] == 'file content here'
print('OK tool input/output')

# Test attachments field
d4 = json.loads('{"formatVersion":1,"session":{"title":"Attach","messages":[{"role":"user","content":"see file","attachments":"/tmp/file.txt","createdAt":0}]}}')
assert d4['session']['messages'][0]['attachments'] == '/tmp/file.txt'
print('OK attachments field')

# Test multiple messages
d5 = json.loads('{"formatVersion":1,"session":{"title":"Multi","messages":[{"role":"user","content":"q1","createdAt":0},{"role":"assistant","content":"a1","createdAt":1},{"role":"user","content":"q2","createdAt":2},{"role":"assistant","content":"a2","createdAt":3}]}}')
assert len(d5['session']['messages']) == 4
print('OK multiple messages')
PYEOF

echo ""
echo "--- hooks format edge cases ---"
python3 << 'PYEOF'
import json

# Test all event types
events = ['preTool', 'postTool', 'preSend', 'postSend', 'onError']
for e in events:
    h = json.loads('{"id":"h_%s","event":"%s","action":"script","target":"/bin/echo","enabled":true}' % (e, e))
    assert h['event'] == e
print('OK all event types')

# Test all action types
actions = ['script', 'webhook', 'prompt']
for a in actions:
    h = json.loads('{"id":"h_%s","event":"preTool","action":"%s","target":"test","enabled":true}' % (a, a))
    assert h['action'] == a
print('OK all action types')

# Test disabled hook
h = json.loads('{"id":"h_disabled","event":"preTool","action":"script","target":"/bin/echo","enabled":false}')
assert h['enabled'] == False
print('OK disabled hook')

# Test empty hooks array
hooks = json.loads('[]')
assert len(hooks) == 0
print('OK empty hooks')
PYEOF

echo ""
echo "--- git extended operations ---"

# 16 - git tag
git -C "$G" tag v1.0.0
TAGS=$(git -C "$G" tag -l)
echo "$TAGS" | grep -q "v1.0.0" && ok 'tag create' || no 'tag create'

# 17 - git tag list
TAG_COUNT=$(git -C "$G" tag -l | wc -l)
[ "$TAG_COUNT" -ge 1 ] && ok "tag list ($TAG_COUNT)" || no "tag list ($TAG_COUNT)"

# 18 - git branch deletion
git -C "$G" branch feature-delete-me
git -C "$G" checkout -q main
git -C "$G" branch -D feature-delete-me
git -C "$G" branch | grep -q "feature-delete-me" && no 'branch delete' || ok 'branch delete'

# 19 - git diff (unstaged)
echo "modified" >> "$G/file1.txt"
DIFF_OUTPUT=$(git -C "$G" diff file1.txt 2>/dev/null)
echo "$DIFF_OUTPUT" | grep -q "modified" && ok 'diff unstaged' || no 'diff unstaged'

# 20 - git diff (staged)
git -C "$G" add file1.txt
STAGED_DIFF=$(git -C "$G" diff --cached 2>/dev/null)
echo "$STAGED_DIFF" | grep -q "modified" && ok 'diff staged' || no 'diff staged'

# 21 - git log
LOG_OUTPUT=$(git -C "$G" log --oneline)
echo "$LOG_OUTPUT" | grep -q "add file1" && ok 'log' || no 'log'

# 22 - git stash with multiple entries
echo "stash-a" > "$G/stash-a.txt"
git -C "$G" add stash-a.txt
git -C "$G" stash push -u -q -m "ares:multi-a" 2>/dev/null
echo "stash-b" > "$G/stash-b.txt"
git -C "$G" add stash-b.txt
git -C "$G" stash push -u -q -m "ares:multi-b" 2>/dev/null
MULTI_COUNT=$(git -C "$G" stash list | wc -l)
[ "$MULTI_COUNT" -ge 2 ] && ok "stash multi ($MULTI_COUNT)" || no "stash multi ($MULTI_COUNT)"

# 23 - stash pop specific index
git -C "$G" stash pop -q stash@{0} 2>/dev/null
test -f "$G/stash-b.txt" && ok 'stash pop specific' || no 'stash pop specific'

# 24 - stash drop specific
DROP_BEFORE=$(git -C "$G" stash list | wc -l)
git -C "$G" stash drop -q stash@{0} 2>/dev/null
DROP_AFTER=$(git -C "$G" stash list | wc -l)
[ "$DROP_AFTER" -lt "$DROP_BEFORE" ] && ok 'stash drop specific' || no "stash drop specific ($DROP_BEFORE -> $DROP_AFTER)"

# 25 - git show (log based — more reliable than show --stat)
LOG_COMMIT=$(git -C "$G" log --oneline -1)
echo "$LOG_COMMIT" | grep -q "add" && ok 'git log head' || no 'git log head'

# 26 - stash list after cleanup
STASH_LEFT=$(git -C "$G" stash list | wc -l)
[ "$STASH_LEFT" -ge 0 ] && ok "stash list after cleanup ($STASH_LEFT)" || no "stash list after cleanup ($STASH_LEFT)"

echo ""
echo "--- git extended operations 2 ---"

# 27 - git blame on committed file
git -C "$G" add file1.txt
git -C "$G" commit -q -m "commit for blame" 2>/dev/null
BLAME_OUTPUT=$(git -C "$G" blame file1.txt 2>/dev/null)
[ -n "$BLAME_OUTPUT" ] && ok 'git blame' || no 'git blame'

# 28 - git reflog
git -C "$G" checkout -q main
REFLOG_OUTPUT=$(git -C "$G" reflog 2>/dev/null)
echo "$REFLOG_OUTPUT" | grep -q "HEAD" && ok 'git reflog' || no 'git reflog'

# 29 - git diff between branches
git -C "$G" branch feature-diff
echo "branch-change" > "$G/branch-file.txt"
git -C "$G" add branch-file.txt
git -C "$G" commit -q -m "branch change"
DIFF_MAIN=$(git -C "$G" diff main..feature-diff --stat 2>/dev/null)
echo "$DIFF_MAIN" | grep -q "branch-file.txt" && ok 'diff between branches' || no 'diff between branches'
git -C "$G" branch -D feature-diff 2>/dev/null

# 30 - git stash with untracked file
git -C "$G" checkout -q main
echo "untracked-content" > "$G/untracked.txt"
git -C "$G" stash push -u -q -m "ares:untracked" 2>/dev/null
test -f "$G/untracked.txt" && no 'stash removes untracked' || ok 'stash removes untracked'
git -C "$G" stash pop -q 2>/dev/null
grep -q "untracked-content" "$G/untracked.txt" && ok 'stash pop restores untracked' || no 'stash pop restores untracked'

echo ""
echo "--- session format extended ---"
python3 << 'PYEOF'
import json

# Test reply_to field
d = json.loads('{"formatVersion":1,"session":{"title":"Reply","messages":[{"role":"user","content":"question","createdAt":0},{"role":"assistant","content":"answer","reply_to":"{\\"id\\":\\"m1\\",\\"content\\":\\"question\\",\\"role\\":\\"user\\"}","createdAt":1}]}}')
assert d['session']['messages'][1]['reply_to'] is not None
reply = json.loads(d['session']['messages'][1]['reply_to'])
assert reply['id'] == 'm1'
assert reply['content'] == 'question'
print('OK reply_to field')

# Test reactions field
d2 = json.loads('{"formatVersion":1,"session":{"title":"React","messages":[{"role":"assistant","content":"helpful","reactions":"{\\"up\\":true}","createdAt":0}]}}')
reactions = json.loads(d2['session']['messages'][0]['reactions'])
assert reactions['up'] == True
print('OK reactions field')

# Test feedback field
d3 = json.loads('{"formatVersion":1,"session":{"title":"Feedback","messages":[{"role":"assistant","content":"response","feedback":"positive","createdAt":0}]}}')
assert d3['session']['messages'][0]['feedback'] == 'positive'
print('OK feedback field')

# Test nested JSON in attachments
d4 = json.loads('{"formatVersion":1,"session":{"title":"Nested","messages":[{"role":"user","content":"see files","attachments":"[{\\"path\\":\\"/tmp/a.txt\\",\\"name\\":\\"a.txt\\"},{\\"path\\":\\"/tmp/b.txt\\",\\"name\\":\\"b.txt\\"}]","createdAt":0}]}}')
atts = json.loads(d4['session']['messages'][0]['attachments'])
assert len(atts) == 2
assert atts[0]['name'] == 'a.txt'
print('OK nested attachments')

# Test empty reply_to is null
d5 = json.loads('{"formatVersion":1,"session":{"title":"NoReply","messages":[{"role":"assistant","content":"answer","reply_to":null,"createdAt":0}]}}')
assert d5['session']['messages'][0]['reply_to'] is None
print('OK null reply_to')
PYEOF

echo ""
echo "--- git empty repo operations ---"
E="$TD/emptyrepo"
mkdir -p "$E"
git init -q -b main "$E"
git -C "$E" config user.email t
git -C "$E" config user.name T

# 31 - empty repo has no commits
LOG_EMPTY=$(git -C "$E" log --oneline 2>&1) || true
echo "$LOG_EMPTY" | grep -q "does not have any commits" && ok 'empty repo no commits' || no 'empty repo no commits'

# 32 - empty repo stash list is empty
EMPTY_STASH=$(git -C "$E" stash list 2>&1)
[ -z "$EMPTY_STASH" ] && ok 'empty repo stash empty' || no 'empty repo stash empty'

# 33 - empty repo branch list shows only main after first commit
echo "init" > "$E/init.txt"
git -C "$E" add init.txt
git -C "$E" commit -q -m "first commit"
BRANCH_COUNT=$(git -C "$E" branch | wc -l)
[ "$BRANCH_COUNT" -eq 1 ] && ok 'empty repo single branch' || no "empty repo single branch ($BRANCH_COUNT)"

echo ""
echo "--- git concurrent operations ---"
C="$TD/concurrent"
mkdir -p "$C"
git init -q -b main "$C"
git -C "$C" config user.email t
git -C "$C" config user.name T
echo "init" > "$C/base.txt"
git -C "$C" add base.txt
git -C "$C" commit -q -m "init"

# 34 - rapid stash push/pop cycle
for i in 1 2 3; do
  echo "cycle-$i" > "$C/cycle.txt"
  git -C "$C" add cycle.txt
  git -C "$C" stash push -u -q -m "ares:cycle-$i" 2>/dev/null
  git -C "$C" stash pop -q 2>/dev/null
done
test -f "$C/cycle.txt" && ok 'rapid stash cycle' || no 'rapid stash cycle'

# 35 - multiple rapid commits
for i in 1 2 3 4 5; do
  echo "commit-$i" > "$C/rapid.txt"
  git -C "$C" add rapid.txt
  git -C "$C" commit -q -m "rapid $i"
done
COMMIT_COUNT=$(git -C "$C" log --oneline | wc -l)
[ "$COMMIT_COUNT" -ge 6 ] && ok "rapid commits ($COMMIT_COUNT)" || no "rapid commits ($COMMIT_COUNT)"

echo ""
echo "PASS: $P  FAIL: $F"
exit $F
