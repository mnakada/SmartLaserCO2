
import sys, os, time, signal
import glob, json, argparse, copy
import tempfile
import serial
import socket, webbrowser
from wsgiref.simple_server import WSGIRequestHandler, make_server
from bottle import *
from serial_manager import SerialManager
from flash import flash_upload, reset_atmega
from build import build_firmware
from filereaders import read_svg, read_dxf, read_ngc
import logging
import ssl

APPNAME = "SmartLaser"
VERSION = "1.0.0"
COMPANY_NAME = "com.nortd.labs"
SERIAL_PORT = None
BITSPERSECOND = 57600
NETWORK_PORT = 4444
LIBSDIR = None
HARDWARE = 'x86'  # also: 'raspberrypi'
CONFIG_FILE = "lasaurapp.conf"
FIRMWARE = "LasaurGrbl.hex"
TOLERANCE = 0.08
CERTSDIR = None
KEYFILE = None
CERTSFILE = None
CA_CERTSFILE = None
accessUser = None
accounts = {}
accountsTable = []
statistics = {}
logger = None
COMMON_NAME = None
ADMIN = None
redirect_pid = 0


if os.name == 'nt': #sys.platform == 'win32':
    GUESS_PREFIX = "Arduino"
elif os.name == 'posix':
    if sys.platform == "linux" or sys.platform == "linux2":
        GUESS_PREFIX = "2341"  # match by arduino VID
    else:
        GUESS_PREFIX = "tty.usbmodem"
else:
    GUESS_PREFIX = "no prefix"


def resources_dir():
    """This is to be used with all relative file access.
       _MEIPASS is a special location for data files when creating
       standalone, single file python apps with pyInstaller.
       Standalone is created by calling from 'other' directory:
       python pyinstaller/pyinstaller.py --onefile app.spec
    """
    if hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    else:
        # root is one up from this file
        return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../'))


def storage_dir():
    directory = ""
    if LIBSDIR != None:
        directory = LIBSDIR
    elif sys.platform == 'darwin':
        # from AppKit import NSSearchPathForDirectoriesInDomains
        # # NSApplicationSupportDirectory = 14
        # # NSUserDomainMask = 1
        # # True for expanding the tilde into a fully qualified path
        # appdata = path.join(NSSearchPathForDirectoriesInDomains(14, 1, True)[0], APPNAME)
        directory = os.path.join(os.path.expanduser('~'), 'Library', 'Application Support', COMPANY_NAME, APPNAME)
    elif sys.platform == 'win32':
        directory = os.path.join(os.path.expandvars('%APPDATA%'), COMPANY_NAME, APPNAME)
    else:
        directory = os.path.join(os.path.expanduser('~'), "." + APPNAME)

    if not os.path.exists(directory):
        os.makedirs(directory)

    return directory


class HackedWSGIRequestHandler(WSGIRequestHandler):
    """ This is a heck to solve super slow request handling
    on the RaspberryPi. The problem is WSGIRequestHandler
    which does a reverse lookup on every request calling gethostbyaddr.
    For some reason this is super slow when connected to the LAN.
    (adding the IP and name of the requester in the /etc/hosts file
    solves the problem but obviously is not practical)
    """
    def address_string(self):
        """Instead of calling getfqdn -> gethostbyaddr we ignore."""
        # return "(a requester)"
        return str(self.client_address[0])


def verify_request(request, client_address):
    global accessUser
    global statistics
    cert = request.getpeercert()
    if cert:
      subject = cert['subject']
      for entity in subject:
        if entity[0][0] == 'commonName':
          accessUser = entity[0][1]
          if not accessUser in statistics:
            statistics[accessUser] = { 'useTime': 0, 'laserTime': 0, 'length': 0, 'lastAccess': 0}
          if time.time() - statistics[accessUser]['lastAccess'] > 30:
            statistics[accessUser]['lastAccess'] = time.time()
            update_statistics()
          return accessUser in accounts
    accessUser = None
    return False

