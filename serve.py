import http.server
import socketserver
import os
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.js') or path.endswith('.mjs'):
            return 'text/javascript'
        return super().guess_type(path)

os.chdir(os.path.dirname(os.path.abspath(__file__)))

def find_free_port(start=8000, tries=20):
    for port in range(start, start + tries):
        try:
            with socketserver.TCPServer(("", port), NoCacheHandler) as test:
                return port
        except OSError:
            continue
    return None

port = find_free_port()
if port is None:
    print("No se encontró un puerto libre. Cierra otros procesos y reintenta.")
    sys.exit(1)

with socketserver.TCPServer(("", port), NoCacheHandler) as httpd:
    httpd.allow_reuse_address = True
    print(f"Sirviendo en http://localhost:{port}  (sin cache)")
    print("Presioná Ctrl+C para detener el servidor.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        httpd.shutdown()