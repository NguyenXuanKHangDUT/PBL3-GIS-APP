<template>
  <div class="map-root">
    <div ref="mapContainer" class="map-container"></div>

    <div
      v-if="streamPopoverVisible"
      class="stream-popover-backdrop"
      @click="closeStreamPopover"
    ></div>

    <div
      v-if="streamPopoverVisible"
      class="stream-popover"
      :style="{ left: `${streamPopoverLeft}px`, top: `${streamPopoverTop}px` }"
      @click.stop
    >
      <div class="stream-popover-header">
        <div>
          <h4>Add Camera</h4>
          <p>Enter the camera stream link for the selected road segment.</p>
        </div>

        <button class="stream-close-btn" @click="closeStreamPopover">✖</button>
      </div>

      <input
        ref="streamInputRef"
        v-model="streamInputValue"
        class="stream-input"
        type="text"
        placeholder="http://.../stream.m3u8 or .mp4"
        @keyup.enter="submitStreamLink"
        @keyup.esc="closeStreamPopover"
      />

      <div class="stream-popover-actions">
        <button class="stream-btn outline" @click="closeStreamPopover">
          Cancel
        </button>

        <button class="stream-btn fill" @click="submitStreamLink">
          Continue Selecting ROI
        </button>
      </div>
    </div>

    <div v-if="simulationModalVisible" class="simulation-overlay">
      <div class="simulation-modal">
        <div class="simulation-header">
          <div>
            <h3>Bird's Eye View Simulation</h3>
            <p>{{ simulationTitle }}</p>
          </div>

          <button class="simulation-close-btn" @click="closeSimulationModal">✖</button>
        </div>

        <div class="simulation-body">
          <canvas
            ref="simulationCanvasRef"
            class="simulation-canvas"
            width="300"
            height="700"
          ></canvas>

          <div class="simulation-side">
            <h4>Realtime Web Simulator</h4>
            <p>
              Python still handles YOLO + BoT-SORT + Homography, while Vue renders
              the Bird's Eye View canvas through Socket.IO data.
            </p>

            <div class="simulation-status-box">
              <span class="status-dot" :class="{ active: simulationRunning }"></span>
              <span>{{ simulationStatus }}</span>
            </div>

            <div class="simulation-legend">
              <div><span class="legend-dot car"></span> Car</div>
              <div><span class="legend-dot motorcycle"></span> Motorcycle</div>
              <div><span class="legend-dot bus"></span> Bus</div>
              <div><span class="legend-dot truck"></span> Truck</div>
            </div>

            <button class="simulation-stop-btn" @click="closeSimulationModal">
              Stop Simulation
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="roiModalVisible" class="roi-overlay">
      <div class="roi-modal">
        <div class="roi-header">
          <div>
            <h3>Setup Camera ROI</h3>
            <p>
              Click 4 points on the camera frame to select ROI
            </p>
          </div>

          <button class="roi-close-btn" @click="cancelRoiSetup">✖</button>
        </div>

        <div class="roi-body">
          <div v-if="roiLoading" class="roi-loading">
            Loading frame from camera...
          </div>

          <div v-else-if="roiError" class="roi-error">
            {{ roiError }}
          </div>

          <div v-else class="roi-frame-wrapper">
            <img
              ref="roiImageRef"
              class="roi-frame"
              :src="roiFrameSrc"
              @click="handleRoiClick"
              draggable="false"
            />

            <svg class="roi-svg" viewBox="0 0 1280 720" preserveAspectRatio="none">
              <polyline
                v-if="roiPoints.length >= 2 && roiPoints.length < 4"
                :points="roiPolylinePoints"
                fill="none"
                stroke="#2196f3"
                stroke-width="3"
                stroke-dasharray="8 6"
              />

              <polygon
                v-if="roiPoints.length === 4"
                :points="roiPolygonPoints"
                fill="rgba(33, 150, 243, 0.18)"
                stroke="#2196f3"
                stroke-width="3"
              />
            </svg>

            <div
              v-for="(point, index) in roiPoints"
              :key="index"
              class="roi-point"
              :style="getRoiPointStyle(point)"
            >
              {{ index + 1 }}
            </div>
          </div>
        </div>

        <div class="roi-footer">
          <div class="roi-info">
            Selected: <strong>{{ roiPoints.length }}/4</strong> points
          </div>

          <div class="roi-actions">
            <button class="roi-btn outline" @click="resetRoiPoints">
              Select Again
            </button>

            <button class="roi-btn outline" @click="cancelRoiSetup">
              Cancel
            </button>

            <button
              class="roi-btn fill"
              :disabled="roiPoints.length !== 4 || roiSaving"
              @click="confirmRoiSetup"
            >
              {{ roiSaving ? 'Saving...' : 'Save ROI & Start Counting' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import cameraIcon from '@/assets/icons/camera.png'

import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as turf from '@turf/turf'
import { io } from 'socket.io-client'

const props = defineProps({
  activeLayer: { type: String, default: 'camera' },
  activeMode: { type: String, default: null },
  triggerRoute: { type: Number, default: 0 },
  avoidTraffic: { type: Boolean, default: false }
})

const emit = defineEmits(['update-point', 'query-result'])

const mapContainer = ref(null)
let map = null
let cameraMarkers = []
let roadGeoJSON = null
let routeMarkers = { A: null, B: null }
let polygonCoords = []
let heatmapInterval = null
let socket = null

const userRole = ref('user')
const authToken = ref('')

const streamPopoverVisible = ref(false)
const streamPopoverLeft = ref(0)
const streamPopoverTop = ref(0)
const streamInputValue = ref('')
const streamInputRef = ref(null)
const pendingRoadClick = ref(null)

const openStreamPopover = async (event, roadFeature) => {
  const roadId = roadFeature.properties.id || 'unknown'
  const autoName = `CAM_${Math.floor(Math.random() * 10000)}`

  pendingRoadClick.value = {
    road_id: roadId,
    name: autoName,
    lng: event.lngLat.lng,
    lat: event.lngLat.lat
  }

  streamInputValue.value = ''
  streamPopoverVisible.value = true

  const originalEvent = event.originalEvent
  const popoverWidth = 360
  const popoverHeight = 170
  const padding = 16

  let left = originalEvent.clientX + 14
  let top = originalEvent.clientY + 14

  if (left + popoverWidth > window.innerWidth - padding) {
    left = originalEvent.clientX - popoverWidth - 14
  }

  if (top + popoverHeight > window.innerHeight - padding) {
    top = originalEvent.clientY - popoverHeight - 14
  }

  streamPopoverLeft.value = Math.max(padding, left)
  streamPopoverTop.value = Math.max(padding, top)

  await nextTick()
  streamInputRef.value?.focus()
}

const closeStreamPopover = () => {
  streamPopoverVisible.value = false
  streamInputValue.value = ''
  pendingRoadClick.value = null
}

const submitStreamLink = async () => {
  const streamLink = streamInputValue.value.trim()

  if (!streamLink) {
    alert('Please enter the camera link.')
    return
  }

  if (!pendingRoadClick.value) {
    alert('No selected road segment found.')
    return
  }

  const cameraData = {
    ...pendingRoadClick.value,
    video_file: streamLink
  }

  closeStreamPopover()

  await openRoiSetupModal(cameraData)
}

const ROI_FRAME_WIDTH = 1280
const ROI_FRAME_HEIGHT = 720

const roiModalVisible = ref(false)
const roiLoading = ref(false)
const roiSaving = ref(false)
const roiError = ref('')
const roiFrameSrc = ref('')
const roiPoints = ref([])
const roiImageRef = ref(null)
const pendingCamera = ref(null)

const roiPolylinePoints = computed(() => {
  return roiPoints.value.map(p => `${p.x},${p.y}`).join(' ')
})

const roiPolygonPoints = computed(() => {
  return roiPoints.value.map(p => `${p.x},${p.y}`).join(' ')
})

const getRoiPointStyle = (point) => {
  return {
    left: `${(point.x / ROI_FRAME_WIDTH) * 100}%`,
    top: `${(point.y / ROI_FRAME_HEIGHT) * 100}%`
  }
}

const resetRoiPoints = () => {
  roiPoints.value = []
}

const cancelRoiSetup = () => {
  roiModalVisible.value = false
  roiLoading.value = false
  roiSaving.value = false
  roiError.value = ''
  roiFrameSrc.value = ''
  roiPoints.value = []
  pendingCamera.value = null
}

const handleRoiClick = (event) => {
  if (roiPoints.value.length >= 4) return
  if (!roiImageRef.value) return

  const rect = roiImageRef.value.getBoundingClientRect()

  const x = Math.round(((event.clientX - rect.left) / rect.width) * ROI_FRAME_WIDTH)
  const y = Math.round(((event.clientY - rect.top) / rect.height) * ROI_FRAME_HEIGHT)

  roiPoints.value.push({
    x: Math.max(0, Math.min(ROI_FRAME_WIDTH, x)),
    y: Math.max(0, Math.min(ROI_FRAME_HEIGHT, y))
  })
}

const openRoiSetupModal = async (cameraData) => {
  pendingCamera.value = cameraData
  roiModalVisible.value = true
  roiLoading.value = true
  roiSaving.value = false
  roiError.value = ''
  roiFrameSrc.value = ''
  roiPoints.value = []

  try {
    const res = await fetch('http://localhost:5000/api/traffic/setup-frame', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken.value}`
      },
      body: JSON.stringify({
        stream_link: cameraData.video_file
      })
    })

    const result = await res.json()

    if (!result.success) {
      roiError.value = result.message || 'Cannot fetch frame from camera.'
      return
    }

    roiFrameSrc.value = `data:image/jpeg;base64,${result.image}`
  } catch (error) {
    roiError.value = 'Cannot connect to backend to fetch setup frame.'
  } finally {
    roiLoading.value = false
  }
}

const confirmRoiSetup = async () => {
  if (!pendingCamera.value) return

  if (roiPoints.value.length !== 4) {
    alert('You need to select 4 ROI points.')
    return
  }

  roiSaving.value = true

  const coords = roiPoints.value
    .map(p => `${p.x},${p.y}`)
    .join(',')

  try {
    const cam = pendingCamera.value

    const addRes = await fetch('http://localhost:5000/api/cameras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken.value}`
      },
      body: JSON.stringify({
        road_id: cam.road_id,
        name: cam.name,
        lng: cam.lng,
        lat: cam.lat,
        video_file: cam.video_file
      })
    })

    const addData = await addRes.json()

    if (!addData.success) {
      alert(addData.message || 'Cannot add camera.')
      return
    }

    const setupRes = await fetch('http://localhost:5000/api/traffic/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken.value}`
      },
      body: JSON.stringify({
        road_id: cam.road_id,
        stream_link: cam.video_file,
        coords
      })
    })

    const setupData = await setupRes.json()

    if (!setupData.success) {
      alert(setupData.message || 'Failed to setup ROI.')
      return
    }

    alert(setupData.message)

    cancelRoiSetup()
    loadCameras()

    if (props.activeLayer === 'heatmap') {
      loadHeatmap()
    }
  } catch (error) {
    alert('Error saving ROI or adding camera: ' + error.message)
  } finally {
    roiSaving.value = false
  }
}

