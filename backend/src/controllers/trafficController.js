import pool from '../config/db.js';
import { spawn } from 'child_process';
import path from 'path';

/* Object quản lý các tiến trình đang chạy ngầm */
export const activeCameras = {};

export const setupLiveCamera = async (req, res) => {
    const { road_id, stream_link } = req.body;
    
    if (!stream_link) {
        return res.status(400).json({ success: false, message: 'Thiếu link luồng Camera (.m3u8)' });
    }

    const yoloDirectory = path.resolve('../YOLO');
    const setupProcess = spawn('python', ['yolo_setup.py', stream_link], { cwd: yoloDirectory });

    let outputData = '';

    setupProcess.stdout.on('data', (data) => {
        outputData += data.toString();
    });

    setupProcess.on('close', async (code) => {
        try {
            const lines = outputData.trim().split('\n');
            const lastLine = lines[lines.length - 1].trim();
            const result = JSON.parse(lastLine);

            if (result.success) {
                const coords = result.coords;

                await pool.query(
                    'UPDATE roads SET camera_link = ?, camera_coords = ? WHERE id = ?',
                    [stream_link, coords, road_id]
                );

                startBackgroundCounter(road_id, stream_link, coords);

                return res.json({ success: true, message: 'Setup Camera thành công! Đang đếm ngầm...' });
            } else {
                return res.status(400).json({ success: false, message: result.message || 'Setup thất bại' });
            }
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Lỗi đọc kết quả từ Python' });
        }
    });
};

export const startBackgroundCounter = (road_id, stream_link, coords) => {
    if (activeCameras[road_id]) {
        activeCameras[road_id].kill();
    }

    const yoloDirectory = path.resolve('../YOLO');
    const counterProcess = spawn('python', ['yolo_counter.py', stream_link, coords], { cwd: yoloDirectory });

    activeCameras[road_id] = counterProcess;

    counterProcess.stdout.on('data', async (data) => {
        const lines = data.toString().trim().split('\n');
        for (let line of lines) {
            try {
                const result = JSON.parse(line.trim());
                if (result.cars_per_minute !== undefined) {
                    const vehicle_count = result.cars_per_minute;
                    
                    // ĐỒNG BỘ LOGIC VỚI GEOSERVER XML
                    let density_level = 'clear';
                    if (vehicle_count >= 100) density_level = 'severe';
                    else if (vehicle_count >= 71) density_level = 'congested';
                    else if (vehicle_count >= 51) density_level = 'heavy';
                    else if (vehicle_count >= 31) density_level = 'moderate';
                    else if (vehicle_count >= 16) density_level = 'light';
                    else if (vehicle_count >= 1) density_level = 'very_light';

                    await pool.query(
                        'INSERT INTO traffic_logs (road_id, vehicle_count, density_level) VALUES (?, ?, ?)',
                        [road_id, vehicle_count, density_level]
                    );
                    
                    await pool.query(
                        'UPDATE roads SET vehicle_count = ?, density_level = ? WHERE id = ?',
                        [vehicle_count, density_level, road_id]
                    );

                    if (global.io) {
                        global.io.emit('traffic-update', {
                            road_id: road_id,
                            vehicle_count: vehicle_count,
                            density_level: density_level
                        });
                    }
                }
            } catch (e) {}
        }
    });

    counterProcess.on('close', () => {
        delete activeCameras[road_id];
    });
};

export const removeCamera = async (req, res) => {
    const { road_id } = req.body;
    
    /* Kill ngay lập tức tiến trình Python đang chạy ngầm của đường này */
    if (activeCameras[road_id]) {
        activeCameras[road_id].kill();
        delete activeCameras[road_id];
    }
    
    try {
        await pool.query(
            'UPDATE roads SET camera_link = NULL, camera_coords = NULL, vehicle_count = 0, density_level = "thong_thoang" WHERE id = ?',
            [road_id]
        );
        res.json({ success: true, message: 'Đã xóa camera và giải phóng RAM thành công.' });
    } catch(error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const viewSimulation = async (req, res) => {
    const { road_id } = req.body;
    
    try {
        const [rows] = await pool.query('SELECT camera_link, camera_coords FROM roads WHERE id = ?', [road_id]);
        
        if (rows.length === 0 || !rows[0].camera_link || !rows[0].camera_coords) {
            return res.status(400).json({ success: false, message: 'Đường này chưa được gắn Camera!' });
        }

        const { camera_link, camera_coords } = rows[0];
        const yoloDirectory = path.resolve('../YOLO');
        
        const simProcess = spawn('python', ['yolo_simulator.py', camera_link, camera_coords], { cwd: yoloDirectory });

        simProcess.on('error', (err) => {
            console.error('Lỗi chạy simulator:', err);
        });

        res.json({ success: true, message: 'Đang mở cửa sổ mô phỏng...' });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getHeatmapData = async (req, res) => {
    try {
        const query = `
            SELECT t1.road_id, t1.vehicle_count, t1.density_level
            FROM traffic_logs t1
            INNER JOIN (
                SELECT road_id, MAX(recorded_at) as max_time
                FROM traffic_logs
                GROUP BY road_id
            ) t2 ON t1.road_id = t2.road_id AND t1.recorded_at = t2.max_time;
        `;
        const [rows] = await pool.query(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

export const getCurrentTrafficStats = async (req, res) => {
    try {
        const query = `
            SELECT r.name as road_name, r.id as road_id, r.vehicle_count, r.density_level
            FROM cameras c
            JOIN roads r ON c.road_id = r.id
            WHERE r.vehicle_count >= 0
            ORDER BY r.vehicle_count DESC;
        `;
        const [rows] = await pool.query(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTrafficHistory = async (req, res) => {
    try {
        const query = `
            SELECT 
                DATE_FORMAT(recorded_at, '%H:%i') as time_frame,
                SUM(vehicle_count) as total_vehicles
            FROM traffic_logs
            WHERE recorded_at >= NOW() - INTERVAL 30 MINUTE
            GROUP BY time_frame
            ORDER BY MIN(recorded_at) ASC; 
        `;
        const [rows] = await pool.query(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// TỰ ĐỘNG KHÔI PHỤC AI KHI KHỞI ĐỘNG SERVER
// ==========================================
export const autoResumeCameras = async () => {
    try {
        const [rows] = await pool.query(
            'SELECT id, camera_link, camera_coords FROM roads WHERE camera_link IS NOT NULL AND camera_coords IS NOT NULL'
        );
        
        if (rows.length > 0) {
            console.log(`🤖 [AI System] Đang tự động đánh thức ${rows.length} luồng Camera...`);
            
            for (const row of rows) {
                let coords = row.camera_coords;
                if (typeof coords === 'object') {
                    coords = JSON.stringify(coords);
                } else {
                    coords = String(coords);
                }
                startBackgroundCounter(row.id, row.camera_link, coords);
                console.log(`  👉 Đã khôi phục thành công Camera cho đường ID: ${row.id}`);
            }
        } else {
            console.log(`🤖 [AI System] Hệ thống trống. Không có Camera nào cần khôi phục.`);
        }
    } catch (error) {
        console.error('❌ Lỗi khi tự động khôi phục Camera:', error.message);
    }
};

export const getCameraDashboardData = async (req, res) => {
    try {
        const query = `
            SELECT c.name as camera_name, r.vehicle_count, r.density_level, c.video_file as camera_link
            FROM cameras c
            JOIN roads r ON c.road_id = r.id
        `;
        const [rows] = await pool.query(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};