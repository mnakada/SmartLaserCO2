# -*- coding: utf-8 -*-

############################################################################
#
#   Copyright (C) 2008-2015
#    Christian Kohlöffel
#    Vinzenz Schulz
#    Jean-Paul Schouwstra
#
#   This file is part of DXF2GCODE.
#
#   DXF2GCODE is free software: you can redistribute it and/or modify
#   it under the terms of the GNU General Public License as published by
#   the Free Software Foundation, either version 3 of the License, or
#   (at your option) any later version.
#
#   DXF2GCODE is distributed in the hope that it will be useful,
#   but WITHOUT ANY WARRANTY; without even the implied warranty of
#   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#   GNU General Public License for more details.
#
#   You should have received a copy of the GNU General Public License
#   along with DXF2GCODE.  If not, see <http://www.gnu.org/licenses/>.
#
############################################################################

from __future__ import division

from math import sqrt, pi

from point import Point

eps = 1e-12

class LineGeo(object):

    """
    Standard Geometry Item used for DXF Import of all geometries, plotting and
    G-Code export.
    """

    def __init__(self, Ps, Pe):
        """
        Standard Method to initialize the LineGeo.
        @param Ps: The Start Point of the line
        @param Pe: the End Point of the line
        """

        self.Ps = Ps
        self.Pe = Pe
        self.length = self.Ps.distance(self.Pe)

    def __str__(self):
        """
        Standard method to print the object
        @return: A string
        """
        return ("\nLineGeo(Ps=Point(x=%s ,y=%s),\n" % (self.Ps.x, self.Ps.y)) + \
               ("Pe=Point(x=%s, y=%s))" % (self.Pe.x, self.Pe.y))

    def distance_l_p(self, Point):
        """
        Find the shortest distance between CCLineGeo and Point elements.
        Algorithm acc. to
        http://notejot.com/2008/09/distance-from-Point-to-line-segment-in-2d/
        http://softsurfer.com/Archive/algorithm_0106/algorithm_0106.htm
        @param Point: the Point
        @return: The shortest distance between the Point and Line
        """
        d = self.Pe - self.Ps
        v = Point - self.Ps

        t = d.dotProd(v)

        if t <= 0:
            # our Point is lying "behind" the segment
            # so end Point 1 is closest to Point and distance is length of
            # vector from end Point 1 to Point.
            return self.Ps.distance(Point)
        elif t >= d.dotProd(d):
            # our Point is lying "ahead" of the segment
            # so end Point 2 is closest to Point and distance is length of
            # vector from end Point 2 to Point.
            return self.Pe.distance(Point)
        else:
            # our Point is lying "inside" the segment
            # i.e.:a perpendicular from it to the line that contains the line
            if (v.dotProd(v) - (t * t) / d.dotProd(d)) < eps:
                return 0.0
            else:
                return sqrt(v.dotProd(v) - (t * t) / d.dotProd(d))