const simulationModalVisible = ref(false)
const simulationCanvasRef = ref(null)
const simulationRoadId = ref(null)
const simulationTitle = ref('Starting simulation...')
const simulationStatus = ref('Not running')
const simulationRunning = ref(false)

const SIM_WIDTH = 300
const SIM_HEIGHT = 700

const SIM_CLASS_COLORS = {
  0: '#ffff00',
  1: '#ff00ff',
  2: '#ffa500',
  3: '#00ff00'
}

const drawSimulationLegend = (ctx) => {
  const legendTop = SIM_HEIGHT - 95

  ctx.fillStyle = '#1e1e1e'
  ctx.fillRect(0, legendTop, SIM_WIDTH, 95)

  ctx.fillStyle = '#ffffff'
  ctx.font = '15px Arial'
  ctx.fillText('Legend', 10, legendTop + 22)

  const items = [
    { classId: 0, name: 'Car', x: 10, y: legendTop + 45 },
    { classId: 1, name: 'Motorcycle', x: 150, y: legendTop + 45 },
    { classId: 2, name: 'Bus', x: 10, y: legendTop + 70 },
    { classId: 3, name: 'Truck', x: 150, y: legendTop + 70 }
  ]

  items.forEach(item => {
    ctx.fillStyle = SIM_CLASS_COLORS[item.classId] || '#ffffff'
    ctx.beginPath()
    ctx.arc(item.x + 8, item.y - 5, 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#dddddd'
    ctx.font = '12px Arial'
    ctx.fillText(item.name, item.x + 20, item.y)
  })
}

const drawSimulationBase = () => {
  const canvas = simulationCanvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, SIM_WIDTH, SIM_HEIGHT)

  ctx.fillStyle = '#323232'
  ctx.fillRect(0, 0, SIM_WIDTH, SIM_HEIGHT)

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3

  ctx.beginPath()
  ctx.moveTo(20, 0)
  ctx.lineTo(20, SIM_HEIGHT)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(SIM_WIDTH - 20, 0)
  ctx.lineTo(SIM_WIDTH - 20, SIM_HEIGHT)
  ctx.stroke()

  const centerX = SIM_WIDTH / 2

  ctx.lineWidth = 2

  for (let y = 10; y < SIM_HEIGHT; y += 40) {
    ctx.beginPath()
    ctx.moveTo(centerX, y)
    ctx.lineTo(centerX, y + 20)
    ctx.stroke()
  }

  drawSimulationLegend(ctx)
}

