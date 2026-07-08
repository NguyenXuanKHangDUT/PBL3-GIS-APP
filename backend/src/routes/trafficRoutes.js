import express from 'express';
import {
    setupLiveCamera,
    getSetupFrame,
    removeCamera,
    viewSimulation,
    startWebSimulation,
    stopWebSimulation,
    getHeatmapData,
    getCurrentTrafficStats,
    getTrafficHistory,
    getCameraDashboardData
} from '../controllers/trafficController.js';

const router = express.Router();

router.post('/setup', setupLiveCamera);
router.post('/remove', removeCamera);

router.post('/simulate', viewSimulation);

router.post('/setup-frame', getSetupFrame);

router.post('/simulate/start', startWebSimulation);
router.post('/simulate/stop', stopWebSimulation);

router.get('/heatmap', getHeatmapData);
router.get('/stats/current', getCurrentTrafficStats);
router.get('/stats/history', getTrafficHistory);
router.get('/cameras/dashboard', getCameraDashboardData);

export default router;