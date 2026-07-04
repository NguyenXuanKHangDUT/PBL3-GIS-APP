import pool from '../config/db.js';

// ===============================
// ROUTING GRAPH CACHE
// ===============================
let routingGraphCache = null;
let routingGraphCacheTime = null;

const clearRoutingGraphCache = () => {
    routingGraphCache = null;
    routingGraphCacheTime = null;
    console.log('🧹 Routing graph cache cleared');
};

const getDist = (p1, p2) => {
    return Math.sqrt(
        Math.pow(p1[0] - p2[0], 2) +
        Math.pow(p1[1] - p2[1], 2)
    );
};

const exactKey = (coord) => `${coord[0]},${coord[1]}`;

const buildRoutingGraphCache = async () => {
    console.log('🔧 [ROUTING CACHE] Building graph cache...');

    const [roads] = await pool.query(`
        SELECT id, geojson_data
        FROM roads
        WHERE geojson_data IS NOT NULL
    `);

    const graph = {};
    const buckets = {};
    const nodeSet = new Set();

    const addNode = (key) => {
        nodeSet.add(key);

        if (!graph[key]) {
            graph[key] = [];
        }
    };

    const addEdge = (u, v, baseWeight, roadId = null) => {
        addNode(u);
        addNode(v);

        graph[u].push({
            node: v,
            baseWeight,
            road_id: roadId
        });

        graph[v].push({
            node: u,
            baseWeight,
            road_id: roadId
        });
    };

    for (const road of roads) {
        let geom;

        try {
            geom = typeof road.geojson_data === 'string'
                ? JSON.parse(road.geojson_data)
                : road.geojson_data;
        } catch (error) {
            console.warn(`⚠️ [ROUTING CACHE] Lỗi parse geojson_data road ${road.id}`);
            continue;
        }

        if (!geom || !geom.coordinates) {
            continue;
        }

        if (geom.type !== 'LineString' && geom.type !== 'MultiLineString') {
            continue;
        }

        const processCoords = (coords) => {
            for (let i = 0; i < coords.length; i++) {
                const currentKey = exactKey(coords[i]);

                const bKey = `${Number(coords[i][0]).toFixed(3)}_${Number(coords[i][1]).toFixed(3)}`;

                if (!buckets[bKey]) {
                    buckets[bKey] = [];
                }

                buckets[bKey].push(coords[i]);

                if (i < coords.length - 1) {
                    const nextKey = exactKey(coords[i + 1]);
                    const dist = getDist(coords[i], coords[i + 1]);

                    addEdge(currentKey, nextKey, dist, road.id);
                }
            }
        };

        if (geom.type === 'LineString') {
            processCoords(geom.coordinates);
        } else if (geom.type === 'MultiLineString') {
            geom.coordinates.forEach(processCoords);
        }
    }

    // Spiderweb Bridging: nối các node rất gần nhau để tránh graph bị đứt ở ngã tư
    Object.values(buckets).forEach(bucket => {
        for (let i = 0; i < bucket.length; i++) {
            for (let j = i + 1; j < bucket.length; j++) {
                const dist = getDist(bucket[i], bucket[j]);

                if (dist > 0 && dist < 0.00035) {
                    addEdge(
                        exactKey(bucket[i]),
                        exactKey(bucket[j]),
                        dist * 2,
                        null
                    );
                }
            }
        }
    });

    routingGraphCache = {
        graph,
        nodeKeys: Array.from(nodeSet)
    };

    routingGraphCacheTime = new Date();

    console.log(
        `✅ [ROUTING CACHE] Graph cached: ${routingGraphCache.nodeKeys.length} nodes`
    );

    return routingGraphCache;
};

const getRoutingGraphCache = async () => {
    if (routingGraphCache) {
        console.log(
            `⚡ [ROUTING CACHE] Using cached graph from ${routingGraphCacheTime.toLocaleTimeString()}`
        );

        return routingGraphCache;
    }

    return await buildRoutingGraphCache();
};

const findNearestNode = (coord, nodeKeys) => {
    let minKey = null;
    let minDist = Infinity;

    for (const key of nodeKeys) {
        const nodeCoord = key.split(',').map(Number);
        const d = getDist(coord, nodeCoord);

        if (d < minDist) {
            minDist = d;
            minKey = key;
        }
    }

    return minKey;
};

