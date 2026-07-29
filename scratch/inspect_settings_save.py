import sys
sys.stdout.reconfigure(encoding='utf-8')

print("=== MOBILE handleSettingsSave ===")
with open(r"c:\MyProject\DFauna\frontend-mobile\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "handlesettingssave" in line.lower() and "const" in line.lower():
            print(f"Mobile L{idx+1}: {line.strip()}")
            for j in range(idx, min(idx + 40, len(lines))):
                print(f"  L{j+1}: {lines[j].strip()}")

print("\n=== DESKTOP handleSettingsSave ===")
with open(r"c:\MyProject\DFauna\frontend-desktop\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "handlesettingssave" in line.lower() and "const" in line.lower():
            print(f"Desktop L{idx+1}: {line.strip()}")
            for j in range(idx, min(idx + 40, len(lines))):
                print(f"  L{j+1}: {lines[j].strip()}")
