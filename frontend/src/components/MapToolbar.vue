<template>
  <div class="map-toolbar" :class="{ 'is-collapsed': isCollapsed }">
    
    <div class="toolbar-toggle" @click="toggleToolbar">
      <span>{{ isCollapsed ? '▶ EXPAND' : '▼ COLLAPSE' }}</span>
    </div>

    <div class="toolbar-body" v-show="!isCollapsed">
      <div class="toolbar-tabs">
        <div 
          class="tab-item" 
          :class="{ active: activeTab === 'manager' }"
          @click="activeTab = 'manager'"
        >
          MANAGER
        </div>
        <div 
          class="tab-item" 
          :class="{ active: activeTab === 'gis' }"
          @click="activeTab = 'gis'"
        >
          GIS FUNCTION
        </div>
      </div>

      <div v-if="activeTab === 'manager'" class="tab-content manager-content">
        <div class="feature-section">
          <h4 class="section-title">Camera Database</h4>
          <p class="section-desc">Monitor live status of the camera network.</p>
          <button class="action-btn fill dashboard-btn" @click="$emit('open-dashboard')">
            📊 Dashboard
          </button>
        </div>
      </div>

      <div v-if="activeTab === 'gis'" class="tab-content gis-content">
        <div class="feature-section">
          <h4 class="section-title">📂 Road Network</h4>
          <p class="section-desc">Upload a .geojson file to update the network.</p>
          
          <input 
            type="file" 
            ref="fileInput" 
            style="display: none" 
            accept=".geojson,application/json" 
            @change="handleFileUpload" 
          />
          
          <button class="action-btn outline" @click="$refs.fileInput.click()">
            📤 Upload .geojson
          </button>
        </div>

        <div class="feature-divider"></div>

        <div class="feature-section">
          <h4 class="section-title">🔍 Spatial Query</h4>
          <p class="section-desc">Draw a polygon to estimate real-time traffic & cameras.</p>
          <button 
            class="action-btn outline polygon-btn" 
            :class="{ 'is-drawing': activeMode === 'polygon' }"
            @click="$emit('set-mode', 'polygon')"
          >
            {{ activeMode === 'polygon' ? '🟢 Drawing... (Double-click to finish)...' : '⬚ Draw Polygon' }}
          </button>
        </div>

        <div class="feature-divider"></div>

        <div class="feature-section">
          <h4 class="section-title">🛣️ Dynamic Routing</h4>
          <p class="section-desc">Select an origin and destination to find the route.</p>
          <div class="route-inputs">
            <div class="input-group" @click="$emit('set-mode', 'A')" :class="{ 'active-point-a': activeMode === 'A' }">
              <span class="point-label a">A</span>
              <input type="text" :value="formatCoord(pointA)" placeholder="Origin..." readonly />
            </div>
            <div class="input-group" @click="$emit('set-mode', 'B')" :class="{ 'active-point-b': activeMode === 'B' }">
              <span class="point-label b">B</span>
              <input type="text" :value="formatCoord(pointB)" placeholder="Destination..." readonly />
            </div>
          </div>
          
          <label class="toggle-control">
            <input type="checkbox" v-model="avoidTraffic" @change="$emit('update-avoid-traffic', avoidTraffic)" />
            <span>Avoid Traffic (AI Heatmap)</span>
          </label>
          
          <button class="action-btn fill" @click="$emit('find-route')">Find Route</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  activeMode: String, 
  pointA: Array,
  pointB: Array
})

const activeTab = ref('manager') 
const fileInput = ref(null)
const isCollapsed = ref(false)
const avoidTraffic = ref(false)

const emit = defineEmits(['locate-user', 'set-mode', 'find-route', 'update-avoid-traffic', 'open-dashboard'])

const toggleToolbar = () => {
  isCollapsed.value = !isCollapsed.value
}