const drawSimulationFrame = (payload) => {
  if (!simulationModalVisible.value) return
  if (!payload || String(payload.road_id) !== String(simulationRoadId.value)) return

  const canvas = simulationCanvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')

  drawSimulationBase()

  const vehicles = payload.vehicles || []

  vehicles.forEach(vehicle => {
    const x = vehicle.x
    const y = vehicle.y
    const color = SIM_CLASS_COLORS[vehicle.class_id] || '#ffffff'

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = color
    ctx.font = '12px Arial'
    ctx.fillText(String(vehicle.id), x + 8, y + 5)
  })

  simulationRunning.value = true
  simulationStatus.value = `Running realtime simulation - ${vehicles.length} vehicles in ROI`
}

const stopSimulationProcess = async (roadId) => {
  if (!roadId) return

  try {
    await fetch('http://localhost:5000/api/traffic/simulate/stop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken.value}`
      },
      body: JSON.stringify({
        road_id: roadId,
        socket_id: socket?.id || null
      })
    })
  } catch (error) {}
}

const openSimulationModal = async (cam) => {
  simulationModalVisible.value = true
  simulationRoadId.value = cam.road_id
  simulationTitle.value = `${cam.name} - Road ID: ${cam.road_id}`
  simulationStatus.value = 'Starting Python web simulator...'
  simulationRunning.value = false

  await nextTick()
  drawSimulationBase()

  try {
    const res = await fetch('http://localhost:5000/api/traffic/simulate/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken.value}`
      },
      body: JSON.stringify({
        road_id: cam.road_id,
        socket_id: socket?.id || null
      })
    })

    const result = await res.json()

    if (!result.success) {
      simulationStatus.value = result.message || 'Cannot start simulation.'
      simulationRunning.value = false
      return
    }

    simulationStatus.value = result.message || 'Web simulation started.'
  } catch (error) {
    simulationStatus.value = 'Backend connection error while starting simulation.'
    simulationRunning.value = false
  }
}

