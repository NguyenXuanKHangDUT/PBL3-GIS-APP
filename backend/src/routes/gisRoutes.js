import express from 'express';
import multer from 'multer';
import { getRoads, uploadGeoJSON, findRoute } from '../controllers/gisController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/roads', getRoads);
router.post('/upload', upload.single('geojson'), uploadGeoJSON);
router.post('/route', findRoute);

export default router;