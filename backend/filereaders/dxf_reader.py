# Adapted from dxf2svg.py by David S. Touretzky
# Computer Science Department, Carnegie Mellon University
# Released under the GNU GPL3 license.


__author__ = 'David S. Touretzky, Stefan Hechenberger <stefan@nortd.com>'


import math
import StringIO

from point import Point
from arcgeo import ArcGeo
from linegeo import LineGeo
from spline_convert import Spline2Arcs



class DXFReader:
    """Parse very simple DXF files with lines, arcs, and lwpolyline.

    Usage:
    reader = DXFReader(0.08)
    boundarys = reader.parse(open('filename').read())
    """

    def __init__(self, tolerance):
        # tolerance settings, used in tessalation, path simplification, etc         
        self.tolerance = tolerance
        self.tolerance2 = tolerance**2

        # parsed path data, paths by color
        # {'#ff0000': [[path0, path1, ..], [path0, ..], ..]}
        # Each path is a list of vertices which is a list of two floats.        
        self.black_boundarys = []

        self.metricflag = 1
        self.linecount = 0
        self.line = ''
        self.dxfcode = ''

    def parse(self, dxfstring):
        self.linecount = 0
        self.line = ""
        self.cmd = ""
        self.infile = StringIO.StringIO(dxfstring)
        self.metricflag = 1

        self.readtosection(2, "ENTITIES")
        self.readtocode(0)
        self.nextcmd = self.line
        while 1:
            self.cmd = self.readblock()
            if self.cmd == "LINE": self.do_line()
            elif self.cmd == "CIRCLE": self.do_circle()
            elif self.cmd == "ARC": self.do_arc()
            elif self.cmd == "LWPOLYLINE": self.do_lwpolyline()
            elif self.cmd == "POLYLINE": self.do_polyline()
            elif self.cmd == "VERTEX": self.do_polyline_vertex()
            elif self.cmd == "SEQEND": self.do_polyline_seqend()
            elif self.cmd == "SPLINE": self.do_spline()
            elif self.cmd == "ENDSEC": break
            else: self.complain_invalid()
        self.infile.close()

        sx = sy = float("inf")
        for path in self.black_boundarys:
          for point in path:
            if point[0] < sx:
              sx = point[0]
            if -point[1] < sy:
              sy = -point[1]
        self.sx = sx
        self.sy = sy
        return {'boundarys':{'#000000':map(self.reverse_path, self.black_boundarys)}}

    def reverse_path(self, path):
        new_path = []
        for point in path:
          new_path.append([point[0] - self.sx, -point[1] - self.sy])
        return new_path

    ################
    # Routines to read entries from the DXF file

    def readblock(self):
      self.block = []
      while 1:
        self.readonepair()
        if self.dxfcode == 0:
          cmd = self.nextcmd
          self.nextcmd = self.line
          break
        self.block.append([int(self.dxfcode), self.line])
      self.blockindex = 0
      return cmd
      
    def readtosection(self, codeval, stringval):
        self.dxfcode = None
        while (self.dxfcode != codeval) or (self.line != stringval):
            self.readonepair()

    def readonepair(self):
        self.readoneline()
        self.dxfcode = int(self.line)
        self.readoneline()

    def readoneline(self):
        self.linecount += 1
        self.line = self.infile.readline()
        if not self.line: 
            print "Premature end of file!"
            print "Something is wrong. Sorry!"
            raise ValueError
        self.line = self.line.rstrip()

    def readtocode(self, val):
        self.dxfcode = None
        while self.dxfcode != val:
            self.readonepair()

    def readgroup(self, codeval):
        val = None
        while self.blockindex < len(self.block):
          if self.block[self.blockindex][0] == codeval:
            val = self.block[self.blockindex][1]
            self.blockindex += 1
            break
          self.blockindex += 1
        return val

    ################
    # Translate each type of entity (line, circle, arc, lwpolyline, polyline, spline)

    def do_line(self):
        x1 = float(self.readgroup(10))
        y1 = float(self.readgroup(20))
        x2 = float(self.readgroup(11))
        y2 = float(self.readgroup(21))
        if self.metricflag == 0:
            x1 = x1*25.4
            y1 = y1*25.4        
            x2 = x2*25.4
            y2 = y2*25.4        
        self.black_boundarys.append([[x1,y1],[x2,y2]])

    def do_circle(self):
        cx = float(self.readgroup(10))
        cy = float(self.readgroup(20))
        r = float(self.readgroup(40))
        if self.metricflag == 0:
            cx = cx*25.4
            cy = cy*25.4        
            r = r*25.4  
        path = []
        self.addArc(path, cx-r, cy, r, r, 0, 0, 0, cx, cy+r)
        self.addArc(path, cx, cy+r, r, r, 0, 0, 0, cx+r, cy)
        self.addArc(path, cx+r, cy, r, r, 0, 0, 0, cx, cy-r)
        self.addArc(path, cx, cy-r, r, r, 0, 0, 0, cx-r, cy)
        self.black_boundarys.append(path)

    def do_arc(self):
        cx = float(self.readgroup(10))
        cy = float(self.readgroup(20))
        r = float(self.readgroup(40))
        if self.metricflag == 0:
            cx = cx*25.4
            cy = cy*25.4        
            r = r*25.4        
        theta1deg = float(self.readgroup(50))
        theta2deg = float(self.readgroup(51))
        thetadiff = theta2deg-theta1deg
        if thetadiff < 0 : thetadiff = thetadiff + 360
        large_arc_flag = int(thetadiff >= 180)
        sweep_flag = 1
        theta1 = theta1deg/180.0 * math.pi;
        theta2 = theta2deg/180.0 * math.pi;
        x1 = cx + r*math.cos(theta1)
        y1 = cy + r*math.sin(theta1)
        x2 = cx + r*math.cos(theta2)
        y2 = cy + r*math.sin(theta2)
        path = []
        self.addArc(path, x1, y1, r, r, 0, large_arc_flag, sweep_flag, x2, y2)
        self.black_boundarys.append(path)

    def do_lwpolyline(self):
        numverts = int(self.readgroup(90))
        plflag = int(self.readgroup(70))
        path = []
        self.black_boundarys.append(path)
        for i in range(0,numverts):
            x = float(self.readgroup(10))
            y = float(self.readgroup(20))
            if self.metricflag == 0:
                x = x*25.4
                y = y*25.4
            path.append([x,y])
        if plflag == 1:
            path.append(path[0])

    def do_polyline(self):
        self.polyline_flag = int(self.readgroup(70))
        self.polyline_path = []
        self.next_bulge = 0
        self.LastPos = None

    def do_polyline_vertex(self):
        x = float(self.readgroup(10))
        y = float(self.readgroup(20))
        if self.metricflag == 0:
          x = x*25.4
          y = y*25.4
        b = self.readgroup(42)
        if b == None:
          b = 0
        self.blockindex = 0
        f = self.readgroup(70)
        if f == None:
          f = 0
        if f != 16:
          if self.next_bulge == 0:
            self.polyline_path.append([x,y])
          else:
            self.bulge2arc(self.polyline_path, self.lastPos, [x,y], self.next_bulge)
        self.next_bulge = b
        self.lastPos = [x,y]

    def do_polyline_seqend(self):
        if self.polyline_flag == 1:
          if self.next_bulge == 0:
            self.polyline_path.append(self.polyline_path[0])
          else:
            self.bulge2arc(self.polyline_path, self.lastPos, self.polyline_path[0], self.next_bulge)
        self.black_boundarys.append(self.polyline_path)

    def bulge2arc(self, path, ps, pe, bulge):
        c = (1 / bulge - bulge) / 2
        if bulge > 0:
          ps, pe = (pe, ps)
        O = Point((ps[0] + pe[0] - (pe[1] - ps[1]) * c) / 2,
                  (ps[1] + pe[1] + (pe[0] - ps[0]) * c) / 2)
        s_ang = O.norm_angle(Point(ps[0], ps[1]))
        e_ang = O.norm_angle(Point(pe[0], pe[1]))
        r = O.distance(Point(ps[0], ps[1]))
        sweep = int((((e_ang - s_ang) % (-2 * pi)) + 2 * pi) > 0)
        addArc(path, ps[0], ps[1], r, r, 0, 0, sweep, pe[0], pe[1])

    def do_spline(self):
        spline_flag = int(self.readgroup(70))
        degree = int(self.readgroup(71))
        nknots = int(self.readgroup(72)) # 29
        ncpts = int(self.readgroup(73)) # 25
        knots= []
        for i in range(0,nknots):
          sk = float(self.readgroup(40))
          knots.append(sk)
        weights = []
        for i in range(0,nknots):
          sg = self.readgroup(41)
          if sg == None:
            break
          weights.append(float(sg))
        self.blockindex = 0
        cpoints = []
        for i in range(0,ncpts):
          x = float(self.readgroup(10))
          y = float(self.readgroup(20))
          if self.metricflag == 0:
            x = x*25.4
            y = y*25.4
          cpoints.append(Point(x,y))
        if len(weights) == 0:
          for nr in range(len(cpoints)):
            weights.append(1)
        
        spline = Spline2Arcs(degree, knots, \
                                     weights, cpoints, self.tolerance, 1)
        geos = spline.Curve

        path = []
        self.black_boundarys.append(path)
        lastPos = None
        for geo in geos:
          if lastPos == None:
            path.append([geo.Ps.x, geo.Ps.y])
          if isinstance(geo, LineGeo):
            path.append([geo.Pe.x, geo.Pe.y])
          if isinstance(geo, ArcGeo):
            large_arc = int(math.fabs(geo.e_ang - geo.s_ang) >= 2 * math.pi)
            sweep = int(geo.ext > 0)
            self.addArc(path, geo.Ps.x, geo.Ps.y, geo.r, geo.r, 0, large_arc , sweep, geo.Pe.x, geo.Pe.y)
          lastPos = geo.Pe

    def complain_invalid(self):
        print "Invalid element '" + self.cmd + "' on line", self.linecount
        print "Can't process this DXF file. Sorry!"
        raise ValueError

    def addArc(self, path, x1, y1, rx, ry, phi, large_arc, sweep, x2, y2):
        # Implemented based on the SVG implementation notes
        # plus some recursive sugar for incrementally refining the
        # arc resolution until the requested tolerance is met.
        # http://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
        cp = math.cos(phi)
        sp = math.sin(phi)
        dx = 0.5 * (x1 - x2)
        dy = 0.5 * (y1 - y2)
        x_ = cp * dx + sp * dy
        y_ = -sp * dx + cp * dy
        r2 = ((rx*ry)**2-(rx*y_)**2-(ry*x_)**2) / ((rx*y_)**2+(ry*x_)**2)
        if r2 < 0:
            r2 = 0
        r = math.sqrt(r2)
        if large_arc == sweep:
            r = -r
        cx_ = r*rx*y_ / ry
        cy_ = -r*ry*x_ / rx
        cx = cp*cx_ - sp*cy_ + 0.5*(x1 + x2)
        cy = sp*cx_ + cp*cy_ + 0.5*(y1 + y2)
        
        def _angle(u, v):
            a = math.acos((u[0]*v[0] + u[1]*v[1]) /
                            math.sqrt(((u[0])**2 + (u[1])**2) *
                            ((v[0])**2 + (v[1])**2)))
            sgn = -1
            if u[0]*v[1] > u[1]*v[0]:
                sgn = 1
            return sgn * a
    
        psi = _angle([1,0], [(x_-cx_)/rx, (y_-cy_)/ry])
        delta = _angle([(x_-cx_)/rx, (y_-cy_)/ry], [(-x_-cx_)/rx, (-y_-cy_)/ry])
        if sweep and delta < 0:
            delta += math.pi * 2
        if not sweep and delta > 0:
            delta -= math.pi * 2
        
        def _getVertex(pct):
            theta = psi + delta * pct
            ct = math.cos(theta)
            st = math.sin(theta)
            return [cp*rx*ct-sp*ry*st+cx, sp*rx*ct+cp*ry*st+cy]        
        
        # let the recursive fun begin
        def _recursiveArc(t1, t2, c1, c5, level, tolerance2):
            def _vertexDistanceSquared(v1, v2):
                return (v2[0]-v1[0])**2 + (v2[1]-v1[1])**2
            
            def _vertexMiddle(v1, v2):
                return [ (v2[0]+v1[0])/2.0, (v2[1]+v1[1])/2.0 ]

            if level > 18:
                # protect from deep recursion cases
                # max 2**18 = 262144 segments
                return

            tRange = t2-t1
            tHalf = t1 + 0.5*tRange
            c2 = _getVertex(t1 + 0.25*tRange)
            c3 = _getVertex(tHalf)
            c4 = _getVertex(t1 + 0.75*tRange)
            if _vertexDistanceSquared(c2, _vertexMiddle(c1,c3)) > tolerance2:
                _recursiveArc(t1, tHalf, c1, c3, level+1, tolerance2)
            path.append(c3)
            if _vertexDistanceSquared(c4, _vertexMiddle(c3,c5)) > tolerance2:
                _recursiveArc(tHalf, t2, c3, c5, level+1, tolerance2)
                
        t1Init = 0.0
        t2Init = 1.0
        c1Init = _getVertex(t1Init)
        c5Init = _getVertex(t2Init)
        path.append(c1Init)
        _recursiveArc(t1Init, t2Init, c1Init, c5Init, 0, self.tolerance2)
        path.append(c5Init)

