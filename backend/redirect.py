
import sys, os, argparse
import tempfile
from wsgiref.simple_server import WSGIRequestHandler, make_server
from bottle import *

host = None

def resources_dir():
        return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../'))

class HackedWSGIRequestHandler(WSGIRequestHandler):
    def address_string(self):
        global host
        host = self.headers['Host']
        return str(self.client_address[0])

def static_css_handler(path):
    return static_file(path, root=os.path.join(resources_dir(), 'frontend/css'))

@route('/img/:path#.+#')
def static_img_handler(path):
    return static_file(path, root=os.path.join(resources_dir(), 'frontend/img'))

@route('/favicon.ico')
def favicon_handler():
    return static_file('favicon.ico', root=os.path.join(resources_dir(), 'frontend/img'))

@route('/')
@route('/index.html')
@route('/app.html')
def default_handler():
    url = 'https://' + host + '/'
    html = '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;URL=' + url + '"></head><body>redirect https</body></html>'
    return html

@route('/download/:filename/:dlname')
def download(filename, dlname):
    return static_file(filename, root=tempfile.gettempdir(), download=dlname)

handler = default_app()
server = make_server('', 80, handler, handler_class=HackedWSGIRequestHandler)
print 'redirector'
server.serve_forever()