def admin_check():
    if CERTSDIR==None:
      return False
    if (accessUser in accounts) and accounts[accessUser]:
      return True
    return False

def loadAccounts():
    if CERTSDIR==None:
      return
    global accounts
    global accountsTable
    global statistics
    accounts = {}
    accountsTable = []
    try:
      f = open(os.path.join(CERTSDIR, 'accounts.json'), 'r')
      accountsTable = json.load(f)['accounts']
      f.close()
      for account in accountsTable:
        accounts[account['user']] = (account['admin'] == True) or (account['admin'] == 'true')
    except IOError:
      pass
    try:
      f = open(os.path.join(CERTSDIR, 'accounts.stat'), 'r')
      statistics = json.load(f)['statistics']
      f.close()
    except IOError:
      pass

def saveAccounts():
    if CERTSDIR==None:
      return
    try:
      file = os.path.join(CERTSDIR, 'accounts.json')
      f = open(file + '.bak', 'w')
      f.write(json.dumps({'accounts':accountsTable}))
      f.close()
      os.rename(file + '.bak', file)
    except IOError:
      pass

def update_statistics():
    if CERTSDIR==None:
      return
    try:
      file = os.path.join(CERTSDIR, 'accounts.stat')
      f = open(file + '.bak', 'w')
      f.write(json.dumps({'statistics':statistics}))
      f.close()
      os.rename(file + '.bak', file)
    except IOError:
      pass

def receive_signal(signum, stack):
  print 'Received:', signum
  raise KeyboardInterrupt('receive signal')

signal.signal(signal.SIGHUP, receive_signal)
signal.signal(signal.SIGINT, receive_signal)
signal.signal(signal.SIGQUIT, receive_signal)
signal.signal(signal.SIGTERM, receive_signal)

def run_with_callback(host, port):
    """ Start a wsgiref server instance with control over the main loop.
        This is a function that I derived from the bottle.py run()
    """
    handler = default_app()
    server = make_server(host, port, handler, handler_class=HackedWSGIRequestHandler)
    if CERTSDIR:
      server.socket = ssl.wrap_socket(server.socket,
        keyfile=KEYFILE,
        certfile=CERTSFILE,
        server_side=True,
        cert_reqs=ssl.CERT_REQUIRED,
        ca_certs=CA_CERTSFILE)
      loadAccounts()
      server.verify_request = verify_request
    server.timeout = 0.01
    server.quiet = True
    print "Persistent storage root is: " + storage_dir()
    print "-----------------------------------------------------------------------------"
    print "Bottle server starting up ..."
    print "Serial is set to %d bps" % BITSPERSECOND
    print "Point your browser to: "
    if CERTSDIR:
      print "https://%s:%d/" % (COMMON_NAME, port)
    elif COMMON_NAME:
      print "http://%s:%d/" % (COMMON_NAME, port)
    else:
      print "http://%s:%d/" % ('127.0.0.1', port)
    print "Use Ctrl-C to quit."
    print "-----------------------------------------------------------------------------"
    print
    # auto-connect on startup
    global SERIAL_PORT
    if not SERIAL_PORT:
        SERIAL_PORT = SerialManager.match_device(GUESS_PREFIX, BITSPERSECOND)
    SerialManager.connect(SERIAL_PORT, BITSPERSECOND)
# I:Mega Start
    time.sleep(1.0)
# I:Mega End
#    # open web-browser
#    try:
#        webbrowser.open_new_tab('http://127.0.0.1:'+str(port))
#        pass
#    except webbrowser.Error:
#        print "Cannot open Webbrowser, please do so manually."
    sys.stdout.flush()  # make sure everything gets flushed
    server.timeout = 0
    lastPowerStatus = 0
    powerStateChange = 0
    while 1:
        try:
            serial_handler('1')
            SerialManager.send_queue_as_ready()
            server.handle_request()
            if HARDWARE == 'raspberrypi':
              powerStatus = RPiPowerControl.interval_check()
              if powerStatus != lastPowerStatus:
                powerStateChange = 1
                lastPowerStatus = powerStatus
            if powerStateChange:
              powerStateChange = checkStatus()
            time.sleep(0.0004)
        except KeyboardInterrupt:
            if HARDWARE == 'raspberrypi':
              RPiPowerControl.gpio_cleanup()
            break
        except:
            import traceback
            traceback.print_exc()
            break
    print "\nShutting down..."
    if redirect_pid:
      os.kill(redirect_pid, signal.SIGTERM)
    SerialManager.close()


