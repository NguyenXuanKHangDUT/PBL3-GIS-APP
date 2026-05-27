<template>
  <div class="analytics-container">
    <div class="header-section">
      <h2>📊 Traffic Flow Analytics</h2>
      <button @click="fetchData" class="btn-refresh">🔄 Refresh Data</button>
    </div>

    <div v-if="isLoaded" class="charts-grid">
      <div class="chart-card">
        <h3>Total System Traffic (Last 30 mins)</h3>
        <div class="chart-wrapper">
          <Line :data="historyChartData" :options="chartOptions" />
        </div>
      </div>

      <div class="chart-card">
        <h3>Live Vehicle Density per Camera</h3>
        <div class="chart-wrapper">
          <Bar :data="currentChartData" :options="chartOptions" />
        </div>
      </div>
    </div>
    
    <div v-else class="loading">
      <div class="spinner"></div>
      <p>Loading system analytics...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Bar, Line } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

const token = localStorage.getItem('token') || ''
const isLoaded = ref(false)

const historyChartData = ref({ labels: [], datasets: [] })
const currentChartData = ref({ labels: [], datasets: [] })

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: true, position: 'bottom' } }
}

const fetchData = async () => {
  isLoaded.value = false
  try {
    const resCurrent = await fetch('http://localhost:5000/api/traffic/stats/current', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const dataCurrent = await resCurrent.json()

    const resHistory = await fetch('http://localhost:5000/api/traffic/stats/history', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const dataHistory = await resHistory.json()

    if (!dataCurrent.success || !dataHistory.success) {
      alert("Failed to fetch analytics data.");
      return;
    }

    currentChartData.value = {
      labels: dataCurrent.data.map(item => item.road_name || `Route ${item.road_id}`),
      datasets: [{
        label: 'Live Vehicles (cars/min)',
        backgroundColor: '#1a73e8', 
        data: dataCurrent.data.map(item => item.vehicle_count),
        borderRadius: 4
      }]
    }

    historyChartData.value = {
      labels: dataHistory.data.map(item => item.time_frame),
      datasets: [{
        label: 'Total Vehicles Captured',
        backgroundColor: '#f44336', 
        borderColor: '#f44336',
        data: dataHistory.data.map(item => item.total_vehicles),
        tension: 0.4, 
        fill: false
      }]
    }
    
    isLoaded.value = true
  } catch (error) {
    console.error("Fetch Error:", error);
    alert("Connection lost. Please check the Backend API.");
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
/* CSS giữ nguyên như cũ của bạn, chỉ đổi font cho hiện đại hơn chút */
.analytics-container { padding: 30px; background: #f4f7f9; min-height: 100vh; font-family: sans-serif; }
.header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
.header-section h2 { color: #011d42; margin: 0; }
.btn-refresh { background: #011d42; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s;}
.btn-refresh:hover { background: #022c64; }
.charts-grid { display: grid; grid-template-columns: 1fr; gap: 30px; }
@media (min-width: 1024px) { .charts-grid { grid-template-columns: 1fr 1fr; } }
.chart-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
.chart-card h3 { text-align: center; color: #333; margin-top: 0; margin-bottom: 20px; font-size: 16px; }
.chart-wrapper { height: 350px; position: relative; }
.loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50vh; color: #666; }
.spinner { border: 4px solid rgba(0,0,0,0.1); width: 40px; height: 40px; border-radius: 50%; border-left-color: #011d42; animation: spin 1s linear infinite; margin-bottom: 15px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>