const formatCoord = (coord) => coord ? `${coord[0].toFixed(4)}, ${coord[1].toFixed(4)}` : ''

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  const formData = new FormData()
  formData.append('geojson', file)

  try {
    const response = await fetch('http://localhost:5000/api/gis/upload', {
      method: 'POST',
      body: formData
    })

    const result = await response.json()
    if (result.success) {
      alert("Đã nhập dữ liệu thành công! Hãy F5 để xem thay đổi.")
    } else {
      alert("Lỗi: " + result.message)
    }
  } catch (error) {
    alert("Không thể kết nối đến server! Vui lòng kiểm tra lại Backend.")
  }
}
</script>

<style scoped>
/* CSS đã được tối ưu cho gọn gàng và thanh lịch hơn */
.map-toolbar {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 380px; /* Nới rộng một chút cho chữ dễ đọc */
  background: #ffffff;
  border-radius: 8px; /* Bo góc mượt hơn */
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

.map-toolbar.is-collapsed {
  width: 220px;
}

.toolbar-toggle {
  background: #f8f9fa;
  text-align: center;
  padding: 10px 10px;
  font-size: 12px;
  font-weight: bold;
  color: #555;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
  border-bottom: 1px solid #e0e0e0;
}

.toolbar-toggle:hover {
  background: #e9ecef;
  color: #011d42;
}

.toolbar-tabs {
  display: flex;
  background: #011d42; /* Đổi sang màu xanh navy cho đồng bộ với theme App */
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 14px 5px;
  color: #8da4c2;
  font-weight: bold;
  font-size: 13px;
  cursor: pointer;
  transition: 0.3s;
  border-bottom: 3px solid transparent;
}

.tab-item:hover {
  color: white;
}

.tab-item.active {
  color: white;
  border-bottom: 3px solid #4caf50; /* Gạch chân xanh lá nổi bật */
}

.tab-content {
  padding: 0;
  max-height: calc(100vh - 150px);
  overflow-y: auto; /* Thêm cuộn nếu màn hình nhỏ */
}

/* Kéo thanh cuộn đẹp hơn */
.tab-content::-webkit-scrollbar { width: 6px; }
.tab-content::-webkit-scrollbar-track { background: #f1f1f1; }
.tab-content::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }

.manager-content, .gis-content {
  padding: 20px;
}

.feature-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-divider {
  height: 1px;
  background: #e0e0e0;
  margin: 20px 0;
}

.section-title {
  font-size: 15px;
  color: #011d42;
  margin: 0;
  font-weight: 700;
}

.section-desc {
  font-size: 13px;
  color: #666;
  margin: 0;
  line-height: 1.4;
}

/* Buttons */
.action-btn {
  width: 100%;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: 0.2s;
  text-align: center;
}

.action-btn.outline {
  background: transparent;
  border: 1px solid #011d42;
  color: #011d42;
}

.action-btn.outline:hover {
  background: #f0f4f8;
}

.action-btn.fill {
  background: #011d42;
  border: none;
  color: white;
}

.action-btn.fill:hover {
  background: #022c64;
}

.dashboard-btn {
  margin-top: 5px;
  font-size: 15px;
}

.polygon-btn.is-drawing {
  background: #e8f0fe;
  border-color: #1a73e8;
  color: #1a73e8;
}

/* Routing Inputs */
.route-inputs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-group {
  display: flex;
  align-items: center;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  transition: 0.2s;
  background: #f9f9f9;
}

.input-group.active-point-a { border: 2px solid #4caf50; background: white; }
.input-group.active-point-b { border: 2px solid #f44336; background: white; }

.point-label {
  padding: 10px 15px;
  font-weight: bold;
  color: white;
  font-size: 14px;
}

.point-label.a { background: #4caf50; }
.point-label.b { background: #f44336; }

.input-group input {
  flex: 1;
  padding: 10px;
  border: none;
  outline: none;
  font-size: 13px;
  background: transparent;
  cursor: pointer;
}

.toggle-control {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #444;
  cursor: pointer;
  margin: 10px 0;
  font-weight: 500;
}
</style>