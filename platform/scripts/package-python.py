from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys, json
root = Path(__file__).resolve().parents[1]
(root/'public/python').mkdir(parents=True, exist_ok=True)
with ZipFile(root/'public/python/concord.zip', 'w', ZIP_DEFLATED) as archive:
    for file in (root/'backend/concord').rglob('*.py'):
        if 'api' not in file.relative_to(root/'backend/concord').parts and file.name not in {'bookstack.py', 'qdrant.py', 'gemini.py', 'sqlite_store.py', 'langgraph_workflow.py'}:
            archive.write(file, file.relative_to(root/'backend'))
sys.path.insert(0,str(root/'backend'))
from concord.demo import build_demo
(root/'lib/concord/baseline.json').write_text(json.dumps(build_demo().snapshot(),indent=2))

# Keep the downloadable developer package aligned with the authoritative source.
(root/'public/downloads').mkdir(parents=True, exist_ok=True)
with ZipFile(root/'public/downloads/concord-python-source.zip', 'w', ZIP_DEFLATED) as archive:
    for file in sorted((root/'backend').rglob('*')):
        if not file.is_file() or '__pycache__' in file.parts:
            continue
        relative = file.relative_to(root/'backend')
        if relative.parts[0] in {'concord', 'tests'} and file.suffix == '.py':
            archive.write(file, relative)
        elif str(relative) in {'README.md', 'pyproject.toml', '.env.example'}:
            archive.write(file, relative)
