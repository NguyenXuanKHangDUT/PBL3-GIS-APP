import pool from '../config/db.js';

export const addCamera = async (req, res) => {
    const { road_id, name, lng, lat, video_file } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO cameras (road_id, name, lng, lat, video_file) VALUES (?, ?, ?, ?, ?)',
            [road_id, name, lng, lat, video_file]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getCameras = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM cameras');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

export const deleteCamera = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM cameras WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};