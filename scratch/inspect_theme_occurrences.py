import sys
sys.stdout.reconfigure(encoding='utf-8')

print("=== MOBILE store_theme occurrences ===")
with open(r"c:\MyProject\DFauna\frontend-mobile\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "store_theme" in line:
            print(f"Mobile L{idx+1}: {line.strip()}")

print("\n=== DESKTOP store_theme occurrences ===")
with open(r"c:\MyProject\DFauna\frontend-desktop\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "store_theme" in line:
            print(f"Desktop L{idx+1}: {line.strip()}")
