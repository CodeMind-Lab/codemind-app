#!/usr/bin/env python3
"""Prepara dist/ per una pubblicazione: aggiorna la cache del service worker.

Il service worker tiene in cache l'app per farla aprire anche senza rete. L'elenco
dei file prima si scriveva a mano e ogni file nuovo dimenticato restava fuori dalla
modalità offline: ora lo genera questo script leggendo dist/.

Uso:  python3 strumenti/prepara-pubblicazione.py 71
Il numero è la versione: va alzato a ogni pubblicazione, altrimenti i telefoni
continuano a usare i file vecchi.
"""
import json
import re
import sys
from pathlib import Path

if len(sys.argv) != 2 or not sys.argv[1].isdigit():
    sys.exit("Uso: python3 strumenti/prepara-pubblicazione.py <numero versione>")
versione = sys.argv[1]
dist = Path(__file__).resolve().parent.parent / "dist"
esclusi = {"js/config.js", "service-worker.js", "js/config.example.js"}
file = sorted(
    p.relative_to(dist).as_posix()
    for p in dist.rglob("*")
    if p.is_file() and not p.name.startswith(".") and p.relative_to(dist).as_posix() not in esclusi
)
elenco = ["./"] + ["./" + f for f in file]
sw = dist / "service-worker.js"
testo = sw.read_text()
testo = re.sub(r'const CACHE = "codemind-shell-v\d+";', f'const CACHE = "codemind-shell-v{versione}";', testo)
testo = re.sub(r"const ASSETS = \[.*?\];", "const ASSETS = " + json.dumps(elenco, indent=1) + ";", testo, count=1, flags=re.S)
sw.write_text(testo)
dimensione = sum((dist / f).stat().st_size for f in file) / 1_000_000
print(f"service worker v{versione}: {len(elenco)} file in cache, {dimensione:.1f} MB")