const closeSimulationModal = async () => {
  const roadId = simulationRoadId.value

  simulationModalVisible.value = false
  simulationRunning.value = false
  simulationStatus.value = 'Simulation stopped'
  simulationRoadId.value = null

  await stopSimulationProcess(roadId)
}

const updateDrawPolygon = () => {
  if (!map) return

  const geojson = {
    type: 'FeatureCollection',
    features: []
  }

  if (polygonCoords.length > 0) {
    if (polygonCoords.length < 3) {
      geojson.features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: polygonCoords
        }
      })
    } else {
      const closedCoords = [...polygonCoords, polygonCoords[0]]
      geojson.features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [closedCoords]
        }
      })
    }
  }

  if (map.getSource('draw-polygon')) {
    map.getSource('draw-polygon').setData(geojson)
  } else {
    map.addSource('draw-polygon', {
      type: 'geojson',
      data: geojson
    })

    map.addLayer({
      id: 'draw-polygon-line',
      type: 'line',
      source: 'draw-polygon',
      paint: {
        'line-color': '#ff9800',
        'line-width': 3,
        'line-dasharray': [2, 2]
      }
    })

    map.addLayer({
      id: 'draw-polygon-fill',
      type: 'fill',
      source: 'draw-polygon',
      paint: {
        'fill-color': '#ff9800',
        'fill-opacity': 0.2
      }
    })
  }
}

