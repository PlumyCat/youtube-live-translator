#!/usr/bin/env python3
"""
Notification hook for Claude Code
Triggered on specific events to provide user feedback
"""

import sys
import json

def main():
    """Simple notification hook - currently a no-op"""
    # Read input from stdin if provided
    if not sys.stdin.isatty():
        try:
            data = json.load(sys.stdin)
            # Process notification data here if needed
            # For now, just exit successfully
        except json.JSONDecodeError:
            pass

    # Exit successfully
    sys.exit(0)

if __name__ == "__main__":
    main()
