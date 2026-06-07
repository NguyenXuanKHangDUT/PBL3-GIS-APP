<template>
  <div class="dashboard-layout">
    <div class="map-wrapper">
      
      <MapViewer 
        :activeLayer="currentLayer" 
        :activeMode="activeMode"
        :triggerRoute="routeTrigger"
        :avoidTraffic="isAvoidingTraffic" 
        @update-point="handlePointUpdate"
        @query-result="handleQueryResult"
      />

      <MapToolbar 
        :activeMode="activeMode"
        :pointA="pointA"
        :pointB="pointB"
        @set-mode="setMode"
        @find-route="triggerRouteCalc"
        @update-avoid-traffic="handleAvoidTraffic"
        @open-dashboard="fetchCameraDashboard"
      />

      <LayerTools @change-layer="updateLayer" />

    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-container">
        <div class="modal-header">
          <h3>📋 Camera Statistics Dashboard</h3>
          <button class="close-btn" @click="showModal = false">✖</button>
        </div>
        <div class="modal-body">
          <table>
            <thead>
              <tr>
                <th>Camera Name</th>
                <th>Live Traffic (cars/min)</th>
                <th>Status</th>
                <th>Live Feed</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(cam, index) in cameraList" :key="index">
                <td><strong>{{ cam.camera_name }}</strong></td>
                <td>{{ cam.vehicle_count || 0 }}</td>
                <td>
                  <span :class="['status-badge', cam.density_level || 'clear']">
                    {{ formatStatus(cam.density_level) }}
                  </span>
                </td>
                <td>
                  <a :href="cam.camera_link" target="_blank" class="link-btn">▶ Watch Live</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import MapViewer from '../components/MapViewer.vue'
import MapToolbar from '../components/MapToolbar.vue'
import LayerTools from '../components/LayerTools.vue'

const currentLayer = ref('heatmap')
const activeMode = ref(null) 
const pointA = ref(null) 
const pointB = ref(null)
const routeTrigger = ref(0) 
const isAvoidingTraffic = ref(false)

const showModal = ref(false);
const cameraList = ref([]);

const updateLayer = (layerName) => {
  currentLayer.value = layerName
}

const setMode = (mode) => {
  activeMode.value = mode
}

const handlePointUpdate = (data) => {
  if (data.mode === 'A') pointA.value = data.coord
  if (data.mode === 'B') pointB.value = data.coord
  activeMode.value = null 
}

const triggerRouteCalc = () => {
  routeTrigger.value++ 
}

const handleAvoidTraffic = (val) => {
  isAvoidingTraffic.value = val;
}

const handleQueryResult = (result) => {
  alert(`📊 SPATIAL QUERY RESULT:\n\n- 📷 Cameras in area: ${result.cameras}\n- 🚗 Estimated vehicles: ${result.vehicles}`);
  activeMode.value = null; 
}

const fetchCameraDashboard = async () => {
  showModal.value = true;
  try {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:5000/api/traffic/cameras/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
    }

    const result = await res.json();
    
    if (result.success) {
        cameraList.value = result.data;
    } else {
        alert("Backend Error: " + result.message);
    }
  } catch (err) {
    alert("Connection Error: " + err.message);
    console.error("Detail Error:", err);
  }
};

// Hàm dịch 6 trạng thái giao thông khớp với XML GeoServer
const formatStatus = (status) => {
  if (status === 'severe') return '⚫ Severe Congestion';
  if (status === 'congested') return '🔴 Congested';
  if (status === 'heavy') return '🟠 Heavy Traffic';
  if (status === 'moderate') return '🟡 Moderate';
  if (status === 'light') return '🟢 Light Traffic';
  if (status === 'very_light') return '🔵 Very Light';
  return '⚪ Clear / No Data';
};

</script>

<style scoped>
.dashboard-layout {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

/* CSS CHO MODAL CAMERA DASHBOARD */
.modal-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.6);
  display: flex; justify-content: center; align-items: center;
  z-index: 9999;
}
.modal-container {
  background: white;
  width: 850px;
  max-width: 90%;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.28);
  font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}
.modal-header {
  background: #011d42; color: white; padding: 15px 20px;
  display: flex; justify-content: space-between; align-items: center;
}
.modal-header h3 { margin: 0; font-size: 16px; }
.close-btn { background: none; border: none; color: white; font-size: 20px; cursor: pointer; }
.close-btn:hover { color: #ff4d4d; }
.modal-body { padding: 20px; max-height: 60vh; overflow-y: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
th { background: #f0f2f5; color: #333; font-weight: bold; position: sticky; top: 0; }

/* ĐÃ CẬP NHẬT: CSS 6 màu chuẩn theo file XML của GeoServer */
.status-badge { 
  padding: 6px 12px; 
  border-radius: 20px; 
  font-size: 13px; 
  font-weight: bold; 
  color: white; 
  display: inline-block; 
  min-width: 140px; 
  text-align: center; 
}
.status-badge.severe { background: #8B0000; }
.status-badge.congested { background: #FF0000; }
.status-badge.heavy { background: #FF9800; }
.status-badge.moderate { background: #FFEB3B; color: #333; } /* Chữ đen trên nền vàng cho dễ đọc */
.status-badge.light { background: #4CAF50; }
.status-badge.very_light { background: #00BCD4; }
.status-badge.clear { background: #64B5F6; }

.link-btn { background: #1a73e8; color: white; text-decoration: none; padding: 8px 15px; border-radius: 5px; font-size: 13px; font-weight: bold; transition: 0.2s;}
.link-btn:hover { background: #1557b0; }
</style>