lastCheck = 0
def checkStatus():
    global lastCheck
    checkFlag = 1
    now = time.time()
    if now - lastCheck < 1.0:
      return checkFlag
    status = get_status()
    if (int(status['power']) > 0) and not status['door_open'] and status['ready'] and status['serial_connected']:
      SerialManager.queue_gcode('!\n')
      time.sleep(1.0)
      SerialManager.queue_gcode('~\nG90\nG30\n')
      checkFlag = 0
    if (int(status['power']) == 0):
      checkFlag = 0
    lastCheck = now
    return checkFlag


@route('/css/:path#.+#')
def static_css_handler(path):
    return static_file(path, root=os.path.join(resources_dir(), 'frontend/css'))

@route('/js/:path#.+#')
def static_js_handler(path):
    return static_file(path, root=os.path.join(resources_dir(), 'frontend/js'))

@route('/img/:path#.+#')
def static_img_handler(path):
    return static_file(path, root=os.path.join(resources_dir(), 'frontend/img'))

@route('/favicon.ico')
def favicon_handler():
    return static_file('favicon.ico', root=os.path.join(resources_dir(), 'frontend/img'))

### LIBRARY

@route('/library/get/:path#.+#')
def static_library_handler(path):
    return static_file(path, root=os.path.join(resources_dir(), 'library'), mimetype='text/plain')

@route('/library/list')
def library_list_handler():
    # return a json list of file names
    file_list = []
    cwd_temp = os.getcwd()
    try:
        os.chdir(os.path.join(resources_dir(), 'library'))
        file_list = glob.glob('*')
    finally:
        os.chdir(cwd_temp)
    return json.dumps(file_list)



### QUEUE

def encode_filename(name):
    str(time.time()) + '-' + base64.urlsafe_b64encode(name)

def decode_filename(name):
    index = name.find('-')
    return base64.urlsafe_b64decode(name[index+1:])

@route('/queue/get/:name#.+#')
def static_queue_handler(name):
    return static_file(name, root=storage_dir(), mimetype='text/plain')


@route('/queue/list')
def library_list_handler():
    # base64.urlsafe_b64encode()
    # base64.urlsafe_b64decode()
    # return a json list of file names
    files = []
    cwd_temp = os.getcwd()
    try:
        os.chdir(storage_dir())
        files = filter(os.path.isfile, glob.glob("*"))
        files.sort(key=lambda x: os.path.getmtime(x))
    finally:
        os.chdir(cwd_temp)
    return json.dumps(files)

@route('/queue/save', method='POST')
def queue_save_handler():
    ret = '0'
    if 'job_name' in request.forms and 'job_data' in request.forms:
        name = request.forms.get('job_name')
        job_data = request.forms.get('job_data')
        filename = os.path.abspath(os.path.join(storage_dir(), name.strip('/\\')))
        if os.path.exists(filename) or os.path.exists(filename+'.starred'):
            return "file_exists"
        try:
            fp = open(filename, 'w')
            fp.write(job_data)
            print "file saved: " + filename
            ret = '1'
        finally:
            fp.close()
    else:
        print "error: save failed, invalid POST request"
    return ret

@route('/queue/rm/:name')
def queue_rm_handler(name):
    # delete queue item, on success return '1'
    ret = '0'
    filename = os.path.abspath(os.path.join(storage_dir(), name.strip('/\\')))
    if filename.startswith(storage_dir()):
        if os.path.exists(filename):
            try:
                os.remove(filename);
                print "file deleted: " + filename
                ret = '1'
            finally:
                pass
    return ret

