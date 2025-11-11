#!/usr/bin/env python3
"""
Hook de validation des commandes pour Claude Code.
Bloque les commandes dangereuses en mode YOLO.
"""
import json
import sys
import re
from typing import List, Pattern

# Patterns de commandes dangereuses à bloquer
FORBIDDEN_PATTERNS: List[Pattern] = [
    re.compile(r'\brm\s+-rf\b'),                    # rm -rf
    re.compile(r'\bsudo\s+rm\b'),                   # sudo rm
    re.compile(r'\bchmod\s+777\b'),                 # chmod 777
    re.compile(r'\bchown\s+.*root\b'),              # chown root
    re.compile(r':\s*>\s*/'),                       # : > /path (truncate)
    re.compile(r'dd\s+if=.*of=/dev/'),              # dd to device
    re.compile(r'mkfs\.'),                          # format filesystem
    re.compile(r'\bcurl.*\|\s*(bash|sh)\b'),        # curl | bash
    re.compile(r'\bwget.*\|\s*(bash|sh)\b'),        # wget | bash
    re.compile(r'>\s*/etc/'),                       # write to /etc/
    re.compile(r'shutdown|halt|reboot'),            # system shutdown
    re.compile(r'\bfork\(\)'),                      # fork bombs
    re.compile(r':.*:.*::'),                        # fork bomb pattern
    re.compile(r'cat\s+/dev/urandom'),              # random data
    re.compile(r'yes\s*\|'),                        # yes spam
]

# Chemins sensibles à protéger
SENSITIVE_PATHS: List[Pattern] = [
    re.compile(r'\.env'),
    re.compile(r'secrets/'),
    re.compile(r'credentials'),
    re.compile(r'\.ssh/'),
    re.compile(r'\.aws/'),
    re.compile(r'/etc/passwd'),
    re.compile(r'/etc/shadow'),
]

def validate_command(command: str, description: str = "") -> bool:
    """
    Valide si une commande est sûre à exécuter.
    
    Returns:
        True si la commande est sûre, False sinon
    """
    command_lower = command.lower()
    
    # Vérifier les patterns dangereux
    for pattern in FORBIDDEN_PATTERNS:
        if pattern.search(command_lower):
            print(f"❌ BLOCKED: Dangerous pattern detected: {pattern.pattern}", file=sys.stderr)
            print(f"Command: {command}", file=sys.stderr)
            return False
    
    # Vérifier les chemins sensibles
    for pattern in SENSITIVE_PATHS:
        if pattern.search(command):
            print(f"❌ BLOCKED: Sensitive path detected: {pattern.pattern}", file=sys.stderr)
            print(f"Command: {command}", file=sys.stderr)
            return False
    
    # Commandes potentiellement dangereuses nécessitant confirmation
    warning_patterns = [
        re.compile(r'\brm\s+.*\*'),                 # rm with wildcards
        re.compile(r'\bmv\s+.*\*.*\s+/'),          # mv with wildcards to root
        re.compile(r'\bcp\s+.*\*.*\s+/'),          # cp with wildcards to root
    ]
    
    for pattern in warning_patterns:
        if pattern.search(command_lower):
            print(f"⚠️  WARNING: Potentially dangerous command: {command}", file=sys.stderr)
            # Ne bloque pas, mais avertit
            break
    
    return True

def main():
    """Point d'entrée principal du hook."""
    try:
        # Lire les données JSON depuis stdin
        input_data = json.load(sys.stdin)
        
        # Extraire la commande
        tool_input = input_data.get('tool_input', {})
        command = tool_input.get('command', '')
        description = tool_input.get('description', '')
        
        if not command:
            # Pas de commande à valider
            sys.exit(0)
        
        # Valider la commande
        if validate_command(command, description):
            # Commande sûre
            sys.exit(0)
        else:
            # Commande bloquée
            sys.exit(2)  # Code 2 = bloquer l'exécution
            
    except json.JSONDecodeError:
        print("❌ ERROR: Invalid JSON input", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"❌ ERROR: Hook validation failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()