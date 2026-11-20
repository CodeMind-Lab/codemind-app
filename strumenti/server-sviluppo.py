#!/usr/bin/env python3
"""Server locale per provare l'app mentre la si modifica.

È lo stesso http.server di Python, ma dice al browser di non tenere copie dei file:
senza questo, dopo una modifica il browser continua a usare i moduli JavaScript
vecchi e sembra che la modifica non abbia funzionato.

Uso (dalla cartella del progetto):  python3 strumenti/server-sviluppo.py 4174
Poi apri http://localhost:4174/dist/
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class SenzaCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


porta = int(sys.argv[1]) if len(sys.argv) > 1 else 4174
radice = Path(__file__).resolve().parent.parent
ThreadingHTTPServer(("127.0.0.1", porta), partial(SenzaCache, directory=str(radice))).serve_forever()
