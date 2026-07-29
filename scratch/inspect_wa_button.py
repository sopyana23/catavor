import sys
sys.stdout.reconfigure(encoding='utf-8')

print("=== MOBILE WHATSAPP BUTTON ===")
with open(r"c:\MyProject\DFauna\frontend-mobile\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "whatsapp" in line.lower() or "chat whatsapp" in line.lower():
            print(f"Mobile L{idx+1}: {line.strip()}")
            for j in range(max(0, idx-5), min(idx+15, len(lines))):
                print(f"  L{j+1}: {lines[j].strip()}")
            print("-" * 50)

print("\n=== DESKTOP WHATSAPP BUTTON ===")
with open(r"c:\MyProject\DFauna\frontend-desktop\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "whatsapp" in line.lower() or "chat whatsapp" in line.lower():
            print(f"Desktop L{idx+1}: {line.strip()}")
            for j in range(max(0, idx-5), min(idx+15, len(lines))):
                print(f"  L{j+1}: {lines[j].strip()}")
            print("-" * 50)
