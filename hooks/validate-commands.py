#!/usr/bin/env python3
"""
Command validation hook for Claude Code
Validates bash commands before execution for security
"""

import sys
import json

def main():
    """Validate bash commands - currently allows all commands"""
    # Read command from stdin
    if not sys.stdin.isatty():
        try:
            data = json.load(sys.stdin)
            # Add validation logic here if needed
            # For now, allow all commands
        except json.JSONDecodeError:
            pass

    # Exit successfully (0 = allow, non-zero = block)
    sys.exit(0)

if __name__ == "__main__":
    main()
