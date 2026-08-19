import subprocess
import sys
import time
import os

def run_step(title, cmd):
    print(f"\n=====================================================")
    print(f"▶️ RUNNING: {title}")
    print(f"=====================================================")
    start = time.time()
    result = subprocess.run(cmd, shell=True)
    duration = round(time.time() - start, 2)
    if result.returncode == 0:
        print(f"✅ {title} PASSED ({duration}s)")
        return True
    else:
        print(f"❌ {title} FAILED with exit code {result.returncode} ({duration}s)")
        return False

def main():
    print("==================================================================")
    print("🏆 JRIDE MASTER AUTONOMOUS E2E / QA / SECURITY AUDIT RUNNER")
    print("==================================================================")
    
    total_start = time.time()
    results = []
    
    # 1. Deep Ride Cycle & State Machine (Backend Core)
    results.append(("Deep Ride Lifecycle & State Machine", run_step("Deep Ride Lifecycle & State Machine", "python backend/test_ride_cycle_deep.py")))
    
    # 2. Defensive Security & Role Authorization Audit
    results.append(("Defensive Security & Authorization Audit", run_step("Defensive Security & Authorization Audit", "python backend/qa_suite/security_authorization_audit.py")))
    
    # 3. Responsive 8-Viewport Matrix
    results.append(("Responsive 8-Viewport Device Matrix", run_step("Responsive 8-Viewport Device Matrix", "python backend/qa_suite/responsive_device_matrix.py")))
    
    # 4. Accountant & Admin Governance Suite
    results.append(("Accountant & Admin Governance E2E", run_step("Accountant & Admin Governance E2E", "python backend/qa_suite/e2e_accountant_admin_flow.py")))
    
    # 5. Student & Driver Full Ride Lifecycle E2E
    results.append(("Student & Driver Full Lifecycle E2E", run_step("Student & Driver Full Lifecycle E2E", "python backend/qa_suite/e2e_student_driver_flow.py")))
    
    total_duration = round(time.time() - total_start, 2)
    
    print("\n==================================================================")
    print("📊 MASTER AUDIT SUMMARY REPORT")
    print("==================================================================")
    all_passed = True
    for name, status in results:
        badge = "✅ PASSED" if status else "❌ FAILED"
        print(f"• {name:<45} : {badge}")
        if not status:
            all_passed = False
            
    print(f"\nTotal Audit Duration: {total_duration}s")
    if all_passed:
        print("🏆 VERDICT: ALL MASTER E2E, SECURITY, RESPONSIVE & RIDE ENGINES PASSED!")
        sys.exit(0)
    else:
        print("⚠️ VERDICT: AUDIT ENCOUNTERED FAILURES - PLEASE REVIEW LOGS")
        sys.exit(1)

if __name__ == "__main__":
    main()
