import pool from '../config/db.js';

export const getRoads = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM roads');
        const features = rows.map(row => ({
            type: 'Feature',
            properties: { id: row.id, name: row.name, type: row.type },
            geometry: typeof row.geojson_data === 'string' ? JSON.parse(row.geojson_data) : row.geojson_data
        }));
        res.json({ type: 'FeatureCollection', features: features });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const uploadGeoJSON = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn file GeoJSON' });
        }

        const geojsonData = JSON.parse(req.file.buffer.toString());

        const roads = geojsonData.features.filter(
            feature => feature.geometry.type === 'LineString'
        );

        for (const road of roads) {
            const roadId = road.id || road.properties.id || `ROAD_${Math.random().toString(36).substring(2, 10)}`;
            const name = road.properties.name || 'Đường chưa đặt tên';
            const type = road.properties.highway || 'unknown';
            
            const geojsonString = JSON.stringify(road.geometry);

            await pool.query(
                `INSERT INTO roads (id, name, road_type, geom, geojson_data) 
                 VALUES (?, ?, ?, ST_SRID(ST_GeomFromGeoJSON(?), 0), ?)`,
                [roadId, name, type, geojsonString, geojsonString] 
            );
        }

        res.json({ success: true, message: `Đã nhập thành công ${roads.length} đoạn đường.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const findRoute = async (req, res) => {
    const { startCoord, endCoord, avoidTraffic } = req.body;
    console.log(">>> [FIND ROUTE] Bắt đầu tìm đường (Chế độ Spiderweb Bridging)...");

    try {
        const [roads] = await pool.query('SELECT * FROM roads');
        const [traffic] = await pool.query(`
            SELECT t1.road_id, t1.vehicle_count 
            FROM traffic_logs t1 
            INNER JOIN (SELECT road_id, MAX(recorded_at) as mt FROM traffic_logs GROUP BY road_id) t2 
            ON t1.road_id = t2.road_id AND t1.recorded_at = t2.mt
        `);

        const trafficMap = {};
        traffic.forEach(t => trafficMap[t.road_id] = t.vehicle_count);

        const graph = {};
        const addEdge = (u, v, weight) => {
            if (!graph[u]) graph[u] = [];
            graph[u].push({ node: v, weight });
            if (!graph[v]) graph[v] = [];
            graph[v].push({ node: u, weight });
        };

        const getDist = (p1, p2) => Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
        

        const exactKey = (coord) => `${coord[0]},${coord[1]}`;
        const buckets = {};

        roads.forEach(road => {
            const geom = typeof road.geojson_data === 'string' ? JSON.parse(road.geojson_data) : road.geojson_data;
            if (geom.type !== 'LineString' && geom.type !== 'MultiLineString') return;
            
            const count = trafficMap[road.id] || 0;
            let multiplier = 1;
            
            if (avoidTraffic) {
                if (count > 80) multiplier = 15;
                else if (count > 60) multiplier = 5;
                else if (count > 40) multiplier = 2;
            }

            const processCoords = (coords) => {
                for (let i = 0; i < coords.length; i++) {
                    const u = exactKey(coords[i]);
                    
                    const bKey = `${Number(coords[i][0]).toFixed(3)}_${Number(coords[i][1]).toFixed(3)}`;
                    if (!buckets[bKey]) buckets[bKey] = [];
                    buckets[bKey].push(coords[i]);

                    if (i < coords.length - 1) {
                        const v = exactKey(coords[i + 1]);
                        const dist = getDist(coords[i], coords[i + 1]) * multiplier;
                        addEdge(u, v, dist);
                    }
                }
            };

            if (geom.type === 'LineString') {
                processCoords(geom.coordinates);
            } else if (geom.type === 'MultiLineString') {
                geom.coordinates.forEach(processCoords);
            }
        });

        Object.values(buckets).forEach(bucket => {
            for (let i = 0; i < bucket.length; i++) {
                for (let j = i + 1; j < bucket.length; j++) {
                    const dist = getDist(bucket[i], bucket[j]);
                    if (dist > 0 && dist < 0.00035) {
                        addEdge(exactKey(bucket[i]), exactKey(bucket[j]), dist * 2);
                    }
                }
            }
        });

        const findNearestNode = (coord) => {
            let minKey = null;
            let minDist = Infinity;
            Object.keys(graph).forEach(key => {
                const nodeCoord = key.split(',').map(Number);
                const d = getDist(coord, nodeCoord);
                if (d < minDist) { minDist = d; minKey = key; }
            });
            return minKey;
        };

        const startNode = findNearestNode(startCoord);
        const endNode = findNearestNode(endCoord);

        if (!startNode || !endNode) {
            return res.json({ success: false, message: "Điểm chọn nằm quá xa hệ thống đường!" });
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
                if (distances[queue[i]] < distances[queue[minIdx]]) minIdx = i;
            }
            
            const u = queue[minIdx];
            queue.splice(minIdx, 1);
            inQueue.delete(u);

            if (u === endNode) break; 
            if (visited.has(u)) continue;
            visited.add(u);

            if (graph[u]) {
                graph[u].forEach(edge => {
                    if (visited.has(edge.node)) return;

                    const alt = distances[u] + edge.weight;
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
            return res.json({ success: false, message: "Bản đồ bị đứt gãy hoặc không có ngã tư hợp lệ gần đó!" });
        }
        
        console.log(">>> [FIND ROUTE] THÀNH CÔNG! Trả về lộ trình mượt mà bám đường.");
        res.json({ 
            success: true, 
            path: { 
                type: 'Feature',
                properties: { name: 'Optimal Route' },
                geometry: { type: 'LineString', coordinates: pathCoords }
            } 
        });
    } catch (error) {
        console.error(">>> [FIND ROUTE] LỖI:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};