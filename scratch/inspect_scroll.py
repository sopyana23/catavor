print("=== MOBILE SCROLL ===")
with open(r"c:\MyProject\DFauna\frontend-mobile\src\App.tsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        if "scrollTo" in line or "scrollTop" in line:
            print(f"L{idx+1}: {line.strip()}")

print("\n=== DESKTOP SCROLL ===")
with open(r"c:\MyProject\DFauna\frontend-desktop/src/App.tsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        if "scrollTo" in line or "scrollTop" in line:
            print(f"L{idx+1}: {line.strip()}")
