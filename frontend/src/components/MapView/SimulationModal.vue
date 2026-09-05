<template>
  <div class="simulation-overlay">

    <div class="simulation-modal">

      <div class="simulation-header">

        <div>
          <h3>Bird's Eye View Simulation</h3>
          <p>{{ title }}</p>
        </div>

        <button
          class="simulation-close-btn"
          @click="emit('close')"
        >
          ✖
        </button>

      </div>

      <div class="simulation-body">

        <canvas
          ref="canvasRef"
          class="simulation-canvas"
          width="300"
          height="700"
        ></canvas>

        <div class="simulation-side">

          <h4>Realtime Web Simulator</h4>

          <p>
            Python still handles YOLO + BoT-SORT +
            Homography, while Vue renders the Bird's Eye
            View canvas through Socket.IO data.
          </p>

          <div class="simulation-status-box">
            <span
              class="status-dot"
              :class="{ active: running }"
            ></span>

            <span>{{ status }}</span>
          </div>

          <div class="simulation-legend">
            <div>
              <span class="legend-dot car"></span>
              Car
            </div>

            <div>
              <span class="legend-dot motorcycle"></span>
              Motorcycle
            </div>

            <div>
              <span class="legend-dot bus"></span>
              Bus
            </div>

            <div>
              <span class="legend-dot truck"></span>
              Truck
            </div>
          </div>

          <button
            class="simulation-stop-btn"
            @click="emit('close')"
          >
            Stop Simulation
          </button>

        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  title: {
    type: String,
    default: ''
  },

  status: {
    type: String,
    default: ''
  },

  running: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const canvasRef = ref(null)

defineExpose({
  getCanvas() {
    return canvasRef.value
  }
})
</script>

<style scoped>
.simulation-overlay {
  position: fixed;
  inset: 0;
  z-index: 3200;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.simulation-modal {
  width: min(760px, 96vw);
  background: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
}

.simulation-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  background: #011d42;
  color: white;
}

.simulation-header h3 {
  margin: 0 0 6px 0;
  font-size: 18px;
}

.simulation-header p {
  margin: 0;
  font-size: 13px;
  opacity: 0.85;
}

.simulation-close-btn {
  border: none;
  background: transparent;
  color: white;
  font-size: 20px;
  cursor: pointer;
}

.simulation-body {
  display: flex;
  gap: 18px;
  padding: 18px;
  background: #f5f5f5;
}

.simulation-canvas {
  width: 300px;
  height: 700px;
  background: #323232;
  border-radius: 8px;
  border: 2px solid #d0d0d0;
}

.simulation-side {
  flex: 1;
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e0e0e0;
}

.simulation-side h4 {
  margin: 0 0 10px 0;
  color: #011d42;
}

.simulation-side p {
  margin: 0 0 14px 0;
  font-size: 13px;
  line-height: 1.45;
  color: #555;
}

.simulation-status-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f0f4f8;
  border-radius: 6px;
  padding: 10px;
  font-size: 13px;
  color: #333;
  margin-bottom: 14px;
}

.status-dot {
  width: 10px;
  height: 10px;
  background: #999;
  border-radius: 50%;
}

.status-dot.active {
  background: #4caf50;
}

.simulation-legend {
  display: grid;
  gap: 8px;
  font-size: 13px;
  color: #333;
  margin-bottom: 18px;
}

.legend-dot {
  display: inline-block;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  margin-right: 8px;
  vertical-align: middle;
}

.legend-dot.car {
  background: #ffff00;
}

.legend-dot.motorcycle {
  background: #ff00ff;
}

.legend-dot.bus {
  background: #ffa500;
}

.legend-dot.truck {
  background: #00ff00;
}

.simulation-stop-btn {
  width: 100%;
  border: none;
  background: #f44336;
  color: white;
  border-radius: 6px;
  padding: 11px;
  font-weight: bold;
  cursor: pointer;
}
</style>