export const getRoads = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM roads');

        const features = rows.map(row => ({
            type: 'Feature',
            properties: {
                id: row.id,
                name: row.name,
                type: row.type
            },
            geometry: typeof row.geojson_data === 'string'
                ? JSON.parse(row.geojson_data)
                : row.geojson_data
        }));

        res.json({
            type: 'FeatureCollection',
            features: features
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const uploadGeoJSON = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn file GeoJSON'
            });
        }

        const geojsonData = JSON.parse(req.file.buffer.toString());

        const roads = geojsonData.features.filter(
            feature => feature.geometry.type === 'LineString'
        );

        for (const road of roads) {
            const roadId = road.id || road.properties.id || `ROAD_${Math.random().toString(36).substring(2, 10)}`;
            const name = road.properties.name || 'Unnamed Road';
            const type = road.properties.highway || 'unknown';

            const geojsonString = JSON.stringify(road.geometry);

            await pool.query(
                `INSERT INTO roads (id, name, road_type, geom, geojson_data) 
                 VALUES (?, ?, ?, ST_SRID(ST_GeomFromGeoJSON(?), 0), ?)`,
                [roadId, name, type, geojsonString, geojsonString]
            );
        }

        clearRoutingGraphCache();

        res.json({
            success: true,
            message: `Đã nhập thành công ${roads.length} đoạn đường.`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const findRoute = async (req, res) => {
    const { startCoord, endCoord, avoidTraffic } = req.body;
    const shouldAvoidTraffic = avoidTraffic === true || avoidTraffic === 'true';

    console.log(">>> [FIND ROUTE] Bắt đầu tìm đường với Routing Graph Cache...");

    try {
        if (!startCoord || !endCoord) {
            return res.json({
                success: false,
                message: "Thiếu điểm bắt đầu hoặc điểm kết thúc!"
            });
        }

        const { graph, nodeKeys } = await getRoutingGraphCache();

        if (!graph || !nodeKeys || nodeKeys.length === 0) {
            return res.json({
                success: false,
                message: "Không có dữ liệu mạng lưới đường!"
            });
        }

        const [traffic] = await pool.query(`
            SELECT t1.road_id, t1.vehicle_count 
            FROM traffic_logs t1 
            INNER JOIN (
                SELECT road_id, MAX(recorded_at) as mt 
                FROM traffic_logs 
                GROUP BY road_id
            ) t2 
            ON t1.road_id = t2.road_id AND t1.recorded_at = t2.mt
        `);

        const trafficMap = {};
        traffic.forEach(t => {
            trafficMap[t.road_id] = t.vehicle_count;
        });

        const startNode = findNearestNode(startCoord, nodeKeys);
        const endNode = findNearestNode(endCoord, nodeKeys);

        if (!startNode || !endNode) {
            return res.json({
                success: false,
                message: "Điểm chọn nằm quá xa hệ thống đường!"
            });
        }

        const distances = {};
        const prev = {};
        const visited = new Set();
        const queue = [startNode];
        const inQueue = new Set([startNode]);

        distances[startNode] = 0;

        while (queue.length > 0) {
            let minIdx = 0;

            for (let i = 1; i < queue.length; i++) {
                if (distances[queue[i]] < distances[queue[minIdx]]) {
                    minIdx = i;
                }
            }

            const u = queue[minIdx];
            queue.splice(minIdx, 1);
            inQueue.delete(u);

            if (u === endNode) {
                break;
            }

            if (visited.has(u)) {
                continue;
            }

            visited.add(u);

            if (graph[u]) {
                graph[u].forEach(edge => {
                    if (visited.has(edge.node)) {
                        return;
                    }

                    let multiplier = 1;

                    if (shouldAvoidTraffic && edge.road_id) {
                        const count = trafficMap[edge.road_id] || 0;

                        if (count > 80) {
                            multiplier = 15;
                        } else if (count > 60) {
                            multiplier = 5;
                        } else if (count > 40) {
                            multiplier = 2;
                        }
                    }

                    const weight = edge.baseWeight * multiplier;
                    const alt = distances[u] + weight;

                    if (distances[edge.node] === undefined || alt < distances[edge.node]) {
                        distances[edge.node] = alt;
                        prev[edge.node] = u;

                        if (!inQueue.has(edge.node)) {
                            queue.push(edge.node);
                            inQueue.add(edge.node);
                        }
                    }
                });
            }
        }

        const pathCoords = [];
        let curr = endNode;

        if (prev[curr] || curr === startNode) {
            while (curr) {
                pathCoords.unshift(curr.split(',').map(Number));
                curr = prev[curr] || null;
            }
        }

        if (pathCoords.length < 2) {
            return res.json({
                success: false,
                message: "Bản đồ bị đứt gãy hoặc không có ngã tư hợp lệ gần đó!"
            });
        }

        console.log(">>> [FIND ROUTE] THÀNH CÔNG! Trả về lộ trình từ graph cache.");

        res.json({
            success: true,
            path: {
                type: 'Feature',
                properties: {
                    name: 'Optimal Route',
                    avoidTraffic: shouldAvoidTraffic,
                    cachedGraph: true
                },
                geometry: {
                    type: 'LineString',
                    coordinates: pathCoords
                }
            }
        });
    } catch (error) {
        console.error(">>> [FIND ROUTE] ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
