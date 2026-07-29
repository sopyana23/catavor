import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\MyProject\DFauna\frontend-desktop\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "jam operasional" in line.lower() or "lokasi galeri" in line.lower():
            print(f"Desktop L{idx+1}: {line.strip()}")
            for j in range(max(0, idx-5), min(idx+25, len(lines))):
                print(f"  L{j+1}: {lines[j].strip()}")
            print("=" * 60)
