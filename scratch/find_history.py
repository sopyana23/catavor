with open(r"c:\MyProject\DFauna\frontend-mobile\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if "history" in line or "pushState" in line or "replaceState" in line or "setAdminSubTab" in line:
        print(f"L{idx+1}: {line.strip()}")
