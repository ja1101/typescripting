#!/usr/bin/env python3
"""
run.py — Build and run src/index.ts (cross-platform)

Usage: python run.py
"""

import subprocess
import sys


def main():
    try:
        print("[1/3] Installing dependencies...")
        subprocess.run(["npm", "install"], check=True, shell=True)

        print("[2/3] Compiling TypeScript...")
        subprocess.run(["npm", "run", "build"], check=True, shell=True)

        print("[3/3] Running the application...")
        subprocess.run(["npm", "start", "ja1101"], check=True, shell=True)

    except subprocess.CalledProcessError as e:
        error_messages = {
            "install": "npm install failed.",
            "build": "TypeScript compilation failed.",
            "start": "Application exited with code {code}.",
        }
        cmd = e.cmd[1] if len(e.cmd) > 1 else e.cmd[0]
        if cmd == "install":
            print(f"ERROR: {error_messages['install']}")
        elif cmd == "run":
            print(f"ERROR: {error_messages['build']}")
        elif cmd == "start":
            print(f"ERROR: {error_messages['start'].format(code=e.returncode)}")
        else:
            print(f"ERROR: Command failed with code {e.returncode}.")
        sys.exit(e.returncode)


if __name__ == "__main__":
    main()
