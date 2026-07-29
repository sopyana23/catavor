import sys
sys.stdout.reconfigure(encoding='utf-8')

print("=== MOBILE ===")
with open(r"c:\MyProject\DFauna\frontend-mobile\src\App.tsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        if ("policy" in line.lower() or "policies" in line.lower() or "quickpolicy" in line.lower()) and ("style=" in line or "background" in line or "color" in line):
            print(f"Mobile L{idx+1}: {line.strip()}")

print("\n=== DESKTOP ===")
with open(r"c:\MyProject\DFauna\frontend-desktop\src\App.tsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        if ("policy" in line.lower() or "policies" in line.lower()) and ("style=" in line or "background" in line or "color" in line):
            print(f"Desktop L{idx+1}: {line.strip()}")
