import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import userRoutes from './routes/userRoutes.js';

import pool from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import gisRoutes from './routes/gisRoutes.js';
import cameraRoutes from './routes/cameraRoutes.js'; 
import trafficRoutes from './routes/trafficRoutes.js';
import { autoResumeCameras } from './controllers/trafficController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

global.io = io;

io.on('connection', (socket) => {
  console.log(`🟢 WebGIS vừa kết nối Socket thành công! ID: ${socket.id}`);
});
/* ---------------------------------- */

app.use('/api/auth', authRoutes);
app.use('/api/gis', gisRoutes);
app.use('/api/cameras', cameraRoutes); 
app.use('/api/traffic', trafficRoutes);
app.use('/api/users', userRoutes);

server.listen(PORT, () => {
  console.log(`🚀 Server dang chay tai: http://localhost:${PORT}`);
  autoResumeCameras();

});