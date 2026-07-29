import sys
sys.stdout.reconfigure(encoding='utf-8')

print("=== MOBILE ===")
with open(r"c:\MyProject\DFauna\frontend-mobile\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "chat whatsapp" in line.lower() or "whatsapp" in line.lower():
            if "style=" in line or "background" in line or "padding:" in line:
                print(f"Mobile L{idx+1}: {line.strip()}")

print("\n=== DESKTOP ===")
with open(r"c:\MyProject\DFauna\frontend-desktop\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "chat whatsapp" in line.lower() or "whatsapp" in line.lower():
            if "style=" in line or "background" in line or "padding:" in line:
                print(f"Desktop L{idx+1}: {line.strip()}")
