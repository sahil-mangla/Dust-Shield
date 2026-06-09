import os
import json

REQUIRED_FILES = [
    "PAPER_REFERENCES.bib",
    "RESEARCH_ANALYSIS.md",
    "RESEARCH_TOPICS.json",
    "SELECTED_TOPIC.json",
    "EVALUATION_PLAN.json",
    "TECH_STACK.json",
    "DESIGN_SYSTEM.md",
    "CSS_TOKENS.css",
    "ROADMAP.json",
    "CHECKLISTS.json",
    "A11Y_REPORT.json",
    "PERFORMANCE_REPORT.json",
    "QA_REPORT.json",
    "PROJECT_BRIEF.md"
]

def verify_all():
    print("=== STARTING DUSTSHIELD WORKFLOW FILE VERIFICATION ===")
    failed = False
    
    for filename in REQUIRED_FILES:
        filepath = os.path.join(".", filename)
        if not os.path.exists(filepath):
            print(f"❌ Missing file: {filename}")
            failed = True
            continue
            
        size = os.path.getsize(filepath)
        if size == 0:
            print(f"❌ Empty file: {filename}")
            failed = True
            continue
            
        if filename.endswith(".json"):
            try:
                with open(filepath, "r") as f:
                    json.load(f)
                print(f"✅ JSON Verified: {filename} ({size} bytes)")
            except Exception as e:
                print(f"❌ Invalid JSON format in {filename}: {str(e)}")
                failed = True
        else:
            print(f"✅ Text/Doc Verified: {filename} ({size} bytes)")
            
    print("====================================================")
    if failed:
        print("❌ Verification FAILED: Some files are missing or malformed.")
        exit(1)
    else:
        print("🎉 Verification SUCCESSFUL: All workflow files are present and valid!")
        exit(0)

if __name__ == "__main__":
    verify_all()
