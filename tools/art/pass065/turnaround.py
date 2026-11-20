"""Pass 065: neutral before/after turnarounds of the hero fish (rows: shipped, Pass 065).

    python3 tools/art/pass065/turnaround.py [output-dir]

Reuses the Pass 062 turnaround renderer (Cycles, grey background, one key light, four azimuths).
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools/art/pass062'))
import turnaround as t  # noqa: E402

if len(sys.argv) > 1:
    t.OUT = Path(sys.argv[1])
else:
    t.OUT = ROOT / 'docs/screenshots/v07-pass065'
t.TMP = HERE / 'out/turnaround'
t.TREATMENTS = ('baseline', 'natural')
t.LABELS = {'baseline': 'Before (shipped)', 'natural': 'Pass 065 hero'}
t.SOURCES = {
    'before-chromis': ('glb', ROOT / 'tools/art/pass017/accepted/chromis.glb'),
    'before-clownfish': ('glb', ROOT / 'tools/art/pass017/accepted/clownfish.glb'),
    'before-gramma': ('blend', ROOT / 'tools/art/pass016/gramma.blend'),
    'chromis': ('glb', HERE / 'out/chromis.glb'),
    'clownfish': ('glb', HERE / 'out/clownfish.glb'),
    'gramma': ('glb', HERE / 'out/gramma.glb'),
}
t.SUBJECTS = {k: {'baseline': (f'before-{k}', None), 'natural': (k, None)} for k in ('chromis', 'clownfish', 'gramma')}
t.main()
