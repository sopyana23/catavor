with open(r"c:\MyProject\DFauna\frontend-desktop\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if "history" in line or "pushState" in line or "replaceState" in line or "setAdminTab" in line or "popstate" in line:
        print(f"L{idx+1}: {line.strip()}")