@route('/queue/clear')
def queue_clear_handler():
    # delete all queue items, on success return '1'
    ret = '0'
    files = []
    cwd_temp = os.getcwd()
    try:
        os.chdir(storage_dir())
        files = filter(os.path.isfile, glob.glob("*"))
        files.sort(key=lambda x: os.path.getmtime(x))
    finally:
        os.chdir(cwd_temp)
    for filename in files:
        if not filename.endswith('.starred'):
            filename = os.path.join(storage_dir(), filename)
            try:
                os.remove(filename);
                print "file deleted: " + filename
                ret = '1'
            finally:
                pass
    return ret

@route('/queue/star/:name')
def queue_star_handler(name):
    ret = '0'
    filename = os.path.abspath(os.path.join(storage_dir(), name.strip('/\\')))
    if filename.startswith(storage_dir()):
        if os.path.exists(filename):
            os.rename(filename, filename + '.starred')
            ret = '1'
    return ret

@route('/queue/unstar/:name')
def queue_unstar_handler(name):
    ret = '0'
    filename = os.path.abspath(os.path.join(storage_dir(), name.strip('/\\')))
    if filename.startswith(storage_dir()):
        if os.path.exists(filename + '.starred'):
            os.rename(filename + '.starred', filename)
            ret = '1'
    return ret




@route('/')
@route('/index.html')
@route('/app.html')
def default_handler():
    loadAccounts()
    return static_file('app.html', root=os.path.join(resources_dir(), 'frontend') )


@route('/stash_download', method='POST')
def stash_download():
    """Create a download file event from string."""
    filedata = request.forms.get('filedata')
    fp = tempfile.NamedTemporaryFile(mode='w', delete=False)
    filename = fp.name
    with fp:
        fp.write(filedata)
        fp.close()
    print "file stashed: " + os.path.basename(filename)
    return os.path.basename(filename)

@route('/download/:filename/:dlname')
def download(filename, dlname):
    print "requesting: " + filename
    return static_file(filename, root=tempfile.gettempdir(), download=dlname)

@route('/serial/:connect')
def serial_handler(connect):
    if connect == '1':
        # print 'js is asking to connect serial'
        if not SerialManager.is_connected():
            try:
                global SERIAL_PORT, BITSPERSECOND, GUESS_PREFIX
                if not SERIAL_PORT:
                    SERIAL_PORT = SerialManager.match_device(GUESS_PREFIX, BITSPERSECOND)
                SerialManager.connect(SERIAL_PORT, BITSPERSECOND)
                ret = "Serial connected to %s:%d." % (SERIAL_PORT, BITSPERSECOND)  + '<br>'
                time.sleep(1.0) # allow some time to receive a prompt/welcome
                SerialManager.flush_input()
                SerialManager.flush_output()
                return ret
            except serial.SerialException:
                SERIAL_PORT = None
                print "Failed to connect to serial."
                return ""
    elif connect == '0':
        # print 'js is asking to close serial'
        if SerialManager.is_connected():
            if SerialManager.close(): return '1'
            else: return ''
    elif connect == '2':
        # print 'js is asking if serial connected'
        if SerialManager.is_connected(): return '1'
        else: return ''
    else:
        print 'ambigious connect request from js: ' + connect
        return ''

@route('/logging', method='POST')
def logging_handler():
    global statistics
    feedrate = request.forms.get('feedrate')
    intensity = request.forms.get('intensity')
    counts = request.forms.get('counts')
    length = request.forms.get('length')

    if logger:
      logger.info('processing : ' + (accessUser + ' ' if accessUser else '') +'F' + feedrate+' '+intensity+'% '+str(round(float(length)/1000, 2)) + 'm' + counts + 'times')
    if float(feedrate):
      useTime = float(length) * float(counts) * 60 / float(feedrate)
    else:
      useTime = 0;
    laserTime = useTime * float(intensity) / 100
    if accessUser:
      statistics[accessUser]['useTime'] += useTime
      statistics[accessUser]['laserTime'] += laserTime
      statistics[accessUser]['length'] += float(length)
      statistics[accessUser]['lastAccess'] = time.time()
      update_statistics()

