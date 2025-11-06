#!/usr/bin/env node

/**
 * Pre-tool Hook : Validation Commandes Dangereuses
 *
 * Bloque les commandes potentiellement dangereuses avant exécution.
 */

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,              // rm -rf / (destructif)
  /sudo\s+rm/,                   // sudo rm (risqué)
  /dd\s+if=/,                    // dd (écrasement disque)
  /mkfs/,                        // mkfs (format disque)
  /:(){ :|:& };:/,               // fork bomb
  /curl.*\|\s*bash/,             // pipe vers bash (risque exécution)
  /wget.*-O.*\|\s*sh/,           // wget pipe sh
  />.*\/dev\/(sd|hd|nvme)/,     // écriture vers device
  /chmod\s+777.*\/$/,            // chmod 777 récursif root
];

const ALLOWED_DANGEROUS_COMMANDS = [
  'npm install',                  // OK
  'npm ci',                       // OK
  'rm -rf node_modules',          // OK (courant)
  'rm -rf dist',                  // OK (build folder)
  'rm -rf release',               // OK (release folder)
  'rm -rf coverage',              // OK (coverage folder)
];

function main() {
  // Lire stdin (command from Claude Code)
  const stdin = process.stdin;
  let data = '';

  stdin.on('data', chunk => {
    data += chunk;
  });

  stdin.on('end', () => {
    try {
      const input = JSON.parse(data);
      const command = input.command || '';

      // Vérifier si commande whitelistée
      const isAllowed = ALLOWED_DANGEROUS_COMMANDS.some(allowed =>
        command.trim().startsWith(allowed)
      );

      if (isAllowed) {
        process.exit(0); // Autoriser
      }

      // Vérifier patterns dangereux
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) {
          console.error(`❌ BLOCKED: Dangerous command detected`);
          console.error(`Command: ${command}`);
          console.error(`Pattern: ${pattern}`);
          process.exit(1); // Bloquer
        }
      }

      // Commande sûre
      process.exit(0);
    } catch (error) {
      console.error('Error parsing input:', error);
      process.exit(1);
    }
  });
}

main();