const runSpatialQuery = () => {
  const closedRing = [...polygonCoords, polygonCoords[0]]
  const searchPolygon = turf.polygon([closedRing])

  let camCount = 0
  let vehicleCount = 0

  cameraMarkers.forEach(marker => {
    const pt = turf.point(marker.getLngLat().toArray())
    if (turf.booleanPointInPolygon(pt, searchPolygon)) {
      camCount++
    }
  })

  if (roadGeoJSON) {
    roadGeoJSON.features.forEach(road => {
      if (!road.geometry) return

      try {
        if (turf.booleanIntersects(road, searchPolygon)) {
          vehicleCount += road.properties.vehicle_count || 0
        }
      } catch (e) {}
    })
  }

  emit('query-result', {
    cameras: camCount,
    vehicles: vehicleCount
  })

  polygonCoords = []
  updateDrawPolygon()
  map.doubleClickZoom.enable()
}

const loadCameras = async () => {
  try {
    const res = await fetch('http://localhost:5000/api/cameras', {
      headers: {
        'Authorization': `Bearer ${authToken.value}`
      }
    })

    const result = await res.json()

    if (result.success) {
      cameraMarkers.forEach(marker => marker.remove())
      cameraMarkers = []

      result.data.forEach(cam => {
        const popupNode = document.createElement('div')

        const deleteBtnHtml = userRole.value === 'admin'
          ? `<button class="del-btn" style="background: #f44336; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; width: 100%;">🗑 Delete Camera</button>`
          : ''

        popupNode.innerHTML = `
          <div style="text-align: center; min-width: 150px; font-family: sans-serif;">
            <p style="margin: 0 0 4px 0; font-weight: bold; font-size: 14px;">${cam.name}</p>
            <p style="margin: 0 0 12px 0; font-size: 12px; color: gray; word-break: break-all;">Link: ${cam.video_file || 'No link available'}</p>
            <button class="sim-btn" style="background: #1a73e8; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; width: 100%; margin-bottom: 8px;">▶ View Simulation</button>
            ${deleteBtnHtml}
          </div>
        `

        const popup = new maplibregl.Popup({ offset: 25 }).setDOMContent(popupNode)

        const markerEl = document.createElement('div')
        markerEl.innerHTML = '<img src="' + cameraIcon + '" style="width: 30px; height: 30px;">'
        markerEl.style.cursor = 'pointer'

        if (props.activeLayer === 'heatmap') {
          markerEl.style.display = 'none'
        }

        const marker = new maplibregl.Marker({ element: markerEl })
          .setLngLat([cam.lng, cam.lat])
          .setPopup(popup)
          .addTo(map)

        cameraMarkers.push(marker)

        const delBtn = popupNode.querySelector('.del-btn')

        if (delBtn) {
          delBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this camera from the system?')) {
              try {
                const delRes = await fetch(`http://localhost:5000/api/cameras/${cam.id}`, {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${authToken.value}`
                  }
                })

                const delData = await delRes.json()

                if (!delData.success) {
                  alert(delData.message)
                  return
                }

                await fetch('http://localhost:5000/api/traffic/remove', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken.value}`
                  },
                  body: JSON.stringify({
                    road_id: cam.road_id
                  })
                })

                marker.remove()

                if (props.activeLayer === 'heatmap') {
                  loadHeatmap()
                }

                loadCameras()
              } catch (err) {
                alert('Error connecting to the server!')
              }
            }
          })
        }

        popupNode.querySelector('.sim-btn').addEventListener('click', async () => {
          await openSimulationModal(cam)
        })
      })
    }
  } catch (error) {}
}

