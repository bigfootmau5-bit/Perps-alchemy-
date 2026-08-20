#!/bin/bash
# Pre-push hook: quick syntax validation
echo "Running pre-push syntax check..."

# Extract ALL script blocks and check every single one
python3 << 'PYEOF'
import re, subprocess, tempfile, os, sys

with open('index.html') as f:
    content = f.read()

blocks = []
pos = 0
while True:
    start = content.find('<script>', pos)
    if start == -1:
        start = content.find('<script ', pos)
        if start == -1:
            break
        tag_end = content.find('>', start)
        if tag_end == -1:
            break
        block_start = tag_end + 1
    else:
        block_start = start + len('<script>')
    
    end = content.find('</script>', block_start)
    if end == -1:
        break
    
    block = content[block_start:end].strip()
    if block and not block.startswith('import'):
        blocks.append((block, content[:start].count('\n') + 1))
    
    pos = end + len('</script>')

errors = 0
checked = 0
for i, (block, line_num) in enumerate(blocks):
    checked += 1
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
        f.write(block)
        f.flush()
        result = subprocess.run(['node', '--check', f.name], capture_output=True, text=True)
        if result.returncode != 0:
            errors += 1
            print(f'  ❌ Block {i} (line ~{line_num}): {result.stderr.strip()[:200]}')
        os.unlink(f.name)

if errors > 0:
    print(f'❌ {errors} syntax error(s) found in {checked} checked blocks. Push blocked.')
    sys.exit(1)
else:
    print(f'✅ All {checked} script blocks pass. Pushing...')
PYEOF
