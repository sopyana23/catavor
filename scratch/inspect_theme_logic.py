import sys
sys.stdout.reconfigure(encoding='utf-8')

print("=== MOBILE THEME CODE ===")
with open(r"c:\MyProject\DFauna\frontend-mobile\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "data-theme" in line or "store_theme" in line or "applytheme" in line.lower():
            print(f"Mobile L{idx+1}: {line.strip()}")

print("\n=== DESKTOP THEME CODE ===")
with open(r"c:\MyProject\DFauna\frontend-desktop\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "data-theme" in line or "store_theme" in line or "applytheme" in line.lower():
            print(f"Desktop L{idx+1}: {line.strip()}")
