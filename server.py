"""Read-only CV research replay. Python 3.9+, standard library only."""
import argparse
import json
import mimetypes
import os
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

HERE = Path(__file__).resolve().parent
FRAMES = ('plain', 'warning_plain', 'json', 'warning_json')


class LocalServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        if os.name == 'nt':
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


class Handler(BaseHTTPRequestHandler):
    bundle = None

    def log_message(self, *args):
        pass

    def send(self, status, body, kind='application/json; charset=utf-8'):
        payload = bytes(body) if isinstance(body, (bytes, bytearray)) else json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        host = self.headers.get('Host', '').split(':')[0].lower()
        if host not in ('127.0.0.1', 'localhost'):
            return self.send(403, {'error': 'Loopback host required'})
        url = urlsplit(self.path)
        q = {k: values[0] for k, values in parse_qs(url.query).items()}
        data = self.bundle
        try:
            if url.path == '/api/health':
                return self.send(200, {'ok': True, 'mode': 'cv-offline-replay', 'new_model_calls': 0, 'external_actions': 0})
            if url.path == '/api/studies':
                return self.send(200, {'models': data['models'], 'cv': data['cv']['stats'], 'limits': data['limits'], 'provenance': data['provenance']})
            if url.path == '/api/catalog':
                return self.send(200, {'models': data['models'], 'cv_records': [{'id': k, 'stratum': v['stratum']} for k, v in data['cv']['records'].items()], 'conditions': list(data['cv']['notes']), 'frames': FRAMES})
            if url.path == '/api/cv/replay':
                rid = q.get('record', 'H01')
                model = q.get('model', data['models'][0])
                frame = q.get('frame', 'plain')
                condition = q.get('condition', 'clean')
                record = data['cv']['records'][rid]
                note = data['cv']['notes'][condition]
                if model not in data['models'] or frame not in FRAMES:
                    raise KeyError('Unknown selection')
                notes = {condition, 'clean', 'neutral'}
                rows = [x for x in data['cv']['cells'] if x['record_id'] == rid and x['model'] == model and x['frame'] == frame and x['condition'] in notes]
                if len(rows) != len(notes) * 2:
                    raise KeyError('Incomplete selection')
                return self.send(200, {'record': record, 'model': model, 'condition': condition, 'frame': frame, 'note': note, 'rubric': data['cv']['rubric'], 'warning': data['cv']['warning'] if frame.startswith('warning') else None, 'rows': rows, 'mode': 'frozen-replay'})
            if url.path.startswith('/api/'):
                return self.send(404, {'error': 'Unknown read-only endpoint'})
            # Only the bundled UI is served; sibling documents and source code are not exposed.
            base = (HERE / 'dist').resolve()
            file = (base / (unquote(url.path).lstrip('/') or 'index.html')).resolve()
            try:
                file.relative_to(base)
            except ValueError:
                return self.send(403, {'error': 'Forbidden path'})
            if file.is_dir():
                file = file / 'index.html'
            if not file.is_file():
                return self.send(404, {'error': 'Not found'})
            kind = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
            if kind.startswith('text/') or kind in ('application/javascript', 'application/json'):
                kind += '; charset=utf-8'
            return self.send(200, file.read_bytes(), kind)
        except (KeyError, ValueError):
            return self.send(400, {'error': 'Unknown replay selection'})

    def do_POST(self):
        self.close_connection = True
        return self.send(405, {'error': 'Read-only app: no write or inference endpoint'})

    do_PUT = do_POST
    do_DELETE = do_POST


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8767)
    args = parser.parse_args()
    Handler.bundle = json.loads((HERE / 'data/replays.json').read_text(encoding='utf-8'))
    server = LocalServer(('127.0.0.1', args.port), Handler)
    print(f'CV Evidence Lab: http://127.0.0.1:{server.server_port}', flush=True)
    print('Archived replay only. No model calls. Stop with Ctrl+C.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