@route('/status')
def get_status_json():
    return json.dumps(get_status())

def get_status():
    status = copy.deepcopy(SerialManager.get_hardware_status())
    status['serial_connected'] = SerialManager.is_connected()
    if HARDWARE == 'raspberrypi':
      status['power'] = RPiPowerControl.get_power_status()
      status['assist_air'] = RPiPowerControl.get_assist_air_status()
      RPiPowerControl.set_process_status(status['serial_connected'] and not status['ready'])
    else:
      status['power'] = 1;
      status['assist_air'] = 1;
    status['lasaurapp_version'] = VERSION
    status['admin'] = admin_check()
    status['user'] = accessUser
    return status

@route('/accounts/get')
def get_accounts():
    if not admin_check():
      return None
    return json.dumps({'accounts':accountsTable, 'statistics':statistics})

@route('/accounts/set', method="POST")
def set_accounts():
    global accounts
    global accountsTable
    if not admin_check():
      return None
    user = request.forms.get('user');
    comment = request.forms.get('comment');
    admin = request.forms.get('admin');
    if (accessUser == user) and (admin != 'true'):
      return None
    if user in accounts:
      for account in accountsTable:
        if account['user'] == user:
          account['comment'] = comment
          account['admin'] = admin
          saveAccounts()
          break
    else:
      add_accounts(user, comment, admin)
    return json.dumps({'accounts':accountsTable, 'statistics':statistics})

@route('/accounts/remove/:user')
def remove_accounts(user):
    global accounts
    global accountsTable
    if not admin_check():
      return None
    if accounts[user]:
      return None
    i = 0
    for account in accountsTable:
      if account['user'] == user:
        accountsTable.pop(i)
        accounts.pop(user)
        break
      i += 1
    saveAccounts()
    return json.dumps({'accounts':accountsTable, 'statistics':statistics})

@route('/accounts/certs/:user')
def get_certs(user):
    global accounts
    global accountsTable
    if not admin_check():
      return None
    for account in accountsTable:
      if account['user'] == user:
        certs_file = os.path.join(resources_dir(), 'PrivateCA/') + user + '.zip'
        if not os.path.exists(certs_file):
          os.system(os.path.join(resources_dir(), 'PrivateCA') + '/mkclient ' + user)
        
        fp = file(certs_file, "r")
        filedata = fp.read()
        fp.close()
        fp = tempfile.NamedTemporaryFile(mode='w', delete=False)
        filename = fp.name
        with fp:
            fp.write(filedata)
            fp.close()
        print "file stashed: " + os.path.basename(filename)
        return os.path.basename(filename)
    return None

def add_accounts(user, comment, admin):
    accountsTable.append({'user':user, 'comment':comment, 'admin':admin})
    accounts[user] = (admin == True) or (admin == 'true')
    saveAccounts()
    statistics[user] = { 'useTime': 0, 'laserTime': 0, 'length': 0, 'lastAccess': 0}
    update_statistics()

@route('/pause/:flag')
def set_pause(flag):
    # returns pause status
    if flag == '1':
        if SerialManager.set_pause(True):
            print "pausing ..."
            return '1'
        else:
            return '0'
    elif flag == '0':
        print "resuming ..."
        if SerialManager.set_pause(False):
            return '1'
        else:
            return '0'

@route('/assist_air/:flag')
def set_assist_air(flag):
    if HARDWARE == 'raspberrypi':
        RPiPowerControl.set_assist_air(flag)
        if logger:
          if flag:
            logger.info('assist air on')
          else:
            logger.info('assist air off')
    return flag

@route('/power/:flag')
def set_power(flag):
    if HARDWARE == 'raspberrypi':
        RPiPowerControl.set_power(flag)
        if logger:
          if flag:
            logger.info('power on')
          else:
            logger.info('power off')
    return flag