const loadHeatmap = async () => {
  if (!roadGeoJSON || !map) return

  try {
    const res = await fetch('http://localhost:5000/api/traffic/heatmap', {
      headers: {
        'Authorization': `Bearer ${authToken.value}`
      }
    })

    const result = await res.json()

    if (result.success) {
      const trafficMap = {}

      result.data.forEach(t => {
        trafficMap[t.road_id] = t.vehicle_count
      })

      const updatedGeoJSON = JSON.parse(JSON.stringify(roadGeoJSON))

      updatedGeoJSON.features.forEach(f => {
        f.properties.vehicle_count = trafficMap[f.properties.id] || 0
      })

      roadGeoJSON = updatedGeoJSON
    }

    const timestamp = new Date().getTime()

    const wmsUrl = `http://localhost:8080/geoserver/traffic_gis/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=traffic_gis:roads&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}&t=${timestamp}`

    if (map.getSource('geoserver-wms')) {
      if (map.getLayer('wms-heatmap-layer')) {
        map.removeLayer('wms-heatmap-layer')
      }
      map.removeSource('geoserver-wms')
    }

    map.addSource('geoserver-wms', {
      type: 'raster',
      tiles: [wmsUrl],
      tileSize: 256
    })

    map.addLayer({
      id: 'wms-heatmap-layer',
      type: 'raster',
      source: 'geoserver-wms',
      paint: {
        'raster-opacity': 1
      }
    })

    if (map.getLayer('gis-roads-layer')) {
      map.setPaintProperty('gis-roads-layer', 'line-opacity', 0.1)
    }
  } catch (error) {}
}

const resetRoadColor = () => {
  if (!roadGeoJSON || !map) return

  if (map.getLayer('wms-heatmap-layer')) {
    map.removeLayer('wms-heatmap-layer')
  }

  if (map.getSource('geoserver-wms')) {
    map.removeSource('geoserver-wms')
  }

  if (map.getLayer('gis-roads-layer')) {
    map.setPaintProperty('gis-roads-layer', 'line-opacity', 1)
    map.setPaintProperty('gis-roads-layer', 'line-color', [
      'match',
      ['get', 'type'],
      'primary',
      '#1a73e8',
      '#4caf50'
    ])
  }
}

watch(() => props.activeLayer, (newLayer) => {
  cameraMarkers.forEach(marker => {
    const markerEl = marker.getElement()

    if (markerEl) {
      markerEl.style.display = newLayer === 'heatmap' ? 'none' : 'block'
    }
  })

  if (newLayer === 'heatmap') {
    loadHeatmap()
  } else {
    resetRoadColor()
  }
})

watch(() => props.activeMode, (newMode) => {
  if (!map) return

  if (newMode === 'polygon') {
    map.doubleClickZoom.disable()
    polygonCoords = []
    updateDrawPolygon()
  } else {
    map.doubleClickZoom.enable()
    polygonCoords = []
    updateDrawPolygon()
  }
})

watch(() => props.triggerRoute, async () => {
  if (!routeMarkers.A || !routeMarkers.B) {
    alert('Please select both Point A and Point B!')
    return
  }

  const startCoord = routeMarkers.A.getLngLat().toArray()
  const endCoord = routeMarkers.B.getLngLat().toArray()

  try {
    const res = await fetch('http://localhost:5000/api/gis/route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken.value}`
      },
      body: JSON.stringify({
        startCoord,
        endCoord,
        avoidTraffic: props.avoidTraffic
      })
    })

    const result = await res.json()

    if (result.success) {
      if (map.getSource('route-path')) {
        map.getSource('route-path').setData(result.path)
      } else {
        map.addSource('route-path', {
          type: 'geojson',
          data: result.path
        })

        map.addLayer({
          id: 'route-path-layer',
          type: 'line',
          source: 'route-path',
          paint: {
            'line-color': '#9c27b0',
            'line-width': 8,
            'line-opacity': 0.8
          }
        })
      }
    } else {
      alert(result.message)
    }
  } catch (error) {
    alert('Error finding route!')
  }
})

