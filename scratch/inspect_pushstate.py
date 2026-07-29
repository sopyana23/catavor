print("=== MOBILE PUSHSTATE ===")
with open(r"c:\MyProject\DFauna\frontend-mobile\src\App.tsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        if "pushState" in line or "replaceState" in line or "goTo" in line:
            print(f"L{idx+1}: {line.strip()}")

print("\n=== DESKTOP PUSHSTATE ===")
with open(r"c:\MyProject\DFauna\frontend-desktop\src\App.tsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        if "pushState" in line or "replaceState" in line or "goTo" in line:
            print(f"L{idx+1}: {line.strip()}")
