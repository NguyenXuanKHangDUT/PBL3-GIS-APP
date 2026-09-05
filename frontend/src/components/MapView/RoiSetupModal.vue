<template>
  <div class="roi-overlay">
    <div class="roi-modal">

      <div class="roi-header">
        <div>
          <h3>Setup Camera ROI</h3>

          <p>
            Click 4 points on the camera frame to select ROI
          </p>
        </div>

        <button
          class="roi-close-btn"
          @click="emit('cancel')"
        >
          ✖
        </button>
      </div>

      <div class="roi-body">

        <div
          v-if="loading"
          class="roi-loading"
        >
          Loading frame from camera...
        </div>

        <div
          v-else-if="errorMessage"
          class="roi-error"
        >
          {{ errorMessage }}
        </div>

        <div
          v-else
          class="roi-frame-wrapper"
        >
          <img
            ref="imageRef"
            class="roi-frame"
            :src="frameSrc"
            @click="handleImageClick"
            draggable="false"
          />

          <svg
            class="roi-svg"
            viewBox="0 0 1280 720"
            preserveAspectRatio="none"
          >
            <polyline
              v-if="points.length >= 2 && points.length < 4"
              :points="polylinePoints"
              fill="none"
              stroke="#2196f3"
              stroke-width="3"
              stroke-dasharray="8 6"
            />

            <polygon
              v-if="points.length === 4"
              :points="polygonPoints"
              fill="rgba(33, 150, 243, 0.18)"
              stroke="#2196f3"
              stroke-width="3"
            />
          </svg>

          <div
            v-for="(point, index) in points"
            :key="index"
            class="roi-point"
            :style="getPointStyle(point)"
          >
            {{ index + 1 }}
          </div>
        </div>
      </div>

      <div class="roi-footer">

        <div class="roi-info">
          Selected:
          <strong>{{ points.length }}/4</strong>
          points
        </div>

        <div class="roi-actions">

          <button
            class="roi-btn outline"
            @click="emit('reset')"
          >
            Select Again
          </button>

          <button
            class="roi-btn outline"
            @click="emit('cancel')"
          >
            Cancel
          </button>

          <button
            class="roi-btn fill"
            :disabled="points.length !== 4 || saving"
            @click="emit('confirm')"
          >
            {{ saving ? 'Saving...' : 'Save ROI & Start Counting' }}
          </button>

        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const ROI_FRAME_WIDTH = 1280
const ROI_FRAME_HEIGHT = 720

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },

  saving: {
    type: Boolean,
    default: false
  },

  errorMessage: {
    type: String,
    default: ''
  },

  frameSrc: {
    type: String,
    default: ''
  },

  points: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'add-point',
  'reset',
  'cancel',
  'confirm'
])

const imageRef = ref(null)

const polylinePoints = computed(() => {
  return props.points
    .map(point => `${point.x},${point.y}`)
    .join(' ')
})

const polygonPoints = computed(() => {
  return props.points
    .map(point => `${point.x},${point.y}`)
    .join(' ')
})

const getPointStyle = (point) => {
  return {
    left: `${(point.x / ROI_FRAME_WIDTH) * 100}%`,
    top: `${(point.y / ROI_FRAME_HEIGHT) * 100}%`
  }
}

const handleImageClick = (event) => {
  if (props.points.length >= 4) return
  if (!imageRef.value) return

  const rect = imageRef.value.getBoundingClientRect()

  const x = Math.round(
    ((event.clientX - rect.left) / rect.width) *
    ROI_FRAME_WIDTH
  )

  const y = Math.round(
    ((event.clientY - rect.top) / rect.height) *
    ROI_FRAME_HEIGHT
  )

  emit('add-point', {
    x: Math.max(
      0,
      Math.min(ROI_FRAME_WIDTH, x)
    ),

    y: Math.max(
      0,
      Math.min(ROI_FRAME_HEIGHT, y)
    )
  })
}
</script>

<style scoped>
.roi-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.roi-modal {
  width: min(1100px, 96vw);
  background: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  font-family: 'Inter', 'Segoe UI', system-ui,
    -apple-system, BlinkMacSystemFont, sans-serif;
}

.roi-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  padding: 16px 20px;
  background: #011d42;
  color: white;
}

.roi-header h3 {
  margin: 0 0 6px 0;
  font-size: 18px;
}

.roi-header p {
  margin: 0;
  font-size: 13px;
  opacity: 0.85;
  line-height: 1.4;
}

.roi-close-btn {
  border: none;
  background: transparent;
  color: white;
  font-size: 20px;
  cursor: pointer;
}

.roi-body {
  padding: 16px;
  background: #f5f5f5;
}

.roi-loading,
.roi-error {
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: #333;
}

.roi-error {
  color: #c62828;
  font-weight: bold;
}

.roi-frame-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #111;
  overflow: hidden;
  border-radius: 8px;
  border: 2px solid #ddd;
}

.roi-frame {
  width: 100%;
  height: 100%;
  object-fit: fill;
  display: block;
  cursor: crosshair;
  user-select: none;
}

.roi-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.roi-point {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #f44336;
  color: white;
  border: 2px solid white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.roi-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid #e0e0e0;
  background: white;
}

.roi-info {
  font-size: 14px;
  color: #333;
}

.roi-actions {
  display: flex;
  gap: 10px;
}

.roi-btn {
  padding: 10px 14px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  border: 1px solid #011d42;
}

.roi-btn.outline {
  background: white;
  color: #011d42;
}

.roi-btn.fill {
  background: #011d42;
  color: white;
}

.roi-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>