onMounted(() => {
  userRole.value = localStorage.getItem('user_role') || 'user'
  authToken.value = localStorage.getItem('token') || ''

  socket = io('http://localhost:5000')

  socket.on('traffic-update', () => {
    loadCameras()

    // if (props.activeLayer === 'heatmap') { // real time instant heatmap
    //   loadHeatmap()
    // }
  })

  socket.on('simulation-frame', (payload) => {
    drawSimulationFrame(payload)
  })

  socket.on('simulation-status', (payload) => {
    if (!payload || String(payload.road_id) !== String(simulationRoadId.value)) return

    simulationStatus.value = payload.message || 'Simulation status updated'

    if (payload.success === false) {
      simulationRunning.value = false
    }
  })

  heatmapInterval = setInterval(() => {
    if (props.activeLayer === 'heatmap') {
      loadHeatmap()
    }
  }, 60000)

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    center: [108.21, 16.06],
    zoom: 13
  })

  map.addControl(new maplibregl.NavigationControl(), 'bottom-right')

  map.on('load', async () => {
    try {
      const res = await fetch('http://localhost:5000/api/gis/roads', {
        headers: {
          'Authorization': `Bearer ${authToken.value}`
        }
      })

      roadGeoJSON = await res.json()

      map.addSource('gis-roads', {
        type: 'geojson',
        data: roadGeoJSON
      })

      map.addLayer({
        id: 'gis-roads-layer',
        type: 'line',
        source: 'gis-roads',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'type'],
            'primary',
            '#1a73e8',
            '#4caf50'
          ],
          'line-width': 5
        }
      })

      if (props.activeLayer === 'heatmap') {
        loadHeatmap()
      }
    } catch (err) {}

    map.on('mouseenter', 'gis-roads-layer', () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', 'gis-roads-layer', () => {
      map.getCanvas().style.cursor = ''
    })

    map.on('click', async (e) => {
      if (props.activeMode === 'A' || props.activeMode === 'B') {
        const coord = [e.lngLat.lng, e.lngLat.lat]
        const color = props.activeMode === 'A' ? '#4caf50' : '#f44336'

        if (routeMarkers[props.activeMode]) {
          routeMarkers[props.activeMode].remove()
        }

        routeMarkers[props.activeMode] = new maplibregl.Marker({ color })
          .setLngLat(coord)
          .addTo(map)

        emit('update-point', {
          mode: props.activeMode,
          coord
        })
      } else if (props.activeMode === 'polygon') {
        polygonCoords.push([e.lngLat.lng, e.lngLat.lat])
        updateDrawPolygon()
      }
    })

    map.on('dblclick', (e) => {
      if (props.activeMode === 'polygon') {
        e.preventDefault()

        if (polygonCoords.length < 3) {
          return alert('You need to click at least 3 points to create a region!')
        }

        runSpatialQuery()
      }
    })

    map.on('contextmenu', 'gis-roads-layer', async (e) => {
      e.preventDefault()

      if (props.activeMode) return

      if (userRole.value !== 'admin') {
        alert('Monitoring area. You do not have permission to add new Camera!')
        return
      }

      const road = e.features[0]

      await openStreamPopover(e, road)
    })

    loadCameras()
  })
})

onUnmounted(() => {
  if (simulationRoadId.value) {
    stopSimulationProcess(simulationRoadId.value)
  }

  if (heatmapInterval) {
    clearInterval(heatmapInterval)
  }

  if (socket) {
    socket.disconnect()
  }

  if (map) {
    map.remove()
  }
})
</script>

<style scoped>
.map-root {
  width: 100%;
  height: 100%;
  position: relative;
}

.map-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

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
  font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
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

/* ===============================
   ADD CAMERA LINK POPOVER
================================ */
.stream-popover-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2499;
  background: transparent;
}

.stream-popover {
  position: fixed;
  width: 360px;
  z-index: 2500;
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.28);
  border: 1px solid #dfe3ea;
  overflow: hidden;
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
}

.stream-popover-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px 10px 16px;
  background: #011d42;
  color: white;
}

.stream-popover-header h4 {
  margin: 0 0 4px 0;
  font-size: 15px;
}

.stream-popover-header p {
  margin: 0;
  font-size: 12px;
  opacity: 0.85;
  line-height: 1.35;
}

.stream-close-btn {
  border: none;
  background: transparent;
  color: white;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
}

.stream-input {
  width: calc(100% - 28px);
  margin: 14px;
  padding: 11px 12px;
  border: 1px solid #cfd6e4;
  border-radius: 7px;
  outline: none;
  font-size: 13px;
  box-sizing: border-box;
}

.stream-input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.12);
}

.stream-popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 14px 14px 14px;
}

.stream-btn {
  padding: 9px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  border: 1px solid #011d42;
}

.stream-btn.outline {
  background: white;
  color: #011d42;
}

.stream-btn.fill {
  background: #011d42;
  color: white;
}
</style>