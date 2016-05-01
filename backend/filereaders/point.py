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

from math import sqrt, sin, cos, atan2

import numbers

class Point(object):
    __slots__ = ["x", "y"]
    eps=1e-12

    def __init__(self, x=0, y=0):
        self.x = x
        self.y = y

    def __str__(self):
        return 'X ->%6.3f  Y ->%6.3f' % (self.x, self.y)
        # return ('CPoints.append(Point(x=%6.5f, y=%6.5f))' %(self.x,self.y))

    def __eq__(self, other):
        """
        Implementaion of is equal of two point, for all other instances it will
        return False
        @param other: The other point for the compare
        @return: True for the same points within tolerance
        """
        if isinstance(other, Point):
            return (-Point.eps < self.x - other.x < Point.eps) and (-Point.eps < self.y - other.y < Point.eps)
        else:
            return False

    def __ne__(self, other):
        """
        Implementation of not equal
        @param other:; The other point
        @return: negative cmp result.
        """
        return not self == other

    def __neg__(self):
        """
        Implemnetaion of Point negation
        @return: Returns a new Point which is negated
        """
        return -1.0 * self

    def __add__(self, other):  # add to another Point
        """
        Implemnetaion of Point addition
        @param other: The other Point which shall be added
        @return: Returns a new Point
        """
        return Point(self.x + other.x, self.y + other.y)

    def __radd__(self, other):
        """
        Implementation of the add for a real value
        @param other: The real value to be added
        @return: Return the new Point
        """
        return Point(self.x + other, self.y + other)

    def __lt__(self,other):
        """
        Implementaion of less then comparision
        @param other: The other point for the compare
        @return: 1 if self is bigger, -1 if smaller, 0 if the same
        """
        if self.x < other.x:
            return True
        elif self.x > other.x:
            return False
        elif self.x == other.x and self.y < other.y:
            return True
        elif self.x == other.x and self.y > other.y:
            return False
        else:
            return 0

    def __sub__(self, other):
        """
        Implemnetaion of Point subtraction
        @param other: The other Point which shall be subtracted
        @return: Returns a new Point
        """
        return self + -other

    def __rmul__(self, other):
        """
        Multiplication by a real value
        @param other: The real value to be multiplied by
        @return: The new poinnt
        """

        return Point(other * self.x, other * self.y)

    def __mul__(self, other):
        """
        The function which is called if the object is multiplied with another
        object. Dependent on the object type different operations are performed
        @param other: The element which is used for the multiplication
        @return: Returns the result dependent on object type
        """
        if isinstance(other, list):
            # Scale the points
            return Point(x=self.x * other[0], y=self.y * other[1])
        elif isinstance(other, numbers.Number):
            return Point(x=self.x * other, y=self.y * other)
        elif isinstance(other, Point):
            # Calculate Scalar (dot) Product
            return self.x * other.x + self.y * other.y
        else:
            print "Unsupported type: %s" % type(other)

    def __truediv__(self, other):
        return Point(x=self.x / other, y=self.y / other)

    def distance(self, other=None):
        """
        Returns distance between two given points
        @param other: the other geometry
        @return: the minimum distance between the the given geometries.
        """
        if other is None:
            other = Point(x=0.0, y=0.0)
        if not isinstance(other, Point):
            return other.distance(self)
        return (self - other).length()

    def dotProd(self, P2):
        """
        Returns the dotProduct of two points
        @param self: The first Point
        @param other: The 2nd Point
        @return: dot Product of the points.
        """
        return (self.x * P2.x) + (self.y * P2.y)

    def length(self):
        return sqrt(self.length_squared())

    def length_squared(self):
        return self.x**2 + self.y**2

    def norm_angle(self, other=None):
        """Returns angle between two given points"""
        if type(other) == type(None):
            other = Point(x=0.0, y=0.0)
        return atan2(other.y - self.y, other.x - self.x)

    def unit_vector(self, Pto=None, r=1):
        """
        Returns vector of length 1 with similar direction as input
        @param Pto: The other point
        @return: Returns the Unit vector
        """
        if Pto is None:
            return self / self.length()
        else:
            diffVec = Pto - self
            l = diffVec.distance()
            return Point(diffVec.x / l * r, diffVec.y / l * r)

    def within_tol(self, other, tol):
        """
        Are the two points within tolerance
        """
        # TODO is this sufficient, or do we want to compare the distance
        return abs(self.x - other.x) <= tol and abs(self.y - other.y) < tol

