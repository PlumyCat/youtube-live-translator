#!/usr/bin/env python3
"""
Hook de formatage automatique pour Claude Code.
Formate automatiquement les fichiers après édition.
"""
import json
import sys
import os
import subprocess
from pathlib import Path

def run_command(cmd: list, cwd: str = None) -> bool:
    """Exécute une commande et retourne True si succès."""
    try:
        result = subprocess.run(
            cmd, 
            cwd=cwd, 
            capture_output=True, 
            text=True, 
            timeout=30
        )
        if result.returncode != 0:
            print(f"⚠️  Warning: {' '.join(cmd)} failed: {result.stderr}", file=sys.stderr)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False

def format_python_file(file_path: str) -> None:
    """Formate un fichier Python avec ruff."""
    print(f"🐍 Formatting Python file: {file_path}")
    
    # Ruff format (remplace Black)
    if run_command(["ruff", "format", file_path]):
        print(f"✅ Formatted with ruff: {file_path}")
    
    # Ruff check avec auto-fix
    if run_command(["ruff", "check", "--fix", file_path]):
        print(f"✅ Fixed imports with ruff: {file_path}")

def format_typescript_file(file_path: str) -> None:
    """Formate un fichier TypeScript/JavaScript."""
    print(f"🟦 Formatting TS/JS file: {file_path}")
    
    # Prettier
    if run_command(["prettier", "--write", file_path]):
        print(f"✅ Formatted with prettier: {file_path}")
    
    # ESLint avec auto-fix
    if run_command(["eslint", "--fix", file_path]):
        print(f"✅ Fixed with ESLint: {file_path}")

def format_json_file(file_path: str) -> None:
    """Formate un fichier JSON."""
    print(f"📄 Formatting JSON file: {file_path}")
    
    if run_command(["prettier", "--write", file_path]):
        print(f"✅ Formatted JSON: {file_path}")

def format_markdown_file(file_path: str) -> None:
    """Formate un fichier Markdown."""
    print(f"📝 Formatting Markdown file: {file_path}")
    
    if run_command(["prettier", "--write", file_path]):
        print(f"✅ Formatted Markdown: {file_path}")

def main():
    """Point d'entrée principal du hook."""
    try:
        # Lire les données JSON depuis stdin
        input_data = json.load(sys.stdin)
        
        # Extraire le chemin du fichier
        tool_input = input_data.get('tool_input', {})
        file_path = tool_input.get('file_path', '')
        
        if not file_path or not os.path.exists(file_path):
            sys.exit(0)
        
        # Obtenir l'extension du fichier
        file_ext = Path(file_path).suffix.lower()
        
        # Formater selon le type de fichier
        if file_ext == '.py':
            format_python_file(file_path)
        elif file_ext in ['.ts', '.tsx', '.js', '.jsx']:
            format_typescript_file(file_path)
        elif file_ext == '.json':
            format_json_file(file_path)
        elif file_ext in ['.md', '.mdx']:
            format_markdown_file(file_path)
        else:
            # Type de fichier non supporté
            pass
        
        sys.exit(0)
        
    except json.JSONDecodeError:
        print("❌ ERROR: Invalid JSON input", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"❌ ERROR: Formatting hook failed: {e}", file=sys.stderr)
        sys.exit(0)  # Ne pas bloquer l'exécution en cas d'erreur de formatage

if __name__ == "__main__":
    main()