@route('/flash_firmware')
@route('/flash_firmware/:firmware_file')
def flash_firmware_handler(firmware_file=FIRMWARE):
    if not admin_check():
      return None
    global SERIAL_PORT, GUESS_PREFIX
    return_code = 1
    if SerialManager.is_connected():
        SerialManager.close()
    # get serial port by url argument
    # e.g: /flash_firmware?port=COM3
    if 'port' in request.GET.keys():
        serial_port = request.GET['port']
        if serial_port[:3] == "COM" or serial_port[:4] == "tty.":
            SERIAL_PORT = serial_port
    # get serial port by enumeration method
    # currenty this works on windows only for updating the firmware
    if not SERIAL_PORT:
        SERIAL_PORT = SerialManager.match_device(GUESS_PREFIX, BITSPERSECOND)
    # resort to brute force methode
    # find available com ports and try them all
    if not SERIAL_PORT:
        comport_list = SerialManager.list_devices(BITSPERSECOND)
        for port in comport_list:
            print "Trying com port: " + port
            return_code = flash_upload(port, resources_dir(), firmware_file, HARDWARE)
            if return_code == 0:
                print "Success with com port: " + port
                SERIAL_PORT = port
                break
    else:
        return_code = flash_upload(SERIAL_PORT, resources_dir(), firmware_file, HARDWARE)
    ret = []
    ret.append('Using com port: %s<br>' % (SERIAL_PORT))
    ret.append('Using firmware: %s<br>' % (firmware_file))
    if return_code == 0:
        print "SUCCESS: Arduino appears to be flashed."
        ret.append('<h2>Successfully Flashed!</h2><br>')
        ret.append('<a href="/">return</a>')
        return ''.join(ret)
    else:
        print "ERROR: Failed to flash Arduino."
        ret.append('<h2>Flashing Failed!</h2> Check terminal window for possible errors. ')
        ret.append('Most likely LasaurApp could not find the right serial port.')
        ret.append('<br><a href="/flash_firmware/'+firmware_file+'">try again</a> or <a href="/">return</a><br><br>')
        if os.name != 'posix':
            ret. append('If you know the COM ports the Arduino is connected to you can specifically select it here:')
            for i in range(1,13):
                ret. append('<br><a href="/flash_firmware?port=COM%s">COM%s</a>' % (i, i))
        return ''.join(ret)


@route('/build_firmware')
def build_firmware_handler():
    if not admin_check():
      return None
    ret = []
    buildname = "LasaurGrbl_from_src"
    firmware_dir = os.path.join(resources_dir(), 'firmware')
    source_dir = os.path.join(resources_dir(), 'firmware', 'src')
    return_code = build_firmware(source_dir, firmware_dir, buildname)
    if return_code != 0:
        ret.append('<h2>FAIL: build error!</h2>')
        ret.append('Syntax error maybe? Try builing in the terminal.')
        ret.append('<br><a href="/">return</a><br><br>')
    else:
        print "SUCCESS: firmware built."
        ret.append('<h2>SUCCESS: new firmware built!</h2>')
        ret.append('<br><a href="/flash_firmware/'+buildname+'.hex">Flash Now!</a><br><br>')
    return ''.join(ret)


@route('/reset_atmega')
def reset_atmega_handler():
    if not admin_check():
      return None
    reset_atmega(HARDWARE)
    return '1'


@route('/gcode', method='POST')
def job_submit_handler():
    job_data = request.forms.get('job_data')
    if job_data and SerialManager.is_connected():
        SerialManager.queue_gcode(job_data)
        return "__ok__"
    else:
        return "serial disconnected"

@route('/queue_pct_done')
def queue_pct_done_handler():
    return SerialManager.get_queue_percentage_done()


