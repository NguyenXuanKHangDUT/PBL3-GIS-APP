import express from 'express';
import { verifyToken, isAdmin } from '../middleware/authMiddleware.js';
import { addCamera, getCameras, deleteCamera } from '../controllers/cameraController.js';

const router = express.Router();

router.get('/', getCameras);
router.post('/', verifyToken, isAdmin, addCamera);
router.delete('/:id', verifyToken, isAdmin, deleteCamera);

export default router;