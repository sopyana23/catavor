import sys
sys.stdout.reconfigure(encoding='utf-8')

print("=== MOBILE ABOUT TAB ===")
with open(r"c:\MyProject\DFauna\frontend-mobile\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "activeTab === 'about'" in line or "activetab === 'about'" in line:
            print(f"Mobile L{idx+1}: {line.strip()}")
            for j in range(idx, min(idx + 150, len(lines))):
                print(f"  L{j+1}: {lines[j].strip()}")

print("\n=== DESKTOP ABOUT TAB ===")
with open(r"c:\MyProject\DFauna\frontend-desktop\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "activeTab === 'about'" in line or "activetab === 'about'" in line:
            print(f"Desktop L{idx+1}: {line.strip()}")
            for j in range(idx, min(idx + 150, len(lines))):
                print(f"  L{j+1}: {lines[j].strip()}")