@route('/file_reader', method='POST')
def file_reader():
    """Parse SVG string."""
    filename = request.forms.get('filename')
    filedata = request.forms.get('filedata')
    dimensions = request.forms.get('dimensions')
    try:
        dimensions = json.loads(dimensions)
    except TypeError:
        dimensions = None
    # print "dims", dimensions[0], ":", dimensions[1]


    dpi_forced = None
    try:
        dpi_forced = float(request.forms.get('dpi'))
    except:
        pass

    optimize = True
    try:
        optimize = bool(int(request.forms.get('optimize')))
    except:
        pass

    if filename and filedata:
        print "You uploaded %s (%d bytes)." % (filename, len(filedata))
        if filename[-4:] in ['.dxf', '.DXF']:
            res = read_dxf(filedata, TOLERANCE, optimize)
        elif filename[-4:] in ['.svg', '.SVG']:
            res = read_svg(filedata, dimensions, TOLERANCE, dpi_forced, optimize)
        elif filename[-4:] in ['.ngc', '.NGC']:
            res = read_ngc(filedata, TOLERANCE, optimize)
        else:
            print "error: unsupported file format"

        # print boundarys
        jsondata = json.dumps(res)
        # print "returning %d items as %d bytes." % (len(res['boundarys']), len(jsondata))
        return jsondata
    return "You missed a field."

### Setup Argument Parser
argparser = argparse.ArgumentParser(description='Run SmartLaser.', prog='smartlaser')
argparser.add_argument('port', metavar='serial_port', nargs='?', default=False,
                    help='serial port to the Lasersaur')
argparser.add_argument('-v', '--version', action='version', version='%(prog)s ' + VERSION)
argparser.add_argument('-p', '--public', dest='host_on_all_interfaces', action='store_true',
                    default=False, help='bind to all network devices (default: bind to 127.0.0.1)')
argparser.add_argument('-f', '--flash', dest='flash', action='store_true',
                    default=False, help='flash Arduino with LasaurGrbl firmware')
argparser.add_argument('-b', '--build', dest='build_flash', action='store_true',
                    default=False, help='build and flash from firmware/src')
argparser.add_argument('-l', '--list', dest='list_serial_devices', action='store_true',
                    default=False, help='list all serial devices currently connected')
argparser.add_argument('-d', '--debug', dest='debug', action='store_true',
                    default=False, help='print more verbose for debugging')
argparser.add_argument('--raspberrypi', dest='raspberrypi', action='store_true',
                    default=False, help='use this for running on Raspberry Pi')
argparser.add_argument('-m', '--match', dest='match',
                    default=GUESS_PREFIX, help='match serial device with this string')
argparser.add_argument('--network_port', dest='network_port',
                    default=4444, help='bind netowrk port (default:4444)')
argparser.add_argument('--libsdir', dest='libsdir',
                    default=False, help='libraries direcotry')
argparser.add_argument('--certsdir', dest='certsDir',
                    default=False, help='accounts file')
argparser.add_argument('--commonname', dest='commonname',
                    default=False, help='certs common name')
argparser.add_argument('--admin', dest='admin',
                    default=False, help='admin email')
argparser.add_argument('--log', dest='logfile',
                    default=False, help='logging file')
args = argparser.parse_args()



print "SmartLaser " + VERSION

if args.certsDir:
    CERTSDIR = os.path.abspath(args.certsDir)
    KEYFILE = os.path.join(CERTSDIR, 'common_smartlaser.key')
    CERTSFILE = os.path.join(CERTSDIR, 'common_smartlaser.crt')
    CA_CERTSFILE = os.path.join(CERTSDIR, 'smartlaser_privateca.crt')
    if args.admin:
          ADMIN = args.admin
    else:
          ADMIN = 'admin'
    if args.commonname:
      COMMON_NAME = args.commonname
    else:
      s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
      s.connect(('8.8.8.8', 80))
      COMMON_NAME = s.getsockname()[0]
      s.close()
    if not os.path.isfile(KEYFILE) or not os.path.isfile(CERTSFILE) or not os.path.isfile(CA_CERTSFILE):
      os.system(os.path.join(resources_dir(), 'PrivateCA') + '/mkca ' + COMMON_NAME + ' ' + CERTSDIR)
      accessUser = ADMIN
      add_accounts(accessUser, '', True)
      path = get_certs(accessUser)
      print '=============================================================='
      print 'http://' + COMMON_NAME + '/download/' + path + '/' + accessUser + '.zip'
      print '=============================================================='
      accessUser = None

