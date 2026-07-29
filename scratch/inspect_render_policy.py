import sys
sys.stdout.reconfigure(encoding='utf-8')

print("=== MOBILE renderFormattedPolicyContent ===")
with open(r"c:\MyProject\DFauna\frontend-mobile\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "renderFormattedPolicyContent" in line and "const" in line:
            for j in range(idx, min(idx + 50, len(lines))):
                print(f"L{j+1}: {lines[j].strip()}")

print("\n=== DESKTOP renderFormattedPolicyContent ===")
with open(r"c:\MyProject\DFauna\frontend-desktop\src\App.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for idx, line in enumerate(lines):
        if "renderFormattedPolicyContent" in line and "const" in line:
            for j in range(idx, min(idx + 50, len(lines))):
                print(f"L{j+1}: {lines[j].strip()}")
