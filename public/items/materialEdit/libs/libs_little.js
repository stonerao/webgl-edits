window.__libs_little = function(){
    (function (global, factory) {
        factory((global.geoEtds = {}));
    }(this, (function (exports) { 'use strict';

        var earcut_1 = earcut;
        var default_1 = earcut;

        function earcut(data, holeIndices, dim) {

            dim = dim || 2;

            var hasHoles = holeIndices && holeIndices.length,
                outerLen = hasHoles ? holeIndices[0] * dim : data.length,
                outerNode = linkedList(data, 0, outerLen, dim, true),
                triangles = [];

            if (!outerNode) return triangles;

            var minX, minY, maxX, maxY, x, y, invSize;

            if (hasHoles) outerNode = eliminateHoles(data, holeIndices, outerNode, dim);

            // if the shape is not too simple, we'll use z-order curve hash later; calculate polygon bbox
            if (data.length > 80 * dim) {
                minX = maxX = data[0];
                minY = maxY = data[1];

                for (var i = dim; i < outerLen; i += dim) {
                    x = data[i];
                    y = data[i + 1];
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }

                // minX, minY and invSize are later used to transform coords into integers for z-order calculation
                invSize = Math.max(maxX - minX, maxY - minY);
                invSize = invSize !== 0 ? 1 / invSize : 0;
            }

            earcutLinked(outerNode, triangles, dim, minX, minY, invSize);

            return triangles;
        }

        // create a circular doubly linked list from polygon points in the specified winding order
        function linkedList(data, start, end, dim, clockwise) {
            var i, last;

            if (clockwise === (signedArea(data, start, end, dim) > 0)) {
                for (i = start; i < end; i += dim) last = insertNode(i, data[i], data[i + 1], last);
            } else {
                for (i = end - dim; i >= start; i -= dim) last = insertNode(i, data[i], data[i + 1], last);
            }

            if (last && equals(last, last.next)) {
                removeNode(last);
                last = last.next;
            }

            return last;
        }

        // eliminate colinear or duplicate points
        function filterPoints(start, end) {
            if (!start) return start;
            if (!end) end = start;

            var p = start,
                again;
            do {
                again = false;

                if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
                    removeNode(p);
                    p = end = p.prev;
                    if (p === p.next) break;
                    again = true;

                } else {
                    p = p.next;
                }
            } while (again || p !== end);

            return end;
        }

        // main ear slicing loop which triangulates a polygon (given as a linked list)
        function earcutLinked(ear, triangles, dim, minX, minY, invSize, pass) {
            if (!ear) return;

            // interlink polygon nodes in z-order
            if (!pass && invSize) indexCurve(ear, minX, minY, invSize);

            var stop = ear,
                prev, next;

            // iterate through ears, slicing them one by one
            while (ear.prev !== ear.next) {
                prev = ear.prev;
                next = ear.next;

                if (invSize ? isEarHashed(ear, minX, minY, invSize) : isEar(ear)) {
                    // cut off the triangle
                    triangles.push(prev.i / dim);
                    triangles.push(ear.i / dim);
                    triangles.push(next.i / dim);

                    removeNode(ear);

                    // skipping the next vertice leads to less sliver triangles
                    ear = next.next;
                    stop = next.next;

                    continue;
                }

                ear = next;

                // if we looped through the whole remaining polygon and can't find any more ears
                if (ear === stop) {
                    // try filtering points and slicing again
                    if (!pass) {
                        earcutLinked(filterPoints(ear), triangles, dim, minX, minY, invSize, 1);

                    // if this didn't work, try curing all small self-intersections locally
                    } else if (pass === 1) {
                        ear = cureLocalIntersections(ear, triangles, dim);
                        earcutLinked(ear, triangles, dim, minX, minY, invSize, 2);

                    // as a last resort, try splitting the remaining polygon into two
                    } else if (pass === 2) {
                        splitEarcut(ear, triangles, dim, minX, minY, invSize);
                    }

                    break;
                }
            }
        }

        // check whether a polygon node forms a valid ear with adjacent nodes
        function isEar(ear) {
            var a = ear.prev,
                b = ear,
                c = ear.next;

            if (area(a, b, c) >= 0) return false; // reflex, can't be an ear

            // now make sure we don't have other points inside the potential ear
            var p = ear.next.next;

            while (p !== ear.prev) {
                if (pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
                    area(p.prev, p, p.next) >= 0) return false;
                p = p.next;
            }

            return true;
        }

        function isEarHashed(ear, minX, minY, invSize) {
            var a = ear.prev,
                b = ear,
                c = ear.next;

            if (area(a, b, c) >= 0) return false; // reflex, can't be an ear

            // triangle bbox; min & max are calculated like this for speed
            var minTX = a.x < b.x ? (a.x < c.x ? a.x : c.x) : (b.x < c.x ? b.x : c.x),
                minTY = a.y < b.y ? (a.y < c.y ? a.y : c.y) : (b.y < c.y ? b.y : c.y),
                maxTX = a.x > b.x ? (a.x > c.x ? a.x : c.x) : (b.x > c.x ? b.x : c.x),
                maxTY = a.y > b.y ? (a.y > c.y ? a.y : c.y) : (b.y > c.y ? b.y : c.y);

            // z-order range for the current triangle bbox;
            var minZ = zOrder(minTX, minTY, minX, minY, invSize),
                maxZ = zOrder(maxTX, maxTY, minX, minY, invSize);

            var p = ear.prevZ,
                n = ear.nextZ;

            // look for points inside the triangle in both directions
            while (p && p.z >= minZ && n && n.z <= maxZ) {
                if (p !== ear.prev && p !== ear.next &&
                    pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
                    area(p.prev, p, p.next) >= 0) return false;
                p = p.prevZ;

                if (n !== ear.prev && n !== ear.next &&
                    pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, n.x, n.y) &&
                    area(n.prev, n, n.next) >= 0) return false;
                n = n.nextZ;
            }

            // look for remaining points in decreasing z-order
            while (p && p.z >= minZ) {
                if (p !== ear.prev && p !== ear.next &&
                    pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
                    area(p.prev, p, p.next) >= 0) return false;
                p = p.prevZ;
            }

            // look for remaining points in increasing z-order
            while (n && n.z <= maxZ) {
                if (n !== ear.prev && n !== ear.next &&
                    pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, n.x, n.y) &&
                    area(n.prev, n, n.next) >= 0) return false;
                n = n.nextZ;
            }

            return true;
        }

        // go through all polygon nodes and cure small local self-intersections
        function cureLocalIntersections(start, triangles, dim) {
            var p = start;
            do {
                var a = p.prev,
                    b = p.next.next;

                if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {

                    triangles.push(a.i / dim);
                    triangles.push(p.i / dim);
                    triangles.push(b.i / dim);

                    // remove two nodes involved
                    removeNode(p);
                    removeNode(p.next);

                    p = start = b;
                }
                p = p.next;
            } while (p !== start);

            return p;
        }

        // try splitting polygon into two and triangulate them independently
        function splitEarcut(start, triangles, dim, minX, minY, invSize) {
            // look for a valid diagonal that divides the polygon into two
            var a = start;
            do {
                var b = a.next.next;
                while (b !== a.prev) {
                    if (a.i !== b.i && isValidDiagonal(a, b)) {
                        // split the polygon in two by the diagonal
                        var c = splitPolygon(a, b);

                        // filter colinear points around the cuts
                        a = filterPoints(a, a.next);
                        c = filterPoints(c, c.next);

                        // run earcut on each half
                        earcutLinked(a, triangles, dim, minX, minY, invSize);
                        earcutLinked(c, triangles, dim, minX, minY, invSize);
                        return;
                    }
                    b = b.next;
                }
                a = a.next;
            } while (a !== start);
        }

        // link every hole into the outer loop, producing a single-ring polygon without holes
        function eliminateHoles(data, holeIndices, outerNode, dim) {
            var queue = [],
                i, len, start, end, list;

            for (i = 0, len = holeIndices.length; i < len; i++) {
                start = holeIndices[i] * dim;
                end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
                list = linkedList(data, start, end, dim, false);
                if (list === list.next) list.steiner = true;
                queue.push(getLeftmost(list));
            }

            queue.sort(compareX);

            // process holes from left to right
            for (i = 0; i < queue.length; i++) {
                eliminateHole(queue[i], outerNode);
                outerNode = filterPoints(outerNode, outerNode.next);
            }

            return outerNode;
        }

        function compareX(a, b) {
            return a.x - b.x;
        }

        // find a bridge between vertices that connects hole with an outer ring and and link it
        function eliminateHole(hole, outerNode) {
            outerNode = findHoleBridge(hole, outerNode);
            if (outerNode) {
                var b = splitPolygon(outerNode, hole);
                filterPoints(b, b.next);
            }
        }

        // David Eberly's algorithm for finding a bridge between hole and outer polygon
        function findHoleBridge(hole, outerNode) {
            var p = outerNode,
                hx = hole.x,
                hy = hole.y,
                qx = -Infinity,
                m;

            // find a segment intersected by a ray from the hole's leftmost point to the left;
            // segment's endpoint with lesser x will be potential connection point
            do {
                if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
                    var x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
                    if (x <= hx && x > qx) {
                        qx = x;
                        if (x === hx) {
                            if (hy === p.y) return p;
                            if (hy === p.next.y) return p.next;
                        }
                        m = p.x < p.next.x ? p : p.next;
                    }
                }
                p = p.next;
            } while (p !== outerNode);

            if (!m) return null;

            if (hx === qx) return m.prev; // hole touches outer segment; pick lower endpoint

            // look for points inside the triangle of hole point, segment intersection and endpoint;
            // if there are no points found, we have a valid connection;
            // otherwise choose the point of the minimum angle with the ray as connection point

            var stop = m,
                mx = m.x,
                my = m.y,
                tanMin = Infinity,
                tan;

            p = m.next;

            while (p !== stop) {
                if (hx >= p.x && p.x >= mx && hx !== p.x &&
                        pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {

                    tan = Math.abs(hy - p.y) / (hx - p.x); // tangential

                    if ((tan < tanMin || (tan === tanMin && p.x > m.x)) && locallyInside(p, hole)) {
                        m = p;
                        tanMin = tan;
                    }
                }

                p = p.next;
            }

            return m;
        }

        // interlink polygon nodes in z-order
        function indexCurve(start, minX, minY, invSize) {
            var p = start;
            do {
                if (p.z === null) p.z = zOrder(p.x, p.y, minX, minY, invSize);
                p.prevZ = p.prev;
                p.nextZ = p.next;
                p = p.next;
            } while (p !== start);

            p.prevZ.nextZ = null;
            p.prevZ = null;

            sortLinked(p);
        }

        // Simon Tatham's linked list merge sort algorithm
        // http://www.chiark.greenend.org.uk/~sgtatham/algorithms/listsort.html
        function sortLinked(list) {
            var i, p, q, e, tail, numMerges, pSize, qSize,
                inSize = 1;

            do {
                p = list;
                list = null;
                tail = null;
                numMerges = 0;

                while (p) {
                    numMerges++;
                    q = p;
                    pSize = 0;
                    for (i = 0; i < inSize; i++) {
                        pSize++;
                        q = q.nextZ;
                        if (!q) break;
                    }
                    qSize = inSize;

                    while (pSize > 0 || (qSize > 0 && q)) {

                        if (pSize !== 0 && (qSize === 0 || !q || p.z <= q.z)) {
                            e = p;
                            p = p.nextZ;
                            pSize--;
                        } else {
                            e = q;
                            q = q.nextZ;
                            qSize--;
                        }

                        if (tail) tail.nextZ = e;
                        else list = e;

                        e.prevZ = tail;
                        tail = e;
                    }

                    p = q;
                }

                tail.nextZ = null;
                inSize *= 2;

            } while (numMerges > 1);

            return list;
        }

        // z-order of a point given coords and inverse of the longer side of data bbox
        function zOrder(x, y, minX, minY, invSize) {
            // coords are transformed into non-negative 15-bit integer range
            x = 32767 * (x - minX) * invSize;
            y = 32767 * (y - minY) * invSize;

            x = (x | (x << 8)) & 0x00FF00FF;
            x = (x | (x << 4)) & 0x0F0F0F0F;
            x = (x | (x << 2)) & 0x33333333;
            x = (x | (x << 1)) & 0x55555555;

            y = (y | (y << 8)) & 0x00FF00FF;
            y = (y | (y << 4)) & 0x0F0F0F0F;
            y = (y | (y << 2)) & 0x33333333;
            y = (y | (y << 1)) & 0x55555555;

            return x | (y << 1);
        }

        // find the leftmost node of a polygon ring
        function getLeftmost(start) {
            var p = start,
                leftmost = start;
            do {
                if (p.x < leftmost.x) leftmost = p;
                p = p.next;
            } while (p !== start);

            return leftmost;
        }

        // check if a point lies within a convex triangle
        function pointInTriangle(ax, ay, bx, by, cx, cy, px, py) {
            return (cx - px) * (ay - py) - (ax - px) * (cy - py) >= 0 &&
                   (ax - px) * (by - py) - (bx - px) * (ay - py) >= 0 &&
                   (bx - px) * (cy - py) - (cx - px) * (by - py) >= 0;
        }

        // check if a diagonal between two polygon nodes is valid (lies in polygon interior)
        function isValidDiagonal(a, b) {
            return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b) &&
                   locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b);
        }

        // signed area of a triangle
        function area(p, q, r) {
            return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
        }

        // check if two points are equal
        function equals(p1, p2) {
            return p1.x === p2.x && p1.y === p2.y;
        }

        // check if two segments intersect
        function intersects(p1, q1, p2, q2) {
            if ((equals(p1, q1) && equals(p2, q2)) ||
                (equals(p1, q2) && equals(p2, q1))) return true;
            return area(p1, q1, p2) > 0 !== area(p1, q1, q2) > 0 &&
                   area(p2, q2, p1) > 0 !== area(p2, q2, q1) > 0;
        }

        // check if a polygon diagonal intersects any polygon segments
        function intersectsPolygon(a, b) {
            var p = a;
            do {
                if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i &&
                        intersects(p, p.next, a, b)) return true;
                p = p.next;
            } while (p !== a);

            return false;
        }

        // check if a polygon diagonal is locally inside the polygon
        function locallyInside(a, b) {
            return area(a.prev, a, a.next) < 0 ?
                area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 :
                area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
        }

        // check if the middle point of a polygon diagonal is inside the polygon
        function middleInside(a, b) {
            var p = a,
                inside = false,
                px = (a.x + b.x) / 2,
                py = (a.y + b.y) / 2;
            do {
                if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y &&
                        (px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x))
                    inside = !inside;
                p = p.next;
            } while (p !== a);

            return inside;
        }

        // link two polygon vertices with a bridge; if the vertices belong to the same ring, it splits polygon into two;
        // if one belongs to the outer ring and another to a hole, it merges it into a single ring
        function splitPolygon(a, b) {
            var a2 = new Node(a.i, a.x, a.y),
                b2 = new Node(b.i, b.x, b.y),
                an = a.next,
                bp = b.prev;

            a.next = b;
            b.prev = a;

            a2.next = an;
            an.prev = a2;

            b2.next = a2;
            a2.prev = b2;

            bp.next = b2;
            b2.prev = bp;

            return b2;
        }

        // create a node and optionally link it with previous one (in a circular doubly linked list)
        function insertNode(i, x, y, last) {
            var p = new Node(i, x, y);

            if (!last) {
                p.prev = p;
                p.next = p;

            } else {
                p.next = last.next;
                p.prev = last;
                last.next.prev = p;
                last.next = p;
            }
            return p;
        }

        function removeNode(p) {
            p.next.prev = p.prev;
            p.prev.next = p.next;

            if (p.prevZ) p.prevZ.nextZ = p.nextZ;
            if (p.nextZ) p.nextZ.prevZ = p.prevZ;
        }

        function Node(i, x, y) {
            // vertice index in coordinates array
            this.i = i;

            // vertex coordinates
            this.x = x;
            this.y = y;

            // previous and next vertice nodes in a polygon ring
            this.prev = null;
            this.next = null;

            // z-order curve value
            this.z = null;

            // previous and next nodes in z-order
            this.prevZ = null;
            this.nextZ = null;

            // indicates whether this is a steiner point
            this.steiner = false;
        }

        // return a percentage difference between the polygon area and its triangulation area;
        // used to verify correctness of triangulation
        earcut.deviation = function (data, holeIndices, dim, triangles) {
            var hasHoles = holeIndices && holeIndices.length;
            var outerLen = hasHoles ? holeIndices[0] * dim : data.length;

            var polygonArea = Math.abs(signedArea(data, 0, outerLen, dim));
            if (hasHoles) {
                for (var i = 0, len = holeIndices.length; i < len; i++) {
                    var start = holeIndices[i] * dim;
                    var end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
                    polygonArea -= Math.abs(signedArea(data, start, end, dim));
                }
            }

            var trianglesArea = 0;
            for (i = 0; i < triangles.length; i += 3) {
                var a = triangles[i] * dim;
                var b = triangles[i + 1] * dim;
                var c = triangles[i + 2] * dim;
                trianglesArea += Math.abs(
                    (data[a] - data[c]) * (data[b + 1] - data[a + 1]) -
                    (data[a] - data[b]) * (data[c + 1] - data[a + 1]));
            }

            return polygonArea === 0 && trianglesArea === 0 ? 0 :
                Math.abs((trianglesArea - polygonArea) / polygonArea);
        };

        function signedArea(data, start, end, dim) {
            var sum = 0;
            for (var i = start, j = end - dim; i < end; i += dim) {
                sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
                j = i;
            }
            return sum;
        }

        // turn a polygon in a multi-dimensional array form (e.g. as in GeoJSON) into a form Earcut accepts
        earcut.flatten = function (data) {
            var dim = data[0][0].length,
                result = {vertices: [], holes: [], dimensions: dim},
                holeIndex = 0;

            for (var i = 0; i < data.length; i++) {
                for (var j = 0; j < data[i].length; j++) {
                    for (var d = 0; d < dim; d++) result.vertices.push(data[i][j][d]);
                }
                if (i > 0) {
                    holeIndex += data[i - 1].length;
                    result.holes.push(holeIndex);
                }
            }
            return result;
        };

        earcut_1.default = default_1;

        /*
         (c) 2017, Vladimir Agafonkin
         Simplify.js, a high-performance JS polyline simplification library
         mourner.github.io/simplify-js
        */

        // to suit your point format, run search/replace for '.x' and '.y';
        // for 3D version, see 3d branch (configurability would draw significant performance overhead)

        // square distance between 2 points
        function getSqDist(p1, p2) {

            var dx = p1[0] - p2[0],
                dy = p1[1] - p2[1];

            return dx * dx + dy * dy;
        }

        // square distance from a point to a segment
        function getSqSegDist(p, p1, p2) {

            var x = p1[0],
                y = p1[1],
                dx = p2[0] - x,
                dy = p2[1] - y;

            if (dx !== 0 || dy !== 0) {

                var t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);

                if (t > 1) {
                    x = p2[0];
                    y = p2[1];

                } else if (t > 0) {
                    x += dx * t;
                    y += dy * t;
                }
            }

            dx = p[0] - x;
            dy = p[1] - y;

            return dx * dx + dy * dy;
        }
        // rest of the code doesn't care about point format

        // basic distance-based simplification
        function simplifyRadialDist(points, sqTolerance) {

            var prevPoint = points[0],
                newPoints = [prevPoint],
                point;

            for (var i = 1, len = points.length; i < len; i++) {
                point = points[i];

                if (getSqDist(point, prevPoint) > sqTolerance) {
                    newPoints.push(point);
                    prevPoint = point;
                }
            }

            if (prevPoint !== point) newPoints.push(point);

            return newPoints;
        }

        function simplifyDPStep(points, first, last, sqTolerance, simplified) {
            var maxSqDist = sqTolerance,
                index;

            for (var i = first + 1; i < last; i++) {
                var sqDist = getSqSegDist(points[i], points[first], points[last]);

                if (sqDist > maxSqDist) {
                    index = i;
                    maxSqDist = sqDist;
                }
            }

            if (maxSqDist > sqTolerance) {
                if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
                simplified.push(points[index]);
                if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
            }
        }

        // simplification using Ramer-Douglas-Peucker algorithm
        function simplifyDouglasPeucker(points, sqTolerance) {
            var last = points.length - 1;

            var simplified = [points[0]];
            simplifyDPStep(points, 0, last, sqTolerance, simplified);
            simplified.push(points[last]);

            return simplified;
        }

        // both algorithms combined for awesome performance
        function simplify(points, tolerance, highestQuality) {

            if (points.length <= 2) return points;

            var sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

            points = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
            points = simplifyDouglasPeucker(points, sqTolerance);

            return points;
        }

        function dot(v1, v2) {
            return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
        }
        function v2Dot(v1, v2) {
            return v1[0] * v2[0] + v1[1] * v2[1];
        }

        function normalize(out, v) {
            const x = v[0];
            const y = v[1];
            const z = v[2];
            const d = Math.sqrt(x * x + y * y + z * z);
            out[0] = x / d;
            out[1] = y / d;
            out[2] = z / d;
            return out;
        }

        function v2Normalize(out, v) {
            const x = v[0];
            const y = v[1];
            const d = Math.sqrt(x * x + y * y);
            out[0] = x / d;
            out[1] = y / d;
            return out;
        }

        function scale(out, v, s) {
            out[0] = v[0] * s;
            out[1] = v[1] * s;
            out[2] = v[2] * s;
            return out;
        }



        function scaleAndAdd(out, v1, v2, s) {
            out[0] = v1[0] + v2[0] * s;
            out[1] = v1[1] + v2[1] * s;
            out[2] = v1[2] + v2[2] * s;
            return out;
        }



        function v2Add(out, v1, v2) {
            out[0] = v1[0] + v2[0];
            out[1] = v1[1] + v2[1];
            return out;
        }





        function v3Sub(out, v1, v2) {
            out[0] = v1[0] - v2[0];
            out[1] = v1[1] - v2[1];
            out[2] = v1[2] - v2[2];
            return out;
        }

        function v3Normalize(out, v) {
            const x = v[0];
            const y = v[1];
            const z = v[2];
            const d = Math.sqrt(x * x + y * y + z * z);
            out[0] = x / d;
            out[1] = y / d;
            out[2] = z / d;
            return out;
        }

        function v3Cross(out, v1, v2) {
            var ax = v1[0], ay = v1[1], az = v1[2],
                bx = v2[0], by = v2[1], bz = v2[2];

            out[0] = ay * bz - az * by;
            out[1] = az * bx - ax * bz;
            out[2] = ax * by - ay * bx;
            return out;
        }

        const rel = [];
        // start and end must be normalized
        function slerp(out, start, end, t) {
            // https://keithmaggio.wordpress.com/2011/02/15/math-magician-lerp-slerp-and-nlerp/
            const cosT = dot(start, end);
            const theta = Math.acos(cosT) * t;

            scaleAndAdd(rel, end, start, -cosT);
            normalize(rel, rel);// start and rel Orthonormal basis

            scale(out, start, Math.cos(theta));
            scaleAndAdd(out, out, rel, Math.sin(theta));

            return out;
        }



        function area$1(points, start, end) {
            // Signed polygon area
            const n = end - start;
            if (n < 3) {
                return 0;
            }
            let area = 0;
            for (let i = (end - 1) * 2, j = start * 2; j < end * 2;) {
                const x0 = points[i];
                const y0 = points[i + 1];
                const x1 = points[j];
                const y1 = points[j + 1];
                i = j;
                j += 2;
                area += x0 * y1 - x1 * y0;
            }

            return area;
        }

        // TODO fitRect x, y are negative?
        // TODO Dimensions
        // TODO bevel="top"|"bottom"

        function triangulate(vertices, holes, dimensions=2) {
            return earcut_1(vertices, holes, dimensions);
        }

        function flatten(data) {
            return earcut_1.flatten(data);
        }

        const v1 = [];
        const v2 = [];
        const v = [];

        function innerOffsetPolygon(
            vertices, out, start, end, outStart, offset, miterLimit, close
        ) {
            const checkMiterLimit = miterLimit != null;
            let outOff = outStart;
            let indicesMap = null;
            if (checkMiterLimit) {
                indicesMap = new Uint32Array(end - start);
            }
            for (let i = start; i < end; i++) {
                const nextIdx = i === end - 1 ? start : i + 1;
                const prevIdx = i === start ? end - 1 : i - 1;
                const x1 = vertices[prevIdx * 2];
                const y1 = vertices[prevIdx * 2 + 1];
                const x2 = vertices[i * 2];
                const y2 = vertices[i * 2 + 1];
                const x3 = vertices[nextIdx * 2];
                const y3 = vertices[nextIdx * 2 + 1];

                v1[0] = x2 - x1;
                v1[1] = y2 - y1;
                v2[0] = x3 - x2;
                v2[1] = y3 - y2;

                v2Normalize(v1, v1);
                v2Normalize(v2, v2);

                checkMiterLimit && (indicesMap[i] = outOff);
                if (!close && i === start) {
                    v[0] = v2[1];
                    v[1] = -v2[0];
                    v2Normalize(v, v);
                    out[outOff * 2] = x2 + v[0] * offset;
                    out[outOff * 2 + 1] = y2 + v[1] * offset;
                    outOff++;
                }
                else if (!close && i === end - 1) {
                    v[0] = v1[1];
                    v[1] = -v1[0];
                    v2Normalize(v, v);
                    out[outOff * 2] = x2 + v[0] * offset;
                    out[outOff * 2 + 1] = y2 + v[1] * offset;
                    outOff++;
                }
                else {
                    // PENDING Why using sub will lost the direction info.
                    v2Add(v, v2, v1);
                    const tmp = v[1];
                    v[1] = -v[0];
                    v[0] = tmp;

                    v2Normalize(v, v);

                    const cosA = v2Dot(v, v2);
                    const sinA = Math.sqrt(1 - cosA * cosA);
                    // PENDING
                    const miter = offset * Math.min(10, 1 / sinA);

                    const isCovex = offset * cosA < 0;

                    if (checkMiterLimit && (1 / sinA) > miterLimit && isCovex) {
                        const mx = x2 + v[0] * offset;
                        const my = y2 + v[1] * offset;
                        const halfA = Math.acos(sinA) / 2;
                        const dist = Math.tan(halfA) * Math.abs(offset);
                        out[outOff * 2] = mx + v[1] * dist;
                        out[outOff * 2 + 1] = my - v[0] * dist;
                        outOff++;
                        out[outOff * 2] = mx - v[1] * dist;
                        out[outOff * 2 + 1] = my + v[0] * dist;
                        outOff++;
                    }
                    else {
                        out[outOff * 2] = x2 + v[0] * miter;
                        out[outOff * 2 + 1] = y2 + v[1] * miter;
                        outOff++;
                    }
                }
            }

            return indicesMap;
        }

        function offsetPolygon(vertices, holes, offset, miterLimit, close) {
            const offsetVertices = miterLimit != null ? [] : new Float32Array(vertices.length);
            const exteriorSize = (holes && holes.length) ? holes[0] : vertices.length / 2;

            innerOffsetPolygon(
                vertices, offsetVertices, 0, exteriorSize, 0, offset, miterLimit, close, false
            );

            if (holes) {
                for (let i = 0; i < holes.length; i++) {
                    const start = holes[i];
                    const end = holes[i + 1] || vertices.length / 2;
                    innerOffsetPolygon(
                        vertices, offsetVertices, start, end,
                        miterLimit != null ? offsetVertices.length / 2 : start,
                        offset, miterLimit, close
                    );
                }
            }

            return offsetVertices;
        }

        function innerOffsetPolygon2(
            vertices, out, start, end, outStart, offset, miterLimit, close
        ) {
            const checkMiterLimit = miterLimit != null;
            let outOff = outStart;
            let indicesMap = null;
            if (checkMiterLimit) {
                indicesMap = new Uint32Array(end - start);
            }
            for (let i = start; i < end; i++) {
                const nextIdx = i === end - 1 ? start : i + 1;
                const prevIdx = i === start ? end - 1 : i - 1;
                const x1 = vertices[prevIdx * 2];
                const y1 = vertices[prevIdx * 2 + 1];
                const x2 = vertices[i * 2];
                const y2 = vertices[i * 2 + 1];
                const x3 = vertices[nextIdx * 2];
                const y3 = vertices[nextIdx * 2 + 1];

                v1[0] = x2 - x1;
                v1[1] = y2 - y1;
                v2[0] = x3 - x2;
                v2[1] = y3 - y2;

                v2Normalize(v1, v1);
                v2Normalize(v2, v2);

                checkMiterLimit && (indicesMap[i] = outOff);
                if (!close && i === start) {
                    v[0] = v2[1];
                    v[1] = -v2[0];
                    v2Normalize(v, v);
                    out[outOff * 2] = v[0] * offset;
                    out[outOff * 2 + 1] = v[1] * offset;
                    outOff++;
                }
                else if (!close && i === end - 1) {
                    v[0] = v1[1];
                    v[1] = -v1[0];
                    v2Normalize(v, v);
                    out[outOff * 2] = v[0] * offset;
                    out[outOff * 2 + 1] = v[1] * offset;
                    outOff++;
                }
                else {
                    // PENDING Why using sub will lost the direction info.
                    v2Add(v, v2, v1);
                    const tmp = v[1];
                    v[1] = -v[0];
                    v[0] = tmp;

                    v2Normalize(v, v);

                    const cosA = v2Dot(v, v2);
                    const sinA = Math.sqrt(1 - cosA * cosA);
                    // PENDING
                    const miter = offset * Math.min(10, 1 / sinA);

                    const isCovex = offset * cosA < 0;

                    if (checkMiterLimit && (1 / sinA) > miterLimit && isCovex) {
                        const mx = x2 + v[0] * offset;
                        const my = y2 + v[1] * offset;
                        const halfA = Math.acos(sinA) / 2;
                        const dist = Math.tan(halfA) * Math.abs(offset);
                        out[outOff * 2] = mx + v[1] * dist;
                        out[outOff * 2 + 1] = my - v[0] * dist;
                        outOff++;
                        out[outOff * 2] = mx - v[1] * dist;
                        out[outOff * 2 + 1] = my + v[0] * dist;
                        outOff++;
                    }
                    else {
                        out[outOff * 2] = v[0] * miter;
                        out[outOff * 2 + 1] = v[1] * miter;
                        outOff++;
                    }
                }
            }

            return indicesMap;
        }

        function offsetPolygon2(vertices, holes, close) {
            const miterLimit = null;
            const offsetVertices = [];
            const exteriorSize = (holes && holes.length) ? holes[0] : vertices.length / 2;

            innerOffsetPolygon2(
                vertices, offsetVertices, 0, exteriorSize, 0, 1, miterLimit, close, false
            );

            if (holes) {
                for (let i = 0; i < holes.length; i++) {
                    const start = holes[i];
                    const end = holes[i + 1] || vertices.length / 2;
                    innerOffsetPolygon2(
                        vertices, offsetVertices, start, end,
                        miterLimit != null ? offsetVertices.length / 2 : start,
                        1, miterLimit, close
                    );
                }
            }

            return offsetVertices;
        }

        exports.flatten = flatten;
        exports.triangulate = triangulate;
        exports.offsetPolygon2 = offsetPolygon2;

        exports.offsetPolygon = offsetPolygon;

    })));

    /**
     * Tween.js - Licensed under the MIT license
     * https://github.com/tweenjs/tween.js
     * ----------------------------------------------
     *
     * See https://github.com/tweenjs/tween.js/graphs/contributors for the full list of contributors.
     * Thank you all, you're awesome!
     */

    var TWEEN = TWEEN || (function () {

        var _tweens = [];

        return {

            getAll: function () {

                return _tweens;

            },

            removeAll: function () {

                _tweens = [];

            },

            add: function (tween) {

                _tweens.push(tween);

            },

            remove: function (tween) {

                var i = _tweens.indexOf(tween);

                if (i !== -1) {
                    _tweens.splice(i, 1);
                }

            },

            update: function (time, preserve) {

                if (_tweens.length === 0) {
                    return false;
                }

                var i = 0;

                time = time !== undefined ? time : TWEEN.now();

                while (i < _tweens.length) {

                    if (_tweens[i].update(time) || preserve) {
                        i++;
                    } else {
                        _tweens.splice(i, 1);
                    }

                }

                return true;

            }
        };

    })();


    // Include a performance.now polyfill.
    // In node.js, use process.hrtime.
    if (typeof (window) === 'undefined' && typeof (process) !== 'undefined') {
        TWEEN.now = function () {
            var time = process.hrtime();

            // Convert [seconds, nanoseconds] to milliseconds.
            return time[0] * 1000 + time[1] / 1000000;
        };
    }
    // In a browser, use window.performance.now if it is available.
    else if (typeof (window) !== 'undefined' &&
             window.performance !== undefined &&
             window.performance.now !== undefined) {
        // This must be bound, because directly assigning this function
        // leads to an invocation exception in Chrome.
        TWEEN.now = window.performance.now.bind(window.performance);
    }
    // Use Date.now if it is available.
    else if (Date.now !== undefined) {
        TWEEN.now = Date.now;
    }
    // Otherwise, use 'new Date().getTime()'.
    else {
        TWEEN.now = function () {
            return new Date().getTime();
        };
    }


    TWEEN.Tween = function (object) {

        var _object = object;
        var _valuesStart = {};
        var _valuesEnd = {};
        var _valuesStartRepeat = {};
        var _duration = 1000;
        var _repeat = 0;
        var _repeatDelayTime;
        var _yoyo = false;
        var _isPlaying = false;
        var _reversed = false;
        var _delayTime = 0;
        var _startTime = null;
        var _easingFunction = TWEEN.Easing.Linear.None;
        var _interpolationFunction = TWEEN.Interpolation.Linear;
        var _chainedTweens = [];
        var _onStartCallback = null;
        var _onStartCallbackFired = false;
        var _onUpdateCallback = null;
        var _onCompleteCallback = null;
        var _onStopCallback = null;

        this.to = function (properties, duration) {

            _valuesEnd = properties;

            if (duration !== undefined) {
                _duration = duration;
            }

            return this;

        };

        this.start = function (time) {

            TWEEN.add(this);

            _isPlaying = true;

            _onStartCallbackFired = false;

            _startTime = time !== undefined ? time : TWEEN.now();
            _startTime += _delayTime;

            for (var property in _valuesEnd) {

                // Check if an Array was provided as property value
                if (_valuesEnd[property] instanceof Array) {

                    if (_valuesEnd[property].length === 0) {
                        continue;
                    }

                    // Create a local copy of the Array with the start value at the front
                    _valuesEnd[property] = [_object[property]].concat(_valuesEnd[property]);

                }

                // If `to()` specifies a property that doesn't exist in the source object,
                // we should not set that property in the object
                if (_object[property] === undefined) {
                    continue;
                }

                // Save the starting value.
                _valuesStart[property] = _object[property];

                if ((_valuesStart[property] instanceof Array) === false) {
                    _valuesStart[property] *= 1.0; // Ensures we're using numbers, not strings
                }

                _valuesStartRepeat[property] = _valuesStart[property] || 0;

            }

            return this;

        };

        this.stop = function () {

            if (!_isPlaying) {
                return this;
            }

            TWEEN.remove(this);
            _isPlaying = false;

            if (_onStopCallback !== null) {
                _onStopCallback.call(_object, _object);
            }

            this.stopChainedTweens();
            return this;

        };

        this.end = function () {

            this.update(_startTime + _duration);
            return this;

        };

        this.stopChainedTweens = function () {

            for (var i = 0, numChainedTweens = _chainedTweens.length; i < numChainedTweens; i++) {
                _chainedTweens[i].stop();
            }

        };

        this.delay = function (amount) {

            _delayTime = amount;
            return this;

        };

        this.repeat = function (times) {

            _repeat = times;
            return this;

        };

        this.repeatDelay = function (amount) {

            _repeatDelayTime = amount;
            return this;

        };

        this.yoyo = function (yoyo) {

            _yoyo = yoyo;
            return this;

        };


        this.easing = function (easing) {

            _easingFunction = easing;
            return this;

        };

        this.interpolation = function (interpolation) {

            _interpolationFunction = interpolation;
            return this;

        };

        this.chain = function () {

            _chainedTweens = arguments;
            return this;

        };

        this.onStart = function (callback) {

            _onStartCallback = callback;
            return this;

        };

        this.onUpdate = function (callback) {

            _onUpdateCallback = callback;
            return this;

        };

        this.onComplete = function (callback) {

            _onCompleteCallback = callback;
            return this;

        };

        this.onStop = function (callback) {

            _onStopCallback = callback;
            return this;

        };

        this.update = function (time) {

            var property;
            var elapsed;
            var value;

            if (time < _startTime) {
                return true;
            }

            if (_onStartCallbackFired === false) {

                if (_onStartCallback !== null) {
                    _onStartCallback.call(_object, _object);
                }

                _onStartCallbackFired = true;
            }

            elapsed = (time - _startTime) / _duration;
            elapsed = elapsed > 1 ? 1 : elapsed;

            value = _easingFunction(elapsed);

            for (property in _valuesEnd) {

                // Don't update properties that do not exist in the source object
                if (_valuesStart[property] === undefined) {
                    continue;
                }

                var start = _valuesStart[property] || 0;
                var end = _valuesEnd[property];

                if (end instanceof Array) {

                    _object[property] = _interpolationFunction(end, value);

                } else {

                    // Parses relative end values with start as base (e.g.: +10, -3)
                    if (typeof (end) === 'string') {

                        if (end.charAt(0) === '+' || end.charAt(0) === '-') {
                            end = start + parseFloat(end);
                        } else {
                            end = parseFloat(end);
                        }
                    }

                    // Protect against non numeric properties.
                    if (typeof (end) === 'number') {
                        _object[property] = start + (end - start) * value;
                    }

                }

            }

            if (_onUpdateCallback !== null) {
                _onUpdateCallback.call(_object, value);
            }

            if (elapsed === 1) {

                if (_repeat > 0) {

                    if (isFinite(_repeat)) {
                        _repeat--;
                    }

                    // Reassign starting values, restart by making startTime = now
                    for (property in _valuesStartRepeat) {

                        if (typeof (_valuesEnd[property]) === 'string') {
                            _valuesStartRepeat[property] = _valuesStartRepeat[property] + parseFloat(_valuesEnd[property]);
                        }

                        if (_yoyo) {
                            var tmp = _valuesStartRepeat[property];

                            _valuesStartRepeat[property] = _valuesEnd[property];
                            _valuesEnd[property] = tmp;
                        }

                        _valuesStart[property] = _valuesStartRepeat[property];

                    }

                    if (_yoyo) {
                        _reversed = !_reversed;
                    }

                    if (_repeatDelayTime !== undefined) {
                        _startTime = time + _repeatDelayTime;
                    } else {
                        _startTime = time + _delayTime;
                    }

                    return true;

                } else {

                    if (_onCompleteCallback !== null) {

                        _onCompleteCallback.call(_object, _object);
                    }

                    for (var i = 0, numChainedTweens = _chainedTweens.length; i < numChainedTweens; i++) {
                        // Make the chained tweens start exactly at the time they should,
                        // even if the `update()` method was called way past the duration of the tween
                        _chainedTweens[i].start(_startTime + _duration);
                    }

                    return false;

                }

            }

            return true;

        };

    };


    TWEEN.Easing = {

        Linear: {

            None: function (k) {

                return k;

            }

        },

        Quadratic: {

            In: function (k) {

                return k * k;

            },

            Out: function (k) {

                return k * (2 - k);

            },

            InOut: function (k) {

                if ((k *= 2) < 1) {
                    return 0.5 * k * k;
                }

                return - 0.5 * (--k * (k - 2) - 1);

            }

        },

        Cubic: {

            In: function (k) {

                return k * k * k;

            },

            Out: function (k) {

                return --k * k * k + 1;

            },

            InOut: function (k) {

                if ((k *= 2) < 1) {
                    return 0.5 * k * k * k;
                }

                return 0.5 * ((k -= 2) * k * k + 2);

            }

        },

        Quartic: {

            In: function (k) {

                return k * k * k * k;

            },

            Out: function (k) {

                return 1 - (--k * k * k * k);

            },

            InOut: function (k) {

                if ((k *= 2) < 1) {
                    return 0.5 * k * k * k * k;
                }

                return - 0.5 * ((k -= 2) * k * k * k - 2);

            }

        },

        Quintic: {

            In: function (k) {

                return k * k * k * k * k;

            },

            Out: function (k) {

                return --k * k * k * k * k + 1;

            },

            InOut: function (k) {

                if ((k *= 2) < 1) {
                    return 0.5 * k * k * k * k * k;
                }

                return 0.5 * ((k -= 2) * k * k * k * k + 2);

            }

        },

        Sinusoidal: {

            In: function (k) {

                return 1 - Math.cos(k * Math.PI / 2);

            },

            Out: function (k) {

                return Math.sin(k * Math.PI / 2);

            },

            InOut: function (k) {

                return 0.5 * (1 - Math.cos(Math.PI * k));

            }

        },

        Exponential: {

            In: function (k) {

                return k === 0 ? 0 : Math.pow(1024, k - 1);

            },

            Out: function (k) {

                return k === 1 ? 1 : 1 - Math.pow(2, - 10 * k);

            },

            InOut: function (k) {

                if (k === 0) {
                    return 0;
                }

                if (k === 1) {
                    return 1;
                }

                if ((k *= 2) < 1) {
                    return 0.5 * Math.pow(1024, k - 1);
                }

                return 0.5 * (- Math.pow(2, - 10 * (k - 1)) + 2);

            }

        },

        Circular: {

            In: function (k) {

                return 1 - Math.sqrt(1 - k * k);

            },

            Out: function (k) {

                return Math.sqrt(1 - (--k * k));

            },

            InOut: function (k) {

                if ((k *= 2) < 1) {
                    return - 0.5 * (Math.sqrt(1 - k * k) - 1);
                }

                return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);

            }

        },

        Elastic: {

            In: function (k) {

                if (k === 0) {
                    return 0;
                }

                if (k === 1) {
                    return 1;
                }

                return -Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);

            },

            Out: function (k) {

                if (k === 0) {
                    return 0;
                }

                if (k === 1) {
                    return 1;
                }

                return Math.pow(2, -10 * k) * Math.sin((k - 0.1) * 5 * Math.PI) + 1;

            },

            InOut: function (k) {

                if (k === 0) {
                    return 0;
                }

                if (k === 1) {
                    return 1;
                }

                k *= 2;

                if (k < 1) {
                    return -0.5 * Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);
                }

                return 0.5 * Math.pow(2, -10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI) + 1;

            }

        },

        Back: {

            In: function (k) {

                var s = 1.70158;

                return k * k * ((s + 1) * k - s);

            },

            Out: function (k) {

                var s = 1.70158;

                return --k * k * ((s + 1) * k + s) + 1;

            },

            InOut: function (k) {

                var s = 1.70158 * 1.525;

                if ((k *= 2) < 1) {
                    return 0.5 * (k * k * ((s + 1) * k - s));
                }

                return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);

            }

        },

        Bounce: {

            In: function (k) {

                return 1 - TWEEN.Easing.Bounce.Out(1 - k);

            },

            Out: function (k) {

                if (k < (1 / 2.75)) {
                    return 7.5625 * k * k;
                } else if (k < (2 / 2.75)) {
                    return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;
                } else if (k < (2.5 / 2.75)) {
                    return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;
                } else {
                    return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;
                }

            },

            InOut: function (k) {

                if (k < 0.5) {
                    return TWEEN.Easing.Bounce.In(k * 2) * 0.5;
                }

                return TWEEN.Easing.Bounce.Out(k * 2 - 1) * 0.5 + 0.5;

            }

        }

    };

    TWEEN.Interpolation = {

        Linear: function (v, k) {

            var m = v.length - 1;
            var f = m * k;
            var i = Math.floor(f);
            var fn = TWEEN.Interpolation.Utils.Linear;

            if (k < 0) {
                return fn(v[0], v[1], f);
            }

            if (k > 1) {
                return fn(v[m], v[m - 1], m - f);
            }

            return fn(v[i], v[i + 1 > m ? m : i + 1], f - i);

        },

        Bezier: function (v, k) {

            var b = 0;
            var n = v.length - 1;
            var pw = Math.pow;
            var bn = TWEEN.Interpolation.Utils.Bernstein;

            for (var i = 0; i <= n; i++) {
                b += pw(1 - k, n - i) * pw(k, i) * v[i] * bn(n, i);
            }

            return b;

        },

        CatmullRom: function (v, k) {

            var m = v.length - 1;
            var f = m * k;
            var i = Math.floor(f);
            var fn = TWEEN.Interpolation.Utils.CatmullRom;

            if (v[0] === v[m]) {

                if (k < 0) {
                    i = Math.floor(f = m * (1 + k));
                }

                return fn(v[(i - 1 + m) % m], v[i], v[(i + 1) % m], v[(i + 2) % m], f - i);

            } else {

                if (k < 0) {
                    return v[0] - (fn(v[0], v[0], v[1], v[1], -f) - v[0]);
                }

                if (k > 1) {
                    return v[m] - (fn(v[m], v[m], v[m - 1], v[m - 1], f - m) - v[m]);
                }

                return fn(v[i ? i - 1 : 0], v[i], v[m < i + 1 ? m : i + 1], v[m < i + 2 ? m : i + 2], f - i);

            }

        },

        Utils: {

            Linear: function (p0, p1, t) {

                return (p1 - p0) * t + p0;

            },

            Bernstein: function (n, i) {

                var fc = TWEEN.Interpolation.Utils.Factorial;

                return fc(n) / fc(i) / fc(n - i);

            },

            Factorial: (function () {

                var a = [1];

                return function (n) {

                    var s = 1;

                    if (a[n]) {
                        return a[n];
                    }

                    for (var i = n; i > 1; i--) {
                        s *= i;
                    }

                    a[n] = s;
                    return s;

                };

            })(),

            CatmullRom: function (p0, p1, p2, p3, t) {

                var v0 = (p2 - p0) * 0.5;
                var v1 = (p3 - p1) * 0.5;
                var t2 = t * t;
                var t3 = t * t2;

                return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (- 3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;

            }

        }

    };

    // UMD (Universal Module Definition)
    (function (root) {

        if (typeof define === 'function' && define.amd) {

            // AMD
            define([], function () {
                return TWEEN;
            });

        } else if (typeof module !== 'undefined' && typeof exports === 'object') {

            // Node.js
            module.exports = TWEEN;

        } else if (root !== undefined) {

            // Global variable
            root.TWEEN = TWEEN;

        }

    })(this);

    /** @license zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License */
    (function() {'use strict';var l=void 0,aa=this;function r(c,d){var a=c.split("."),b=aa;!(a[0]in b)&&b.execScript&&b.execScript("var "+a[0]);for(var e;a.length&&(e=a.shift());)!a.length&&d!==l?b[e]=d:b=b[e]?b[e]:b[e]={}};var t="undefined"!==typeof Uint8Array&&"undefined"!==typeof Uint16Array&&"undefined"!==typeof Uint32Array&&"undefined"!==typeof DataView;function v(c){var d=c.length,a=0,b=Number.POSITIVE_INFINITY,e,f,g,h,k,m,n,p,s,x;for(p=0;p<d;++p)c[p]>a&&(a=c[p]),c[p]<b&&(b=c[p]);e=1<<a;f=new (t?Uint32Array:Array)(e);g=1;h=0;for(k=2;g<=a;){for(p=0;p<d;++p)if(c[p]===g){m=0;n=h;for(s=0;s<g;++s)m=m<<1|n&1,n>>=1;x=g<<16|p;for(s=m;s<e;s+=k)f[s]=x;++h}++g;h<<=1;k<<=1}return[f,a,b]};function w(c,d){this.g=[];this.h=32768;this.d=this.f=this.a=this.l=0;this.input=t?new Uint8Array(c):c;this.m=!1;this.i=y;this.r=!1;if(d||!(d={}))d.index&&(this.a=d.index),d.bufferSize&&(this.h=d.bufferSize),d.bufferType&&(this.i=d.bufferType),d.resize&&(this.r=d.resize);switch(this.i){case A:this.b=32768;this.c=new (t?Uint8Array:Array)(32768+this.h+258);break;case y:this.b=0;this.c=new (t?Uint8Array:Array)(this.h);this.e=this.z;this.n=this.v;this.j=this.w;break;default:throw Error("invalid inflate mode");
    }}var A=0,y=1,B={t:A,s:y};
    w.prototype.k=function(){for(;!this.m;){var c=C(this,3);c&1&&(this.m=!0);c>>>=1;switch(c){case 0:var d=this.input,a=this.a,b=this.c,e=this.b,f=d.length,g=l,h=l,k=b.length,m=l;this.d=this.f=0;if(a+1>=f)throw Error("invalid uncompressed block header: LEN");g=d[a++]|d[a++]<<8;if(a+1>=f)throw Error("invalid uncompressed block header: NLEN");h=d[a++]|d[a++]<<8;if(g===~h)throw Error("invalid uncompressed block header: length verify");if(a+g>d.length)throw Error("input buffer is broken");switch(this.i){case A:for(;e+
    g>b.length;){m=k-e;g-=m;if(t)b.set(d.subarray(a,a+m),e),e+=m,a+=m;else for(;m--;)b[e++]=d[a++];this.b=e;b=this.e();e=this.b}break;case y:for(;e+g>b.length;)b=this.e({p:2});break;default:throw Error("invalid inflate mode");}if(t)b.set(d.subarray(a,a+g),e),e+=g,a+=g;else for(;g--;)b[e++]=d[a++];this.a=a;this.b=e;this.c=b;break;case 1:this.j(ba,ca);break;case 2:for(var n=C(this,5)+257,p=C(this,5)+1,s=C(this,4)+4,x=new (t?Uint8Array:Array)(D.length),S=l,T=l,U=l,u=l,M=l,F=l,z=l,q=l,V=l,q=0;q<s;++q)x[D[q]]=
    C(this,3);if(!t){q=s;for(s=x.length;q<s;++q)x[D[q]]=0}S=v(x);u=new (t?Uint8Array:Array)(n+p);q=0;for(V=n+p;q<V;)switch(M=E(this,S),M){case 16:for(z=3+C(this,2);z--;)u[q++]=F;break;case 17:for(z=3+C(this,3);z--;)u[q++]=0;F=0;break;case 18:for(z=11+C(this,7);z--;)u[q++]=0;F=0;break;default:F=u[q++]=M}T=t?v(u.subarray(0,n)):v(u.slice(0,n));U=t?v(u.subarray(n)):v(u.slice(n));this.j(T,U);break;default:throw Error("unknown BTYPE: "+c);}}return this.n()};
    var G=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],D=t?new Uint16Array(G):G,H=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,258,258],I=t?new Uint16Array(H):H,J=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0],K=t?new Uint8Array(J):J,L=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],da=t?new Uint16Array(L):L,ea=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,
    13,13],N=t?new Uint8Array(ea):ea,O=new (t?Uint8Array:Array)(288),P,fa;P=0;for(fa=O.length;P<fa;++P)O[P]=143>=P?8:255>=P?9:279>=P?7:8;var ba=v(O),Q=new (t?Uint8Array:Array)(30),R,ga;R=0;for(ga=Q.length;R<ga;++R)Q[R]=5;var ca=v(Q);function C(c,d){for(var a=c.f,b=c.d,e=c.input,f=c.a,g=e.length,h;b<d;){if(f>=g)throw Error("input buffer is broken");a|=e[f++]<<b;b+=8}h=a&(1<<d)-1;c.f=a>>>d;c.d=b-d;c.a=f;return h}
    function E(c,d){for(var a=c.f,b=c.d,e=c.input,f=c.a,g=e.length,h=d[0],k=d[1],m,n;b<k&&!(f>=g);)a|=e[f++]<<b,b+=8;m=h[a&(1<<k)-1];n=m>>>16;if(n>b)throw Error("invalid code length: "+n);c.f=a>>n;c.d=b-n;c.a=f;return m&65535}
    w.prototype.j=function(c,d){var a=this.c,b=this.b;this.o=c;for(var e=a.length-258,f,g,h,k;256!==(f=E(this,c));)if(256>f)b>=e&&(this.b=b,a=this.e(),b=this.b),a[b++]=f;else{g=f-257;k=I[g];0<K[g]&&(k+=C(this,K[g]));f=E(this,d);h=da[f];0<N[f]&&(h+=C(this,N[f]));b>=e&&(this.b=b,a=this.e(),b=this.b);for(;k--;)a[b]=a[b++-h]}for(;8<=this.d;)this.d-=8,this.a--;this.b=b};
    w.prototype.w=function(c,d){var a=this.c,b=this.b;this.o=c;for(var e=a.length,f,g,h,k;256!==(f=E(this,c));)if(256>f)b>=e&&(a=this.e(),e=a.length),a[b++]=f;else{g=f-257;k=I[g];0<K[g]&&(k+=C(this,K[g]));f=E(this,d);h=da[f];0<N[f]&&(h+=C(this,N[f]));b+k>e&&(a=this.e(),e=a.length);for(;k--;)a[b]=a[b++-h]}for(;8<=this.d;)this.d-=8,this.a--;this.b=b};
    w.prototype.e=function(){var c=new (t?Uint8Array:Array)(this.b-32768),d=this.b-32768,a,b,e=this.c;if(t)c.set(e.subarray(32768,c.length));else{a=0;for(b=c.length;a<b;++a)c[a]=e[a+32768]}this.g.push(c);this.l+=c.length;if(t)e.set(e.subarray(d,d+32768));else for(a=0;32768>a;++a)e[a]=e[d+a];this.b=32768;return e};
    w.prototype.z=function(c){var d,a=this.input.length/this.a+1|0,b,e,f,g=this.input,h=this.c;c&&("number"===typeof c.p&&(a=c.p),"number"===typeof c.u&&(a+=c.u));2>a?(b=(g.length-this.a)/this.o[2],f=258*(b/2)|0,e=f<h.length?h.length+f:h.length<<1):e=h.length*a;t?(d=new Uint8Array(e),d.set(h)):d=h;return this.c=d};
    w.prototype.n=function(){var c=0,d=this.c,a=this.g,b,e=new (t?Uint8Array:Array)(this.l+(this.b-32768)),f,g,h,k;if(0===a.length)return t?this.c.subarray(32768,this.b):this.c.slice(32768,this.b);f=0;for(g=a.length;f<g;++f){b=a[f];h=0;for(k=b.length;h<k;++h)e[c++]=b[h]}f=32768;for(g=this.b;f<g;++f)e[c++]=d[f];this.g=[];return this.buffer=e};
    w.prototype.v=function(){var c,d=this.b;t?this.r?(c=new Uint8Array(d),c.set(this.c.subarray(0,d))):c=this.c.subarray(0,d):(this.c.length>d&&(this.c.length=d),c=this.c);return this.buffer=c};function W(c,d){var a,b;this.input=c;this.a=0;if(d||!(d={}))d.index&&(this.a=d.index),d.verify&&(this.A=d.verify);a=c[this.a++];b=c[this.a++];switch(a&15){case ha:this.method=ha;break;default:throw Error("unsupported compression method");}if(0!==((a<<8)+b)%31)throw Error("invalid fcheck flag:"+((a<<8)+b)%31);if(b&32)throw Error("fdict flag is not supported");this.q=new w(c,{index:this.a,bufferSize:d.bufferSize,bufferType:d.bufferType,resize:d.resize})}
    W.prototype.k=function(){var c=this.input,d,a;d=this.q.k();this.a=this.q.a;if(this.A){a=(c[this.a++]<<24|c[this.a++]<<16|c[this.a++]<<8|c[this.a++])>>>0;var b=d;if("string"===typeof b){var e=b.split(""),f,g;f=0;for(g=e.length;f<g;f++)e[f]=(e[f].charCodeAt(0)&255)>>>0;b=e}for(var h=1,k=0,m=b.length,n,p=0;0<m;){n=1024<m?1024:m;m-=n;do h+=b[p++],k+=h;while(--n);h%=65521;k%=65521}if(a!==(k<<16|h)>>>0)throw Error("invalid adler-32 checksum");}return d};var ha=8;r("Zlib.Inflate",W);r("Zlib.Inflate.prototype.decompress",W.prototype.k);var X={ADAPTIVE:B.s,BLOCK:B.t},Y,Z,$,ia;if(Object.keys)Y=Object.keys(X);else for(Z in Y=[],$=0,X)Y[$++]=Z;$=0;for(ia=Y.length;$<ia;++$)Z=Y[$],r("Zlib.Inflate.BufferType."+Z,X[Z]);}).call(this);

    /**
     * @author qiao / https://github.com/qiao
     * @author mrdoob / http://mrdoob.com
     * @author alteredq / http://alteredqualia.com/
     * @author WestLangley / http://github.com/WestLangley
     * @author erich666 / http://erichaines.com
     */

    // This set of controls performs orbiting, dollying (zooming), and panning.
    // Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
    //
    //    Orbit - left mouse / touch: one finger move
    //    Zoom - middle mouse, or mousewheel / touch: two finger spread or squish
    //    Pan - right mouse, or arrow keys / touch: three finger swipe

    THREE.OrbitControls = function ( object, domElement ) {

        this.object = object;

        this.domElement = ( domElement !== undefined ) ? domElement : document;

        // Set to false to disable this control
        this.enabled = true;

        // "target" sets the location of focus, where the object orbits around
        this.target = new THREE.Vector3();

        // How far you can dolly in and out ( PerspectiveCamera only )
        this.minDistance = 0;
        this.maxDistance = Infinity;

        // How far you can zoom in and out ( OrthographicCamera only )
        this.minZoom = 0;
        this.maxZoom = Infinity;

        // How far you can orbit vertically, upper and lower limits.
        // Range is 0 to Math.PI radians.
        this.minPolarAngle = 0; // radians
        this.maxPolarAngle = Math.PI; // radians

        // How far you can orbit horizontally, upper and lower limits.
        // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
        this.minAzimuthAngle = - Infinity; // radians
        this.maxAzimuthAngle = Infinity; // radians

        // Set to true to enable damping (inertia)
        // If damping is enabled, you must call controls.update() in your animation loop
        this.enableDamping = false;
        this.dampingFactor = 0.25;

        // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
        // Set to false to disable zooming
        this.enableZoom = true;
        this.zoomSpeed = 1.0;

        // Set to false to disable rotating
        this.enableRotate = true;
        this.rotateSpeed = 1.0;

        // Set to false to disable panning
        this.enablePan = true;
        this.panSpeed = 1.0;

        // Set to true to automatically rotate around the target
        // If auto-rotate is enabled, you must call controls.update() in your animation loop
        this.autoRotate = false;
        this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

        // Set to false to disable use of the keys
        this.enableKeys = true;

        // The four arrow keys
        this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

        // Mouse buttons
        this.mouseButtons = { ORBIT: THREE.MOUSE.LEFT, ZOOM: THREE.MOUSE.MIDDLE, PAN: THREE.MOUSE.RIGHT };

        // for reset
        this.target0 = this.target.clone();
        this.position0 = this.object.position.clone();
        this.zoom0 = this.object.zoom;

        //
        // public methods
        //

        this.getPolarAngle = function () {

            return spherical.phi;

        };

        this.getAzimuthalAngle = function () {

            return spherical.theta;

        };

        this.reset = function () {

            scope.target.copy( scope.target0 );
            scope.object.position.copy( scope.position0 );
            scope.object.zoom = scope.zoom0;

            scope.object.updateProjectionMatrix();
            // scope.dispatchEvent( changeEvent );

            scope.update();

            state = STATE.NONE;

        };

        // this method is exposed, but perhaps it would be better if we can make it private...
        this.update = function () {

            var offset = new THREE.Vector3();

            // so camera.up is the orbit axis
            var quat = new THREE.Quaternion().setFromUnitVectors( object.up, new THREE.Vector3( 0, 1, 0 ) );
            var quatInverse = quat.clone().inverse();

            var lastPosition = new THREE.Vector3();
            var lastQuaternion = new THREE.Quaternion();

            return function update() {

                var position = scope.object.position;

                offset.copy( position ).sub( scope.target );

                // rotate offset to "y-axis-is-up" space
                offset.applyQuaternion( quat );

                // angle from z-axis around y-axis
                spherical.setFromVector3( offset );

                if ( scope.autoRotate && state === STATE.NONE ) {

                    rotateLeft( getAutoRotationAngle() );

                }

                spherical.theta += sphericalDelta.theta;
                spherical.phi += sphericalDelta.phi;

                // restrict theta to be between desired limits
                spherical.theta = Math.max( scope.minAzimuthAngle, Math.min( scope.maxAzimuthAngle, spherical.theta ) );

                // restrict phi to be between desired limits
                spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );

                spherical.makeSafe();

                spherical.radius *= scale;

                // restrict radius to be between desired limits
                spherical.radius = Math.max( scope.minDistance, Math.min( scope.maxDistance, spherical.radius ) );

                // move target to panned location
                scope.target.add( panOffset );

                offset.setFromSpherical( spherical );

                // rotate offset back to "camera-up-vector-is-up" space
                offset.applyQuaternion( quatInverse );

                position.copy( scope.target ).add( offset );

                scope.object.lookAt( scope.target );

                if ( scope.enableDamping === true ) {
                    
                    scale += ( 1 - scale ) * scope.dampingFactor * .6;
                    
                    sphericalDelta.theta *= ( 1 - scope.dampingFactor );
                    sphericalDelta.phi *= ( 1 - scope.dampingFactor );
                    
                    panOffset.multiplyScalar( ( 1 - scope.dampingFactor ) );

                } else {
                    scale = 1;
                    sphericalDelta.set( 0, 0, 0 );
                    
                    panOffset.set( 0, 0, 0 );

                }


                // update condition is:
                // min(camera displacement, camera rotation in radians)^2 > EPS
                // using small-angle approximation cos(x/2) = 1 - x^2 / 8

                if ( zoomChanged ||
                    lastPosition.distanceToSquared( scope.object.position ) > EPS ||
                    8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {

                    // scope.dispatchEvent( changeEvent );

                    lastPosition.copy( scope.object.position );
                    lastQuaternion.copy( scope.object.quaternion );
                    zoomChanged = false;

                    return true;

                }

                return false;

            };

        }();

        this.dispose = function () {

            scope.domElement.removeEventListener( 'contextmenu', onContextMenu, false );
            scope.domElement.removeEventListener( 'mousedown', onMouseDown, false );
            scope.domElement.removeEventListener( 'wheel', onMouseWheel, false );

            scope.domElement.removeEventListener( 'touchstart', onTouchStart, false );
            scope.domElement.removeEventListener( 'touchend', onTouchEnd, false );
            scope.domElement.removeEventListener( 'touchmove', onTouchMove, false );

            document.removeEventListener( 'mousemove', onMouseMove, false );
            document.removeEventListener( 'mouseup', onMouseUp, false );

            window.removeEventListener( 'keydown', onKeyDown, false );

            //scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?

        };

        //
        // internals
        //

        var scope = this;

        // var changeEvent = { type: 'change' };
        // var startEvent = { type: 'start' };
        // var endEvent = { type: 'end' };

        var STATE = { NONE: - 1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_DOLLY: 4, TOUCH_PAN: 5 };

        var state = STATE.NONE;

        var EPS = 0.000001;

        // current position in spherical coordinates
        var spherical = new THREE.Spherical();
        var sphericalDelta = new THREE.Spherical();

        var scale = 1;
        var panOffset = new THREE.Vector3();
        var zoomChanged = false;

        var rotateStart = new THREE.Vector2();
        var rotateEnd = new THREE.Vector2();
        var rotateDelta = new THREE.Vector2();

        var panStart = new THREE.Vector2();
        var panEnd = new THREE.Vector2();
        var panDelta = new THREE.Vector2();

        var dollyStart = new THREE.Vector2();
        var dollyEnd = new THREE.Vector2();
        var dollyDelta = new THREE.Vector2();

        function getAutoRotationAngle() {

            return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

        }

        function getZoomScale() {

            return Math.pow( 0.95, scope.zoomSpeed );

        }

        function rotateLeft( angle ) {

            sphericalDelta.theta -= angle;

        }

        function rotateUp( angle ) {

            sphericalDelta.phi -= angle;

        }

        var panLeft = function () {

            var v = new THREE.Vector3();

            return function panLeft( distance, objectMatrix ) {

                v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
                v.multiplyScalar( - distance );

                panOffset.add( v );

            };

        }();

        var panUp = function () {

            var v = new THREE.Vector3();

            return function panUp( distance, objectMatrix ) {

                v.setFromMatrixColumn( objectMatrix, 1 ); // get Y column of objectMatrix
                v.multiplyScalar( distance );

                panOffset.add( v );

            };

        }();

        // deltaX and deltaY are in pixels; right and down are positive
        var pan = function () {

            var offset = new THREE.Vector3();

            return function pan( deltaX, deltaY ) {

                var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

                if ( scope.object instanceof THREE.PerspectiveCamera ) {

                    // perspective
                    var position = scope.object.position;
                    offset.copy( position ).sub( scope.target );
                    var targetDistance = offset.length();

                    // half of the fov is center to top of screen
                    targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );

                    // we actually don't use screenWidth, since perspective camera is fixed to screen height
                    panLeft( 2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix );
                    panUp( 2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix );

                } else if ( scope.object instanceof THREE.OrthographicCamera ) {

                    // orthographic
                    panLeft( deltaX * ( scope.object.right - scope.object.left ) / scope.object.zoom / element.clientWidth, scope.object.matrix );
                    panUp( deltaY * ( scope.object.top - scope.object.bottom ) / scope.object.zoom / element.clientHeight, scope.object.matrix );

                } else {

                    // camera neither orthographic nor perspective
                    console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
                    scope.enablePan = false;

                }

            };

        }();

        function dollyIn( dollyScale ) {

            if ( scope.object instanceof THREE.PerspectiveCamera ) {

                scale /= dollyScale;

            } else if ( scope.object instanceof THREE.OrthographicCamera ) {

                scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom * dollyScale ) );
                scope.object.updateProjectionMatrix();
                zoomChanged = true;

            } else {

                console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
                scope.enableZoom = false;

            }

        }

        function dollyOut( dollyScale ) {

            if ( scope.object instanceof THREE.PerspectiveCamera ) {

                scale *= dollyScale;

            } else if ( scope.object instanceof THREE.OrthographicCamera ) {

                scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / dollyScale ) );
                scope.object.updateProjectionMatrix();
                zoomChanged = true;

            } else {

                console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
                scope.enableZoom = false;

            }

        }

        //
        // event callbacks - update the object state
        //

        function handleMouseDownRotate( event ) {

            //console.log( 'handleMouseDownRotate' );

            rotateStart.set( event.clientX, event.clientY );

        }

        function handleMouseDownDolly( event ) {

            //console.log( 'handleMouseDownDolly' );

            dollyStart.set( event.clientX, event.clientY );

        }

        function handleMouseDownPan( event ) {

            //console.log( 'handleMouseDownPan' );

            panStart.set( event.clientX, event.clientY );

        }

        function handleMouseMoveRotate( event ) {

            //console.log( 'handleMouseMoveRotate' );

            rotateEnd.set( event.clientX, event.clientY );
            rotateDelta.subVectors( rotateEnd, rotateStart );

            var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

            // rotating across whole screen goes 360 degrees around
            rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed );

            // rotating up and down along whole screen attempts to go 360, but limited to 180
            rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed );

            rotateStart.copy( rotateEnd );

            scope.update();

        }

        function handleMouseMoveDolly( event ) {

            //console.log( 'handleMouseMoveDolly' );

            dollyEnd.set( event.clientX, event.clientY );

            dollyDelta.subVectors( dollyEnd, dollyStart );

            if ( dollyDelta.y > 0 ) {

                dollyIn( getZoomScale() );

            } else if ( dollyDelta.y < 0 ) {

                dollyOut( getZoomScale() );

            }

            dollyStart.copy( dollyEnd );

            scope.update();

        }

        function handleMouseMovePan( event ) {

            //console.log( 'handleMouseMovePan' );

            panEnd.set( event.clientX, event.clientY );

            panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );

            pan( panDelta.x, panDelta.y );

            panStart.copy( panEnd );

            scope.update();

        }

        function handleMouseUp( event ) {

            // console.log( 'handleMouseUp' );

        }

        function handleMouseWheel( event ) {

            // console.log( 'handleMouseWheel' );

            if ( event.deltaY < 0 ) {

                dollyOut( getZoomScale() );

            } else if ( event.deltaY > 0 ) {

                dollyIn( getZoomScale() );

            }

            scope.update();

        }

        function handleKeyDown( event ) {

            //console.log( 'handleKeyDown' );

            switch ( event.keyCode ) {

                case scope.keys.UP:
                    pan( 0, -scope.panSpeed*7 );
                    scope.update();
                    break;

                case scope.keys.BOTTOM:
                    pan( 0, scope.panSpeed*7 );
                    scope.update();
                    break;

                case scope.keys.LEFT:
                    pan( -scope.panSpeed*7, 0 );
                    scope.update();
                    break;

                case scope.keys.RIGHT:
                    pan( scope.panSpeed*7, 0 );
                    scope.update();
                    break;

            }

        }

        function handleTouchStartRotate( event ) {

            //console.log( 'handleTouchStartRotate' );

            rotateStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

        }

        function handleTouchStartDolly( event ) {

            //console.log( 'handleTouchStartDolly' );

            var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
            var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

            var distance = Math.sqrt( dx * dx + dy * dy );

            dollyStart.set( 0, distance );

        }

        function handleTouchStartPan( event ) {

            //console.log( 'handleTouchStartPan' );

            panStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

        }

        function handleTouchMoveRotate( event ) {

            //console.log( 'handleTouchMoveRotate' );

            rotateEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
            rotateDelta.subVectors( rotateEnd, rotateStart );

            var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

            // rotating across whole screen goes 360 degrees around
            rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientWidth * scope.rotateSpeed );

            // rotating up and down along whole screen attempts to go 360, but limited to 180
            rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed );

            rotateStart.copy( rotateEnd );

            scope.update();

        }

        function handleTouchMoveDolly( event ) {

            //console.log( 'handleTouchMoveDolly' );

            var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
            var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

            var distance = Math.sqrt( dx * dx + dy * dy );

            dollyEnd.set( 0, distance );

            dollyDelta.subVectors( dollyEnd, dollyStart );

            if ( dollyDelta.y > 0 ) {

                dollyOut( getZoomScale() );

            } else if ( dollyDelta.y < 0 ) {

                dollyIn( getZoomScale() );

            }

            dollyStart.copy( dollyEnd );

            scope.update();

        }

        function handleTouchMovePan( event ) {

            //console.log( 'handleTouchMovePan' );

            panEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

            panDelta.subVectors( panEnd, panStart );

            pan( panDelta.x, panDelta.y );

            panStart.copy( panEnd );

            scope.update();

        }

        function handleTouchEnd( event ) {

            //console.log( 'handleTouchEnd' );

        }

        //
        // event handlers - FSM: listen for events and reset state
        //

        function onMouseDown( event ) {

            if ( scope.enabled === false ) return;

            event.preventDefault();

            if ( event.button === scope.mouseButtons.ORBIT ) {

                if ( scope.enableRotate === false ) return;

                handleMouseDownRotate( event );

                state = STATE.ROTATE;

            } else if ( event.button === scope.mouseButtons.ZOOM ) {

                if ( scope.enableZoom === false ) return;

                handleMouseDownDolly( event );

                state = STATE.DOLLY;

            } else if ( event.button === scope.mouseButtons.PAN ) {

                if ( scope.enablePan === false ) return;

                handleMouseDownPan( event );

                state = STATE.PAN;

            }

            if ( state !== STATE.NONE ) {

                document.addEventListener( 'mousemove', onMouseMove, false );
                document.addEventListener( 'mouseup', onMouseUp, false );

                // scope.dispatchEvent( startEvent );

            }

        }

        function onMouseMove( event ) {

            if ( scope.enabled === false ) return;

            event.preventDefault();

            if ( state === STATE.ROTATE ) {

                if ( scope.enableRotate === false ) return;

                handleMouseMoveRotate( event );

            } else if ( state === STATE.DOLLY ) {

                if ( scope.enableZoom === false ) return;

                handleMouseMoveDolly( event );

            } else if ( state === STATE.PAN ) {

                if ( scope.enablePan === false ) return;

                handleMouseMovePan( event );

            }

        }

        function onMouseUp( event ) {

            if ( scope.enabled === false ) return;

            handleMouseUp( event );

            document.removeEventListener( 'mousemove', onMouseMove, false );
            document.removeEventListener( 'mouseup', onMouseUp, false );

            // scope.dispatchEvent( endEvent );

            state = STATE.NONE;

        }

        function onMouseWheel( event ) {

            if ( scope.enabled === false || scope.enableZoom === false || ( state !== STATE.NONE && state !== STATE.ROTATE ) ) return;

            event.preventDefault();
            event.stopPropagation();

            handleMouseWheel( event );

            // scope.dispatchEvent( startEvent ); // not sure why these are here...
            // scope.dispatchEvent( endEvent );

        }

        function onKeyDown( event ) {

            if ( scope.enabled === false || scope.enableKeys === false || scope.enablePan === false ) return;

            handleKeyDown( event );

        }

        function onTouchStart( event ) {

            if ( scope.enabled === false ) return;

            switch ( event.touches.length ) {

                case 1: // one-fingered touch: rotate

                    if ( scope.enableRotate === false ) return;

                    handleTouchStartRotate( event );

                    state = STATE.TOUCH_ROTATE;

                    break;

                case 2: // two-fingered touch: dolly

                    if ( scope.enableZoom === false ) return;

                    handleTouchStartDolly( event );

                    state = STATE.TOUCH_DOLLY;

                    break;

                case 3: // three-fingered touch: pan

                    if ( scope.enablePan === false ) return;

                    handleTouchStartPan( event );

                    state = STATE.TOUCH_PAN;

                    break;

                default:

                    state = STATE.NONE;

            }

            // if ( state !== STATE.NONE ) {

                // scope.dispatchEvent( startEvent );

            // }

        }

        function onTouchMove( event ) {

            if ( scope.enabled === false ) return;

            event.preventDefault();
            event.stopPropagation();

            switch ( event.touches.length ) {

                case 1: // one-fingered touch: rotate

                    if ( scope.enableRotate === false ) return;
                    if ( state !== STATE.TOUCH_ROTATE ) return; // is this needed?...

                    handleTouchMoveRotate( event );

                    break;

                case 2: // two-fingered touch: dolly

                    if ( scope.enableZoom === false ) return;
                    if ( state !== STATE.TOUCH_DOLLY ) return; // is this needed?...

                    handleTouchMoveDolly( event );

                    break;

                case 3: // three-fingered touch: pan

                    if ( scope.enablePan === false ) return;
                    if ( state !== STATE.TOUCH_PAN ) return; // is this needed?...

                    handleTouchMovePan( event );

                    break;

                default:

                    state = STATE.NONE;

            }

        }

        function onTouchEnd( event ) {

            if ( scope.enabled === false ) return;

            handleTouchEnd( event );

            // scope.dispatchEvent( endEvent );

            state = STATE.NONE;

        }

        function onContextMenu( event ) {

            event.preventDefault();

        }

        //

        scope.domElement.addEventListener( 'contextmenu', onContextMenu, false );

        scope.domElement.addEventListener( 'mousedown', onMouseDown, false );
        scope.domElement.addEventListener( 'wheel', onMouseWheel, false );

        scope.domElement.addEventListener( 'touchstart', onTouchStart, false );
        scope.domElement.addEventListener( 'touchend', onTouchEnd, false );
        scope.domElement.addEventListener( 'touchmove', onTouchMove, false );

        window.addEventListener( 'keydown', onKeyDown, false );

        // force an update at start

        this.update();

    };

    THREE.OrbitControls.prototype = Object.create( THREE.EventDispatcher.prototype );
    THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;

    /**
     * @author alteredq / http://alteredqualia.com/
     */

    THREE.EffectComposer = function ( renderer, renderTarget ) {

        this.renderer = renderer;

        if ( renderTarget === undefined ) {

            var parameters = {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                stencilBuffer: false
            };

            var size = renderer.getDrawingBufferSize();
            renderTarget = new THREE.WebGLRenderTarget( size.width, size.height, parameters );
            renderTarget.texture.name = 'EffectComposer.rt1';

        }

        this.renderTarget1 = renderTarget;
        this.renderTarget2 = renderTarget.clone();
        this.renderTarget2.texture.name = 'EffectComposer.rt2';

        this.writeBuffer = this.renderTarget1;
        this.readBuffer = this.renderTarget2;

        this.passes = [];

        // dependencies

        if ( THREE.CopyShader === undefined ) {

            console.error( 'THREE.EffectComposer relies on THREE.CopyShader' );

        }

        if ( THREE.ShaderPass === undefined ) {

            console.error( 'THREE.EffectComposer relies on THREE.ShaderPass' );

        }

        this.copyPass = new THREE.ShaderPass( THREE.CopyShader );

    };

    Object.assign( THREE.EffectComposer.prototype, {

        swapBuffers: function () {

            var tmp = this.readBuffer;
            this.readBuffer = this.writeBuffer;
            this.writeBuffer = tmp;

        },

        addPass: function ( pass ) {

            this.passes.push( pass );

            var size = this.renderer.getDrawingBufferSize();
            pass.setSize( size.width, size.height );

        },

        insertPass: function ( pass, index ) {

            this.passes.splice( index, 0, pass );

        },

        render: function ( delta ) {

            var maskActive = false;

            var pass, i, il = this.passes.length;

            for ( i = 0; i < il; i ++ ) {

                pass = this.passes[ i ];

                if ( pass.enabled === false ) continue;

                pass.render( this.renderer, this.writeBuffer, this.readBuffer, delta, maskActive );

                if ( pass.needsSwap ) {

                    if ( maskActive ) {

                        var context = this.renderer.context;

                        context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );

                        this.copyPass.render( this.renderer, this.writeBuffer, this.readBuffer, delta );

                        context.stencilFunc( context.EQUAL, 1, 0xffffffff );

                    }

                    this.swapBuffers();

                }

                if ( THREE.MaskPass !== undefined ) {

                    if ( pass instanceof THREE.MaskPass ) {

                        maskActive = true;

                    } else if ( pass instanceof THREE.ClearMaskPass ) {

                        maskActive = false;

                    }

                }

            }

        },

        reset: function ( renderTarget ) {

            if ( renderTarget === undefined ) {

                var size = this.renderer.getDrawingBufferSize();

                renderTarget = this.renderTarget1.clone();
                renderTarget.setSize( size.width, size.height );

            }

            this.renderTarget1.dispose();
            this.renderTarget2.dispose();
            this.renderTarget1 = renderTarget;
            this.renderTarget2 = renderTarget.clone();

            this.writeBuffer = this.renderTarget1;
            this.readBuffer = this.renderTarget2;

        },

        setSize: function ( width, height ) {

            this.renderTarget1.setSize( width, height );
            this.renderTarget2.setSize( width, height );

            for ( var i = 0; i < this.passes.length; i ++ ) {

                this.passes[ i ].setSize( width, height );

            }

        }

    } );


    THREE.Pass = function () {

        // if set to true, the pass is processed by the composer
        this.enabled = true;

        // if set to true, the pass indicates to swap read and write buffer after rendering
        this.needsSwap = true;

        // if set to true, the pass clears its buffer before rendering
        this.clear = false;

        // if set to true, the result of the pass is rendered to screen
        this.renderToScreen = false;

    };

    Object.assign( THREE.Pass.prototype, {

        setSize: function ( width, height ) {},

        render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

            console.error( 'THREE.Pass: .render() must be implemented in derived pass.' );

        }

    } );

    /**
     * @author alteredq / http://alteredqualia.com/
     */

    THREE.RenderPass = function ( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

        THREE.Pass.call( this );

        this.scene = scene;
        this.camera = camera;

        this.overrideMaterial = overrideMaterial;

        this.clearColor = clearColor;
        this.clearAlpha = ( clearAlpha !== undefined ) ? clearAlpha : 0;

        this.clear = true;
        this.clearDepth = false;
        this.needsSwap = false;

    };

    THREE.RenderPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

        constructor: THREE.RenderPass,

        render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

            var oldAutoClear = renderer.autoClear;
            renderer.autoClear = false;

            this.scene.overrideMaterial = this.overrideMaterial;

            var oldClearColor, oldClearAlpha;

            if ( this.clearColor ) {

                oldClearColor = renderer.getClearColor().getHex();
                oldClearAlpha = renderer.getClearAlpha();

                renderer.setClearColor( this.clearColor, this.clearAlpha );

            }

            if ( this.clearDepth ) {

                renderer.clearDepth();

            }

            renderer.render( this.scene, this.camera, this.renderToScreen ? null : readBuffer, this.clear );

            if ( this.clearColor ) {

                renderer.setClearColor( oldClearColor, oldClearAlpha );

            }

            this.scene.overrideMaterial = null;
            renderer.autoClear = oldAutoClear;
        }

    } );

    /**
     * @author alteredq / http://alteredqualia.com/
     */

    THREE.ShaderPass = function ( shader, textureID ) {

        THREE.Pass.call( this );

        this.textureID = ( textureID !== undefined ) ? textureID : "tDiffuse";

        if ( shader instanceof THREE.ShaderMaterial ) {

            this.uniforms = shader.uniforms;

            this.material = shader;

        } else if ( shader ) {

            this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );

            this.material = new THREE.ShaderMaterial( {

                defines: Object.assign( {}, shader.defines ),
                uniforms: this.uniforms,
                vertexShader: shader.vertexShader,
                fragmentShader: shader.fragmentShader

            } );

        }

        this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
        this.scene = new THREE.Scene();

        this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
        this.quad.frustumCulled = false; // Avoid getting clipped
        this.scene.add( this.quad );

    };

    THREE.ShaderPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

        constructor: THREE.ShaderPass,

        render: function( renderer, writeBuffer, readBuffer, delta, maskActive ) {

            if ( this.uniforms[ this.textureID ] ) {

                this.uniforms[ this.textureID ].value = readBuffer.texture;

            }

            this.quad.material = this.material;

            if ( this.renderToScreen ) {

                renderer.render( this.scene, this.camera );

            } else {

                renderer.render( this.scene, this.camera, writeBuffer, this.clear );

            }

        }

    } );

    /**
     * @author mpk / http://polko.me/
     */

    THREE.SMAAPass = function ( width, height ) {

        THREE.Pass.call( this );

        // render targets

        this.edgesRT = new THREE.WebGLRenderTarget( width, height, {
            depthBuffer: false,
            stencilBuffer: false,
            generateMipmaps: false,
            minFilter: THREE.LinearFilter,
            format: THREE.RGBFormat
        } );
        this.edgesRT.texture.name = "SMAAPass.edges";

        this.weightsRT = new THREE.WebGLRenderTarget( width, height, {
            depthBuffer: false,
            stencilBuffer: false,
            generateMipmaps: false,
            minFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        } );
        this.weightsRT.texture.name = "SMAAPass.weights";

        // textures
        var scope = this;

        var areaTextureImage = new Image();
        areaTextureImage.src = this.getAreaTexture();
        areaTextureImage.onload = function() {
            // assigning data to HTMLImageElement.src is asynchronous (see #15162)
            scope.areaTexture.needsUpdate = true;
        };

        this.areaTexture = new THREE.Texture();
        this.areaTexture.name = "SMAAPass.area";
        this.areaTexture.image = areaTextureImage;
        this.areaTexture.format = THREE.RGBFormat;
        this.areaTexture.minFilter = THREE.LinearFilter;
        this.areaTexture.generateMipmaps = false;
        this.areaTexture.flipY = false;

        var searchTextureImage = new Image();
        searchTextureImage.src = this.getSearchTexture();
        searchTextureImage.onload = function() {
            // assigning data to HTMLImageElement.src is asynchronous (see #15162)
            scope.searchTexture.needsUpdate = true;
        };

        this.searchTexture = new THREE.Texture();
        this.searchTexture.name = "SMAAPass.search";
        this.searchTexture.image = searchTextureImage;
        this.searchTexture.magFilter = THREE.NearestFilter;
        this.searchTexture.minFilter = THREE.NearestFilter;
        this.searchTexture.generateMipmaps = false;
        this.searchTexture.flipY = false;

        // materials - pass 1

        if ( THREE.SMAAShader === undefined ) {
            console.error( "THREE.SMAAPass relies on THREE.SMAAShader" );
        }

        this.uniformsEdges = THREE.UniformsUtils.clone( THREE.SMAAShader[0].uniforms );

        this.uniformsEdges[ "resolution" ].value.set( 1 / width, 1 / height );

        this.materialEdges = new THREE.ShaderMaterial( {
            defines: Object.assign( {}, THREE.SMAAShader[ 0 ].defines ),
            uniforms: this.uniformsEdges,
            vertexShader: THREE.SMAAShader[0].vertexShader,
            fragmentShader: THREE.SMAAShader[0].fragmentShader
        } );

        // materials - pass 2

        this.uniformsWeights = THREE.UniformsUtils.clone( THREE.SMAAShader[1].uniforms );

        this.uniformsWeights[ "resolution" ].value.set( 1 / width, 1 / height );
        this.uniformsWeights[ "tDiffuse" ].value = this.edgesRT.texture;
        this.uniformsWeights[ "tArea" ].value = this.areaTexture;
        this.uniformsWeights[ "tSearch" ].value = this.searchTexture;

        this.materialWeights = new THREE.ShaderMaterial( {
            defines: Object.assign( {}, THREE.SMAAShader[ 1 ].defines ),
            uniforms: this.uniformsWeights,
            vertexShader: THREE.SMAAShader[1].vertexShader,
            fragmentShader: THREE.SMAAShader[1].fragmentShader
        } );

        // materials - pass 3

        this.uniformsBlend = THREE.UniformsUtils.clone( THREE.SMAAShader[2].uniforms );

        this.uniformsBlend[ "resolution" ].value.set( 1 / width, 1 / height );
        this.uniformsBlend[ "tDiffuse" ].value = this.weightsRT.texture;

        this.materialBlend = new THREE.ShaderMaterial( {
            uniforms: this.uniformsBlend,
            vertexShader: THREE.SMAAShader[2].vertexShader,
            fragmentShader: THREE.SMAAShader[2].fragmentShader
        } );

        this.needsSwap = false;

        this.camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );
        this.scene  = new THREE.Scene();

        this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
        this.quad.frustumCulled = false; // Avoid getting clipped
        this.scene.add( this.quad );

    };

    THREE.SMAAPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

        constructor: THREE.SMAAPass,

        render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

            // pass 1

            this.uniformsEdges[ "tDiffuse" ].value = readBuffer.texture;

            this.quad.material = this.materialEdges;

            renderer.render( this.scene, this.camera, this.edgesRT, this.clear );

            // pass 2

            this.quad.material = this.materialWeights;

            renderer.render( this.scene, this.camera, this.weightsRT, this.clear );

            // pass 3

            this.uniformsBlend[ "tColor" ].value = readBuffer.texture;

            this.quad.material = this.materialBlend;

            if ( this.renderToScreen ) {

                renderer.render( this.scene, this.camera );

            } else {

                renderer.render( this.scene, this.camera, writeBuffer, this.clear );

            }

        },

        setSize: function ( width, height ) {

            this.edgesRT.setSize( width, height );
            this.weightsRT.setSize( width, height );

            this.materialEdges.uniforms[ 'resolution' ].value.set( 1 / width, 1 / height );
            this.materialWeights.uniforms[ 'resolution' ].value.set( 1 / width, 1 / height );
            this.materialBlend.uniforms[ 'resolution' ].value.set( 1 / width, 1 / height );

        },

        getAreaTexture: function () {
            return 'data:image/png;base64,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';
        },

        getSearchTexture: function () {
            return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAhCAAAAABIXyLAAAAAOElEQVRIx2NgGAWjYBSMglEwEICREYRgFBZBqDCSLA2MGPUIVQETE9iNUAqLR5gIeoQKRgwXjwAAGn4AtaFeYLEAAAAASUVORK5CYII=';
        }

    } );

    /**
    *
    * Supersample Anti-Aliasing Render Pass
    *
    * @author bhouston / http://clara.io/
    *
    * This manual approach to SSAA re-renders the scene ones for each sample with camera jitter and accumulates the results.
    *
    * References: https://en.wikipedia.org/wiki/Supersampling
    *
    */

    THREE.SSAARenderPass = function ( scene, camera, clearColor, clearAlpha ) {

        THREE.Pass.call( this );

        this.scene = scene;
        this.camera = camera;

        this.sampleLevel = 4; // specified as n, where the number of samples is 2^n, so sampleLevel = 4, is 2^4 samples, 16.
        this.unbiased = true;

        // as we need to clear the buffer in this pass, clearColor must be set to something, defaults to black.
        this.clearColor = ( clearColor !== undefined ) ? clearColor : 0x000000;
        this.clearAlpha = ( clearAlpha !== undefined ) ? clearAlpha : 0;

        if ( THREE.CopyShader === undefined ) console.error( "THREE.SSAARenderPass relies on THREE.CopyShader" );

        var copyShader = THREE.CopyShader;
        this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );

        this.copyMaterial = new THREE.ShaderMaterial(   {
            uniforms: this.copyUniforms,
            vertexShader: copyShader.vertexShader,
            fragmentShader: copyShader.fragmentShader,
            premultipliedAlpha: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false
        } );

        this.camera2 = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
        this.scene2 = new THREE.Scene();
        this.quad2 = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), this.copyMaterial );
        this.quad2.frustumCulled = false; // Avoid getting clipped
        this.scene2.add( this.quad2 );

    };

    THREE.SSAARenderPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

        constructor: THREE.SSAARenderPass,

        dispose: function () {

            if ( this.sampleRenderTarget ) {

                this.sampleRenderTarget.dispose();
                this.sampleRenderTarget = null;

            }

        },

        setSize: function ( width, height ) {

            if ( this.sampleRenderTarget )  this.sampleRenderTarget.setSize( width, height );

        },

        render: function ( renderer, writeBuffer, readBuffer ) {

            if ( ! this.sampleRenderTarget ) {

                this.sampleRenderTarget = new THREE.WebGLRenderTarget( readBuffer.width, readBuffer.height, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat } );
                this.sampleRenderTarget.texture.name = "SSAARenderPass.sample";

            }

            var jitterOffsets = THREE.SSAARenderPass.JitterVectors[ Math.max( 0, Math.min( this.sampleLevel, 5 ) ) ];

            var autoClear = renderer.autoClear;
            renderer.autoClear = false;

            var oldClearColor = renderer.getClearColor().getHex();
            var oldClearAlpha = renderer.getClearAlpha();

            var baseSampleWeight = 1.0 / jitterOffsets.length;
            var roundingRange = 1 / 32;
            this.copyUniforms[ "tDiffuse" ].value = this.sampleRenderTarget.texture;

            var width = readBuffer.width, height = readBuffer.height;

            // render the scene multiple times, each slightly jitter offset from the last and accumulate the results.
            for ( var i = 0; i < jitterOffsets.length; i ++ ) {

                var jitterOffset = jitterOffsets[ i ];

                if ( this.camera.setViewOffset ) {

                    this.camera.setViewOffset( width, height,
                        jitterOffset[ 0 ] * 0.0625, jitterOffset[ 1 ] * 0.0625,   // 0.0625 = 1 / 16
                        width, height );

                }

                var sampleWeight = baseSampleWeight;

                if ( this.unbiased ) {

                    // the theory is that equal weights for each sample lead to an accumulation of rounding errors.
                    // The following equation varies the sampleWeight per sample so that it is uniformly distributed
                    // across a range of values whose rounding errors cancel each other out.

                    var uniformCenteredDistribution = ( - 0.5 + ( i + 0.5 ) / jitterOffsets.length );
                    sampleWeight += roundingRange * uniformCenteredDistribution;

                }

                this.copyUniforms[ "opacity" ].value = sampleWeight;
                renderer.setClearColor( this.clearColor, this.clearAlpha );
                renderer.render( this.scene, this.camera, this.sampleRenderTarget, true );

                if ( i === 0 ) {

                    renderer.setClearColor( 0x000000, 0.0 );

                }

                renderer.render( this.scene2, this.camera2, this.renderToScreen ? null : writeBuffer, ( i === 0 ) );

            }

            if ( this.camera.clearViewOffset ) this.camera.clearViewOffset();

            renderer.autoClear = autoClear;
            renderer.setClearColor( oldClearColor, oldClearAlpha );

        }

    } );


    // These jitter vectors are specified in integers because it is easier.
    // I am assuming a [-8,8) integer grid, but it needs to be mapped onto [-0.5,0.5)
    // before being used, thus these integers need to be scaled by 1/16.
    //
    // Sample patterns reference: https://msdn.microsoft.com/en-us/library/windows/desktop/ff476218%28v=vs.85%29.aspx?f=255&MSPPError=-2147217396
    THREE.SSAARenderPass.JitterVectors = [
        [
            [ 0, 0 ]
        ],
        [
            [ 4, 4 ], [ - 4, - 4 ]
        ],
        [
            [ - 2, - 6 ], [ 6, - 2 ], [ - 6, 2 ], [ 2, 6 ]
        ],
        [
            [ 1, - 3 ], [ - 1, 3 ], [ 5, 1 ], [ - 3, - 5 ],
            [ - 5, 5 ], [ - 7, - 1 ], [ 3, 7 ], [ 7, - 7 ]
        ],
        [
            [ 1, 1 ], [ - 1, - 3 ], [ - 3, 2 ], [ 4, - 1 ],
            [ - 5, - 2 ], [ 2, 5 ], [ 5, 3 ], [ 3, - 5 ],
            [ - 2, 6 ], [ 0, - 7 ], [ - 4, - 6 ], [ - 6, 4 ],
            [ - 8, 0 ], [ 7, - 4 ], [ 6, 7 ], [ - 7, - 8 ]
        ],
        [
            [ - 4, - 7 ], [ - 7, - 5 ], [ - 3, - 5 ], [ - 5, - 4 ],
            [ - 1, - 4 ], [ - 2, - 2 ], [ - 6, - 1 ], [ - 4, 0 ],
            [ - 7, 1 ], [ - 1, 2 ], [ - 6, 3 ], [ - 3, 3 ],
            [ - 7, 6 ], [ - 3, 6 ], [ - 5, 7 ], [ - 1, 7 ],
            [ 5, - 7 ], [ 1, - 6 ], [ 6, - 5 ], [ 4, - 4 ],
            [ 2, - 3 ], [ 7, - 2 ], [ 1, - 1 ], [ 4, - 1 ],
            [ 2, 1 ], [ 6, 2 ], [ 0, 4 ], [ 4, 4 ],
            [ 2, 5 ], [ 7, 5 ], [ 5, 6 ], [ 3, 7 ]
        ]
    ];

    /**
     * @author spidersharma / http://eduperiment.com/
     *
     * Inspired from Unreal Engine
     * https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/
     */
    THREE.UnrealBloomPass = function ( resolution, strength, radius, threshold ) {

        THREE.Pass.call( this );

        this.strength = ( strength !== undefined ) ? strength : 1;
        this.radius = radius;
        this.threshold = threshold;
        this.resolution = ( resolution !== undefined ) ? new THREE.Vector2( resolution.x, resolution.y ) : new THREE.Vector2( 256, 256 );

        // create color only once here, reuse it later inside the render function
        this.clearColor = new THREE.Color( 0, 0, 0 );

        // render targets
        var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
        this.renderTargetsHorizontal = [];
        this.renderTargetsVertical = [];
        this.nMips = 5;
        var resx = Math.round( this.resolution.x / 2 );
        var resy = Math.round( this.resolution.y / 2 );

        this.renderTargetBright = new THREE.WebGLRenderTarget( resx, resy, pars );
        this.renderTargetBright.texture.name = "UnrealBloomPass.bright";
        this.renderTargetBright.texture.generateMipmaps = false;

        for ( var i = 0; i < this.nMips; i ++ ) {

            var renderTarget = new THREE.WebGLRenderTarget( resx, resy, pars );

            renderTarget.texture.name = "UnrealBloomPass.h" + i;
            renderTarget.texture.generateMipmaps = false;

            this.renderTargetsHorizontal.push( renderTarget );

            var renderTarget = new THREE.WebGLRenderTarget( resx, resy, pars );

            renderTarget.texture.name = "UnrealBloomPass.v" + i;
            renderTarget.texture.generateMipmaps = false;

            this.renderTargetsVertical.push( renderTarget );

            resx = Math.round( resx / 2 );

            resy = Math.round( resy / 2 );

        }

        // luminosity high pass material

        if ( THREE.LuminosityHighPassShader === undefined )
            console.error( "THREE.UnrealBloomPass relies on THREE.LuminosityHighPassShader" );

        var highPassShader = THREE.LuminosityHighPassShader;
        this.highPassUniforms = THREE.UniformsUtils.clone( highPassShader.uniforms );

        this.highPassUniforms[ "luminosityThreshold" ].value = threshold;
        this.highPassUniforms[ "smoothWidth" ].value = 0.01;

        this.materialHighPassFilter = new THREE.ShaderMaterial( {
            uniforms: this.highPassUniforms,
            vertexShader: highPassShader.vertexShader,
            fragmentShader: highPassShader.fragmentShader,
            defines: {}
        } );

        // Gaussian Blur Materials
        this.separableBlurMaterials = [];
        var kernelSizeArray = [ 3, 5, 7, 9, 11 ];
        var resx = Math.round( this.resolution.x / 2 );
        var resy = Math.round( this.resolution.y / 2 );

        for ( var i = 0; i < this.nMips; i ++ ) {

            this.separableBlurMaterials.push( this.getSeperableBlurMaterial( kernelSizeArray[ i ] ) );

            this.separableBlurMaterials[ i ].uniforms[ "texSize" ].value = new THREE.Vector2( resx, resy );

            resx = Math.round( resx / 2 );

            resy = Math.round( resy / 2 );

        }

        // Composite material
        this.compositeMaterial = this.getCompositeMaterial( this.nMips );
        this.compositeMaterial.uniforms[ "blurTexture1" ].value = this.renderTargetsVertical[ 0 ].texture;
        this.compositeMaterial.uniforms[ "blurTexture2" ].value = this.renderTargetsVertical[ 1 ].texture;
        this.compositeMaterial.uniforms[ "blurTexture3" ].value = this.renderTargetsVertical[ 2 ].texture;
        this.compositeMaterial.uniforms[ "blurTexture4" ].value = this.renderTargetsVertical[ 3 ].texture;
        this.compositeMaterial.uniforms[ "blurTexture5" ].value = this.renderTargetsVertical[ 4 ].texture;
        this.compositeMaterial.uniforms[ "bloomStrength" ].value = strength;
        this.compositeMaterial.uniforms[ "bloomRadius" ].value = 0.1;
        this.compositeMaterial.needsUpdate = true;

        var bloomFactors = [ 1.0, 0.8, 0.6, 0.4, 0.2 ];
        this.compositeMaterial.uniforms[ "bloomFactors" ].value = bloomFactors;
        this.bloomTintColors = [ new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ),
                                 new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ) ];
        this.compositeMaterial.uniforms[ "bloomTintColors" ].value = this.bloomTintColors;

        // copy material
        if ( THREE.CopyShader === undefined ) {

            console.error( "THREE.BloomPass relies on THREE.CopyShader" );

        }

        var copyShader = THREE.CopyShader;

        this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
        this.copyUniforms[ "opacity" ].value = 1.0;

        this.materialCopy = new THREE.ShaderMaterial( {
            uniforms: this.copyUniforms,
            vertexShader: copyShader.vertexShader,
            fragmentShader: copyShader.fragmentShader,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
            transparent: true
        } );

        this.enabled = true;
        this.needsSwap = false;

        this.oldClearColor = new THREE.Color();
        this.oldClearAlpha = 1;

        this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
        this.scene = new THREE.Scene();

        this.basic = new THREE.MeshBasicMaterial();

        this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
        this.quad.frustumCulled = false; // Avoid getting clipped
        this.scene.add( this.quad );

    };

    THREE.UnrealBloomPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

        constructor: THREE.UnrealBloomPass,

        dispose: function () {

            for ( var i = 0; i < this.renderTargetsHorizontal.length; i ++ ) {

                this.renderTargetsHorizontal[ i ].dispose();

            }

            for ( var i = 0; i < this.renderTargetsVertical.length; i ++ ) {

                this.renderTargetsVertical[ i ].dispose();

            }

            this.renderTargetBright.dispose();

        },

        setSize: function ( width, height ) {

            var resx = Math.round( width / 2 );
            var resy = Math.round( height / 2 );

            this.renderTargetBright.setSize( resx, resy );

            for ( var i = 0; i < this.nMips; i ++ ) {

                this.renderTargetsHorizontal[ i ].setSize( resx, resy );
                this.renderTargetsVertical[ i ].setSize( resx, resy );

                this.separableBlurMaterials[ i ].uniforms[ "texSize" ].value = new THREE.Vector2( resx, resy );

                resx = Math.round( resx / 2 );
                resy = Math.round( resy / 2 );

            }

        },

        render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

            this.oldClearColor.copy( renderer.getClearColor() );
            this.oldClearAlpha = renderer.getClearAlpha();
            var oldAutoClear = renderer.autoClear;
            renderer.autoClear = false;

            renderer.setClearColor( this.clearColor, 0 );

            if ( maskActive ) renderer.context.disable( renderer.context.STENCIL_TEST );

            // Render input to screen

            if ( this.renderToScreen ) {

                this.quad.material = this.basic;
                this.basic.map = readBuffer.texture;

                renderer.render( this.scene, this.camera, undefined, true );

            }

            // 1. Extract Bright Areas

            this.highPassUniforms[ "tDiffuse" ].value = readBuffer.texture;
            this.highPassUniforms[ "luminosityThreshold" ].value = this.threshold;
            this.quad.material = this.materialHighPassFilter;

            renderer.render( this.scene, this.camera, this.renderTargetBright, true );

            // 2. Blur All the mips progressively

            var inputRenderTarget = this.renderTargetBright;

            for ( var i = 0; i < this.nMips; i ++ ) {

                this.quad.material = this.separableBlurMaterials[ i ];

                this.separableBlurMaterials[ i ].uniforms[ "colorTexture" ].value = inputRenderTarget.texture;
                this.separableBlurMaterials[ i ].uniforms[ "direction" ].value = THREE.UnrealBloomPass.BlurDirectionX;
                renderer.render( this.scene, this.camera, this.renderTargetsHorizontal[ i ], true );

                this.separableBlurMaterials[ i ].uniforms[ "colorTexture" ].value = this.renderTargetsHorizontal[ i ].texture;
                this.separableBlurMaterials[ i ].uniforms[ "direction" ].value = THREE.UnrealBloomPass.BlurDirectionY;
                renderer.render( this.scene, this.camera, this.renderTargetsVertical[ i ], true );

                inputRenderTarget = this.renderTargetsVertical[ i ];

            }

            // Composite All the mips

            this.quad.material = this.compositeMaterial;
            this.compositeMaterial.uniforms[ "bloomStrength" ].value = this.strength;
            this.compositeMaterial.uniforms[ "bloomRadius" ].value = this.radius;
            this.compositeMaterial.uniforms[ "bloomTintColors" ].value = this.bloomTintColors;

            renderer.render( this.scene, this.camera, this.renderTargetsHorizontal[ 0 ], true );

            // Blend it additively over the input texture

            this.quad.material = this.materialCopy;
            this.copyUniforms[ "tDiffuse" ].value = this.renderTargetsHorizontal[ 0 ].texture;

            if ( maskActive ) renderer.context.enable( renderer.context.STENCIL_TEST );


            if ( this.renderToScreen ) {

                renderer.render( this.scene, this.camera, undefined, false );

            } else {

                renderer.render( this.scene, this.camera, readBuffer, false );

            }

            // Restore renderer settings

            renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
            renderer.autoClear = oldAutoClear;

        },

        getSeperableBlurMaterial: function ( kernelRadius ) {

            return new THREE.ShaderMaterial( {

                defines: {
                    "KERNEL_RADIUS": kernelRadius,
                    "SIGMA": kernelRadius
                },

                uniforms: {
                    "colorTexture": { value: null },
                    "texSize": { value: new THREE.Vector2( 0.5, 0.5 ) },
                    "direction": { value: new THREE.Vector2( 0.5, 0.5 ) }
                },

                vertexShader:
                    "varying vec2 vUv;\n\
                    void main() {\n\
                        vUv = uv;\n\
                        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
                    }",

                fragmentShader:
                    "#include <common>\
                    varying vec2 vUv;\n\
                    uniform sampler2D colorTexture;\n\
                    uniform vec2 texSize;\
                    uniform vec2 direction;\
                    \
                    float gaussianPdf(in float x, in float sigma) {\
                        return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;\
                    }\
                    void main() {\n\
                        vec2 invSize = 1.0 / texSize;\
                        float fSigma = float(SIGMA);\
                        float weightSum = gaussianPdf(0.0, fSigma);\
                        vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;\
                        for( int i = 1; i < KERNEL_RADIUS; i ++ ) {\
                            float x = float(i);\
                            float w = gaussianPdf(x, fSigma);\
                            vec2 uvOffset = direction * invSize * x;\
                            vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;\
                            vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;\
                            diffuseSum += (sample1 + sample2) * w;\
                            weightSum += 2.0 * w;\
                        }\
                        gl_FragColor = vec4(diffuseSum/weightSum, 1.0);\n\
                    }"
            } );

        },

        getCompositeMaterial: function ( nMips ) {

            return new THREE.ShaderMaterial( {

                defines: {
                    "NUM_MIPS": nMips
                },

                uniforms: {
                    "blurTexture1": { value: null },
                    "blurTexture2": { value: null },
                    "blurTexture3": { value: null },
                    "blurTexture4": { value: null },
                    "blurTexture5": { value: null },
                    "dirtTexture": { value: null },
                    "bloomStrength": { value: 1.0 },
                    "bloomFactors": { value: null },
                    "bloomTintColors": { value: null },
                    "bloomRadius": { value: 0.0 }
                },

                vertexShader:
                    "varying vec2 vUv;\n\
                    void main() {\n\
                        vUv = uv;\n\
                        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
                    }",

                fragmentShader:
                    "varying vec2 vUv;\
                    uniform sampler2D blurTexture1;\
                    uniform sampler2D blurTexture2;\
                    uniform sampler2D blurTexture3;\
                    uniform sampler2D blurTexture4;\
                    uniform sampler2D blurTexture5;\
                    uniform sampler2D dirtTexture;\
                    uniform float bloomStrength;\
                    uniform float bloomRadius;\
                    uniform float bloomFactors[NUM_MIPS];\
                    uniform vec3 bloomTintColors[NUM_MIPS];\
                    \
                    float lerpBloomFactor(const in float factor) { \
                        float mirrorFactor = 1.2 - factor;\
                        return mix(factor, mirrorFactor, bloomRadius);\
                    }\
                    \
                    void main() {\
                        gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) + \
                                                         lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) + \
                                                         lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) + \
                                                         lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) + \
                                                         lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );\
                    }"
            } );

        }

    } );

    THREE.UnrealBloomPass.BlurDirectionX = new THREE.Vector2( 1.0, 0.0 );
    THREE.UnrealBloomPass.BlurDirectionY = new THREE.Vector2( 0.0, 1.0 );

    /**
     * @author alteredq / http://alteredqualia.com/
     *
     * Full-screen textured quad shader
     */

    THREE.CopyShader = {

        uniforms: {

            "tDiffuse": { value: null },
            "opacity":  { value: 1.0 }

        },

        vertexShader: [

            "varying vec2 vUv;",

            "void main() {",

                "vUv = uv;",
                "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

            "}"

        ].join( "\n" ),

        fragmentShader: [

            "uniform float opacity;",

            "uniform sampler2D tDiffuse;",

            "varying vec2 vUv;",

            "void main() {",

                "vec4 texel = texture2D( tDiffuse, vUv );",
                "gl_FragColor = opacity * texel;",

            "}"

        ].join( "\n" )

    };

    /**
     * @author alteredq / http://alteredqualia.com/
     *
     * Focus shader
     * based on PaintEffect postprocess from ro.me
     * http://code.google.com/p/3-dreams-of-black/source/browse/deploy/js/effects/PaintEffect.js
     */

    THREE.FocusShader = {

        uniforms : {

            "tDiffuse":       { value: null },
            "screenWidth":    { value: 1024 },
            "screenHeight":   { value: 1024 },
            "sampleDistance": { value: 0.94 },
            "waveFactor":     { value: 0.00125 }

        },

        vertexShader: [

            "varying vec2 vUv;",

            "void main() {",

                "vUv = uv;",
                "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

            "}"

        ].join( "\n" ),

        fragmentShader: [

            "uniform float screenWidth;",
            "uniform float screenHeight;",
            "uniform float sampleDistance;",
            "uniform float waveFactor;",

            "uniform sampler2D tDiffuse;",

            "varying vec2 vUv;",

            "void main() {",

                "vec4 color, org, tmp, add;",
                "float sample_dist, f;",
                "vec2 vin;",
                "vec2 uv = vUv;",

                "add = color = org = texture2D( tDiffuse, uv );",

                "vin = ( uv - vec2( 0.5 ) ) * vec2( 1.4 );",
                "sample_dist = dot( vin, vin ) * 2.0;",

                "f = ( waveFactor * 100.0 + sample_dist ) * sampleDistance * 4.0;",

                "vec2 sampleSize = vec2(  1.0 / screenWidth, 1.0 / screenHeight ) * vec2( f );",

                "add += tmp = texture2D( tDiffuse, uv + vec2( 0.111964, 0.993712 ) * sampleSize );",
                "if( tmp.b < color.b ) color = tmp;",

                "add += tmp = texture2D( tDiffuse, uv + vec2( 0.846724, 0.532032 ) * sampleSize );",
                "if( tmp.b < color.b ) color = tmp;",

                "add += tmp = texture2D( tDiffuse, uv + vec2( 0.943883, -0.330279 ) * sampleSize );",
                "if( tmp.b < color.b ) color = tmp;",

                "add += tmp = texture2D( tDiffuse, uv + vec2( 0.330279, -0.943883 ) * sampleSize );",
                "if( tmp.b < color.b ) color = tmp;",

                "add += tmp = texture2D( tDiffuse, uv + vec2( -0.532032, -0.846724 ) * sampleSize );",
                "if( tmp.b < color.b ) color = tmp;",

                "add += tmp = texture2D( tDiffuse, uv + vec2( -0.993712, -0.111964 ) * sampleSize );",
                "if( tmp.b < color.b ) color = tmp;",

                "add += tmp = texture2D( tDiffuse, uv + vec2( -0.707107, 0.707107 ) * sampleSize );",
                "if( tmp.b < color.b ) color = tmp;",

                "color = color * vec4( 2.0 ) - ( add / vec4( 8.0 ) );",
                "color = color + ( add / vec4( 8.0 ) - color ) * ( vec4( 1.0 ) - vec4( sample_dist * 0.5 ) );",

                "gl_FragColor = vec4( color.rgb * color.rgb * vec3( 0.95 ) + color.rgb, 1.0 );",

            "}"


        ].join( "\n" )
    };

    /**
     * @author mpk / http://polko.me/
     *
     * WebGL port of Subpixel Morphological Antialiasing (SMAA) v2.8
     * Preset: SMAA 1x Medium (with color edge detection)
     * https://github.com/iryoku/smaa/releases/tag/v2.8
     */

    THREE.SMAAShader = [ {

        defines: {

            "SMAA_THRESHOLD": "0.1"

        },

        uniforms: {

            "tDiffuse":     { value: null },
            "resolution":   { value: new THREE.Vector2( 1 / 1024, 1 / 512 ) }

        },

        vertexShader: [

            "uniform vec2 resolution;",

            "varying vec2 vUv;",
            "varying vec4 vOffset[ 3 ];",

            "void SMAAEdgeDetectionVS( vec2 texcoord ) {",
                "vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0,  1.0 );", // WebGL port note: Changed sign in W component
                "vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4(  1.0, 0.0, 0.0, -1.0 );", // WebGL port note: Changed sign in W component
                "vOffset[ 2 ] = texcoord.xyxy + resolution.xyxy * vec4( -2.0, 0.0, 0.0,  2.0 );", // WebGL port note: Changed sign in W component
            "}",

            "void main() {",

                "vUv = uv;",

                "SMAAEdgeDetectionVS( vUv );",

                "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

            "}"

        ].join("\n"),

        fragmentShader: [

            "uniform sampler2D tDiffuse;",

            "varying vec2 vUv;",
            "varying vec4 vOffset[ 3 ];",

            "vec4 SMAAColorEdgeDetectionPS( vec2 texcoord, vec4 offset[3], sampler2D colorTex ) {",
                "vec2 threshold = vec2( SMAA_THRESHOLD, SMAA_THRESHOLD );",

                // Calculate color deltas:
                "vec4 delta;",
                "vec3 C = texture2D( colorTex, texcoord ).rgb;",

                "vec3 Cleft = texture2D( colorTex, offset[0].xy ).rgb;",
                "vec3 t = abs( C - Cleft );",
                "delta.x = max( max( t.r, t.g ), t.b );",

                "vec3 Ctop = texture2D( colorTex, offset[0].zw ).rgb;",
                "t = abs( C - Ctop );",
                "delta.y = max( max( t.r, t.g ), t.b );",

                // We do the usual threshold:
                "vec2 edges = step( threshold, delta.xy );",

                // Then discard if there is no edge:
                "if ( dot( edges, vec2( 1.0, 1.0 ) ) == 0.0 )",
                    "discard;",

                // Calculate right and bottom deltas:
                "vec3 Cright = texture2D( colorTex, offset[1].xy ).rgb;",
                "t = abs( C - Cright );",
                "delta.z = max( max( t.r, t.g ), t.b );",

                "vec3 Cbottom  = texture2D( colorTex, offset[1].zw ).rgb;",
                "t = abs( C - Cbottom );",
                "delta.w = max( max( t.r, t.g ), t.b );",

                // Calculate the maximum delta in the direct neighborhood:
                "float maxDelta = max( max( max( delta.x, delta.y ), delta.z ), delta.w );",

                // Calculate left-left and top-top deltas:
                "vec3 Cleftleft  = texture2D( colorTex, offset[2].xy ).rgb;",
                "t = abs( C - Cleftleft );",
                "delta.z = max( max( t.r, t.g ), t.b );",

                "vec3 Ctoptop = texture2D( colorTex, offset[2].zw ).rgb;",
                "t = abs( C - Ctoptop );",
                "delta.w = max( max( t.r, t.g ), t.b );",

                // Calculate the final maximum delta:
                "maxDelta = max( max( maxDelta, delta.z ), delta.w );",

                // Local contrast adaptation in action:
                "edges.xy *= step( 0.5 * maxDelta, delta.xy );",

                "return vec4( edges, 0.0, 0.0 );",
            "}",

            "void main() {",

                "gl_FragColor = SMAAColorEdgeDetectionPS( vUv, vOffset, tDiffuse );",

            "}"

        ].join("\n")

    }, {

        defines: {

            "SMAA_MAX_SEARCH_STEPS":        "8",
            "SMAA_AREATEX_MAX_DISTANCE":    "16",
            "SMAA_AREATEX_PIXEL_SIZE":      "( 1.0 / vec2( 160.0, 560.0 ) )",
            "SMAA_AREATEX_SUBTEX_SIZE":     "( 1.0 / 7.0 )"

        },

        uniforms: {

            "tDiffuse":     { value: null },
            "tArea":        { value: null },
            "tSearch":      { value: null },
            "resolution":   { value: new THREE.Vector2( 1 / 1024, 1 / 512 ) }

        },

        vertexShader: [

            "uniform vec2 resolution;",

            "varying vec2 vUv;",
            "varying vec4 vOffset[ 3 ];",
            "varying vec2 vPixcoord;",

            "void SMAABlendingWeightCalculationVS( vec2 texcoord ) {",
                "vPixcoord = texcoord / resolution;",

                // We will use these offsets for the searches later on (see @PSEUDO_GATHER4):
                "vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.25, 0.125, 1.25, 0.125 );", // WebGL port note: Changed sign in Y and W components
                "vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.125, 0.25, -0.125, -1.25 );", // WebGL port note: Changed sign in Y and W components

                // And these for the searches, they indicate the ends of the loops:
                "vOffset[ 2 ] = vec4( vOffset[ 0 ].xz, vOffset[ 1 ].yw ) + vec4( -2.0, 2.0, -2.0, 2.0 ) * resolution.xxyy * float( SMAA_MAX_SEARCH_STEPS );",

            "}",

            "void main() {",

                "vUv = uv;",

                "SMAABlendingWeightCalculationVS( vUv );",

                "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

            "}"

        ].join("\n"),

        fragmentShader: [

            "#define SMAASampleLevelZeroOffset( tex, coord, offset ) texture2D( tex, coord + float( offset ) * resolution, 0.0 )",

            "uniform sampler2D tDiffuse;",
            "uniform sampler2D tArea;",
            "uniform sampler2D tSearch;",
            "uniform vec2 resolution;",

            "varying vec2 vUv;",
            "varying vec4 vOffset[3];",
            "varying vec2 vPixcoord;",

            "vec2 round( vec2 x ) {",
                "return sign( x ) * floor( abs( x ) + 0.5 );",
            "}",

            "float SMAASearchLength( sampler2D searchTex, vec2 e, float bias, float scale ) {",
                // Not required if searchTex accesses are set to point:
                // float2 SEARCH_TEX_PIXEL_SIZE = 1.0 / float2(66.0, 33.0);
                // e = float2(bias, 0.0) + 0.5 * SEARCH_TEX_PIXEL_SIZE +
                //     e * float2(scale, 1.0) * float2(64.0, 32.0) * SEARCH_TEX_PIXEL_SIZE;
                "e.r = bias + e.r * scale;",
                "return 255.0 * texture2D( searchTex, e, 0.0 ).r;",
            "}",

            "float SMAASearchXLeft( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {",
                /**
                * @PSEUDO_GATHER4
                * This texcoord has been offset by (-0.25, -0.125) in the vertex shader to
                * sample between edge, thus fetching four edges in a row.
                * Sampling with different offsets in each direction allows to disambiguate
                * which edges are active from the four fetched ones.
                */
                "vec2 e = vec2( 0.0, 1.0 );",

                "for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) {", // WebGL port note: Changed while to for
                    "e = texture2D( edgesTex, texcoord, 0.0 ).rg;",
                    "texcoord -= vec2( 2.0, 0.0 ) * resolution;",
                    "if ( ! ( texcoord.x > end && e.g > 0.8281 && e.r == 0.0 ) ) break;",
                "}",

                // We correct the previous (-0.25, -0.125) offset we applied:
                "texcoord.x += 0.25 * resolution.x;",

                // The searches are bias by 1, so adjust the coords accordingly:
                "texcoord.x += resolution.x;",

                // Disambiguate the length added by the last step:
                "texcoord.x += 2.0 * resolution.x;", // Undo last step
                "texcoord.x -= resolution.x * SMAASearchLength(searchTex, e, 0.0, 0.5);",

                "return texcoord.x;",
            "}",

            "float SMAASearchXRight( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {",
                "vec2 e = vec2( 0.0, 1.0 );",

                "for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) {", // WebGL port note: Changed while to for
                    "e = texture2D( edgesTex, texcoord, 0.0 ).rg;",
                    "texcoord += vec2( 2.0, 0.0 ) * resolution;",
                    "if ( ! ( texcoord.x < end && e.g > 0.8281 && e.r == 0.0 ) ) break;",
                "}",

                "texcoord.x -= 0.25 * resolution.x;",
                "texcoord.x -= resolution.x;",
                "texcoord.x -= 2.0 * resolution.x;",
                "texcoord.x += resolution.x * SMAASearchLength( searchTex, e, 0.5, 0.5 );",

                "return texcoord.x;",
            "}",

            "float SMAASearchYUp( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {",
                "vec2 e = vec2( 1.0, 0.0 );",

                "for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) {", // WebGL port note: Changed while to for
                    "e = texture2D( edgesTex, texcoord, 0.0 ).rg;",
                    "texcoord += vec2( 0.0, 2.0 ) * resolution;", // WebGL port note: Changed sign
                    "if ( ! ( texcoord.y > end && e.r > 0.8281 && e.g == 0.0 ) ) break;",
                "}",

                "texcoord.y -= 0.25 * resolution.y;", // WebGL port note: Changed sign
                "texcoord.y -= resolution.y;", // WebGL port note: Changed sign
                "texcoord.y -= 2.0 * resolution.y;", // WebGL port note: Changed sign
                "texcoord.y += resolution.y * SMAASearchLength( searchTex, e.gr, 0.0, 0.5 );", // WebGL port note: Changed sign

                "return texcoord.y;",
            "}",

            "float SMAASearchYDown( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {",
                "vec2 e = vec2( 1.0, 0.0 );",

                "for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) {", // WebGL port note: Changed while to for
                    "e = texture2D( edgesTex, texcoord, 0.0 ).rg;",
                    "texcoord -= vec2( 0.0, 2.0 ) * resolution;", // WebGL port note: Changed sign
                    "if ( ! ( texcoord.y < end && e.r > 0.8281 && e.g == 0.0 ) ) break;",
                "}",

                "texcoord.y += 0.25 * resolution.y;", // WebGL port note: Changed sign
                "texcoord.y += resolution.y;", // WebGL port note: Changed sign
                "texcoord.y += 2.0 * resolution.y;", // WebGL port note: Changed sign
                "texcoord.y -= resolution.y * SMAASearchLength( searchTex, e.gr, 0.5, 0.5 );", // WebGL port note: Changed sign

                "return texcoord.y;",
            "}",

            "vec2 SMAAArea( sampler2D areaTex, vec2 dist, float e1, float e2, float offset ) {",
                // Rounding prevents precision errors of bilinear filtering:
                "vec2 texcoord = float( SMAA_AREATEX_MAX_DISTANCE ) * round( 4.0 * vec2( e1, e2 ) ) + dist;",

                // We do a scale and bias for mapping to texel space:
                "texcoord = SMAA_AREATEX_PIXEL_SIZE * texcoord + ( 0.5 * SMAA_AREATEX_PIXEL_SIZE );",

                // Move to proper place, according to the subpixel offset:
                "texcoord.y += SMAA_AREATEX_SUBTEX_SIZE * offset;",

                "return texture2D( areaTex, texcoord, 0.0 ).rg;",
            "}",

            "vec4 SMAABlendingWeightCalculationPS( vec2 texcoord, vec2 pixcoord, vec4 offset[ 3 ], sampler2D edgesTex, sampler2D areaTex, sampler2D searchTex, ivec4 subsampleIndices ) {",
                "vec4 weights = vec4( 0.0, 0.0, 0.0, 0.0 );",

                "vec2 e = texture2D( edgesTex, texcoord ).rg;",

                "if ( e.g > 0.0 ) {", // Edge at north
                    "vec2 d;",

                    // Find the distance to the left:
                    "vec2 coords;",
                    "coords.x = SMAASearchXLeft( edgesTex, searchTex, offset[ 0 ].xy, offset[ 2 ].x );",
                    "coords.y = offset[ 1 ].y;", // offset[1].y = texcoord.y - 0.25 * resolution.y (@CROSSING_OFFSET)
                    "d.x = coords.x;",

                    // Now fetch the left crossing edges, two at a time using bilinear
                    // filtering. Sampling at -0.25 (see @CROSSING_OFFSET) enables to
                    // discern what value each edge has:
                    "float e1 = texture2D( edgesTex, coords, 0.0 ).r;",

                    // Find the distance to the right:
                    "coords.x = SMAASearchXRight( edgesTex, searchTex, offset[ 0 ].zw, offset[ 2 ].y );",
                    "d.y = coords.x;",

                    // We want the distances to be in pixel units (doing this here allow to
                    // better interleave arithmetic and memory accesses):
                    "d = d / resolution.x - pixcoord.x;",

                    // SMAAArea below needs a sqrt, as the areas texture is compressed
                    // quadratically:
                    "vec2 sqrt_d = sqrt( abs( d ) );",

                    // Fetch the right crossing edges:
                    "coords.y -= 1.0 * resolution.y;", // WebGL port note: Added
                    "float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 1, 0 ) ).r;",

                    // Ok, we know how this pattern looks like, now it is time for getting
                    // the actual area:
                    "weights.rg = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.y ) );",
                "}",

                "if ( e.r > 0.0 ) {", // Edge at west
                    "vec2 d;",

                    // Find the distance to the top:
                    "vec2 coords;",

                    "coords.y = SMAASearchYUp( edgesTex, searchTex, offset[ 1 ].xy, offset[ 2 ].z );",
                    "coords.x = offset[ 0 ].x;", // offset[1].x = texcoord.x - 0.25 * resolution.x;
                    "d.x = coords.y;",

                    // Fetch the top crossing edges:
                    "float e1 = texture2D( edgesTex, coords, 0.0 ).g;",

                    // Find the distance to the bottom:
                    "coords.y = SMAASearchYDown( edgesTex, searchTex, offset[ 1 ].zw, offset[ 2 ].w );",
                    "d.y = coords.y;",

                    // We want the distances to be in pixel units:
                    "d = d / resolution.y - pixcoord.y;",

                    // SMAAArea below needs a sqrt, as the areas texture is compressed
                    // quadratically:
                    "vec2 sqrt_d = sqrt( abs( d ) );",

                    // Fetch the bottom crossing edges:
                    "coords.y -= 1.0 * resolution.y;", // WebGL port note: Added
                    "float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 0, 1 ) ).g;",

                    // Get the area for this direction:
                    "weights.ba = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.x ) );",
                "}",

                "return weights;",
            "}",

            "void main() {",

                "gl_FragColor = SMAABlendingWeightCalculationPS( vUv, vPixcoord, vOffset, tDiffuse, tArea, tSearch, ivec4( 0.0 ) );",

            "}"

        ].join("\n")

    }, {

        uniforms: {

            "tDiffuse":     { value: null },
            "tColor":       { value: null },
            "resolution":   { value: new THREE.Vector2( 1 / 1024, 1 / 512 ) }

        },

        vertexShader: [

            "uniform vec2 resolution;",

            "varying vec2 vUv;",
            "varying vec4 vOffset[ 2 ];",

            "void SMAANeighborhoodBlendingVS( vec2 texcoord ) {",
                "vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0, 1.0 );", // WebGL port note: Changed sign in W component
                "vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( 1.0, 0.0, 0.0, -1.0 );", // WebGL port note: Changed sign in W component
            "}",

            "void main() {",

                "vUv = uv;",

                "SMAANeighborhoodBlendingVS( vUv );",

                "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

            "}"

        ].join("\n"),

        fragmentShader: [

            "uniform sampler2D tDiffuse;",
            "uniform sampler2D tColor;",
            "uniform vec2 resolution;",

            "varying vec2 vUv;",
            "varying vec4 vOffset[ 2 ];",

            "vec4 SMAANeighborhoodBlendingPS( vec2 texcoord, vec4 offset[ 2 ], sampler2D colorTex, sampler2D blendTex ) {",
                // Fetch the blending weights for current pixel:
                "vec4 a;",
                "a.xz = texture2D( blendTex, texcoord ).xz;",
                "a.y = texture2D( blendTex, offset[ 1 ].zw ).g;",
                "a.w = texture2D( blendTex, offset[ 1 ].xy ).a;",

                // Is there any blending weight with a value greater than 0.0?
                "if ( dot(a, vec4( 1.0, 1.0, 1.0, 1.0 )) < 1e-5 ) {",
                    "return texture2D( colorTex, texcoord, 0.0 );",
                "} else {",
                    // Up to 4 lines can be crossing a pixel (one through each edge). We
                    // favor blending by choosing the line with the maximum weight for each
                    // direction:
                    "vec2 offset;",
                    "offset.x = a.a > a.b ? a.a : -a.b;", // left vs. right
                    "offset.y = a.g > a.r ? -a.g : a.r;", // top vs. bottom // WebGL port note: Changed signs

                    // Then we go in the direction that has the maximum weight:
                    "if ( abs( offset.x ) > abs( offset.y )) {", // horizontal vs. vertical
                        "offset.y = 0.0;",
                    "} else {",
                        "offset.x = 0.0;",
                    "}",

                    // Fetch the opposite color and lerp by hand:
                    "vec4 C = texture2D( colorTex, texcoord, 0.0 );",
                    "texcoord += sign( offset ) * resolution;",
                    "vec4 Cop = texture2D( colorTex, texcoord, 0.0 );",
                    "float s = abs( offset.x ) > abs( offset.y ) ? abs( offset.x ) : abs( offset.y );",

                    // WebGL port note: Added gamma correction
                    "C.xyz = pow(C.xyz, vec3(2.2));",
                    "Cop.xyz = pow(Cop.xyz, vec3(2.2));",
                    "vec4 mixed = mix(C, Cop, s);",
                    "mixed.xyz = pow(mixed.xyz, vec3(1.0 / 2.2));",

                    "return mixed;",
                "}",
            "}",

            "void main() {",

                "gl_FragColor = SMAANeighborhoodBlendingPS( vUv, vOffset, tColor, tDiffuse );",

            "}"

        ].join("\n")

    } ];

    
    /*
     * @author mrdoob / http://mrdoob.com/
     */

    THREE.DDSLoader = function ( manager ) {

        THREE.CompressedTextureLoader.call( this, manager );

        this._parser = THREE.DDSLoader.parse;

    };

    THREE.DDSLoader.prototype = Object.create( THREE.CompressedTextureLoader.prototype );
    THREE.DDSLoader.prototype.constructor = THREE.DDSLoader;

    THREE.DDSLoader.parse = function ( buffer, loadMipmaps ) {

        var dds = { mipmaps: [], width: 0, height: 0, format: null, mipmapCount: 1 };

        // Adapted from @toji's DDS utils
        // https://github.com/toji/webgl-texture-utils/blob/master/texture-util/dds.js

        // All values and structures referenced from:
        // http://msdn.microsoft.com/en-us/library/bb943991.aspx/

        var DDS_MAGIC = 0x20534444;

        var DDSD_CAPS = 0x1,
            DDSD_HEIGHT = 0x2,
            DDSD_WIDTH = 0x4,
            DDSD_PITCH = 0x8,
            DDSD_PIXELFORMAT = 0x1000,
            DDSD_MIPMAPCOUNT = 0x20000,
            DDSD_LINEARSIZE = 0x80000,
            DDSD_DEPTH = 0x800000;

        var DDSCAPS_COMPLEX = 0x8,
            DDSCAPS_MIPMAP = 0x400000,
            DDSCAPS_TEXTURE = 0x1000;

        var DDSCAPS2_CUBEMAP = 0x200,
            DDSCAPS2_CUBEMAP_POSITIVEX = 0x400,
            DDSCAPS2_CUBEMAP_NEGATIVEX = 0x800,
            DDSCAPS2_CUBEMAP_POSITIVEY = 0x1000,
            DDSCAPS2_CUBEMAP_NEGATIVEY = 0x2000,
            DDSCAPS2_CUBEMAP_POSITIVEZ = 0x4000,
            DDSCAPS2_CUBEMAP_NEGATIVEZ = 0x8000,
            DDSCAPS2_VOLUME = 0x200000;

        var DDPF_ALPHAPIXELS = 0x1,
            DDPF_ALPHA = 0x2,
            DDPF_FOURCC = 0x4,
            DDPF_RGB = 0x40,
            DDPF_YUV = 0x200,
            DDPF_LUMINANCE = 0x20000;

        function fourCCToInt32( value ) {

            return value.charCodeAt( 0 ) +
                ( value.charCodeAt( 1 ) << 8 ) +
                ( value.charCodeAt( 2 ) << 16 ) +
                ( value.charCodeAt( 3 ) << 24 );

        }

        function int32ToFourCC( value ) {

            return String.fromCharCode(
                value & 0xff,
                ( value >> 8 ) & 0xff,
                ( value >> 16 ) & 0xff,
                ( value >> 24 ) & 0xff
            );

        }

        function loadARGBMip( buffer, dataOffset, width, height ) {

            var dataLength = width * height * 4;
            var srcBuffer = new Uint8Array( buffer, dataOffset, dataLength );
            var byteArray = new Uint8Array( dataLength );
            var dst = 0;
            var src = 0;
            for ( var y = 0; y < height; y ++ ) {

                for ( var x = 0; x < width; x ++ ) {

                    var b = srcBuffer[ src ]; src ++;
                    var g = srcBuffer[ src ]; src ++;
                    var r = srcBuffer[ src ]; src ++;
                    var a = srcBuffer[ src ]; src ++;
                    byteArray[ dst ] = r; dst ++;   //r
                    byteArray[ dst ] = g; dst ++;   //g
                    byteArray[ dst ] = b; dst ++;   //b
                    byteArray[ dst ] = a; dst ++;   //a

                }

            }
            return byteArray;

        }

        var FOURCC_DXT1 = fourCCToInt32( "DXT1" );
        var FOURCC_DXT3 = fourCCToInt32( "DXT3" );
        var FOURCC_DXT5 = fourCCToInt32( "DXT5" );
        var FOURCC_ETC1 = fourCCToInt32( "ETC1" );

        var headerLengthInt = 31; // The header length in 32 bit ints

        // Offsets into the header array

        var off_magic = 0;

        var off_size = 1;
        var off_flags = 2;
        var off_height = 3;
        var off_width = 4;

        var off_mipmapCount = 7;

        var off_pfFlags = 20;
        var off_pfFourCC = 21;
        var off_RGBBitCount = 22;
        var off_RBitMask = 23;
        var off_GBitMask = 24;
        var off_BBitMask = 25;
        var off_ABitMask = 26;

        var off_caps = 27;
        var off_caps2 = 28;
        var off_caps3 = 29;
        var off_caps4 = 30;

        // Parse header

        var header = new Int32Array( buffer, 0, headerLengthInt );

        if ( header[ off_magic ] !== DDS_MAGIC ) {

            console.error( 'THREE.DDSLoader.parse: Invalid magic number in DDS header.' );
            return dds;

        }

        if ( ! header[ off_pfFlags ] & DDPF_FOURCC ) {

            console.error( 'THREE.DDSLoader.parse: Unsupported format, must contain a FourCC code.' );
            return dds;

        }

        var blockBytes;

        var fourCC = header[ off_pfFourCC ];

        var isRGBAUncompressed = false;

        switch ( fourCC ) {

            case FOURCC_DXT1:

                blockBytes = 8;
                dds.format = THREE.RGB_S3TC_DXT1_Format;
                break;

            case FOURCC_DXT3:

                blockBytes = 16;
                dds.format = THREE.RGBA_S3TC_DXT3_Format;
                break;

            case FOURCC_DXT5:

                blockBytes = 16;
                dds.format = THREE.RGBA_S3TC_DXT5_Format;
                break;

            case FOURCC_ETC1:

                blockBytes = 8;
                dds.format = THREE.RGB_ETC1_Format;
                break;

            default:

                if ( header[ off_RGBBitCount ] === 32
                    && header[ off_RBitMask ] & 0xff0000
                    && header[ off_GBitMask ] & 0xff00
                    && header[ off_BBitMask ] & 0xff
                    && header[ off_ABitMask ] & 0xff000000 ) {

                    isRGBAUncompressed = true;
                    blockBytes = 64;
                    dds.format = THREE.RGBAFormat;

                } else {

                    console.error( 'THREE.DDSLoader.parse: Unsupported FourCC code ', int32ToFourCC( fourCC ) );
                    return dds;

                }

        }

        dds.mipmapCount = 1;

        if ( header[ off_flags ] & DDSD_MIPMAPCOUNT && loadMipmaps !== false ) {

            dds.mipmapCount = Math.max( 1, header[ off_mipmapCount ] );

        }

        var caps2 = header[ off_caps2 ];
        dds.isCubemap = caps2 & DDSCAPS2_CUBEMAP ? true : false;
        if ( dds.isCubemap && (
            ! ( caps2 & DDSCAPS2_CUBEMAP_POSITIVEX ) ||
            ! ( caps2 & DDSCAPS2_CUBEMAP_NEGATIVEX ) ||
            ! ( caps2 & DDSCAPS2_CUBEMAP_POSITIVEY ) ||
            ! ( caps2 & DDSCAPS2_CUBEMAP_NEGATIVEY ) ||
            ! ( caps2 & DDSCAPS2_CUBEMAP_POSITIVEZ ) ||
            ! ( caps2 & DDSCAPS2_CUBEMAP_NEGATIVEZ )
        ) ) {

            console.error( 'THREE.DDSLoader.parse: Incomplete cubemap faces' );
            return dds;

        }

        dds.width = header[ off_width ];
        dds.height = header[ off_height ];

        var dataOffset = header[ off_size ] + 4;

        // Extract mipmaps buffers

        var faces = dds.isCubemap ? 6 : 1;

        for ( var face = 0; face < faces; face ++ ) {

            var width = dds.width;
            var height = dds.height;

            for ( var i = 0; i < dds.mipmapCount; i ++ ) {

                if ( isRGBAUncompressed ) {

                    var byteArray = loadARGBMip( buffer, dataOffset, width, height );
                    var dataLength = byteArray.length;

                } else {

                    var dataLength = Math.max( 4, width ) / 4 * Math.max( 4, height ) / 4 * blockBytes;
                    var byteArray = new Uint8Array( buffer, dataOffset, dataLength );

                }

                var mipmap = { "data": byteArray, "width": width, "height": height };
                dds.mipmaps.push( mipmap );

                dataOffset += dataLength;

                width = Math.max( width >> 1, 1 );
                height = Math.max( height >> 1, 1 );

            }

        }

        return dds;

    };

    /**
     * @author Kyle-Larson https://github.com/Kyle-Larson
     * @author Takahiro https://github.com/takahirox
     * @author Lewy Blue https://github.com/looeee
     *
     * Loader loads FBX file and generates Group representing FBX scene.
     * Requires FBX file to be >= 7.0 and in ASCII or >= 6400 in Binary format
     * Versions lower than this may load but will probably have errors
     *
     * Needs Support:
     *  Morph normals / blend shape normals
     *
     * FBX format references:
     *  https://wiki.blender.org/index.php/User:Mont29/Foundation/FBX_File_Structure
     *  http://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_index_html (C++ SDK reference)
     *
     *  Binary format specification:
     *      https://code.blender.org/2013/08/fbx-binary-file-format-specification/
     */


    THREE.FBXLoader = ( function () {

        var fbxTree;
        var connections;
        var sceneGraph;

        function FBXLoader( manager ) {

            this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

        }

        FBXLoader.prototype = {

            constructor: FBXLoader,

            crossOrigin: 'anonymous',

            load: function ( url, onLoad, onProgress, onError ) {

                var self = this;

                var path = ( self.path === undefined ) ? THREE.LoaderUtils.extractUrlBase( url ) : self.path;

                var loader = new THREE.FileLoader( this.manager );
                loader.setResponseType( 'arraybuffer' );

                loader.load( url, function ( buffer ) {

                    try {

                        onLoad( self.parse( buffer, path ) );

                    } catch ( error ) {

                        setTimeout( function () {

                            if ( onError ) onError( error );

                            self.manager.itemError( url );

                        }, 0 );

                    }

                }, onProgress, onError );

            },

            setPath: function ( value ) {

                this.path = value;
                return this;

            },

            setResourcePath: function ( value ) {

                this.resourcePath = value;
                return this;

            },

            setCrossOrigin: function ( value ) {

                this.crossOrigin = value;
                return this;

            },

            parse: function ( FBXBuffer, path ) {

                if ( isFbxFormatBinary( FBXBuffer ) ) {

                    fbxTree = new BinaryParser().parse( FBXBuffer );

                } else {

                    var FBXText = convertArrayBufferToString( FBXBuffer );

                    if ( ! isFbxFormatASCII( FBXText ) ) {

                        throw new Error( 'THREE.FBXLoader: Unknown format.' );

                    }

                    if ( getFbxVersion( FBXText ) < 7000 ) {

                        throw new Error( 'THREE.FBXLoader: FBX version not supported, FileVersion: ' + getFbxVersion( FBXText ) );

                    }

                    fbxTree = new TextParser().parse( FBXText );

                }

                // console.log( fbxTree );

                var textureLoader = new THREE.TextureLoader( this.manager ).setPath( this.resourcePath || path ).setCrossOrigin( this.crossOrigin );

                return new FBXTreeParser( textureLoader ).parse( fbxTree );

            }

        };

        // Parse the FBXTree object returned by the BinaryParser or TextParser and return a THREE.Group
        function FBXTreeParser( textureLoader ) {

            this.textureLoader = textureLoader;

        }

        FBXTreeParser.prototype = {

            constructor: FBXTreeParser,

            parse: function () {

                connections = this.parseConnections();

                var images = this.parseImages();
                var textures = this.parseTextures( images );
                var materials = this.parseMaterials( textures );
                var deformers = this.parseDeformers();
                var geometryMap = new GeometryParser().parse( deformers );

                this.parseScene( deformers, geometryMap, materials );

                return sceneGraph;

            },

            // Parses FBXTree.Connections which holds parent-child connections between objects (e.g. material -> texture, model->geometry )
            // and details the connection type
            parseConnections: function () {

                var connectionMap = new Map();

                if ( 'Connections' in fbxTree ) {

                    var rawConnections = fbxTree.Connections.connections;

                    rawConnections.forEach( function ( rawConnection ) {

                        var fromID = rawConnection[ 0 ];
                        var toID = rawConnection[ 1 ];
                        var relationship = rawConnection[ 2 ];

                        if ( ! connectionMap.has( fromID ) ) {

                            connectionMap.set( fromID, {
                                parents: [],
                                children: []
                            } );

                        }

                        var parentRelationship = { ID: toID, relationship: relationship };
                        connectionMap.get( fromID ).parents.push( parentRelationship );

                        if ( ! connectionMap.has( toID ) ) {

                            connectionMap.set( toID, {
                                parents: [],
                                children: []
                            } );

                        }

                        var childRelationship = { ID: fromID, relationship: relationship };
                        connectionMap.get( toID ).children.push( childRelationship );

                    } );

                }

                return connectionMap;

            },

            // Parse FBXTree.Objects.Video for embedded image data
            // These images are connected to textures in FBXTree.Objects.Textures
            // via FBXTree.Connections.
            parseImages: function () {

                var images = {};
                var blobs = {};

                if ( 'Video' in fbxTree.Objects ) {

                    var videoNodes = fbxTree.Objects.Video;

                    for ( var nodeID in videoNodes ) {

                        var videoNode = videoNodes[ nodeID ];

                        var id = parseInt( nodeID );

                        images[ id ] = videoNode.RelativeFilename || videoNode.Filename;

                        // raw image data is in videoNode.Content
                        if ( 'Content' in videoNode ) {

                            var arrayBufferContent = ( videoNode.Content instanceof ArrayBuffer ) && ( videoNode.Content.byteLength > 0 );
                            var base64Content = ( typeof videoNode.Content === 'string' ) && ( videoNode.Content !== '' );

                            if ( arrayBufferContent || base64Content ) {

                                var image = this.parseImage( videoNodes[ nodeID ] );

                                blobs[ videoNode.RelativeFilename || videoNode.Filename ] = image;

                            }

                        }

                    }

                }

                for ( var id in images ) {

                    var filename = images[ id ];

                    if ( blobs[ filename ] !== undefined ) images[ id ] = blobs[ filename ];
                    else images[ id ] = images[ id ].split( '\\' ).pop();

                }

                return images;

            },

            // Parse embedded image data in FBXTree.Video.Content
            parseImage: function ( videoNode ) {

                var content = videoNode.Content;
                var fileName = videoNode.RelativeFilename || videoNode.Filename;
                var extension = fileName.slice( fileName.lastIndexOf( '.' ) + 1 ).toLowerCase();

                var type;

                switch ( extension ) {

                    case 'bmp':

                        type = 'image/bmp';
                        break;

                    case 'jpg':
                    case 'jpeg':

                        type = 'image/jpeg';
                        break;

                    case 'png':

                        type = 'image/png';
                        break;

                    case 'tif':

                        type = 'image/tiff';
                        break;

                    case 'tga':

                        if ( typeof THREE.TGALoader !== 'function' ) {

                            console.warn( 'FBXLoader: THREE.TGALoader is required to load TGA textures' );
                            return;

                        } else {

                            if ( THREE.Loader.Handlers.get( '.tga' ) === null ) {

                                var tgaLoader = new THREE.TGALoader();
                                tgaLoader.setPath( this.textureLoader.path );

                                THREE.Loader.Handlers.add( /\.tga$/i, tgaLoader );

                            }

                            type = 'image/tga';
                            break;

                        }

                    default:

                        console.warn( 'FBXLoader: Image type "' + extension + '" is not supported.' );
                        return;

                }

                if ( typeof content === 'string' ) { // ASCII format

                    return 'data:' + type + ';base64,' + content;

                } else { // Binary Format

                    var array = new Uint8Array( content );
                    return window.URL.createObjectURL( new Blob( [ array ], { type: type } ) );

                }

            },

            // Parse nodes in FBXTree.Objects.Texture
            // These contain details such as UV scaling, cropping, rotation etc and are connected
            // to images in FBXTree.Objects.Video
            parseTextures: function ( images ) {

                var textureMap = new Map();

                if ( 'Texture' in fbxTree.Objects ) {

                    var textureNodes = fbxTree.Objects.Texture;
                    for ( var nodeID in textureNodes ) {

                        var texture = this.parseTexture( textureNodes[ nodeID ], images );
                        textureMap.set( parseInt( nodeID ), texture );

                    }

                }

                return textureMap;

            },

            // Parse individual node in FBXTree.Objects.Texture
            parseTexture: function ( textureNode, images ) {

                var texture = this.loadTexture( textureNode, images );

                texture.ID = textureNode.id;

                texture.name = textureNode.attrName;

                var wrapModeU = textureNode.WrapModeU;
                var wrapModeV = textureNode.WrapModeV;

                var valueU = wrapModeU !== undefined ? wrapModeU.value : 0;
                var valueV = wrapModeV !== undefined ? wrapModeV.value : 0;

                // http://download.autodesk.com/us/fbx/SDKdocs/FBX_SDK_Help/files/fbxsdkref/class_k_fbx_texture.html#889640e63e2e681259ea81061b85143a
                // 0: repeat(default), 1: clamp

                texture.wrapS = valueU === 0 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
                texture.wrapT = valueV === 0 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;

                if ( 'Scaling' in textureNode ) {

                    var values = textureNode.Scaling.value;

                    texture.repeat.x = values[ 0 ];
                    texture.repeat.y = values[ 1 ];

                }

                return texture;

            },

            // load a texture specified as a blob or data URI, or via an external URL using THREE.TextureLoader
            loadTexture: function ( textureNode, images ) {

                var fileName;

                var currentPath = this.textureLoader.path;

                var children = connections.get( textureNode.id ).children;

                if ( children !== undefined && children.length > 0 && images[ children[ 0 ].ID ] !== undefined ) {

                    fileName = images[ children[ 0 ].ID ];

                    if ( fileName.indexOf( 'blob:' ) === 0 || fileName.indexOf( 'data:' ) === 0 ) {

                        this.textureLoader.setPath( undefined );

                    }

                }

                var texture;

                var extension = textureNode.FileName.slice( - 3 ).toLowerCase();

                if ( extension === 'tga' ) {

                    var loader = THREE.Loader.Handlers.get( '.tga' );

                    if ( loader === null ) {

                        console.warn( 'FBXLoader: TGALoader not found, creating empty placeholder texture for', fileName );
                        texture = new THREE.Texture();

                    } else {

                        texture = loader.load( fileName );

                    }

                } else if ( extension === 'psd' ) {

                    console.warn( 'FBXLoader: PSD textures are not supported, creating empty placeholder texture for', fileName );
                    texture = new THREE.Texture();

                } else {

                    texture = this.textureLoader.load( fileName );

                }

                this.textureLoader.setPath( currentPath );

                return texture;

            },

            // Parse nodes in FBXTree.Objects.Material
            parseMaterials: function ( textureMap ) {

                var materialMap = new Map();

                if ( 'Material' in fbxTree.Objects ) {

                    var materialNodes = fbxTree.Objects.Material;

                    for ( var nodeID in materialNodes ) {

                        var material = this.parseMaterial( materialNodes[ nodeID ], textureMap );

                        if ( material !== null ) materialMap.set( parseInt( nodeID ), material );

                    }

                }

                return materialMap;

            },

            // Parse single node in FBXTree.Objects.Material
            // Materials are connected to texture maps in FBXTree.Objects.Textures
            // FBX format currently only supports Lambert and Phong shading models
            parseMaterial: function ( materialNode, textureMap ) {

                var ID = materialNode.id;
                var name = materialNode.attrName;
                var type = materialNode.ShadingModel;

                // Case where FBX wraps shading model in property object.
                if ( typeof type === 'object' ) {

                    type = type.value;

                }

                // Ignore unused materials which don't have any connections.
                if ( ! connections.has( ID ) ) return null;

                var parameters = this.parseParameters( materialNode, textureMap, ID );

                var material;

                switch ( type.toLowerCase() ) {

                    case 'phong':
                        material = new THREE.MeshPhongMaterial();
                        break;
                    case 'lambert':
                        material = new THREE.MeshLambertMaterial();
                        break;
                    default:
                        console.warn( 'THREE.FBXLoader: unknown material type "%s". Defaulting to MeshPhongMaterial.', type );
                        material = new THREE.MeshPhongMaterial( { color: 0x3300ff } );
                        break;

                }

                material.setValues( parameters );
                material.name = name;

                return material;

            },

            // Parse FBX material and return parameters suitable for a three.js material
            // Also parse the texture map and return any textures associated with the material
            parseParameters: function ( materialNode, textureMap, ID ) {

                var parameters = {};

                if ( materialNode.BumpFactor ) {

                    parameters.bumpScale = materialNode.BumpFactor.value;

                }
                if ( materialNode.Diffuse ) {

                    parameters.color = new THREE.Color().fromArray( materialNode.Diffuse.value );

                } else if ( materialNode.DiffuseColor && materialNode.DiffuseColor.type === 'Color' ) {

                    // The blender exporter exports diffuse here instead of in materialNode.Diffuse
                    parameters.color = new THREE.Color().fromArray( materialNode.DiffuseColor.value );

                }
                if ( materialNode.DisplacementFactor ) {

                    parameters.displacementScale = materialNode.DisplacementFactor.value;

                }
                if ( materialNode.Emissive ) {

                    parameters.emissive = new THREE.Color().fromArray( materialNode.Emissive.value );

                } else if ( materialNode.EmissiveColor && materialNode.EmissiveColor.type === 'Color' ) {

                    // The blender exporter exports emissive color here instead of in materialNode.Emissive
                    parameters.emissive = new THREE.Color().fromArray( materialNode.EmissiveColor.value );

                }
                if ( materialNode.EmissiveFactor ) {

                    parameters.emissiveIntensity = parseFloat( materialNode.EmissiveFactor.value );

                }
                if ( materialNode.Opacity ) {

                    parameters.opacity = parseFloat( materialNode.Opacity.value );

                }
                if ( parameters.opacity < 1.0 ) {

                    parameters.transparent = true;

                }
                if ( materialNode.ReflectionFactor ) {

                    parameters.reflectivity = materialNode.ReflectionFactor.value;

                }
                if ( materialNode.Shininess ) {

                    parameters.shininess = materialNode.Shininess.value;

                }
                if ( materialNode.Specular ) {

                    parameters.specular = new THREE.Color().fromArray( materialNode.Specular.value );

                } else if ( materialNode.SpecularColor && materialNode.SpecularColor.type === 'Color' ) {

                    // The blender exporter exports specular color here instead of in materialNode.Specular
                    parameters.specular = new THREE.Color().fromArray( materialNode.SpecularColor.value );

                }

                var self = this;
                connections.get( ID ).children.forEach( function ( child ) {

                    var type = child.relationship;

                    switch ( type ) {

                        case 'Bump':
                            parameters.bumpMap = self.getTexture( textureMap, child.ID );
                            break;

                        case 'DiffuseColor':
                            parameters.map = self.getTexture( textureMap, child.ID );
                            break;

                        case 'DisplacementColor':
                            parameters.displacementMap = self.getTexture( textureMap, child.ID );
                            break;


                        case 'EmissiveColor':
                            parameters.emissiveMap = self.getTexture( textureMap, child.ID );
                            break;

                        case 'NormalMap':
                            parameters.normalMap = self.getTexture( textureMap, child.ID );
                            break;

                        case 'ReflectionColor':
                            parameters.envMap = self.getTexture( textureMap, child.ID );
                            parameters.envMap.mapping = THREE.EquirectangularReflectionMapping;
                            break;

                        case 'SpecularColor':
                            parameters.specularMap = self.getTexture( textureMap, child.ID );
                            break;

                        case 'TransparentColor':
                            parameters.alphaMap = self.getTexture( textureMap, child.ID );
                            parameters.transparent = true;
                            break;

                        case 'AmbientColor':
                        case 'ShininessExponent': // AKA glossiness map
                        case 'SpecularFactor': // AKA specularLevel
                        case 'VectorDisplacementColor': // NOTE: Seems to be a copy of DisplacementColor
                        default:
                            console.warn( 'THREE.FBXLoader: %s map is not supported in three.js, skipping texture.', type );
                            break;

                    }

                } );

                return parameters;

            },

            // get a texture from the textureMap for use by a material.
            getTexture: function ( textureMap, id ) {

                // if the texture is a layered texture, just use the first layer and issue a warning
                if ( 'LayeredTexture' in fbxTree.Objects && id in fbxTree.Objects.LayeredTexture ) {

                    console.warn( 'THREE.FBXLoader: layered textures are not supported in three.js. Discarding all but first layer.' );
                    id = connections.get( id ).children[ 0 ].ID;

                }

                return textureMap.get( id );

            },

            // Parse nodes in FBXTree.Objects.Deformer
            // Deformer node can contain skinning or Vertex Cache animation data, however only skinning is supported here
            // Generates map of Skeleton-like objects for use later when generating and binding skeletons.
            parseDeformers: function () {

                var skeletons = {};
                var morphTargets = {};

                if ( 'Deformer' in fbxTree.Objects ) {

                    var DeformerNodes = fbxTree.Objects.Deformer;

                    for ( var nodeID in DeformerNodes ) {

                        var deformerNode = DeformerNodes[ nodeID ];

                        var relationships = connections.get( parseInt( nodeID ) );

                        if ( deformerNode.attrType === 'Skin' ) {

                            var skeleton = this.parseSkeleton( relationships, DeformerNodes );
                            skeleton.ID = nodeID;

                            if ( relationships.parents.length > 1 ) console.warn( 'THREE.FBXLoader: skeleton attached to more than one geometry is not supported.' );
                            skeleton.geometryID = relationships.parents[ 0 ].ID;

                            skeletons[ nodeID ] = skeleton;

                        } else if ( deformerNode.attrType === 'BlendShape' ) {

                            var morphTarget = {
                                id: nodeID,
                            };

                            morphTarget.rawTargets = this.parseMorphTargets( relationships, DeformerNodes );
                            morphTarget.id = nodeID;

                            if ( relationships.parents.length > 1 ) console.warn( 'THREE.FBXLoader: morph target attached to more than one geometry is not supported.' );

                            morphTargets[ nodeID ] = morphTarget;

                        }

                    }

                }

                return {

                    skeletons: skeletons,
                    morphTargets: morphTargets,

                };

            },

            // Parse single nodes in FBXTree.Objects.Deformer
            // The top level skeleton node has type 'Skin' and sub nodes have type 'Cluster'
            // Each skin node represents a skeleton and each cluster node represents a bone
            parseSkeleton: function ( relationships, deformerNodes ) {

                var rawBones = [];

                relationships.children.forEach( function ( child ) {

                    var boneNode = deformerNodes[ child.ID ];

                    if ( boneNode.attrType !== 'Cluster' ) return;

                    var rawBone = {

                        ID: child.ID,
                        indices: [],
                        weights: [],
                        transformLink: new THREE.Matrix4().fromArray( boneNode.TransformLink.a ),
                        // transform: new THREE.Matrix4().fromArray( boneNode.Transform.a ),
                        // linkMode: boneNode.Mode,

                    };

                    if ( 'Indexes' in boneNode ) {

                        rawBone.indices = boneNode.Indexes.a;
                        rawBone.weights = boneNode.Weights.a;

                    }

                    rawBones.push( rawBone );

                } );

                return {

                    rawBones: rawBones,
                    bones: []

                };

            },

            // The top level morph deformer node has type "BlendShape" and sub nodes have type "BlendShapeChannel"
            parseMorphTargets: function ( relationships, deformerNodes ) {

                var rawMorphTargets = [];

                for ( var i = 0; i < relationships.children.length; i ++ ) {

                    var child = relationships.children[ i ];

                    var morphTargetNode = deformerNodes[ child.ID ];

                    var rawMorphTarget = {

                        name: morphTargetNode.attrName,
                        initialWeight: morphTargetNode.DeformPercent,
                        id: morphTargetNode.id,
                        fullWeights: morphTargetNode.FullWeights.a

                    };

                    if ( morphTargetNode.attrType !== 'BlendShapeChannel' ) return;

                    rawMorphTarget.geoID = connections.get( parseInt( child.ID ) ).children.filter( function ( child ) {

                        return child.relationship === undefined;

                    } )[ 0 ].ID;

                    rawMorphTargets.push( rawMorphTarget );

                }

                return rawMorphTargets;

            },

            // create the main THREE.Group() to be returned by the loader
            parseScene: function ( deformers, geometryMap, materialMap ) {

                sceneGraph = new THREE.Group();

                var modelMap = this.parseModels( deformers.skeletons, geometryMap, materialMap );

                var modelNodes = fbxTree.Objects.Model;

                var self = this;
                modelMap.forEach( function ( model ) {

                    var modelNode = modelNodes[ model.ID ];
                    self.setLookAtProperties( model, modelNode );

                    var parentConnections = connections.get( model.ID ).parents;

                    parentConnections.forEach( function ( connection ) {

                        var parent = modelMap.get( connection.ID );
                        if ( parent !== undefined ) parent.add( model );

                    } );

                    if ( model.parent === null ) {

                        sceneGraph.add( model );

                    }


                } );

                this.bindSkeleton( deformers.skeletons, geometryMap, modelMap );

                this.createAmbientLight();

                this.setupMorphMaterials();

                sceneGraph.traverse( function ( node ) {

                    if ( node.userData.transformData ) {

                        if ( node.parent ) node.userData.transformData.parentMatrixWorld = node.parent.matrix;

                        var transform = generateTransform( node.userData.transformData );

                        node.applyMatrix( transform );

                    }

                } );

                var animations = new AnimationParser().parse();

                // if all the models where already combined in a single group, just return that
                if ( sceneGraph.children.length === 1 && sceneGraph.children[ 0 ].isGroup ) {

                    sceneGraph.children[ 0 ].animations = animations;
                    sceneGraph = sceneGraph.children[ 0 ];

                }

                sceneGraph.animations = animations;

            },

            // parse nodes in FBXTree.Objects.Model
            parseModels: function ( skeletons, geometryMap, materialMap ) {

                var modelMap = new Map();
                var modelNodes = fbxTree.Objects.Model;

                for ( var nodeID in modelNodes ) {

                    var id = parseInt( nodeID );
                    var node = modelNodes[ nodeID ];
                    var relationships = connections.get( id );

                    var model = this.buildSkeleton( relationships, skeletons, id, node.attrName );

                    if ( ! model ) {

                        switch ( node.attrType ) {

                            case 'Camera':
                                model = this.createCamera( relationships );
                                break;
                            case 'Light':
                                model = this.createLight( relationships );
                                break;
                            case 'Mesh':
                                model = this.createMesh( relationships, geometryMap, materialMap );
                                break;
                            case 'NurbsCurve':
                                model = this.createCurve( relationships, geometryMap );
                                break;
                            case 'LimbNode':
                            case 'Root':
                                model = new THREE.Bone();
                                break;
                            case 'Null':
                            default:
                                model = new THREE.Group();
                                break;

                        }

                        model.name = THREE.PropertyBinding.sanitizeNodeName( node.attrName );
                        model.ID = id;

                    }

                    this.getTransformData( model, node );
                    modelMap.set( id, model );

                }

                return modelMap;

            },

            buildSkeleton: function ( relationships, skeletons, id, name ) {

                var bone = null;

                relationships.parents.forEach( function ( parent ) {

                    for ( var ID in skeletons ) {

                        var skeleton = skeletons[ ID ];

                        skeleton.rawBones.forEach( function ( rawBone, i ) {

                            if ( rawBone.ID === parent.ID ) {

                                var subBone = bone;
                                bone = new THREE.Bone();

                                bone.matrixWorld.copy( rawBone.transformLink );

                                // set name and id here - otherwise in cases where "subBone" is created it will not have a name / id
                                bone.name = THREE.PropertyBinding.sanitizeNodeName( name );
                                bone.ID = id;

                                skeleton.bones[ i ] = bone;

                                // In cases where a bone is shared between multiple meshes
                                // duplicate the bone here and and it as a child of the first bone
                                if ( subBone !== null ) {

                                    bone.add( subBone );

                                }

                            }

                        } );

                    }

                } );

                return bone;

            },

            // create a THREE.PerspectiveCamera or THREE.OrthographicCamera
            createCamera: function ( relationships ) {

                var model;
                var cameraAttribute;

                relationships.children.forEach( function ( child ) {

                    var attr = fbxTree.Objects.NodeAttribute[ child.ID ];

                    if ( attr !== undefined ) {

                        cameraAttribute = attr;

                    }

                } );

                if ( cameraAttribute === undefined ) {

                    model = new THREE.Object3D();

                } else {

                    var type = 0;
                    if ( cameraAttribute.CameraProjectionType !== undefined && cameraAttribute.CameraProjectionType.value === 1 ) {

                        type = 1;

                    }

                    var nearClippingPlane = 1;
                    if ( cameraAttribute.NearPlane !== undefined ) {

                        nearClippingPlane = cameraAttribute.NearPlane.value / 1000;

                    }

                    var farClippingPlane = 1000;
                    if ( cameraAttribute.FarPlane !== undefined ) {

                        farClippingPlane = cameraAttribute.FarPlane.value / 1000;

                    }


                    var width = window.innerWidth;
                    var height = window.innerHeight;

                    if ( cameraAttribute.AspectWidth !== undefined && cameraAttribute.AspectHeight !== undefined ) {

                        width = cameraAttribute.AspectWidth.value;
                        height = cameraAttribute.AspectHeight.value;

                    }

                    var aspect = width / height;

                    var fov = 45;
                    if ( cameraAttribute.FieldOfView !== undefined ) {

                        fov = cameraAttribute.FieldOfView.value;

                    }

                    var focalLength = cameraAttribute.FocalLength ? cameraAttribute.FocalLength.value : null;

                    switch ( type ) {

                        case 0: // Perspective
                            model = new THREE.PerspectiveCamera( fov, aspect, nearClippingPlane, farClippingPlane );
                            if ( focalLength !== null ) model.setFocalLength( focalLength );
                            break;

                        case 1: // Orthographic
                            model = new THREE.OrthographicCamera( - width / 2, width / 2, height / 2, - height / 2, nearClippingPlane, farClippingPlane );
                            break;

                        default:
                            console.warn( 'THREE.FBXLoader: Unknown camera type ' + type + '.' );
                            model = new THREE.Object3D();
                            break;

                    }

                }

                return model;

            },

            // Create a THREE.DirectionalLight, THREE.PointLight or THREE.SpotLight
            createLight: function ( relationships ) {

                var model;
                var lightAttribute;

                relationships.children.forEach( function ( child ) {

                    var attr = fbxTree.Objects.NodeAttribute[ child.ID ];

                    if ( attr !== undefined ) {

                        lightAttribute = attr;

                    }

                } );

                if ( lightAttribute === undefined ) {

                    model = new THREE.Object3D();

                } else {

                    var type;

                    // LightType can be undefined for Point lights
                    if ( lightAttribute.LightType === undefined ) {

                        type = 0;

                    } else {

                        type = lightAttribute.LightType.value;

                    }

                    var color = 0xffffff;

                    if ( lightAttribute.Color !== undefined ) {

                        color = new THREE.Color().fromArray( lightAttribute.Color.value );

                    }

                    var intensity = ( lightAttribute.Intensity === undefined ) ? 1 : lightAttribute.Intensity.value / 100;

                    // light disabled
                    if ( lightAttribute.CastLightOnObject !== undefined && lightAttribute.CastLightOnObject.value === 0 ) {

                        intensity = 0;

                    }

                    var distance = 0;
                    if ( lightAttribute.FarAttenuationEnd !== undefined ) {

                        if ( lightAttribute.EnableFarAttenuation !== undefined && lightAttribute.EnableFarAttenuation.value === 0 ) {

                            distance = 0;

                        } else {

                            distance = lightAttribute.FarAttenuationEnd.value;

                        }

                    }

                    // TODO: could this be calculated linearly from FarAttenuationStart to FarAttenuationEnd?
                    var decay = 1;

                    switch ( type ) {

                        case 0: // Point
                            model = new THREE.PointLight( color, intensity, distance, decay );
                            break;

                        case 1: // Directional
                            model = new THREE.DirectionalLight( color, intensity );
                            break;

                        case 2: // Spot
                            var angle = Math.PI / 3;

                            if ( lightAttribute.InnerAngle !== undefined ) {

                                angle = THREE.Math.degToRad( lightAttribute.InnerAngle.value );

                            }

                            var penumbra = 0;
                            if ( lightAttribute.OuterAngle !== undefined ) {

                                // TODO: this is not correct - FBX calculates outer and inner angle in degrees
                                // with OuterAngle > InnerAngle && OuterAngle <= Math.PI
                                // while three.js uses a penumbra between (0, 1) to attenuate the inner angle
                                penumbra = THREE.Math.degToRad( lightAttribute.OuterAngle.value );
                                penumbra = Math.max( penumbra, 1 );

                            }

                            model = new THREE.SpotLight( color, intensity, distance, angle, penumbra, decay );
                            break;

                        default:
                            console.warn( 'THREE.FBXLoader: Unknown light type ' + lightAttribute.LightType.value + ', defaulting to a THREE.PointLight.' );
                            model = new THREE.PointLight( color, intensity );
                            break;

                    }

                    if ( lightAttribute.CastShadows !== undefined && lightAttribute.CastShadows.value === 1 ) {

                        model.castShadow = true;

                    }

                }

                return model;

            },

            createMesh: function ( relationships, geometryMap, materialMap ) {

                var model;
                var geometry = null;
                var material = null;
                var materials = [];

                // get geometry and materials(s) from connections
                relationships.children.forEach( function ( child ) {

                    if ( geometryMap.has( child.ID ) ) {

                        geometry = geometryMap.get( child.ID );

                    }

                    if ( materialMap.has( child.ID ) ) {

                        materials.push( materialMap.get( child.ID ) );

                    }

                } );

                if ( materials.length > 1 ) {

                    material = materials;

                } else if ( materials.length > 0 ) {

                    material = materials[ 0 ];

                } else {

                    material = new THREE.MeshPhongMaterial( { color: 0xcccccc } );
                    materials.push( material );

                }

                if ( 'color' in geometry.attributes ) {

                    materials.forEach( function ( material ) {

                        material.vertexColors = THREE.VertexColors;

                    } );

                }

                if ( geometry.FBX_Deformer ) {

                    materials.forEach( function ( material ) {

                        material.skinning = true;

                    } );

                    model = new THREE.SkinnedMesh( geometry, material );

                } else {

                    model = new THREE.Mesh( geometry, material );

                }

                return model;

            },

            createCurve: function ( relationships, geometryMap ) {

                var geometry = relationships.children.reduce( function ( geo, child ) {

                    if ( geometryMap.has( child.ID ) ) geo = geometryMap.get( child.ID );

                    return geo;

                }, null );

                // FBX does not list materials for Nurbs lines, so we'll just put our own in here.
                var material = new THREE.LineBasicMaterial( { color: 0x3300ff, linewidth: 1 } );
                return new THREE.Line( geometry, material );

            },

            // parse the model node for transform data
            getTransformData: function ( model, modelNode ) {

                var transformData = {};

                if ( 'InheritType' in modelNode ) transformData.inheritType = parseInt( modelNode.InheritType.value );

                if ( 'RotationOrder' in modelNode ) transformData.eulerOrder = getEulerOrder( modelNode.RotationOrder.value );
                else transformData.eulerOrder = 'ZYX';

                if ( 'Lcl_Translation' in modelNode ) transformData.translation = modelNode.Lcl_Translation.value;

                if ( 'PreRotation' in modelNode ) transformData.preRotation = modelNode.PreRotation.value;
                if ( 'Lcl_Rotation' in modelNode ) transformData.rotation = modelNode.Lcl_Rotation.value;
                if ( 'PostRotation' in modelNode ) transformData.postRotation = modelNode.PostRotation.value;

                if ( 'Lcl_Scaling' in modelNode ) transformData.scale = modelNode.Lcl_Scaling.value;

                if ( 'ScalingOffset' in modelNode ) transformData.scalingOffset = modelNode.ScalingOffset.value;
                if ( 'ScalingPivot' in modelNode ) transformData.scalingPivot = modelNode.ScalingPivot.value;

                if ( 'RotationOffset' in modelNode ) transformData.rotationOffset = modelNode.RotationOffset.value;
                if ( 'RotationPivot' in modelNode ) transformData.rotationPivot = modelNode.RotationPivot.value;

                model.userData.transformData = transformData;

            },

            setLookAtProperties: function ( model, modelNode ) {

                if ( 'LookAtProperty' in modelNode ) {

                    var children = connections.get( model.ID ).children;

                    children.forEach( function ( child ) {

                        if ( child.relationship === 'LookAtProperty' ) {

                            var lookAtTarget = fbxTree.Objects.Model[ child.ID ];

                            if ( 'Lcl_Translation' in lookAtTarget ) {

                                var pos = lookAtTarget.Lcl_Translation.value;

                                // DirectionalLight, SpotLight
                                if ( model.target !== undefined ) {

                                    model.target.position.fromArray( pos );
                                    sceneGraph.add( model.target );

                                } else { // Cameras and other Object3Ds

                                    model.lookAt( new THREE.Vector3().fromArray( pos ) );

                                }

                            }

                        }

                    } );

                }

            },

            bindSkeleton: function ( skeletons, geometryMap, modelMap ) {

                var bindMatrices = this.parsePoseNodes();

                for ( var ID in skeletons ) {

                    var skeleton = skeletons[ ID ];

                    var parents = connections.get( parseInt( skeleton.ID ) ).parents;

                    parents.forEach( function ( parent ) {

                        if ( geometryMap.has( parent.ID ) ) {

                            var geoID = parent.ID;
                            var geoRelationships = connections.get( geoID );

                            geoRelationships.parents.forEach( function ( geoConnParent ) {

                                if ( modelMap.has( geoConnParent.ID ) ) {

                                    var model = modelMap.get( geoConnParent.ID );

                                    model.bind( new THREE.Skeleton( skeleton.bones ), bindMatrices[ geoConnParent.ID ] );

                                }

                            } );

                        }

                    } );

                }

            },

            parsePoseNodes: function () {

                var bindMatrices = {};

                if ( 'Pose' in fbxTree.Objects ) {

                    var BindPoseNode = fbxTree.Objects.Pose;

                    for ( var nodeID in BindPoseNode ) {

                        if ( BindPoseNode[ nodeID ].attrType === 'BindPose' ) {

                            var poseNodes = BindPoseNode[ nodeID ].PoseNode;

                            if ( Array.isArray( poseNodes ) ) {

                                poseNodes.forEach( function ( poseNode ) {

                                    bindMatrices[ poseNode.Node ] = new THREE.Matrix4().fromArray( poseNode.Matrix.a );

                                } );

                            } else {

                                bindMatrices[ poseNodes.Node ] = new THREE.Matrix4().fromArray( poseNodes.Matrix.a );

                            }

                        }

                    }

                }

                return bindMatrices;

            },

            // Parse ambient color in FBXTree.GlobalSettings - if it's not set to black (default), create an ambient light
            createAmbientLight: function () {

                if ( 'GlobalSettings' in fbxTree && 'AmbientColor' in fbxTree.GlobalSettings ) {

                    var ambientColor = fbxTree.GlobalSettings.AmbientColor.value;
                    var r = ambientColor[ 0 ];
                    var g = ambientColor[ 1 ];
                    var b = ambientColor[ 2 ];

                    if ( r !== 0 || g !== 0 || b !== 0 ) {

                        var color = new THREE.Color( r, g, b );
                        sceneGraph.add( new THREE.AmbientLight( color, 1 ) );

                    }

                }

            },

            setupMorphMaterials: function () {

                var self = this;
                sceneGraph.traverse( function ( child ) {

                    if ( child.isMesh ) {

                        if ( child.geometry.morphAttributes.position && child.geometry.morphAttributes.position.length ) {

                            if ( Array.isArray( child.material ) ) {

                                child.material.forEach( function ( material, i ) {

                                    self.setupMorphMaterial( child, material, i );

                                } );

                            } else {

                                self.setupMorphMaterial( child, child.material );

                            }

                        }

                    }

                } );

            },

            setupMorphMaterial: function ( child, material, index ) {

                var uuid = child.uuid;
                var matUuid = material.uuid;

                // if a geometry has morph targets, it cannot share the material with other geometries
                var sharedMat = false;

                sceneGraph.traverse( function ( node ) {

                    if ( node.isMesh ) {

                        if ( Array.isArray( node.material ) ) {

                            node.material.forEach( function ( mat ) {

                                if ( mat.uuid === matUuid && node.uuid !== uuid ) sharedMat = true;

                            } );

                        } else if ( node.material.uuid === matUuid && node.uuid !== uuid ) sharedMat = true;

                    }

                } );

                if ( sharedMat === true ) {

                    var clonedMat = material.clone();
                    clonedMat.morphTargets = true;

                    if ( index === undefined ) child.material = clonedMat;
                    else child.material[ index ] = clonedMat;

                } else material.morphTargets = true;

            }

        };

        // parse Geometry data from FBXTree and return map of BufferGeometries
        function GeometryParser() {}

        GeometryParser.prototype = {

            constructor: GeometryParser,

            // Parse nodes in FBXTree.Objects.Geometry
            parse: function ( deformers ) {

                var geometryMap = new Map();

                if ( 'Geometry' in fbxTree.Objects ) {

                    var geoNodes = fbxTree.Objects.Geometry;

                    for ( var nodeID in geoNodes ) {

                        var relationships = connections.get( parseInt( nodeID ) );
                        var geo = this.parseGeometry( relationships, geoNodes[ nodeID ], deformers );

                        geometryMap.set( parseInt( nodeID ), geo );

                    }

                }

                return geometryMap;

            },

            // Parse single node in FBXTree.Objects.Geometry
            parseGeometry: function ( relationships, geoNode, deformers ) {

                switch ( geoNode.attrType ) {

                    case 'Mesh':
                        return this.parseMeshGeometry( relationships, geoNode, deformers );
                        break;

                    case 'NurbsCurve':
                        return this.parseNurbsGeometry( geoNode );
                        break;

                }

            },

            // Parse single node mesh geometry in FBXTree.Objects.Geometry
            parseMeshGeometry: function ( relationships, geoNode, deformers ) {

                var skeletons = deformers.skeletons;
                var morphTargets = deformers.morphTargets;

                var modelNodes = relationships.parents.map( function ( parent ) {

                    return fbxTree.Objects.Model[ parent.ID ];

                } );

                // don't create geometry if it is not associated with any models
                if ( modelNodes.length === 0 ) return;

                var skeleton = relationships.children.reduce( function ( skeleton, child ) {

                    if ( skeletons[ child.ID ] !== undefined ) skeleton = skeletons[ child.ID ];

                    return skeleton;

                }, null );

                var morphTarget = relationships.children.reduce( function ( morphTarget, child ) {

                    if ( morphTargets[ child.ID ] !== undefined ) morphTarget = morphTargets[ child.ID ];

                    return morphTarget;

                }, null );

                // Assume one model and get the preRotation from that
                // if there is more than one model associated with the geometry this may cause problems
                var modelNode = modelNodes[ 0 ];

                var transformData = {};

                if ( 'RotationOrder' in modelNode ) transformData.eulerOrder = getEulerOrder( modelNode.RotationOrder.value );
                if ( 'InheritType' in modelNode ) transformData.inheritType = parseInt( modelNode.InheritType.value );

                if ( 'GeometricTranslation' in modelNode ) transformData.translation = modelNode.GeometricTranslation.value;
                if ( 'GeometricRotation' in modelNode ) transformData.rotation = modelNode.GeometricRotation.value;
                if ( 'GeometricScaling' in modelNode ) transformData.scale = modelNode.GeometricScaling.value;

                var transform = generateTransform( transformData );

                return this.genGeometry( geoNode, skeleton, morphTarget, transform );

            },

            // Generate a THREE.BufferGeometry from a node in FBXTree.Objects.Geometry
            genGeometry: function ( geoNode, skeleton, morphTarget, preTransform ) {

                var geo = new THREE.BufferGeometry();
                if ( geoNode.attrName ) geo.name = geoNode.attrName;

                var geoInfo = this.parseGeoNode( geoNode, skeleton );
                var buffers = this.genBuffers( geoInfo );

                var positionAttribute = new THREE.Float32BufferAttribute( buffers.vertex, 3 );

                preTransform.applyToBufferAttribute( positionAttribute );

                geo.addAttribute( 'position', positionAttribute );

                if ( buffers.colors.length > 0 ) {

                    geo.addAttribute( 'color', new THREE.Float32BufferAttribute( buffers.colors, 3 ) );

                }

                if ( skeleton ) {

                    geo.addAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( buffers.weightsIndices, 4 ) );

                    geo.addAttribute( 'skinWeight', new THREE.Float32BufferAttribute( buffers.vertexWeights, 4 ) );

                    // used later to bind the skeleton to the model
                    geo.FBX_Deformer = skeleton;

                }

                if ( buffers.normal.length > 0 ) {

                    var normalAttribute = new THREE.Float32BufferAttribute( buffers.normal, 3 );

                    var normalMatrix = new THREE.Matrix3().getNormalMatrix( preTransform );
                    normalMatrix.applyToBufferAttribute( normalAttribute );

                    geo.addAttribute( 'normal', normalAttribute );

                }

                buffers.uvs.forEach( function ( uvBuffer, i ) {

                    // subsequent uv buffers are called 'uv1', 'uv2', ...
                    var name = 'uv' + ( i + 1 ).toString();

                    // the first uv buffer is just called 'uv'
                    if ( i === 0 ) {

                        name = 'uv';

                    }

                    geo.addAttribute( name, new THREE.Float32BufferAttribute( buffers.uvs[ i ], 2 ) );

                } );

                if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {

                    // Convert the material indices of each vertex into rendering groups on the geometry.
                    var prevMaterialIndex = buffers.materialIndex[ 0 ];
                    var startIndex = 0;

                    buffers.materialIndex.forEach( function ( currentIndex, i ) {

                        if ( currentIndex !== prevMaterialIndex ) {

                            geo.addGroup( startIndex, i - startIndex, prevMaterialIndex );

                            prevMaterialIndex = currentIndex;
                            startIndex = i;

                        }

                    } );

                    // the loop above doesn't add the last group, do that here.
                    if ( geo.groups.length > 0 ) {

                        var lastGroup = geo.groups[ geo.groups.length - 1 ];
                        var lastIndex = lastGroup.start + lastGroup.count;

                        if ( lastIndex !== buffers.materialIndex.length ) {

                            geo.addGroup( lastIndex, buffers.materialIndex.length - lastIndex, prevMaterialIndex );

                        }

                    }

                    // case where there are multiple materials but the whole geometry is only
                    // using one of them
                    if ( geo.groups.length === 0 ) {

                        geo.addGroup( 0, buffers.materialIndex.length, buffers.materialIndex[ 0 ] );

                    }

                }

                this.addMorphTargets( geo, geoNode, morphTarget, preTransform );

                return geo;

            },

            parseGeoNode: function ( geoNode, skeleton ) {

                var geoInfo = {};

                geoInfo.vertexPositions = ( geoNode.Vertices !== undefined ) ? geoNode.Vertices.a : [];
                geoInfo.vertexIndices = ( geoNode.PolygonVertexIndex !== undefined ) ? geoNode.PolygonVertexIndex.a : [];

                if ( geoNode.LayerElementColor ) {

                    geoInfo.color = this.parseVertexColors( geoNode.LayerElementColor[ 0 ] );

                }

                if ( geoNode.LayerElementMaterial ) {

                    geoInfo.material = this.parseMaterialIndices( geoNode.LayerElementMaterial[ 0 ] );

                }

                if ( geoNode.LayerElementNormal ) {

                    geoInfo.normal = this.parseNormals( geoNode.LayerElementNormal[ 0 ] );

                }

                if ( geoNode.LayerElementUV ) {

                    geoInfo.uv = [];

                    var i = 0;
                    while ( geoNode.LayerElementUV[ i ] ) {

                        geoInfo.uv.push( this.parseUVs( geoNode.LayerElementUV[ i ] ) );
                        i ++;

                    }

                }

                geoInfo.weightTable = {};

                if ( skeleton !== null ) {

                    geoInfo.skeleton = skeleton;

                    skeleton.rawBones.forEach( function ( rawBone, i ) {

                        // loop over the bone's vertex indices and weights
                        rawBone.indices.forEach( function ( index, j ) {

                            if ( geoInfo.weightTable[ index ] === undefined ) geoInfo.weightTable[ index ] = [];

                            geoInfo.weightTable[ index ].push( {

                                id: i,
                                weight: rawBone.weights[ j ],

                            } );

                        } );

                    } );

                }

                return geoInfo;

            },

            genBuffers: function ( geoInfo ) {

                var buffers = {
                    vertex: [],
                    normal: [],
                    colors: [],
                    uvs: [],
                    materialIndex: [],
                    vertexWeights: [],
                    weightsIndices: [],
                };

                var polygonIndex = 0;
                var faceLength = 0;
                var displayedWeightsWarning = false;

                // these will hold data for a single face
                var facePositionIndexes = [];
                var faceNormals = [];
                var faceColors = [];
                var faceUVs = [];
                var faceWeights = [];
                var faceWeightIndices = [];

                var self = this;
                geoInfo.vertexIndices.forEach( function ( vertexIndex, polygonVertexIndex ) {

                    var endOfFace = false;

                    // Face index and vertex index arrays are combined in a single array
                    // A cube with quad faces looks like this:
                    // PolygonVertexIndex: *24 {
                    //  a: 0, 1, 3, -3, 2, 3, 5, -5, 4, 5, 7, -7, 6, 7, 1, -1, 1, 7, 5, -4, 6, 0, 2, -5
                    //  }
                    // Negative numbers mark the end of a face - first face here is 0, 1, 3, -3
                    // to find index of last vertex bit shift the index: ^ - 1
                    if ( vertexIndex < 0 ) {

                        vertexIndex = vertexIndex ^ - 1; // equivalent to ( x * -1 ) - 1
                        endOfFace = true;

                    }

                    var weightIndices = [];
                    var weights = [];

                    facePositionIndexes.push( vertexIndex * 3, vertexIndex * 3 + 1, vertexIndex * 3 + 2 );

                    if ( geoInfo.color ) {

                        var data = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.color );

                        faceColors.push( data[ 0 ], data[ 1 ], data[ 2 ] );

                    }

                    if ( geoInfo.skeleton ) {

                        if ( geoInfo.weightTable[ vertexIndex ] !== undefined ) {

                            geoInfo.weightTable[ vertexIndex ].forEach( function ( wt ) {

                                weights.push( wt.weight );
                                weightIndices.push( wt.id );

                            } );


                        }

                        if ( weights.length > 4 ) {

                            if ( ! displayedWeightsWarning ) {

                                console.warn( 'THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to vertex. Deleting additional weights.' );
                                displayedWeightsWarning = true;

                            }

                            var wIndex = [ 0, 0, 0, 0 ];
                            var Weight = [ 0, 0, 0, 0 ];

                            weights.forEach( function ( weight, weightIndex ) {

                                var currentWeight = weight;
                                var currentIndex = weightIndices[ weightIndex ];

                                Weight.forEach( function ( comparedWeight, comparedWeightIndex, comparedWeightArray ) {

                                    if ( currentWeight > comparedWeight ) {

                                        comparedWeightArray[ comparedWeightIndex ] = currentWeight;
                                        currentWeight = comparedWeight;

                                        var tmp = wIndex[ comparedWeightIndex ];
                                        wIndex[ comparedWeightIndex ] = currentIndex;
                                        currentIndex = tmp;

                                    }

                                } );

                            } );

                            weightIndices = wIndex;
                            weights = Weight;

                        }

                        // if the weight array is shorter than 4 pad with 0s
                        while ( weights.length < 4 ) {

                            weights.push( 0 );
                            weightIndices.push( 0 );

                        }

                        for ( var i = 0; i < 4; ++ i ) {

                            faceWeights.push( weights[ i ] );
                            faceWeightIndices.push( weightIndices[ i ] );

                        }

                    }

                    if ( geoInfo.normal ) {

                        var data = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.normal );

                        faceNormals.push( data[ 0 ], data[ 1 ], data[ 2 ] );

                    }

                    if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {

                        var materialIndex = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.material )[ 0 ];

                    }

                    if ( geoInfo.uv ) {

                        geoInfo.uv.forEach( function ( uv, i ) {

                            var data = getData( polygonVertexIndex, polygonIndex, vertexIndex, uv );

                            if ( faceUVs[ i ] === undefined ) {

                                faceUVs[ i ] = [];

                            }

                            faceUVs[ i ].push( data[ 0 ] );
                            faceUVs[ i ].push( data[ 1 ] );

                        } );

                    }

                    faceLength ++;

                    if ( endOfFace ) {

                        self.genFace( buffers, geoInfo, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength );

                        polygonIndex ++;
                        faceLength = 0;

                        // reset arrays for the next face
                        facePositionIndexes = [];
                        faceNormals = [];
                        faceColors = [];
                        faceUVs = [];
                        faceWeights = [];
                        faceWeightIndices = [];

                    }

                } );

                return buffers;

            },

            // Generate data for a single face in a geometry. If the face is a quad then split it into 2 tris
            genFace: function ( buffers, geoInfo, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength ) {

                for ( var i = 2; i < faceLength; i ++ ) {

                    buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 0 ] ] );
                    buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 1 ] ] );
                    buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 2 ] ] );

                    buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 ] ] );
                    buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 + 1 ] ] );
                    buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 + 2 ] ] );

                    buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 ] ] );
                    buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 + 1 ] ] );
                    buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 + 2 ] ] );

                    if ( geoInfo.skeleton ) {

                        buffers.vertexWeights.push( faceWeights[ 0 ] );
                        buffers.vertexWeights.push( faceWeights[ 1 ] );
                        buffers.vertexWeights.push( faceWeights[ 2 ] );
                        buffers.vertexWeights.push( faceWeights[ 3 ] );

                        buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 ] );
                        buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 1 ] );
                        buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 2 ] );
                        buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 3 ] );

                        buffers.vertexWeights.push( faceWeights[ i * 4 ] );
                        buffers.vertexWeights.push( faceWeights[ i * 4 + 1 ] );
                        buffers.vertexWeights.push( faceWeights[ i * 4 + 2 ] );
                        buffers.vertexWeights.push( faceWeights[ i * 4 + 3 ] );

                        buffers.weightsIndices.push( faceWeightIndices[ 0 ] );
                        buffers.weightsIndices.push( faceWeightIndices[ 1 ] );
                        buffers.weightsIndices.push( faceWeightIndices[ 2 ] );
                        buffers.weightsIndices.push( faceWeightIndices[ 3 ] );

                        buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 ] );
                        buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 1 ] );
                        buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 2 ] );
                        buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 3 ] );

                        buffers.weightsIndices.push( faceWeightIndices[ i * 4 ] );
                        buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 1 ] );
                        buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 2 ] );
                        buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 3 ] );

                    }

                    if ( geoInfo.color ) {

                        buffers.colors.push( faceColors[ 0 ] );
                        buffers.colors.push( faceColors[ 1 ] );
                        buffers.colors.push( faceColors[ 2 ] );

                        buffers.colors.push( faceColors[ ( i - 1 ) * 3 ] );
                        buffers.colors.push( faceColors[ ( i - 1 ) * 3 + 1 ] );
                        buffers.colors.push( faceColors[ ( i - 1 ) * 3 + 2 ] );

                        buffers.colors.push( faceColors[ i * 3 ] );
                        buffers.colors.push( faceColors[ i * 3 + 1 ] );
                        buffers.colors.push( faceColors[ i * 3 + 2 ] );

                    }

                    if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {

                        buffers.materialIndex.push( materialIndex );
                        buffers.materialIndex.push( materialIndex );
                        buffers.materialIndex.push( materialIndex );

                    }

                    if ( geoInfo.normal ) {

                        buffers.normal.push( faceNormals[ 0 ] );
                        buffers.normal.push( faceNormals[ 1 ] );
                        buffers.normal.push( faceNormals[ 2 ] );

                        buffers.normal.push( faceNormals[ ( i - 1 ) * 3 ] );
                        buffers.normal.push( faceNormals[ ( i - 1 ) * 3 + 1 ] );
                        buffers.normal.push( faceNormals[ ( i - 1 ) * 3 + 2 ] );

                        buffers.normal.push( faceNormals[ i * 3 ] );
                        buffers.normal.push( faceNormals[ i * 3 + 1 ] );
                        buffers.normal.push( faceNormals[ i * 3 + 2 ] );

                    }

                    if ( geoInfo.uv ) {

                        geoInfo.uv.forEach( function ( uv, j ) {

                            if ( buffers.uvs[ j ] === undefined ) buffers.uvs[ j ] = [];

                            buffers.uvs[ j ].push( faceUVs[ j ][ 0 ] );
                            buffers.uvs[ j ].push( faceUVs[ j ][ 1 ] );

                            buffers.uvs[ j ].push( faceUVs[ j ][ ( i - 1 ) * 2 ] );
                            buffers.uvs[ j ].push( faceUVs[ j ][ ( i - 1 ) * 2 + 1 ] );

                            buffers.uvs[ j ].push( faceUVs[ j ][ i * 2 ] );
                            buffers.uvs[ j ].push( faceUVs[ j ][ i * 2 + 1 ] );

                        } );

                    }

                }

            },

            addMorphTargets: function ( parentGeo, parentGeoNode, morphTarget, preTransform ) {

                if ( morphTarget === null ) return;

                parentGeo.morphAttributes.position = [];
                // parentGeo.morphAttributes.normal = []; // not implemented

                var self = this;
                morphTarget.rawTargets.forEach( function ( rawTarget ) {

                    var morphGeoNode = fbxTree.Objects.Geometry[ rawTarget.geoID ];

                    if ( morphGeoNode !== undefined ) {

                        self.genMorphGeometry( parentGeo, parentGeoNode, morphGeoNode, preTransform, rawTarget.name );

                    }

                } );

            },

            // a morph geometry node is similar to a standard  node, and the node is also contained
            // in FBXTree.Objects.Geometry, however it can only have attributes for position, normal
            // and a special attribute Index defining which vertices of the original geometry are affected
            // Normal and position attributes only have data for the vertices that are affected by the morph
            genMorphGeometry: function ( parentGeo, parentGeoNode, morphGeoNode, preTransform, name ) {

                var morphGeo = new THREE.BufferGeometry();
                if ( morphGeoNode.attrName ) morphGeo.name = morphGeoNode.attrName;

                var vertexIndices = ( parentGeoNode.PolygonVertexIndex !== undefined ) ? parentGeoNode.PolygonVertexIndex.a : [];

                // make a copy of the parent's vertex positions
                var vertexPositions = ( parentGeoNode.Vertices !== undefined ) ? parentGeoNode.Vertices.a.slice() : [];

                var morphPositions = ( morphGeoNode.Vertices !== undefined ) ? morphGeoNode.Vertices.a : [];
                var indices = ( morphGeoNode.Indexes !== undefined ) ? morphGeoNode.Indexes.a : [];

                for ( var i = 0; i < indices.length; i ++ ) {

                    var morphIndex = indices[ i ] * 3;

                    // FBX format uses blend shapes rather than morph targets. This can be converted
                    // by additively combining the blend shape positions with the original geometry's positions
                    vertexPositions[ morphIndex ] += morphPositions[ i * 3 ];
                    vertexPositions[ morphIndex + 1 ] += morphPositions[ i * 3 + 1 ];
                    vertexPositions[ morphIndex + 2 ] += morphPositions[ i * 3 + 2 ];

                }

                // TODO: add morph normal support
                var morphGeoInfo = {
                    vertexIndices: vertexIndices,
                    vertexPositions: vertexPositions,
                };

                var morphBuffers = this.genBuffers( morphGeoInfo );

                var positionAttribute = new THREE.Float32BufferAttribute( morphBuffers.vertex, 3 );
                positionAttribute.name = name || morphGeoNode.attrName;

                preTransform.applyToBufferAttribute( positionAttribute );

                parentGeo.morphAttributes.position.push( positionAttribute );

            },

            // Parse normal from FBXTree.Objects.Geometry.LayerElementNormal if it exists
            parseNormals: function ( NormalNode ) {

                var mappingType = NormalNode.MappingInformationType;
                var referenceType = NormalNode.ReferenceInformationType;
                var buffer = NormalNode.Normals.a;
                var indexBuffer = [];
                if ( referenceType === 'IndexToDirect' ) {

                    if ( 'NormalIndex' in NormalNode ) {

                        indexBuffer = NormalNode.NormalIndex.a;

                    } else if ( 'NormalsIndex' in NormalNode ) {

                        indexBuffer = NormalNode.NormalsIndex.a;

                    }

                }

                return {
                    dataSize: 3,
                    buffer: buffer,
                    indices: indexBuffer,
                    mappingType: mappingType,
                    referenceType: referenceType
                };

            },

            // Parse UVs from FBXTree.Objects.Geometry.LayerElementUV if it exists
            parseUVs: function ( UVNode ) {

                var mappingType = UVNode.MappingInformationType;
                var referenceType = UVNode.ReferenceInformationType;
                var buffer = UVNode.UV.a;
                var indexBuffer = [];
                if ( referenceType === 'IndexToDirect' ) {

                    indexBuffer = UVNode.UVIndex.a;

                }

                return {
                    dataSize: 2,
                    buffer: buffer,
                    indices: indexBuffer,
                    mappingType: mappingType,
                    referenceType: referenceType
                };

            },

            // Parse Vertex Colors from FBXTree.Objects.Geometry.LayerElementColor if it exists
            parseVertexColors: function ( ColorNode ) {

                var mappingType = ColorNode.MappingInformationType;
                var referenceType = ColorNode.ReferenceInformationType;
                var buffer = ColorNode.Colors.a;
                var indexBuffer = [];
                if ( referenceType === 'IndexToDirect' ) {

                    indexBuffer = ColorNode.ColorIndex.a;

                }

                return {
                    dataSize: 4,
                    buffer: buffer,
                    indices: indexBuffer,
                    mappingType: mappingType,
                    referenceType: referenceType
                };

            },

            // Parse mapping and material data in FBXTree.Objects.Geometry.LayerElementMaterial if it exists
            parseMaterialIndices: function ( MaterialNode ) {

                var mappingType = MaterialNode.MappingInformationType;
                var referenceType = MaterialNode.ReferenceInformationType;

                if ( mappingType === 'NoMappingInformation' ) {

                    return {
                        dataSize: 1,
                        buffer: [ 0 ],
                        indices: [ 0 ],
                        mappingType: 'AllSame',
                        referenceType: referenceType
                    };

                }

                var materialIndexBuffer = MaterialNode.Materials.a;

                // Since materials are stored as indices, there's a bit of a mismatch between FBX and what
                // we expect.So we create an intermediate buffer that points to the index in the buffer,
                // for conforming with the other functions we've written for other data.
                var materialIndices = [];

                for ( var i = 0; i < materialIndexBuffer.length; ++ i ) {

                    materialIndices.push( i );

                }

                return {
                    dataSize: 1,
                    buffer: materialIndexBuffer,
                    indices: materialIndices,
                    mappingType: mappingType,
                    referenceType: referenceType
                };

            },

            // Generate a NurbGeometry from a node in FBXTree.Objects.Geometry
            parseNurbsGeometry: function ( geoNode ) {

                if ( THREE.NURBSCurve === undefined ) {

                    console.error( 'THREE.FBXLoader: The loader relies on THREE.NURBSCurve for any nurbs present in the model. Nurbs will show up as empty geometry.' );
                    return new THREE.BufferGeometry();

                }

                var order = parseInt( geoNode.Order );

                if ( isNaN( order ) ) {

                    console.error( 'THREE.FBXLoader: Invalid Order %s given for geometry ID: %s', geoNode.Order, geoNode.id );
                    return new THREE.BufferGeometry();

                }

                var degree = order - 1;

                var knots = geoNode.KnotVector.a;
                var controlPoints = [];
                var pointsValues = geoNode.Points.a;

                for ( var i = 0, l = pointsValues.length; i < l; i += 4 ) {

                    controlPoints.push( new THREE.Vector4().fromArray( pointsValues, i ) );

                }

                var startKnot, endKnot;

                if ( geoNode.Form === 'Closed' ) {

                    controlPoints.push( controlPoints[ 0 ] );

                } else if ( geoNode.Form === 'Periodic' ) {

                    startKnot = degree;
                    endKnot = knots.length - 1 - startKnot;

                    for ( var i = 0; i < degree; ++ i ) {

                        controlPoints.push( controlPoints[ i ] );

                    }

                }

                var curve = new THREE.NURBSCurve( degree, knots, controlPoints, startKnot, endKnot );
                var vertices = curve.getPoints( controlPoints.length * 7 );

                var positions = new Float32Array( vertices.length * 3 );

                vertices.forEach( function ( vertex, i ) {

                    vertex.toArray( positions, i * 3 );

                } );

                var geometry = new THREE.BufferGeometry();
                geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

                return geometry;

            },

        };

        // parse animation data from FBXTree
        function AnimationParser() {}

        AnimationParser.prototype = {

            constructor: AnimationParser,

            // take raw animation clips and turn them into three.js animation clips
            parse: function () {

                var animationClips = [];

                var rawClips = this.parseClips();

                if ( rawClips === undefined ) return;

                for ( var key in rawClips ) {

                    var rawClip = rawClips[ key ];

                    var clip = this.addClip( rawClip );

                    animationClips.push( clip );

                }

                return animationClips;

            },

            parseClips: function () {

                // since the actual transformation data is stored in FBXTree.Objects.AnimationCurve,
                // if this is undefined we can safely assume there are no animations
                if ( fbxTree.Objects.AnimationCurve === undefined ) return undefined;

                var curveNodesMap = this.parseAnimationCurveNodes();

                this.parseAnimationCurves( curveNodesMap );

                var layersMap = this.parseAnimationLayers( curveNodesMap );
                var rawClips = this.parseAnimStacks( layersMap );

                return rawClips;

            },

            // parse nodes in FBXTree.Objects.AnimationCurveNode
            // each AnimationCurveNode holds data for an animation transform for a model (e.g. left arm rotation )
            // and is referenced by an AnimationLayer
            parseAnimationCurveNodes: function () {

                var rawCurveNodes = fbxTree.Objects.AnimationCurveNode;

                var curveNodesMap = new Map();

                for ( var nodeID in rawCurveNodes ) {

                    var rawCurveNode = rawCurveNodes[ nodeID ];

                    if ( rawCurveNode.attrName.match( /S|R|T|DeformPercent/ ) !== null ) {

                        var curveNode = {

                            id: rawCurveNode.id,
                            attr: rawCurveNode.attrName,
                            curves: {},

                        };

                        curveNodesMap.set( curveNode.id, curveNode );

                    }

                }

                return curveNodesMap;

            },

            // parse nodes in FBXTree.Objects.AnimationCurve and connect them up to
            // previously parsed AnimationCurveNodes. Each AnimationCurve holds data for a single animated
            // axis ( e.g. times and values of x rotation)
            parseAnimationCurves: function ( curveNodesMap ) {

                var rawCurves = fbxTree.Objects.AnimationCurve;

                // TODO: Many values are identical up to roundoff error, but won't be optimised
                // e.g. position times: [0, 0.4, 0. 8]
                // position values: [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.235384487103147e-7, 93.67520904541016, -0.9982695579528809]
                // clearly, this should be optimised to
                // times: [0], positions [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809]
                // this shows up in nearly every FBX file, and generally time array is length > 100

                for ( var nodeID in rawCurves ) {

                    var animationCurve = {

                        id: rawCurves[ nodeID ].id,
                        times: rawCurves[ nodeID ].KeyTime.a.map( convertFBXTimeToSeconds ),
                        values: rawCurves[ nodeID ].KeyValueFloat.a,

                    };

                    var relationships = connections.get( animationCurve.id );

                    if ( relationships !== undefined ) {

                        var animationCurveID = relationships.parents[ 0 ].ID;
                        var animationCurveRelationship = relationships.parents[ 0 ].relationship;

                        if ( animationCurveRelationship.match( /X/ ) ) {

                            curveNodesMap.get( animationCurveID ).curves[ 'x' ] = animationCurve;

                        } else if ( animationCurveRelationship.match( /Y/ ) ) {

                            curveNodesMap.get( animationCurveID ).curves[ 'y' ] = animationCurve;

                        } else if ( animationCurveRelationship.match( /Z/ ) ) {

                            curveNodesMap.get( animationCurveID ).curves[ 'z' ] = animationCurve;

                        } else if ( animationCurveRelationship.match( /d|DeformPercent/ ) && curveNodesMap.has( animationCurveID ) ) {

                            curveNodesMap.get( animationCurveID ).curves[ 'morph' ] = animationCurve;

                        }

                    }

                }

            },

            // parse nodes in FBXTree.Objects.AnimationLayer. Each layers holds references
            // to various AnimationCurveNodes and is referenced by an AnimationStack node
            // note: theoretically a stack can have multiple layers, however in practice there always seems to be one per stack
            parseAnimationLayers: function ( curveNodesMap ) {

                var rawLayers = fbxTree.Objects.AnimationLayer;

                var layersMap = new Map();

                for ( var nodeID in rawLayers ) {

                    var layerCurveNodes = [];

                    var connection = connections.get( parseInt( nodeID ) );

                    if ( connection !== undefined ) {

                        // all the animationCurveNodes used in the layer
                        var children = connection.children;

                        children.forEach( function ( child, i ) {

                            if ( curveNodesMap.has( child.ID ) ) {

                                var curveNode = curveNodesMap.get( child.ID );

                                // check that the curves are defined for at least one axis, otherwise ignore the curveNode
                                if ( curveNode.curves.x !== undefined || curveNode.curves.y !== undefined || curveNode.curves.z !== undefined ) {

                                    if ( layerCurveNodes[ i ] === undefined ) {

                                        var modelID = connections.get( child.ID ).parents.filter( function ( parent ) {

                                            return parent.relationship !== undefined;

                                        } )[ 0 ].ID;

                                        if ( modelID !== undefined ) {

                                            var rawModel = fbxTree.Objects.Model[ modelID.toString() ];

                                            var node = {

                                                modelName: THREE.PropertyBinding.sanitizeNodeName( rawModel.attrName ),
                                                ID: rawModel.id,
                                                initialPosition: [ 0, 0, 0 ],
                                                initialRotation: [ 0, 0, 0 ],
                                                initialScale: [ 1, 1, 1 ],

                                            };

                                            sceneGraph.traverse( function ( child ) {

                                                if ( child.ID = rawModel.id ) {

                                                    node.transform = child.matrix;

                                                    if ( child.userData.transformData ) node.eulerOrder = child.userData.transformData.eulerOrder;

                                                }

                                            } );

                                            if ( ! node.transform ) node.transform = new THREE.Matrix4();

                                            // if the animated model is pre rotated, we'll have to apply the pre rotations to every
                                            // animation value as well
                                            if ( 'PreRotation' in rawModel ) node.preRotation = rawModel.PreRotation.value;
                                            if ( 'PostRotation' in rawModel ) node.postRotation = rawModel.PostRotation.value;

                                            layerCurveNodes[ i ] = node;

                                        }

                                    }

                                    if ( layerCurveNodes[ i ] ) layerCurveNodes[ i ][ curveNode.attr ] = curveNode;

                                } else if ( curveNode.curves.morph !== undefined ) {

                                    if ( layerCurveNodes[ i ] === undefined ) {

                                        var deformerID = connections.get( child.ID ).parents.filter( function ( parent ) {

                                            return parent.relationship !== undefined;

                                        } )[ 0 ].ID;

                                        var morpherID = connections.get( deformerID ).parents[ 0 ].ID;
                                        var geoID = connections.get( morpherID ).parents[ 0 ].ID;

                                        // assuming geometry is not used in more than one model
                                        var modelID = connections.get( geoID ).parents[ 0 ].ID;

                                        var rawModel = fbxTree.Objects.Model[ modelID ];

                                        var node = {

                                            modelName: THREE.PropertyBinding.sanitizeNodeName( rawModel.attrName ),
                                            morphName: fbxTree.Objects.Deformer[ deformerID ].attrName,

                                        };

                                        layerCurveNodes[ i ] = node;

                                    }

                                    layerCurveNodes[ i ][ curveNode.attr ] = curveNode;

                                }

                            }

                        } );

                        layersMap.set( parseInt( nodeID ), layerCurveNodes );

                    }

                }

                return layersMap;

            },

            // parse nodes in FBXTree.Objects.AnimationStack. These are the top level node in the animation
            // hierarchy. Each Stack node will be used to create a THREE.AnimationClip
            parseAnimStacks: function ( layersMap ) {

                var rawStacks = fbxTree.Objects.AnimationStack;

                // connect the stacks (clips) up to the layers
                var rawClips = {};

                for ( var nodeID in rawStacks ) {

                    var children = connections.get( parseInt( nodeID ) ).children;

                    if ( children.length > 1 ) {

                        // it seems like stacks will always be associated with a single layer. But just in case there are files
                        // where there are multiple layers per stack, we'll display a warning
                        console.warn( 'THREE.FBXLoader: Encountered an animation stack with multiple layers, this is currently not supported. Ignoring subsequent layers.' );

                    }

                    var layer = layersMap.get( children[ 0 ].ID );

                    rawClips[ nodeID ] = {

                        name: rawStacks[ nodeID ].attrName,
                        layer: layer,

                    };

                }

                return rawClips;

            },

            addClip: function ( rawClip ) {

                var tracks = [];

                var self = this;
                rawClip.layer.forEach( function ( rawTracks ) {

                    tracks = tracks.concat( self.generateTracks( rawTracks ) );

                } );

                return new THREE.AnimationClip( rawClip.name, - 1, tracks );

            },

            generateTracks: function ( rawTracks ) {

                var tracks = [];

                var initialPosition = new THREE.Vector3();
                var initialRotation = new THREE.Quaternion();
                var initialScale = new THREE.Vector3();

                if ( rawTracks.transform ) rawTracks.transform.decompose( initialPosition, initialRotation, initialScale );

                initialPosition = initialPosition.toArray();
                initialRotation = new THREE.Euler().setFromQuaternion( initialRotation, rawTracks.eulerOrder ).toArray();
                initialScale = initialScale.toArray();

                if ( rawTracks.T !== undefined && Object.keys( rawTracks.T.curves ).length > 0 ) {

                    var positionTrack = this.generateVectorTrack( rawTracks.modelName, rawTracks.T.curves, initialPosition, 'position' );
                    if ( positionTrack !== undefined ) tracks.push( positionTrack );

                }

                if ( rawTracks.R !== undefined && Object.keys( rawTracks.R.curves ).length > 0 ) {

                    var rotationTrack = this.generateRotationTrack( rawTracks.modelName, rawTracks.R.curves, initialRotation, rawTracks.preRotation, rawTracks.postRotation, rawTracks.eulerOrder );
                    if ( rotationTrack !== undefined ) tracks.push( rotationTrack );

                }

                if ( rawTracks.S !== undefined && Object.keys( rawTracks.S.curves ).length > 0 ) {

                    var scaleTrack = this.generateVectorTrack( rawTracks.modelName, rawTracks.S.curves, initialScale, 'scale' );
                    if ( scaleTrack !== undefined ) tracks.push( scaleTrack );

                }

                if ( rawTracks.DeformPercent !== undefined ) {

                    var morphTrack = this.generateMorphTrack( rawTracks );
                    if ( morphTrack !== undefined ) tracks.push( morphTrack );

                }

                return tracks;

            },

            generateVectorTrack: function ( modelName, curves, initialValue, type ) {

                var times = this.getTimesForAllAxes( curves );
                var values = this.getKeyframeTrackValues( times, curves, initialValue );

                return new THREE.VectorKeyframeTrack( modelName + '.' + type, times, values );

            },

            generateRotationTrack: function ( modelName, curves, initialValue, preRotation, postRotation, eulerOrder ) {

                if ( curves.x !== undefined ) {

                    this.interpolateRotations( curves.x );
                    curves.x.values = curves.x.values.map( THREE.Math.degToRad );

                }
                if ( curves.y !== undefined ) {

                    this.interpolateRotations( curves.y );
                    curves.y.values = curves.y.values.map( THREE.Math.degToRad );

                }
                if ( curves.z !== undefined ) {

                    this.interpolateRotations( curves.z );
                    curves.z.values = curves.z.values.map( THREE.Math.degToRad );

                }

                var times = this.getTimesForAllAxes( curves );
                var values = this.getKeyframeTrackValues( times, curves, initialValue );

                if ( preRotation !== undefined ) {

                    preRotation = preRotation.map( THREE.Math.degToRad );
                    preRotation.push( eulerOrder );

                    preRotation = new THREE.Euler().fromArray( preRotation );
                    preRotation = new THREE.Quaternion().setFromEuler( preRotation );

                }

                if ( postRotation !== undefined ) {

                    postRotation = postRotation.map( THREE.Math.degToRad );
                    postRotation.push( eulerOrder );

                    postRotation = new THREE.Euler().fromArray( postRotation );
                    postRotation = new THREE.Quaternion().setFromEuler( postRotation ).inverse();

                }

                var quaternion = new THREE.Quaternion();
                var euler = new THREE.Euler();

                var quaternionValues = [];

                for ( var i = 0; i < values.length; i += 3 ) {

                    euler.set( values[ i ], values[ i + 1 ], values[ i + 2 ], eulerOrder );

                    quaternion.setFromEuler( euler );

                    if ( preRotation !== undefined ) quaternion.premultiply( preRotation );
                    if ( postRotation !== undefined ) quaternion.multiply( postRotation );

                    quaternion.toArray( quaternionValues, ( i / 3 ) * 4 );

                }

                return new THREE.QuaternionKeyframeTrack( modelName + '.quaternion', times, quaternionValues );

            },

            generateMorphTrack: function ( rawTracks ) {

                var curves = rawTracks.DeformPercent.curves.morph;
                var values = curves.values.map( function ( val ) {

                    return val / 100;

                } );

                var morphNum = sceneGraph.getObjectByName( rawTracks.modelName ).morphTargetDictionary[ rawTracks.morphName ];

                return new THREE.NumberKeyframeTrack( rawTracks.modelName + '.morphTargetInfluences[' + morphNum + ']', curves.times, values );

            },

            // For all animated objects, times are defined separately for each axis
            // Here we'll combine the times into one sorted array without duplicates
            getTimesForAllAxes: function ( curves ) {

                var times = [];

                // first join together the times for each axis, if defined
                if ( curves.x !== undefined ) times = times.concat( curves.x.times );
                if ( curves.y !== undefined ) times = times.concat( curves.y.times );
                if ( curves.z !== undefined ) times = times.concat( curves.z.times );

                // then sort them and remove duplicates
                times = times.sort( function ( a, b ) {

                    return a - b;

                } ).filter( function ( elem, index, array ) {

                    return array.indexOf( elem ) == index;

                } );

                return times;

            },

            getKeyframeTrackValues: function ( times, curves, initialValue ) {

                var prevValue = initialValue;

                var values = [];

                var xIndex = - 1;
                var yIndex = - 1;
                var zIndex = - 1;

                times.forEach( function ( time ) {

                    if ( curves.x ) xIndex = curves.x.times.indexOf( time );
                    if ( curves.y ) yIndex = curves.y.times.indexOf( time );
                    if ( curves.z ) zIndex = curves.z.times.indexOf( time );

                    // if there is an x value defined for this frame, use that
                    if ( xIndex !== - 1 ) {

                        var xValue = curves.x.values[ xIndex ];
                        values.push( xValue );
                        prevValue[ 0 ] = xValue;

                    } else {

                        // otherwise use the x value from the previous frame
                        values.push( prevValue[ 0 ] );

                    }

                    if ( yIndex !== - 1 ) {

                        var yValue = curves.y.values[ yIndex ];
                        values.push( yValue );
                        prevValue[ 1 ] = yValue;

                    } else {

                        values.push( prevValue[ 1 ] );

                    }

                    if ( zIndex !== - 1 ) {

                        var zValue = curves.z.values[ zIndex ];
                        values.push( zValue );
                        prevValue[ 2 ] = zValue;

                    } else {

                        values.push( prevValue[ 2 ] );

                    }

                } );

                return values;

            },

            // Rotations are defined as Euler angles which can have values  of any size
            // These will be converted to quaternions which don't support values greater than
            // PI, so we'll interpolate large rotations
            interpolateRotations: function ( curve ) {

                for ( var i = 1; i < curve.values.length; i ++ ) {

                    var initialValue = curve.values[ i - 1 ];
                    var valuesSpan = curve.values[ i ] - initialValue;

                    var absoluteSpan = Math.abs( valuesSpan );

                    if ( absoluteSpan >= 180 ) {

                        var numSubIntervals = absoluteSpan / 180;

                        var step = valuesSpan / numSubIntervals;
                        var nextValue = initialValue + step;

                        var initialTime = curve.times[ i - 1 ];
                        var timeSpan = curve.times[ i ] - initialTime;
                        var interval = timeSpan / numSubIntervals;
                        var nextTime = initialTime + interval;

                        var interpolatedTimes = [];
                        var interpolatedValues = [];

                        while ( nextTime < curve.times[ i ] ) {

                            interpolatedTimes.push( nextTime );
                            nextTime += interval;

                            interpolatedValues.push( nextValue );
                            nextValue += step;

                        }

                        curve.times = inject( curve.times, i, interpolatedTimes );
                        curve.values = inject( curve.values, i, interpolatedValues );

                    }

                }

            },

        };

        // parse an FBX file in ASCII format
        function TextParser() {}

        TextParser.prototype = {

            constructor: TextParser,

            getPrevNode: function () {

                return this.nodeStack[ this.currentIndent - 2 ];

            },

            getCurrentNode: function () {

                return this.nodeStack[ this.currentIndent - 1 ];

            },

            getCurrentProp: function () {

                return this.currentProp;

            },

            pushStack: function ( node ) {

                this.nodeStack.push( node );
                this.currentIndent += 1;

            },

            popStack: function () {

                this.nodeStack.pop();
                this.currentIndent -= 1;

            },

            setCurrentProp: function ( val, name ) {

                this.currentProp = val;
                this.currentPropName = name;

            },

            parse: function ( text ) {

                this.currentIndent = 0;

                this.allNodes = new FBXTree();
                this.nodeStack = [];
                this.currentProp = [];
                this.currentPropName = '';

                var self = this;

                var split = text.split( /[\r\n]+/ );

                split.forEach( function ( line, i ) {

                    var matchComment = line.match( /^[\s\t]*;/ );
                    var matchEmpty = line.match( /^[\s\t]*$/ );

                    if ( matchComment || matchEmpty ) return;

                    var matchBeginning = line.match( '^\\t{' + self.currentIndent + '}(\\w+):(.*){', '' );
                    var matchProperty = line.match( '^\\t{' + ( self.currentIndent ) + '}(\\w+):[\\s\\t\\r\\n](.*)' );
                    var matchEnd = line.match( '^\\t{' + ( self.currentIndent - 1 ) + '}}' );

                    if ( matchBeginning ) {

                        self.parseNodeBegin( line, matchBeginning );

                    } else if ( matchProperty ) {

                        self.parseNodeProperty( line, matchProperty, split[ ++ i ] );

                    } else if ( matchEnd ) {

                        self.popStack();

                    } else if ( line.match( /^[^\s\t}]/ ) ) {

                        // large arrays are split over multiple lines terminated with a ',' character
                        // if this is encountered the line needs to be joined to the previous line
                        self.parseNodePropertyContinued( line );

                    }

                } );

                return this.allNodes;

            },

            parseNodeBegin: function ( line, property ) {

                var nodeName = property[ 1 ].trim().replace( /^"/, '' ).replace( /"$/, '' );

                var nodeAttrs = property[ 2 ].split( ',' ).map( function ( attr ) {

                    return attr.trim().replace( /^"/, '' ).replace( /"$/, '' );

                } );

                var node = { name: nodeName };
                var attrs = this.parseNodeAttr( nodeAttrs );

                var currentNode = this.getCurrentNode();

                // a top node
                if ( this.currentIndent === 0 ) {

                    this.allNodes.add( nodeName, node );

                } else { // a subnode

                    // if the subnode already exists, append it
                    if ( nodeName in currentNode ) {

                        // special case Pose needs PoseNodes as an array
                        if ( nodeName === 'PoseNode' ) {

                            currentNode.PoseNode.push( node );

                        } else if ( currentNode[ nodeName ].id !== undefined ) {

                            currentNode[ nodeName ] = {};
                            currentNode[ nodeName ][ currentNode[ nodeName ].id ] = currentNode[ nodeName ];

                        }

                        if ( attrs.id !== '' ) currentNode[ nodeName ][ attrs.id ] = node;

                    } else if ( typeof attrs.id === 'number' ) {

                        currentNode[ nodeName ] = {};
                        currentNode[ nodeName ][ attrs.id ] = node;

                    } else if ( nodeName !== 'Properties70' ) {

                        if ( nodeName === 'PoseNode' )  currentNode[ nodeName ] = [ node ];
                        else currentNode[ nodeName ] = node;

                    }

                }

                if ( typeof attrs.id === 'number' ) node.id = attrs.id;
                if ( attrs.name !== '' ) node.attrName = attrs.name;
                if ( attrs.type !== '' ) node.attrType = attrs.type;

                this.pushStack( node );

            },

            parseNodeAttr: function ( attrs ) {

                var id = attrs[ 0 ];

                if ( attrs[ 0 ] !== '' ) {

                    id = parseInt( attrs[ 0 ] );

                    if ( isNaN( id ) ) {

                        id = attrs[ 0 ];

                    }

                }

                var name = '', type = '';

                if ( attrs.length > 1 ) {

                    name = attrs[ 1 ].replace( /^(\w+)::/, '' );
                    type = attrs[ 2 ];

                }

                return { id: id, name: name, type: type };

            },

            parseNodeProperty: function ( line, property, contentLine ) {

                var propName = property[ 1 ].replace( /^"/, '' ).replace( /"$/, '' ).trim();
                var propValue = property[ 2 ].replace( /^"/, '' ).replace( /"$/, '' ).trim();

                // for special case: base64 image data follows "Content: ," line
                //  Content: ,
                //   "/9j/4RDaRXhpZgAATU0A..."
                if ( propName === 'Content' && propValue === ',' ) {

                    propValue = contentLine.replace( /"/g, '' ).replace( /,$/, '' ).trim();

                }

                var currentNode = this.getCurrentNode();
                var parentName = currentNode.name;

                if ( parentName === 'Properties70' ) {

                    this.parseNodeSpecialProperty( line, propName, propValue );
                    return;

                }

                // Connections
                if ( propName === 'C' ) {

                    var connProps = propValue.split( ',' ).slice( 1 );
                    var from = parseInt( connProps[ 0 ] );
                    var to = parseInt( connProps[ 1 ] );

                    var rest = propValue.split( ',' ).slice( 3 );

                    rest = rest.map( function ( elem ) {

                        return elem.trim().replace( /^"/, '' );

                    } );

                    propName = 'connections';
                    propValue = [ from, to ];
                    append( propValue, rest );

                    if ( currentNode[ propName ] === undefined ) {

                        currentNode[ propName ] = [];

                    }

                }

                // Node
                if ( propName === 'Node' ) currentNode.id = propValue;

                // connections
                if ( propName in currentNode && Array.isArray( currentNode[ propName ] ) ) {

                    currentNode[ propName ].push( propValue );

                } else {

                    if ( propName !== 'a' ) currentNode[ propName ] = propValue;
                    else currentNode.a = propValue;

                }

                this.setCurrentProp( currentNode, propName );

                // convert string to array, unless it ends in ',' in which case more will be added to it
                if ( propName === 'a' && propValue.slice( - 1 ) !== ',' ) {

                    currentNode.a = parseNumberArray( propValue );

                }

            },

            parseNodePropertyContinued: function ( line ) {

                var currentNode = this.getCurrentNode();

                currentNode.a += line;

                // if the line doesn't end in ',' we have reached the end of the property value
                // so convert the string to an array
                if ( line.slice( - 1 ) !== ',' ) {

                    currentNode.a = parseNumberArray( currentNode.a );

                }

            },

            // parse "Property70"
            parseNodeSpecialProperty: function ( line, propName, propValue ) {

                // split this
                // P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
                // into array like below
                // ["Lcl Scaling", "Lcl Scaling", "", "A", "1,1,1" ]
                var props = propValue.split( '",' ).map( function ( prop ) {

                    return prop.trim().replace( /^\"/, '' ).replace( /\s/, '_' );

                } );

                var innerPropName = props[ 0 ];
                var innerPropType1 = props[ 1 ];
                var innerPropType2 = props[ 2 ];
                var innerPropFlag = props[ 3 ];
                var innerPropValue = props[ 4 ];

                // cast values where needed, otherwise leave as strings
                switch ( innerPropType1 ) {

                    case 'int':
                    case 'enum':
                    case 'bool':
                    case 'ULongLong':
                    case 'double':
                    case 'Number':
                    case 'FieldOfView':
                        innerPropValue = parseFloat( innerPropValue );
                        break;

                    case 'Color':
                    case 'ColorRGB':
                    case 'Vector3D':
                    case 'Lcl_Translation':
                    case 'Lcl_Rotation':
                    case 'Lcl_Scaling':
                        innerPropValue = parseNumberArray( innerPropValue );
                        break;

                }

                // CAUTION: these props must append to parent's parent
                this.getPrevNode()[ innerPropName ] = {

                    'type': innerPropType1,
                    'type2': innerPropType2,
                    'flag': innerPropFlag,
                    'value': innerPropValue

                };

                this.setCurrentProp( this.getPrevNode(), innerPropName );

            },

        };

        // Parse an FBX file in Binary format
        function BinaryParser() {}

        BinaryParser.prototype = {

            constructor: BinaryParser,

            parse: function ( buffer ) {

                var reader = new BinaryReader( buffer );
                reader.skip( 23 ); // skip magic 23 bytes

                var version = reader.getUint32();

                console.log( 'THREE.FBXLoader: FBX binary version: ' + version );

                var allNodes = new FBXTree();

                while ( ! this.endOfContent( reader ) ) {

                    var node = this.parseNode( reader, version );
                    if ( node !== null ) allNodes.add( node.name, node );

                }

                return allNodes;

            },

            // Check if reader has reached the end of content.
            endOfContent: function ( reader ) {

                // footer size: 160bytes + 16-byte alignment padding
                // - 16bytes: magic
                // - padding til 16-byte alignment (at least 1byte?)
                //  (seems like some exporters embed fixed 15 or 16bytes?)
                // - 4bytes: magic
                // - 4bytes: version
                // - 120bytes: zero
                // - 16bytes: magic
                if ( reader.size() % 16 === 0 ) {

                    return ( ( reader.getOffset() + 160 + 16 ) & ~ 0xf ) >= reader.size();

                } else {

                    return reader.getOffset() + 160 + 16 >= reader.size();

                }

            },

            // recursively parse nodes until the end of the file is reached
            parseNode: function ( reader, version ) {

                var node = {};

                // The first three data sizes depends on version.
                var endOffset = ( version >= 7500 ) ? reader.getUint64() : reader.getUint32();
                var numProperties = ( version >= 7500 ) ? reader.getUint64() : reader.getUint32();

                // note: do not remove this even if you get a linter warning as it moves the buffer forward
                var propertyListLen = ( version >= 7500 ) ? reader.getUint64() : reader.getUint32();

                var nameLen = reader.getUint8();
                var name = reader.getString( nameLen );

                // Regards this node as NULL-record if endOffset is zero
                if ( endOffset === 0 ) return null;

                var propertyList = [];

                for ( var i = 0; i < numProperties; i ++ ) {

                    propertyList.push( this.parseProperty( reader ) );

                }

                // Regards the first three elements in propertyList as id, attrName, and attrType
                var id = propertyList.length > 0 ? propertyList[ 0 ] : '';
                var attrName = propertyList.length > 1 ? propertyList[ 1 ] : '';
                var attrType = propertyList.length > 2 ? propertyList[ 2 ] : '';

                // check if this node represents just a single property
                // like (name, 0) set or (name2, [0, 1, 2]) set of {name: 0, name2: [0, 1, 2]}
                node.singleProperty = ( numProperties === 1 && reader.getOffset() === endOffset ) ? true : false;

                while ( endOffset > reader.getOffset() ) {

                    var subNode = this.parseNode( reader, version );

                    if ( subNode !== null ) this.parseSubNode( name, node, subNode );

                }

                node.propertyList = propertyList; // raw property list used by parent

                if ( typeof id === 'number' ) node.id = id;
                if ( attrName !== '' ) node.attrName = attrName;
                if ( attrType !== '' ) node.attrType = attrType;
                if ( name !== '' ) node.name = name;

                return node;

            },

            parseSubNode: function ( name, node, subNode ) {

                // special case: child node is single property
                if ( subNode.singleProperty === true ) {

                    var value = subNode.propertyList[ 0 ];

                    if ( Array.isArray( value ) ) {

                        node[ subNode.name ] = subNode;

                        subNode.a = value;

                    } else {

                        node[ subNode.name ] = value;

                    }

                } else if ( name === 'Connections' && subNode.name === 'C' ) {

                    var array = [];

                    subNode.propertyList.forEach( function ( property, i ) {

                        // first Connection is FBX type (OO, OP, etc.). We'll discard these
                        if ( i !== 0 ) array.push( property );

                    } );

                    if ( node.connections === undefined ) {

                        node.connections = [];

                    }

                    node.connections.push( array );

                } else if ( subNode.name === 'Properties70' ) {

                    var keys = Object.keys( subNode );

                    keys.forEach( function ( key ) {

                        node[ key ] = subNode[ key ];

                    } );

                } else if ( name === 'Properties70' && subNode.name === 'P' ) {

                    var innerPropName = subNode.propertyList[ 0 ];
                    var innerPropType1 = subNode.propertyList[ 1 ];
                    var innerPropType2 = subNode.propertyList[ 2 ];
                    var innerPropFlag = subNode.propertyList[ 3 ];
                    var innerPropValue;

                    if ( innerPropName.indexOf( 'Lcl ' ) === 0 ) innerPropName = innerPropName.replace( 'Lcl ', 'Lcl_' );
                    if ( innerPropType1.indexOf( 'Lcl ' ) === 0 ) innerPropType1 = innerPropType1.replace( 'Lcl ', 'Lcl_' );

                    if ( innerPropType1 === 'Color' || innerPropType1 === 'ColorRGB' || innerPropType1 === 'Vector' || innerPropType1 === 'Vector3D' || innerPropType1.indexOf( 'Lcl_' ) === 0 ) {

                        innerPropValue = [
                            subNode.propertyList[ 4 ],
                            subNode.propertyList[ 5 ],
                            subNode.propertyList[ 6 ]
                        ];

                    } else {

                        innerPropValue = subNode.propertyList[ 4 ];

                    }

                    // this will be copied to parent, see above
                    node[ innerPropName ] = {

                        'type': innerPropType1,
                        'type2': innerPropType2,
                        'flag': innerPropFlag,
                        'value': innerPropValue

                    };

                } else if ( node[ subNode.name ] === undefined ) {

                    if ( typeof subNode.id === 'number' ) {

                        node[ subNode.name ] = {};
                        node[ subNode.name ][ subNode.id ] = subNode;

                    } else {

                        node[ subNode.name ] = subNode;

                    }

                } else {

                    if ( subNode.name === 'PoseNode' ) {

                        if ( ! Array.isArray( node[ subNode.name ] ) ) {

                            node[ subNode.name ] = [ node[ subNode.name ] ];

                        }

                        node[ subNode.name ].push( subNode );

                    } else if ( node[ subNode.name ][ subNode.id ] === undefined ) {

                        node[ subNode.name ][ subNode.id ] = subNode;

                    }

                }

            },

            parseProperty: function ( reader ) {

                var type = reader.getString( 1 );

                switch ( type ) {

                    case 'C':
                        return reader.getBoolean();

                    case 'D':
                        return reader.getFloat64();

                    case 'F':
                        return reader.getFloat32();

                    case 'I':
                        return reader.getInt32();

                    case 'L':
                        return reader.getInt64();

                    case 'R':
                        var length = reader.getUint32();
                        return reader.getArrayBuffer( length );

                    case 'S':
                        var length = reader.getUint32();
                        return reader.getString( length );

                    case 'Y':
                        return reader.getInt16();

                    case 'b':
                    case 'c':
                    case 'd':
                    case 'f':
                    case 'i':
                    case 'l':

                        var arrayLength = reader.getUint32();
                        var encoding = reader.getUint32(); // 0: non-compressed, 1: compressed
                        var compressedLength = reader.getUint32();

                        if ( encoding === 0 ) {

                            switch ( type ) {

                                case 'b':
                                case 'c':
                                    return reader.getBooleanArray( arrayLength );

                                case 'd':
                                    return reader.getFloat64Array( arrayLength );

                                case 'f':
                                    return reader.getFloat32Array( arrayLength );

                                case 'i':
                                    return reader.getInt32Array( arrayLength );

                                case 'l':
                                    return reader.getInt64Array( arrayLength );

                            }

                        }

                        if ( typeof Zlib === 'undefined' ) {

                            console.error( 'THREE.FBXLoader: External library Inflate.min.js required, obtain or import from https://github.com/imaya/zlib.js' );

                        }

                        var inflate = new Zlib.Inflate( new Uint8Array( reader.getArrayBuffer( compressedLength ) ) ); // eslint-disable-line no-undef
                        var reader2 = new BinaryReader( inflate.decompress().buffer );

                        switch ( type ) {

                            case 'b':
                            case 'c':
                                return reader2.getBooleanArray( arrayLength );

                            case 'd':
                                return reader2.getFloat64Array( arrayLength );

                            case 'f':
                                return reader2.getFloat32Array( arrayLength );

                            case 'i':
                                return reader2.getInt32Array( arrayLength );

                            case 'l':
                                return reader2.getInt64Array( arrayLength );

                        }

                    default:
                        throw new Error( 'THREE.FBXLoader: Unknown property type ' + type );

                }

            }

        };

        function BinaryReader( buffer, littleEndian ) {

            this.dv = new DataView( buffer );
            this.offset = 0;
            this.littleEndian = ( littleEndian !== undefined ) ? littleEndian : true;

        }

        BinaryReader.prototype = {

            constructor: BinaryReader,

            getOffset: function () {

                return this.offset;

            },

            size: function () {

                return this.dv.buffer.byteLength;

            },

            skip: function ( length ) {

                this.offset += length;

            },

            // seems like true/false representation depends on exporter.
            // true: 1 or 'Y'(=0x59), false: 0 or 'T'(=0x54)
            // then sees LSB.
            getBoolean: function () {

                return ( this.getUint8() & 1 ) === 1;

            },

            getBooleanArray: function ( size ) {

                var a = [];

                for ( var i = 0; i < size; i ++ ) {

                    a.push( this.getBoolean() );

                }

                return a;

            },

            getUint8: function () {

                var value = this.dv.getUint8( this.offset );
                this.offset += 1;
                return value;

            },

            getInt16: function () {

                var value = this.dv.getInt16( this.offset, this.littleEndian );
                this.offset += 2;
                return value;

            },

            getInt32: function () {

                var value = this.dv.getInt32( this.offset, this.littleEndian );
                this.offset += 4;
                return value;

            },

            getInt32Array: function ( size ) {

                var a = [];

                for ( var i = 0; i < size; i ++ ) {

                    a.push( this.getInt32() );

                }

                return a;

            },

            getUint32: function () {

                var value = this.dv.getUint32( this.offset, this.littleEndian );
                this.offset += 4;
                return value;

            },

            // JavaScript doesn't support 64-bit integer so calculate this here
            // 1 << 32 will return 1 so using multiply operation instead here.
            // There's a possibility that this method returns wrong value if the value
            // is out of the range between Number.MAX_SAFE_INTEGER and Number.MIN_SAFE_INTEGER.
            // TODO: safely handle 64-bit integer
            getInt64: function () {

                var low, high;

                if ( this.littleEndian ) {

                    low = this.getUint32();
                    high = this.getUint32();

                } else {

                    high = this.getUint32();
                    low = this.getUint32();

                }

                // calculate negative value
                if ( high & 0x80000000 ) {

                    high = ~ high & 0xFFFFFFFF;
                    low = ~ low & 0xFFFFFFFF;

                    if ( low === 0xFFFFFFFF ) high = ( high + 1 ) & 0xFFFFFFFF;

                    low = ( low + 1 ) & 0xFFFFFFFF;

                    return - ( high * 0x100000000 + low );

                }

                return high * 0x100000000 + low;

            },

            getInt64Array: function ( size ) {

                var a = [];

                for ( var i = 0; i < size; i ++ ) {

                    a.push( this.getInt64() );

                }

                return a;

            },

            // Note: see getInt64() comment
            getUint64: function () {

                var low, high;

                if ( this.littleEndian ) {

                    low = this.getUint32();
                    high = this.getUint32();

                } else {

                    high = this.getUint32();
                    low = this.getUint32();

                }

                return high * 0x100000000 + low;

            },

            getFloat32: function () {

                var value = this.dv.getFloat32( this.offset, this.littleEndian );
                this.offset += 4;
                return value;

            },

            getFloat32Array: function ( size ) {

                var a = [];

                for ( var i = 0; i < size; i ++ ) {

                    a.push( this.getFloat32() );

                }

                return a;

            },

            getFloat64: function () {

                var value = this.dv.getFloat64( this.offset, this.littleEndian );
                this.offset += 8;
                return value;

            },

            getFloat64Array: function ( size ) {

                var a = [];

                for ( var i = 0; i < size; i ++ ) {

                    a.push( this.getFloat64() );

                }

                return a;

            },

            getArrayBuffer: function ( size ) {

                var value = this.dv.buffer.slice( this.offset, this.offset + size );
                this.offset += size;
                return value;

            },

            getString: function ( size ) {

                // note: safari 9 doesn't support Uint8Array.indexOf; create intermediate array instead
                var a = [];

                for ( var i = 0; i < size; i ++ ) {

                    a[ i ] = this.getUint8();

                }

                var nullByte = a.indexOf( 0 );
                if ( nullByte >= 0 ) a = a.slice( 0, nullByte );

                return THREE.LoaderUtils.decodeText( new Uint8Array( a ) );

            }

        };

        // FBXTree holds a representation of the FBX data, returned by the TextParser ( FBX ASCII format)
        // and BinaryParser( FBX Binary format)
        function FBXTree() {}

        FBXTree.prototype = {

            constructor: FBXTree,

            add: function ( key, val ) {

                this[ key ] = val;

            },

        };

        // ************** UTILITY FUNCTIONS **************

        function isFbxFormatBinary( buffer ) {

            var CORRECT = 'Kaydara FBX Binary  \0';

            return buffer.byteLength >= CORRECT.length && CORRECT === convertArrayBufferToString( buffer, 0, CORRECT.length );

        }

        function isFbxFormatASCII( text ) {

            var CORRECT = [ 'K', 'a', 'y', 'd', 'a', 'r', 'a', '\\', 'F', 'B', 'X', '\\', 'B', 'i', 'n', 'a', 'r', 'y', '\\', '\\' ];

            var cursor = 0;

            function read( offset ) {

                var result = text[ offset - 1 ];
                text = text.slice( cursor + offset );
                cursor ++;
                return result;

            }

            for ( var i = 0; i < CORRECT.length; ++ i ) {

                var num = read( 1 );
                if ( num === CORRECT[ i ] ) {

                    return false;

                }

            }

            return true;

        }

        function getFbxVersion( text ) {

            var versionRegExp = /FBXVersion: (\d+)/;
            var match = text.match( versionRegExp );
            if ( match ) {

                var version = parseInt( match[ 1 ] );
                return version;

            }
            throw new Error( 'THREE.FBXLoader: Cannot find the version number for the file given.' );

        }

        // Converts FBX ticks into real time seconds.
        function convertFBXTimeToSeconds( time ) {

            return time / 46186158000;

        }

        var dataArray = [];

        // extracts the data from the correct position in the FBX array based on indexing type
        function getData( polygonVertexIndex, polygonIndex, vertexIndex, infoObject ) {

            var index;

            switch ( infoObject.mappingType ) {

                case 'ByPolygonVertex' :
                    index = polygonVertexIndex;
                    break;
                case 'ByPolygon' :
                    index = polygonIndex;
                    break;
                case 'ByVertice' :
                    index = vertexIndex;
                    break;
                case 'AllSame' :
                    index = infoObject.indices[ 0 ];
                    break;
                default :
                    console.warn( 'THREE.FBXLoader: unknown attribute mapping type ' + infoObject.mappingType );

            }

            if ( infoObject.referenceType === 'IndexToDirect' ) index = infoObject.indices[ index ];

            var from = index * infoObject.dataSize;
            var to = from + infoObject.dataSize;

            return slice( dataArray, infoObject.buffer, from, to );

        }

        var tempEuler = new THREE.Euler();
        var tempVec = new THREE.Vector3();

        // generate transformation from FBX transform data
        // ref: https://help.autodesk.com/view/FBX/2017/ENU/?guid=__files_GUID_10CDD63C_79C1_4F2D_BB28_AD2BE65A02ED_htm
        // ref: http://docs.autodesk.com/FBX/2014/ENU/FBX-SDK-Documentation/index.html?url=cpp_ref/_transformations_2main_8cxx-example.html,topicNumber=cpp_ref__transformations_2main_8cxx_example_htmlfc10a1e1-b18d-4e72-9dc0-70d0f1959f5e
        function generateTransform( transformData ) {

            var lTranslationM = new THREE.Matrix4();
            var lPreRotationM = new THREE.Matrix4();
            var lRotationM = new THREE.Matrix4();
            var lPostRotationM = new THREE.Matrix4();

            var lScalingM = new THREE.Matrix4();
            var lScalingPivotM = new THREE.Matrix4();
            var lScalingOffsetM = new THREE.Matrix4();
            var lRotationOffsetM = new THREE.Matrix4();
            var lRotationPivotM = new THREE.Matrix4();

            var lParentGX = new THREE.Matrix4();
            var lGlobalT = new THREE.Matrix4();

            var inheritType = ( transformData.inheritType ) ? transformData.inheritType : 0;

            if ( transformData.translation ) lTranslationM.setPosition( tempVec.fromArray( transformData.translation ) );

            if ( transformData.preRotation ) {

                var array = transformData.preRotation.map( THREE.Math.degToRad );
                array.push( transformData.eulerOrder );
                lPreRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );

            }

            if ( transformData.rotation ) {

                var array = transformData.rotation.map( THREE.Math.degToRad );
                array.push( transformData.eulerOrder );
                lRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );

            }

            if ( transformData.postRotation ) {

                var array = transformData.postRotation.map( THREE.Math.degToRad );
                array.push( transformData.eulerOrder );
                lPostRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );

            }

            if ( transformData.scale ) lScalingM.scale( tempVec.fromArray( transformData.scale ) );

            // Pivots and offsets
            if ( transformData.scalingOffset ) lScalingOffsetM.setPosition( tempVec.fromArray( transformData.scalingOffset ) );
            if ( transformData.scalingPivot ) lScalingPivotM.setPosition( tempVec.fromArray( transformData.scalingPivot ) );
            if ( transformData.rotationOffset ) lRotationOffsetM.setPosition( tempVec.fromArray( transformData.rotationOffset ) );
            if ( transformData.rotationPivot ) lRotationPivotM.setPosition( tempVec.fromArray( transformData.rotationPivot ) );

            // parent transform
            if ( transformData.parentMatrixWorld ) lParentGX = transformData.parentMatrixWorld;

            // Global Rotation
            var lLRM = lPreRotationM.multiply( lRotationM ).multiply( lPostRotationM );
            var lParentGRM = new THREE.Matrix4();
            lParentGX.extractRotation( lParentGRM );

            // Global Shear*Scaling
            var lParentTM = new THREE.Matrix4();
            var lLSM;
            var lParentGSM;
            var lParentGRSM;

            lParentTM.copyPosition( lParentGX );
            lParentGRSM = lParentTM.getInverse( lParentTM ).multiply( lParentGX );
            lParentGSM = lParentGRM.getInverse( lParentGRM ).multiply( lParentGRSM );
            lLSM = lScalingM;

            var lGlobalRS;
            if ( inheritType === 0 ) {

                lGlobalRS = lParentGRM.multiply( lLRM ).multiply( lParentGSM ).multiply( lLSM );

            } else if ( inheritType === 1 ) {

                lGlobalRS = lParentGRM.multiply( lParentGSM ).multiply( lLRM ).multiply( lLSM );

            } else {

                var lParentLSM = new THREE.Matrix4().copy( lScalingM );

                var lParentGSM_noLocal = lParentGSM.multiply( lParentLSM.getInverse( lParentLSM ) );

                lGlobalRS = lParentGRM.multiply( lLRM ).multiply( lParentGSM_noLocal ).multiply( lLSM );

            }

            // Calculate the local transform matrix
            var lTransform = lTranslationM.multiply( lRotationOffsetM ).multiply( lRotationPivotM ).multiply( lPreRotationM ).multiply( lRotationM ).multiply( lPostRotationM ).multiply( lRotationPivotM.getInverse( lRotationPivotM ) ).multiply( lScalingOffsetM ).multiply( lScalingPivotM ).multiply( lScalingM ).multiply( lScalingPivotM.getInverse( lScalingPivotM ) );

            var lLocalTWithAllPivotAndOffsetInfo = new THREE.Matrix4().copyPosition( lTransform );

            var lGlobalTranslation = lParentGX.multiply( lLocalTWithAllPivotAndOffsetInfo );
            lGlobalT.copyPosition( lGlobalTranslation );

            lTransform = lGlobalT.multiply( lGlobalRS );

            return lTransform;

        }

        // Returns the three.js intrinsic Euler order corresponding to FBX extrinsic Euler order
        // ref: http://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_class_fbx_euler_html
        function getEulerOrder( order ) {

            order = order || 0;

            var enums = [
                'ZYX', // -> XYZ extrinsic
                'YZX', // -> XZY extrinsic
                'XZY', // -> YZX extrinsic
                'ZXY', // -> YXZ extrinsic
                'YXZ', // -> ZXY extrinsic
                'XYZ', // -> ZYX extrinsic
                //'SphericXYZ', // not possible to support
            ];

            if ( order === 6 ) {

                console.warn( 'THREE.FBXLoader: unsupported Euler Order: Spherical XYZ. Animations and rotations may be incorrect.' );
                return enums[ 0 ];

            }

            return enums[ order ];

        }

        // Parses comma separated list of numbers and returns them an array.
        // Used internally by the TextParser
        function parseNumberArray( value ) {

            var array = value.split( ',' ).map( function ( val ) {

                return parseFloat( val );

            } );

            return array;

        }

        function convertArrayBufferToString( buffer, from, to ) {

            if ( from === undefined ) from = 0;
            if ( to === undefined ) to = buffer.byteLength;

            return THREE.LoaderUtils.decodeText( new Uint8Array( buffer, from, to ) );

        }

        function append( a, b ) {

            for ( var i = 0, j = a.length, l = b.length; i < l; i ++, j ++ ) {

                a[ j ] = b[ i ];

            }

        }

        function slice( a, b, from, to ) {

            for ( var i = from, j = 0; i < to; i ++, j ++ ) {

                a[ j ] = b[ i ];

            }

            return a;

        }

        // inject array a2 into array a1 at index
        function inject( a1, index, a2 ) {

            return a1.slice( 0, index ).concat( a2 ).concat( a1.slice( index ) );

        }

        return FBXLoader;

    } )();

    /*
     * @author Daosheng Mu / https://github.com/DaoshengMu/
     * @author mrdoob / http://mrdoob.com/
     * @author takahirox / https://github.com/takahirox/
     */

    THREE.TGALoader = function ( manager ) {

        this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

    };

    THREE.TGALoader.prototype = {

        constructor: THREE.TGALoader,

        load: function ( url, onLoad, onProgress, onError ) {

            var scope = this;

            var texture = new THREE.Texture();

            var loader = new THREE.FileLoader( this.manager );
            loader.setResponseType( 'arraybuffer' );
            loader.setPath( this.path );

            loader.load( url, function ( buffer ) {

                texture.image = scope.parse( buffer );
                texture.needsUpdate = true;

                if ( onLoad !== undefined ) {

                    onLoad( texture );

                }

            }, onProgress, onError );

            return texture;

        },

        parse: function ( buffer ) {

            // reference from vthibault, https://github.com/vthibault/roBrowser/blob/master/src/Loaders/Targa.js

            function tgaCheckHeader( header ) {

                switch ( header.image_type ) {

                    // check indexed type

                    case TGA_TYPE_INDEXED:
                    case TGA_TYPE_RLE_INDEXED:
                        if ( header.colormap_length > 256 || header.colormap_size !== 24 || header.colormap_type !== 1 ) {

                            console.error( 'THREE.TGALoader: Invalid type colormap data for indexed type.' );

                        }
                        break;

                    // check colormap type

                    case TGA_TYPE_RGB:
                    case TGA_TYPE_GREY:
                    case TGA_TYPE_RLE_RGB:
                    case TGA_TYPE_RLE_GREY:
                        if ( header.colormap_type ) {

                            console.error( 'THREE.TGALoader: Invalid type colormap data for colormap type.' );

                        }
                        break;

                    // What the need of a file without data ?

                    case TGA_TYPE_NO_DATA:
                        console.error( 'THREE.TGALoader: No data.' );

                    // Invalid type ?

                    default:
                        console.error( 'THREE.TGALoader: Invalid type "%s".', header.image_type );

                }

                // check image width and height

                if ( header.width <= 0 || header.height <= 0 ) {

                    console.error( 'THREE.TGALoader: Invalid image size.' );

                }

                // check image pixel size

                if ( header.pixel_size !== 8 && header.pixel_size !== 16 &&
                    header.pixel_size !== 24 && header.pixel_size !== 32 ) {

                    console.error( 'THREE.TGALoader: Invalid pixel size "%s".', header.pixel_size );

                }

            }

            // parse tga image buffer

            function tgaParse( use_rle, use_pal, header, offset, data ) {

                var pixel_data,
                    pixel_size,
                    pixel_total,
                    palettes;

                pixel_size = header.pixel_size >> 3;
                pixel_total = header.width * header.height * pixel_size;

                 // read palettes

                 if ( use_pal ) {

                     palettes = data.subarray( offset, offset += header.colormap_length * ( header.colormap_size >> 3 ) );

                 }

                 // read RLE

                 if ( use_rle ) {

                     pixel_data = new Uint8Array( pixel_total );

                    var c, count, i;
                    var shift = 0;
                    var pixels = new Uint8Array( pixel_size );

                    while ( shift < pixel_total ) {

                        c = data[ offset ++ ];
                        count = ( c & 0x7f ) + 1;

                        // RLE pixels

                        if ( c & 0x80 ) {

                            // bind pixel tmp array

                            for ( i = 0; i < pixel_size; ++ i ) {

                                pixels[ i ] = data[ offset ++ ];

                            }

                            // copy pixel array

                            for ( i = 0; i < count; ++ i ) {

                                pixel_data.set( pixels, shift + i * pixel_size );

                            }

                            shift += pixel_size * count;

                        } else {

                            // raw pixels

                            count *= pixel_size;
                            for ( i = 0; i < count; ++ i ) {

                                pixel_data[ shift + i ] = data[ offset ++ ];

                            }
                            shift += count;

                        }

                    }

                 } else {

                    // raw pixels

                    pixel_data = data.subarray(
                         offset, offset += ( use_pal ? header.width * header.height : pixel_total )
                    );

                 }

                 return {
                    pixel_data: pixel_data,
                    palettes: palettes
                 };

            }

            function tgaGetImageData8bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image, palettes ) {

                var colormap = palettes;
                var color, i = 0, x, y;
                var width = header.width;

                for ( y = y_start; y !== y_end; y += y_step ) {

                    for ( x = x_start; x !== x_end; x += x_step, i ++ ) {

                        color = image[ i ];
                        imageData[ ( x + width * y ) * 4 + 3 ] = 255;
                        imageData[ ( x + width * y ) * 4 + 2 ] = colormap[ ( color * 3 ) + 0 ];
                        imageData[ ( x + width * y ) * 4 + 1 ] = colormap[ ( color * 3 ) + 1 ];
                        imageData[ ( x + width * y ) * 4 + 0 ] = colormap[ ( color * 3 ) + 2 ];

                    }

                }

                return imageData;

            }

            function tgaGetImageData16bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {

                var color, i = 0, x, y;
                var width = header.width;

                for ( y = y_start; y !== y_end; y += y_step ) {

                    for ( x = x_start; x !== x_end; x += x_step, i += 2 ) {

                        color = image[ i + 0 ] + ( image[ i + 1 ] << 8 ); // Inversed ?
                        imageData[ ( x + width * y ) * 4 + 0 ] = ( color & 0x7C00 ) >> 7;
                        imageData[ ( x + width * y ) * 4 + 1 ] = ( color & 0x03E0 ) >> 2;
                        imageData[ ( x + width * y ) * 4 + 2 ] = ( color & 0x001F ) >> 3;
                        imageData[ ( x + width * y ) * 4 + 3 ] = ( color & 0x8000 ) ? 0 : 255;

                    }

                }

                return imageData;

            }

            function tgaGetImageData24bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {

                var i = 0, x, y;
                var width = header.width;

                for ( y = y_start; y !== y_end; y += y_step ) {

                    for ( x = x_start; x !== x_end; x += x_step, i += 3 ) {

                        imageData[ ( x + width * y ) * 4 + 3 ] = 255;
                        imageData[ ( x + width * y ) * 4 + 2 ] = image[ i + 0 ];
                        imageData[ ( x + width * y ) * 4 + 1 ] = image[ i + 1 ];
                        imageData[ ( x + width * y ) * 4 + 0 ] = image[ i + 2 ];

                    }

                }

                return imageData;

            }

            function tgaGetImageData32bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {

                var i = 0, x, y;
                var width = header.width;

                for ( y = y_start; y !== y_end; y += y_step ) {

                    for ( x = x_start; x !== x_end; x += x_step, i += 4 ) {

                        imageData[ ( x + width * y ) * 4 + 2 ] = image[ i + 0 ];
                        imageData[ ( x + width * y ) * 4 + 1 ] = image[ i + 1 ];
                        imageData[ ( x + width * y ) * 4 + 0 ] = image[ i + 2 ];
                        imageData[ ( x + width * y ) * 4 + 3 ] = image[ i + 3 ];

                    }

                }

                return imageData;

            }

            function tgaGetImageDataGrey8bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {

                var color, i = 0, x, y;
                var width = header.width;

                for ( y = y_start; y !== y_end; y += y_step ) {

                    for ( x = x_start; x !== x_end; x += x_step, i ++ ) {

                        color = image[ i ];
                        imageData[ ( x + width * y ) * 4 + 0 ] = color;
                        imageData[ ( x + width * y ) * 4 + 1 ] = color;
                        imageData[ ( x + width * y ) * 4 + 2 ] = color;
                        imageData[ ( x + width * y ) * 4 + 3 ] = 255;

                    }

                }

                return imageData;

            }

            function tgaGetImageDataGrey16bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {

                var i = 0, x, y;
                var width = header.width;

                for ( y = y_start; y !== y_end; y += y_step ) {

                    for ( x = x_start; x !== x_end; x += x_step, i += 2 ) {

                        imageData[ ( x + width * y ) * 4 + 0 ] = image[ i + 0 ];
                        imageData[ ( x + width * y ) * 4 + 1 ] = image[ i + 0 ];
                        imageData[ ( x + width * y ) * 4 + 2 ] = image[ i + 0 ];
                        imageData[ ( x + width * y ) * 4 + 3 ] = image[ i + 1 ];

                    }

                }

                return imageData;

            }

            function getTgaRGBA( data, width, height, image, palette ) {

                var x_start,
                    y_start,
                    x_step,
                    y_step,
                    x_end,
                    y_end;

                switch ( ( header.flags & TGA_ORIGIN_MASK ) >> TGA_ORIGIN_SHIFT ) {

                    default:
                    case TGA_ORIGIN_UL:
                        x_start = 0;
                        x_step = 1;
                        x_end = width;
                        y_start = 0;
                        y_step = 1;
                        y_end = height;
                        break;

                    case TGA_ORIGIN_BL:
                        x_start = 0;
                        x_step = 1;
                        x_end = width;
                        y_start = height - 1;
                        y_step = - 1;
                        y_end = - 1;
                        break;

                    case TGA_ORIGIN_UR:
                        x_start = width - 1;
                        x_step = - 1;
                        x_end = - 1;
                        y_start = 0;
                        y_step = 1;
                        y_end = height;
                        break;

                    case TGA_ORIGIN_BR:
                        x_start = width - 1;
                        x_step = - 1;
                        x_end = - 1;
                        y_start = height - 1;
                        y_step = - 1;
                        y_end = - 1;
                        break;

                }

                if ( use_grey ) {

                    switch ( header.pixel_size ) {

                        case 8:
                            tgaGetImageDataGrey8bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
                            break;

                        case 16:
                            tgaGetImageDataGrey16bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
                            break;

                        default:
                            console.error( 'THREE.TGALoader: Format not supported.' );
                            break;

                    }

                } else {

                    switch ( header.pixel_size ) {

                        case 8:
                            tgaGetImageData8bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image, palette );
                            break;

                        case 16:
                            tgaGetImageData16bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
                            break;

                        case 24:
                            tgaGetImageData24bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
                            break;

                        case 32:
                            tgaGetImageData32bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
                            break;

                        default:
                            console.error( 'THREE.TGALoader: Format not supported.' );
                            break;

                    }

                }

                // Load image data according to specific method
                // var func = 'tgaGetImageData' + (use_grey ? 'Grey' : '') + (header.pixel_size) + 'bits';
                // func(data, y_start, y_step, y_end, x_start, x_step, x_end, width, image, palette );
                return data;

            }

            // TGA constants

            var TGA_TYPE_NO_DATA = 0,
                TGA_TYPE_INDEXED = 1,
                TGA_TYPE_RGB = 2,
                TGA_TYPE_GREY = 3,
                TGA_TYPE_RLE_INDEXED = 9,
                TGA_TYPE_RLE_RGB = 10,
                TGA_TYPE_RLE_GREY = 11,

                TGA_ORIGIN_MASK = 0x30,
                TGA_ORIGIN_SHIFT = 0x04,
                TGA_ORIGIN_BL = 0x00,
                TGA_ORIGIN_BR = 0x01,
                TGA_ORIGIN_UL = 0x02,
                TGA_ORIGIN_UR = 0x03;

            if ( buffer.length < 19 ) console.error( 'THREE.TGALoader: Not enough data to contain header.' );

            var content = new Uint8Array( buffer ),
                offset = 0,
                header = {
                    id_length: content[ offset ++ ],
                    colormap_type: content[ offset ++ ],
                    image_type: content[ offset ++ ],
                    colormap_index: content[ offset ++ ] | content[ offset ++ ] << 8,
                    colormap_length: content[ offset ++ ] | content[ offset ++ ] << 8,
                    colormap_size: content[ offset ++ ],
                    origin: [
                        content[ offset ++ ] | content[ offset ++ ] << 8,
                        content[ offset ++ ] | content[ offset ++ ] << 8
                    ],
                    width: content[ offset ++ ] | content[ offset ++ ] << 8,
                    height: content[ offset ++ ] | content[ offset ++ ] << 8,
                    pixel_size: content[ offset ++ ],
                    flags: content[ offset ++ ]
                };

                // check tga if it is valid format

            tgaCheckHeader( header );

            if ( header.id_length + offset > buffer.length ) {

                console.error( 'THREE.TGALoader: No data.' );

            }

            // skip the needn't data

            offset += header.id_length;

            // get targa information about RLE compression and palette

            var use_rle = false,
                use_pal = false,
                use_grey = false;

            switch ( header.image_type ) {

                case TGA_TYPE_RLE_INDEXED:
                    use_rle = true;
                    use_pal = true;
                    break;

                case TGA_TYPE_INDEXED:
                    use_pal = true;
                    break;

                case TGA_TYPE_RLE_RGB:
                    use_rle = true;
                    break;

                case TGA_TYPE_RGB:
                    break;

                case TGA_TYPE_RLE_GREY:
                    use_rle = true;
                    use_grey = true;
                    break;

                case TGA_TYPE_GREY:
                    use_grey = true;
                    break;

            }

            //

            var canvas = document.createElement( 'canvas' );
            canvas.width = header.width;
            canvas.height = header.height;

            var context = canvas.getContext( '2d' );
            var imageData = context.createImageData( header.width, header.height );

            var result = tgaParse( use_rle, use_pal, header, offset, content );
            var rgbaData = getTgaRGBA( imageData.data, header.width, header.height, result.pixel_data, result.palettes );

            context.putImageData( imageData, 0, 0 );

            return canvas;

        },

        setPath: function ( value ) {

            this.path = value;
            return this;

        }

    };

    /**
     * @author spidersharma / http://eduperiment.com/
     */

    THREE.OutlinePass = function ( resolution, scene, camera, selectedObjects ) {

        this.renderScene = scene;
        this.renderCamera = camera;
        this.selectedObjects = selectedObjects !== undefined ? selectedObjects : [];
        this.visibleEdgeColor = new THREE.Color( 1, 1, 1 );
        this.hiddenEdgeColor = new THREE.Color( 0.1, 0.04, 0.02 );
        this.edgeGlow = 0.0;
        this.usePatternTexture = false;
        this.edgeThickness = 1.0;
        this.edgeStrength = 3.0;
        this.downSampleRatio = 2;
        this.pulsePeriod = 0;

        THREE.Pass.call( this );

        this.resolution = ( resolution !== undefined ) ? new THREE.Vector2( resolution.x, resolution.y ) : new THREE.Vector2( 256, 256 );

        var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };

        var resx = Math.round( this.resolution.x / this.downSampleRatio );
        var resy = Math.round( this.resolution.y / this.downSampleRatio );

        this.maskBufferMaterial = new THREE.MeshBasicMaterial( { color: 0xffffff } );
        this.maskBufferMaterial.side = THREE.DoubleSide;
        this.renderTargetMaskBuffer = new THREE.WebGLRenderTarget( this.resolution.x, this.resolution.y, pars );
        this.renderTargetMaskBuffer.texture.name = "OutlinePass.mask";
        this.renderTargetMaskBuffer.texture.generateMipmaps = false;

        this.depthMaterial = new THREE.MeshDepthMaterial();
        this.depthMaterial.side = THREE.DoubleSide;
        this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
        this.depthMaterial.blending = THREE.NoBlending;

        this.prepareMaskMaterial = this.getPrepareMaskMaterial();
        this.prepareMaskMaterial.side = THREE.DoubleSide;
        this.prepareMaskMaterial.fragmentShader = replaceDepthToViewZ( this.prepareMaskMaterial.fragmentShader, this.renderCamera );

        this.renderTargetDepthBuffer = new THREE.WebGLRenderTarget( this.resolution.x, this.resolution.y, pars );
        this.renderTargetDepthBuffer.texture.name = "OutlinePass.depth";
        this.renderTargetDepthBuffer.texture.generateMipmaps = false;

        this.renderTargetMaskDownSampleBuffer = new THREE.WebGLRenderTarget( resx, resy, pars );
        this.renderTargetMaskDownSampleBuffer.texture.name = "OutlinePass.depthDownSample";
        this.renderTargetMaskDownSampleBuffer.texture.generateMipmaps = false;

        this.renderTargetBlurBuffer1 = new THREE.WebGLRenderTarget( resx, resy, pars );
        this.renderTargetBlurBuffer1.texture.name = "OutlinePass.blur1";
        this.renderTargetBlurBuffer1.texture.generateMipmaps = false;
        this.renderTargetBlurBuffer2 = new THREE.WebGLRenderTarget( Math.round( resx / 2 ), Math.round( resy / 2 ), pars );
        this.renderTargetBlurBuffer2.texture.name = "OutlinePass.blur2";
        this.renderTargetBlurBuffer2.texture.generateMipmaps = false;

        this.edgeDetectionMaterial = this.getEdgeDetectionMaterial();
        this.renderTargetEdgeBuffer1 = new THREE.WebGLRenderTarget( resx, resy, pars );
        this.renderTargetEdgeBuffer1.texture.name = "OutlinePass.edge1";
        this.renderTargetEdgeBuffer1.texture.generateMipmaps = false;
        this.renderTargetEdgeBuffer2 = new THREE.WebGLRenderTarget( Math.round( resx / 2 ), Math.round( resy / 2 ), pars );
        this.renderTargetEdgeBuffer2.texture.name = "OutlinePass.edge2";
        this.renderTargetEdgeBuffer2.texture.generateMipmaps = false;

        var MAX_EDGE_THICKNESS = 4;
        var MAX_EDGE_GLOW = 4;

        this.separableBlurMaterial1 = this.getSeperableBlurMaterial( MAX_EDGE_THICKNESS );
        this.separableBlurMaterial1.uniforms[ "texSize" ].value = new THREE.Vector2( resx, resy );
        this.separableBlurMaterial1.uniforms[ "kernelRadius" ].value = 1;
        this.separableBlurMaterial2 = this.getSeperableBlurMaterial( MAX_EDGE_GLOW );
        this.separableBlurMaterial2.uniforms[ "texSize" ].value = new THREE.Vector2( Math.round( resx / 2 ), Math.round( resy / 2 ) );
        this.separableBlurMaterial2.uniforms[ "kernelRadius" ].value = MAX_EDGE_GLOW;

        // Overlay material
        this.overlayMaterial = this.getOverlayMaterial();

        // copy material
        if ( THREE.CopyShader === undefined )
            console.error( "THREE.OutlinePass relies on THREE.CopyShader" );

        var copyShader = THREE.CopyShader;

        this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
        this.copyUniforms[ "opacity" ].value = 1.0;

        this.materialCopy = new THREE.ShaderMaterial( {
            uniforms: this.copyUniforms,
            vertexShader: copyShader.vertexShader,
            fragmentShader: copyShader.fragmentShader,
            blending: THREE.NoBlending,
            depthTest: false,
            depthWrite: false,
            transparent: true
        } );

        this.enabled = true;
        this.needsSwap = false;

        this.oldClearColor = new THREE.Color();
        this.oldClearAlpha = 1;

        this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
        this.scene = new THREE.Scene();

        this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
        this.quad.frustumCulled = false; // Avoid getting clipped
        this.scene.add( this.quad );

        this.tempPulseColor1 = new THREE.Color();
        this.tempPulseColor2 = new THREE.Color();
        this.textureMatrix = new THREE.Matrix4();

        function replaceDepthToViewZ( string, camera ) {

            var type = camera.isPerspectiveCamera ? 'perspective' : 'orthographic';

            return string.replace( /DEPTH_TO_VIEW_Z/g, type + 'DepthToViewZ' );

        }

    };

    THREE.OutlinePass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

        constructor: THREE.OutlinePass,

        dispose: function () {

            this.renderTargetMaskBuffer.dispose();
            this.renderTargetDepthBuffer.dispose();
            this.renderTargetMaskDownSampleBuffer.dispose();
            this.renderTargetBlurBuffer1.dispose();
            this.renderTargetBlurBuffer2.dispose();
            this.renderTargetEdgeBuffer1.dispose();
            this.renderTargetEdgeBuffer2.dispose();

        },

        setSize: function ( width, height ) {

            this.renderTargetMaskBuffer.setSize( width, height );

            var resx = Math.round( width / this.downSampleRatio );
            var resy = Math.round( height / this.downSampleRatio );
            this.renderTargetMaskDownSampleBuffer.setSize( resx, resy );
            this.renderTargetBlurBuffer1.setSize( resx, resy );
            this.renderTargetEdgeBuffer1.setSize( resx, resy );
            this.separableBlurMaterial1.uniforms[ "texSize" ].value = new THREE.Vector2( resx, resy );

            resx = Math.round( resx / 2 );
            resy = Math.round( resy / 2 );

            this.renderTargetBlurBuffer2.setSize( resx, resy );
            this.renderTargetEdgeBuffer2.setSize( resx, resy );

            this.separableBlurMaterial2.uniforms[ "texSize" ].value = new THREE.Vector2( resx, resy );

        },

        changeVisibilityOfSelectedObjects: function ( bVisible ) {

            function gatherSelectedMeshesCallBack( object ) {

                if ( object.isMesh ) {

                    if ( bVisible ) {

                        object.visible = object.userData.oldVisible;
                        delete object.userData.oldVisible;

                    } else {

                        object.userData.oldVisible = object.visible;
                        object.visible = bVisible;

                    }

                }

            }

            for ( var i = 0; i < this.selectedObjects.length; i ++ ) {

                var selectedObject = this.selectedObjects[ i ];
                selectedObject.traverse( gatherSelectedMeshesCallBack );

            }

        },

        changeVisibilityOfNonSelectedObjects: function ( bVisible ) {

            var selectedMeshes = [];

            function gatherSelectedMeshesCallBack( object ) {

                if ( object.isMesh ) selectedMeshes.push( object );

            }

            for ( var i = 0; i < this.selectedObjects.length; i ++ ) {

                var selectedObject = this.selectedObjects[ i ];
                selectedObject.traverse( gatherSelectedMeshesCallBack );

            }

            function VisibilityChangeCallBack( object ) {

                if ( object.isMesh || object.isLine || object.isSprite ) {

                    var bFound = false;

                    for ( var i = 0; i < selectedMeshes.length; i ++ ) {

                        var selectedObjectId = selectedMeshes[ i ].id;

                        if ( selectedObjectId === object.id ) {

                            bFound = true;
                            break;

                        }

                    }

                    if ( ! bFound ) {

                        var visibility = object.visible;

                        if ( ! bVisible || object.bVisible ) object.visible = bVisible;

                        object.bVisible = visibility;

                    }

                }

            }

            this.renderScene.traverse( VisibilityChangeCallBack );

        },

        updateTextureMatrix: function () {

            this.textureMatrix.set( 0.5, 0.0, 0.0, 0.5,
                0.0, 0.5, 0.0, 0.5,
                0.0, 0.0, 0.5, 0.5,
                0.0, 0.0, 0.0, 1.0 );
            this.textureMatrix.multiply( this.renderCamera.projectionMatrix );
            this.textureMatrix.multiply( this.renderCamera.matrixWorldInverse );

        },

        render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

            if ( this.selectedObjects.length > 0 ) {

                this.oldClearColor.copy( renderer.getClearColor() );
                this.oldClearAlpha = renderer.getClearAlpha();
                var oldAutoClear = renderer.autoClear;

                renderer.autoClear = false;

                if ( maskActive ) renderer.context.disable( renderer.context.STENCIL_TEST );

                renderer.setClearColor( 0xffffff, 1 );

                // Make selected objects invisible
                this.changeVisibilityOfSelectedObjects( false );

                var currentBackground = this.renderScene.background;
                this.renderScene.background = null;

                // 1. Draw Non Selected objects in the depth buffer
                this.renderScene.overrideMaterial = this.depthMaterial;
                renderer.render( this.renderScene, this.renderCamera, this.renderTargetDepthBuffer, true );

                // Make selected objects visible
                this.changeVisibilityOfSelectedObjects( true );

                // Update Texture Matrix for Depth compare
                this.updateTextureMatrix();

                // Make non selected objects invisible, and draw only the selected objects, by comparing the depth buffer of non selected objects
                this.changeVisibilityOfNonSelectedObjects( false );
                this.renderScene.overrideMaterial = this.prepareMaskMaterial;
                this.prepareMaskMaterial.uniforms[ "cameraNearFar" ].value = new THREE.Vector2( this.renderCamera.near, this.renderCamera.far );
                this.prepareMaskMaterial.uniforms[ "depthTexture" ].value = this.renderTargetDepthBuffer.texture;
                this.prepareMaskMaterial.uniforms[ "textureMatrix" ].value = this.textureMatrix;
                renderer.render( this.renderScene, this.renderCamera, this.renderTargetMaskBuffer, true );
                this.renderScene.overrideMaterial = null;
                this.changeVisibilityOfNonSelectedObjects( true );

                this.renderScene.background = currentBackground;

                // 2. Downsample to Half resolution
                this.quad.material = this.materialCopy;
                this.copyUniforms[ "tDiffuse" ].value = this.renderTargetMaskBuffer.texture;
                renderer.render( this.scene, this.camera, this.renderTargetMaskDownSampleBuffer, true );

                this.tempPulseColor1.copy( this.visibleEdgeColor );
                this.tempPulseColor2.copy( this.hiddenEdgeColor );

                if ( this.pulsePeriod > 0 ) {

                    var scalar = ( 1 + 0.25 ) / 2 + Math.cos( performance.now() * 0.01 / this.pulsePeriod ) * ( 1.0 - 0.25 ) / 2;
                    this.tempPulseColor1.multiplyScalar( scalar );
                    this.tempPulseColor2.multiplyScalar( scalar );

                }

                // 3. Apply Edge Detection Pass
                this.quad.material = this.edgeDetectionMaterial;
                this.edgeDetectionMaterial.uniforms[ "maskTexture" ].value = this.renderTargetMaskDownSampleBuffer.texture;
                this.edgeDetectionMaterial.uniforms[ "texSize" ].value = new THREE.Vector2( this.renderTargetMaskDownSampleBuffer.width, this.renderTargetMaskDownSampleBuffer.height );
                this.edgeDetectionMaterial.uniforms[ "visibleEdgeColor" ].value = this.tempPulseColor1;
                this.edgeDetectionMaterial.uniforms[ "hiddenEdgeColor" ].value = this.tempPulseColor2;
                renderer.render( this.scene, this.camera, this.renderTargetEdgeBuffer1, true );

                // 4. Apply Blur on Half res
                this.quad.material = this.separableBlurMaterial1;
                this.separableBlurMaterial1.uniforms[ "colorTexture" ].value = this.renderTargetEdgeBuffer1.texture;
                this.separableBlurMaterial1.uniforms[ "direction" ].value = THREE.OutlinePass.BlurDirectionX;
                this.separableBlurMaterial1.uniforms[ "kernelRadius" ].value = this.edgeThickness;
                renderer.render( this.scene, this.camera, this.renderTargetBlurBuffer1, true );
                this.separableBlurMaterial1.uniforms[ "colorTexture" ].value = this.renderTargetBlurBuffer1.texture;
                this.separableBlurMaterial1.uniforms[ "direction" ].value = THREE.OutlinePass.BlurDirectionY;
                renderer.render( this.scene, this.camera, this.renderTargetEdgeBuffer1, true );

                // Apply Blur on quarter res
                this.quad.material = this.separableBlurMaterial2;
                this.separableBlurMaterial2.uniforms[ "colorTexture" ].value = this.renderTargetEdgeBuffer1.texture;
                this.separableBlurMaterial2.uniforms[ "direction" ].value = THREE.OutlinePass.BlurDirectionX;
                renderer.render( this.scene, this.camera, this.renderTargetBlurBuffer2, true );
                this.separableBlurMaterial2.uniforms[ "colorTexture" ].value = this.renderTargetBlurBuffer2.texture;
                this.separableBlurMaterial2.uniforms[ "direction" ].value = THREE.OutlinePass.BlurDirectionY;
                renderer.render( this.scene, this.camera, this.renderTargetEdgeBuffer2, true );

                // Blend it additively over the input texture
                this.quad.material = this.overlayMaterial;
                this.overlayMaterial.uniforms[ "maskTexture" ].value = this.renderTargetMaskBuffer.texture;
                this.overlayMaterial.uniforms[ "edgeTexture1" ].value = this.renderTargetEdgeBuffer1.texture;
                this.overlayMaterial.uniforms[ "edgeTexture2" ].value = this.renderTargetEdgeBuffer2.texture;
                this.overlayMaterial.uniforms[ "patternTexture" ].value = this.patternTexture;
                this.overlayMaterial.uniforms[ "edgeStrength" ].value = this.edgeStrength;
                this.overlayMaterial.uniforms[ "edgeGlow" ].value = this.edgeGlow;
                this.overlayMaterial.uniforms[ "usePatternTexture" ].value = this.usePatternTexture;


                if ( maskActive ) renderer.context.enable( renderer.context.STENCIL_TEST );

                renderer.render( this.scene, this.camera, readBuffer, false );

                renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
                renderer.autoClear = oldAutoClear;

            }

            if ( this.renderToScreen ) {

                this.quad.material = this.materialCopy;
                this.copyUniforms[ "tDiffuse" ].value = readBuffer.texture;
                renderer.render( this.scene, this.camera );

            }

        },

        getPrepareMaskMaterial: function () {

            return new THREE.ShaderMaterial( {

                uniforms: {
                    "depthTexture": { value: null },
                    "cameraNearFar": { value: new THREE.Vector2( 0.5, 0.5 ) },
                    "textureMatrix": { value: new THREE.Matrix4() }
                },

                vertexShader: [
                    'varying vec4 projTexCoord;',
                    'varying vec4 vPosition;',
                    'uniform mat4 textureMatrix;',

                    'void main() {',

                    '   vPosition = modelViewMatrix * vec4( position, 1.0 );',
                    '   vec4 worldPosition = modelMatrix * vec4( position, 1.0 );',
                    '   projTexCoord = textureMatrix * worldPosition;',
                    '   gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

                    '}'
                ].join( '\n' ),

                fragmentShader: [
                    '#include <packing>',
                    'varying vec4 vPosition;',
                    'varying vec4 projTexCoord;',
                    'uniform sampler2D depthTexture;',
                    'uniform vec2 cameraNearFar;',

                    'void main() {',

                    '   float depth = unpackRGBAToDepth(texture2DProj( depthTexture, projTexCoord ));',
                    '   float viewZ = - DEPTH_TO_VIEW_Z( depth, cameraNearFar.x, cameraNearFar.y );',
                    '   float depthTest = (-vPosition.z > viewZ) ? 1.0 : 0.0;',
                    '   gl_FragColor = vec4(0.0, depthTest, 1.0, 1.0);',

                    '}'
                ].join( '\n' )

            } );

        },

        getEdgeDetectionMaterial: function () {

            return new THREE.ShaderMaterial( {

                uniforms: {
                    "maskTexture": { value: null },
                    "texSize": { value: new THREE.Vector2( 0.5, 0.5 ) },
                    "visibleEdgeColor": { value: new THREE.Vector3( 1.0, 1.0, 1.0 ) },
                    "hiddenEdgeColor": { value: new THREE.Vector3( 1.0, 1.0, 1.0 ) },
                },

                vertexShader:
                    "varying vec2 vUv;\n\
                    void main() {\n\
                        vUv = uv;\n\
                        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
                    }",

                fragmentShader:
                    "varying vec2 vUv;\
                    uniform sampler2D maskTexture;\
                    uniform vec2 texSize;\
                    uniform vec3 visibleEdgeColor;\
                    uniform vec3 hiddenEdgeColor;\
                    \
                    void main() {\n\
                        vec2 invSize = 1.0 / texSize;\
                        vec4 uvOffset = vec4(1.0, 0.0, 0.0, 1.0) * vec4(invSize, invSize);\
                        vec4 c1 = texture2D( maskTexture, vUv + uvOffset.xy);\
                        vec4 c2 = texture2D( maskTexture, vUv - uvOffset.xy);\
                        vec4 c3 = texture2D( maskTexture, vUv + uvOffset.yw);\
                        vec4 c4 = texture2D( maskTexture, vUv - uvOffset.yw);\
                        float diff1 = (c1.r - c2.r)*0.5;\
                        float diff2 = (c3.r - c4.r)*0.5;\
                        float d = length( vec2(diff1, diff2) );\
                        float a1 = min(c1.g, c2.g);\
                        float a2 = min(c3.g, c4.g);\
                        float visibilityFactor = min(a1, a2);\
                        vec3 edgeColor = 1.0 - visibilityFactor > 0.001 ? visibleEdgeColor : hiddenEdgeColor;\
                        gl_FragColor = vec4(edgeColor, 1.0) * vec4(d);\
                    }"
            } );

        },

        getSeperableBlurMaterial: function ( maxRadius ) {

            return new THREE.ShaderMaterial( {

                defines: {
                    "MAX_RADIUS": maxRadius,
                },

                uniforms: {
                    "colorTexture": { value: null },
                    "texSize": { value: new THREE.Vector2( 0.5, 0.5 ) },
                    "direction": { value: new THREE.Vector2( 0.5, 0.5 ) },
                    "kernelRadius": { value: 1.0 }
                },

                vertexShader:
                    "varying vec2 vUv;\n\
                    void main() {\n\
                        vUv = uv;\n\
                        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
                    }",

                fragmentShader:
                    "#include <common>\
                    varying vec2 vUv;\
                    uniform sampler2D colorTexture;\
                    uniform vec2 texSize;\
                    uniform vec2 direction;\
                    uniform float kernelRadius;\
                    \
                    float gaussianPdf(in float x, in float sigma) {\
                        return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;\
                    }\
                    void main() {\
                        vec2 invSize = 1.0 / texSize;\
                        float weightSum = gaussianPdf(0.0, kernelRadius);\
                        vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;\
                        vec2 delta = direction * invSize * kernelRadius/float(MAX_RADIUS);\
                        vec2 uvOffset = delta;\
                        for( int i = 1; i <= MAX_RADIUS; i ++ ) {\
                            float w = gaussianPdf(uvOffset.x, kernelRadius);\
                            vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;\
                            vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;\
                            diffuseSum += ((sample1 + sample2) * w);\
                            weightSum += (2.0 * w);\
                            uvOffset += delta;\
                        }\
                        gl_FragColor = vec4(diffuseSum/weightSum, 1.0);\
                    }"
            } );

        },

        getOverlayMaterial: function () {

            return new THREE.ShaderMaterial( {

                uniforms: {
                    "maskTexture": { value: null },
                    "edgeTexture1": { value: null },
                    "edgeTexture2": { value: null },
                    "patternTexture": { value: null },
                    "edgeStrength": { value: 1.0 },
                    "edgeGlow": { value: 1.0 },
                    "usePatternTexture": { value: 0.0 }
                },

                vertexShader:
                    "varying vec2 vUv;\n\
                    void main() {\n\
                        vUv = uv;\n\
                        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
                    }",

                fragmentShader:
                    "varying vec2 vUv;\
                    uniform sampler2D maskTexture;\
                    uniform sampler2D edgeTexture1;\
                    uniform sampler2D edgeTexture2;\
                    uniform sampler2D patternTexture;\
                    uniform float edgeStrength;\
                    uniform float edgeGlow;\
                    uniform bool usePatternTexture;\
                    \
                    void main() {\
                        vec4 edgeValue1 = texture2D(edgeTexture1, vUv);\
                        vec4 edgeValue2 = texture2D(edgeTexture2, vUv);\
                        vec4 maskColor = texture2D(maskTexture, vUv);\
                        vec4 patternColor = texture2D(patternTexture, 6.0 * vUv);\
                        float visibilityFactor = 1.0 - maskColor.g > 0.0 ? 1.0 : 0.5;\
                        vec4 edgeValue = edgeValue1 + edgeValue2 * edgeGlow;\
                        vec4 finalColor = edgeStrength * maskColor.r * edgeValue;\
                        if(usePatternTexture)\
                            finalColor += + visibilityFactor * (1.0 - maskColor.r) * (1.0 - patternColor.r);\
                        gl_FragColor = finalColor;\
                    }",
                blending: THREE.AdditiveBlending,
                depthTest: false,
                depthWrite: false,
                transparent: true
            } );

        }

    } );

    THREE.OutlinePass.BlurDirectionX = new THREE.Vector2( 1.0, 0.0 );
    THREE.OutlinePass.BlurDirectionY = new THREE.Vector2( 0.0, 1.0 );

};