if args.raspberrypi:
    HARDWARE = 'raspberrypi'
    NETWORK_PORT = 80
    if CERTSDIR:
      NETWORK_PORT = 443
    from RPiPowerControl import RPiPowerControl

if args.network_port:
    NETWORK_PORT = int(args.network_port)

if args.libsdir:
    LIBSDIR = args.libsdir

if args.logfile:
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    fh = logging.FileHandler(filename=args.logfile)
    fh.setFormatter(logging.Formatter('%(asctime)s : %(message)s'))
    logger.addHandler(fh)


if args.list_serial_devices:
    SerialManager.list_devices(BITSPERSECOND)
else:
    if not SERIAL_PORT:
        if args.port:
            # (1) get the serial device from the argument list
            SERIAL_PORT = args.port
            print "Using serial device '"+ SERIAL_PORT +"' from command line."
        else:
            # (2) get the serial device from the config file
            if os.path.isfile(CONFIG_FILE):
                fp = open(CONFIG_FILE)
                line = fp.readline().strip()
                if len(line) > 3:
                    SERIAL_PORT = line
                    print "Using serial device '"+ SERIAL_PORT +"' from '" + CONFIG_FILE + "'."

    if not SERIAL_PORT:
        if args.match:
            GUESS_PREFIX = args.match
            SERIAL_PORT = SerialManager.match_device(GUESS_PREFIX, BITSPERSECOND)
            if SERIAL_PORT:
                print "Using serial device '"+ str(SERIAL_PORT)
                if os.name == 'posix':
                    # not for windows for now
                    print "(first device to match: " + args.match + ")"
        else:
            SERIAL_PORT = SerialManager.match_device(GUESS_PREFIX, BITSPERSECOND)
            if SERIAL_PORT:
                print "Using serial device '"+ str(SERIAL_PORT) +"' by best guess."

    if not SERIAL_PORT:
        print "-----------------------------------------------------------------------------"
        print "WARNING: SmartLaser doesn't know what serial device to connect to!"
        print "Make sure the Lasersaur hardware is connectd to the USB interface."
        if os.name == 'nt':
            print "ON WINDOWS: You will also need to setup the virtual com port."
            print "See 'Installing Drivers': http://arduino.cc/en/Guide/Windows"
        print "-----------------------------------------------------------------------------"

    # run
    if args.debug:
        debug(True)
        if hasattr(sys, "_MEIPASS"):
            print "Data root is: " + sys._MEIPASS
    if args.flash:
        return_code = flash_upload(SERIAL_PORT, resources_dir(), FIRMWARE, HARDWARE)
        if return_code == 0:
            print "SUCCESS: Arduino appears to be flashed."
        else:
            print "ERROR: Failed to flash Arduino."
    elif args.build_flash:
        # build
        buildname = "LasaurGrbl_from_src"
        firmware_dir = os.path.join(resources_dir(), 'firmware')
        source_dir = os.path.join(resources_dir(), 'firmware', 'src')
        return_code = build_firmware(source_dir, firmware_dir, buildname)
        if return_code != 0:
            print ret
        else:
            print "SUCCESS: firmware built."
            # flash
            return_code = flash_upload(SERIAL_PORT, resources_dir(), FIRMWARE, HARDWARE)
            if return_code == 0:
                print "SUCCESS: Arduino appears to be flashed."
            else:
                print "ERROR: Failed to flash Arduino."
    else:
        if (CERTSDIR != None) and (NETWORK_PORT == 443):
            redirect_pid = os.fork()
            if redirect_pid == 0:
              import redirect
        if args.host_on_all_interfaces:
            run_with_callback('', NETWORK_PORT)
        else:
            run_with_callback('127.0.0.1', NETWORK_PORT)
