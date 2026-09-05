import pool from '../config/db.js';
import { startBackgroundCounter } from './trafficController.js';

export const addCamera = async (req, res) => {
    const {
        road_id,
        name,
        lng,
        lat,
        video_file,
        coords
    } = req.body;

    // ===============================
    // VALIDATION
    // ===============================
    if (
        !road_id ||
        !name ||
        lng === undefined ||
        lat === undefined ||
        !video_file ||
        !coords
    ) {
        return res.status(400).json({
            success: false,
            message: 'Missing required camera information.'
        });
    }

    const connection = await pool.getConnection();

    try {
        // ===============================
        // START TRANSACTION
        // ===============================
        await connection.beginTransaction();

        // Check road exists and lock it during transaction
        const [roads] = await connection.query(
            'SELECT id FROM roads WHERE id = ? FOR UPDATE',
            [road_id]
        );

        if (roads.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: 'Road not found.'
            });
        }

        // ===============================
        // 1. INSERT CAMERA
        // ===============================
        const [cameraResult] = await connection.query(
            `INSERT INTO cameras
            (road_id, name, lng, lat, video_file)
            VALUES (?, ?, ?, ?, ?)`,
            [
                road_id,
                name,
                lng,
                lat,
                video_file
            ]
        );

        // ===============================
        // 2. SAVE STREAM + ROI TO ROAD
        // ===============================
        await connection.query(
            `UPDATE roads
            SET camera_link = ?,
                camera_coords = ?
            WHERE id = ?`,
            [
                video_file,
                coords,
                road_id
            ]
        );

        // ===============================
        // EVERYTHING OK -> COMMIT
        // ===============================
        await connection.commit();

        // ===============================
        // START AI AFTER COMMIT
        // ===============================
        startBackgroundCounter(
            road_id,
            video_file,
            coords
        );

        return res.status(201).json({
            success: true,
            id: cameraResult.insertId,
            message: 'Camera created successfully! ROI saved and background counting started.'
        });

    } catch (error) {
        // ===============================
        // SOMETHING FAILED -> ROLLBACK
        // ===============================
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error(
                '[CAMERA TRANSACTION] Rollback error:',
                rollbackError
            );
        }

        console.error(
            '[CAMERA TRANSACTION] Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {
        connection.release();
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