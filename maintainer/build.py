from pathlib import Path
import shutil
import subprocess

root = Path(__file__).parent
node = shutil.which("node")
if node is None:
    raise SystemExit("Node.js is required to build the standalone offline GraphQL.js runtime.")
subprocess.run([node, str(root / "build.cjs")], cwd=root, check=True)
