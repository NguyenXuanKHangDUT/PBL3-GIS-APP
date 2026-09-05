<template>
  <div class="map-root">
    <div ref="mapContainer" class="map-container"></div>

    <CameraStreamPopover
      v-if="streamPopoverVisible"
      :left="streamPopoverLeft"
      :top="streamPopoverTop"
      @close="closeStreamPopover"
      @submit="submitStreamLink"
    />

    <SimulationModal
      v-if="simulationModalVisible"
      ref="simulationModalRef"
      :title="simulationTitle"
      :status="simulationStatus"
      :running="simulationRunning"
      @close="closeSimulationModal"
    />

    <RoiSetupModal
      v-if="roiModalVisible"
      :loading="roiLoading"
      :saving="roiSaving"
      :error-message="roiError"
      :frame-src="roiFrameSrc"
      :points="roiPoints"
      @add-point="handleRoiPoint"
      @reset="resetRoiPoints"
      @cancel="cancelRoiSetup"
      @confirm="confirmRoiSetup"
    />
  </div>
</template>

<script setup>
import cameraIcon from '@/assets/icons/camera.png'

import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as turf from '@turf/turf'
import { io } from 'socket.io-client'
import { API_URL, SOCKET_URL, GEOSERVER_URL } from '@/config/env'

import CameraStreamPopover from './CameraStreamPopover.vue'
import RoiSetupModal from './RoiSetupModal.vue'
import SimulationModal from './SimulationModal.vue'

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
const pendingRoadClick = ref(null)

const openStreamPopover = (event, roadFeature) => {
  const roadId = roadFeature.properties.id || 'unknown'
  const autoName = `CAM_${Math.floor(Math.random() * 10000)}`

  pendingRoadClick.value = {
    road_id: roadId,
    name: autoName,
    lng: event.lngLat.lng,
    lat: event.lngLat.lat
  }

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
}

const closeStreamPopover = () => {
  streamPopoverVisible.value = false
  pendingRoadClick.value = null
}

const submitStreamLink = async (streamLink) => {
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

const roiModalVisible = ref(false)
const roiLoading = ref(false)
const roiSaving = ref(false)
const roiError = ref('')
const roiFrameSrc = ref('')
const roiPoints = ref([])
const pendingCamera = ref(null)

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

const handleRoiPoint = (point) => {
  if (roiPoints.value.length >= 4) return

  roiPoints.value.push(point)
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
    const res = await fetch(`${API_URL}/api/traffic/setup-frame`, {
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

    const response = await fetch(`${API_URL}/api/cameras`, {
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
        video_file: cam.video_file,

        // ROI now goes in the SAME request
        coords
      })
    })

    const result = await response.json()

    if (!result.success) {
      alert(
        result.message ||
        'Failed to create camera.'
      )
      return
    }

    alert(result.message)

    cancelRoiSetup()

    await loadCameras()

    if (props.activeLayer === 'heatmap') {
      await loadHeatmap()
    }

  } catch (error) {
    alert(
      'Error creating camera: ' +
      error.message
    )

  } finally {
    roiSaving.value = false
  }
}

const simulationModalVisible = ref(false)
const simulationModalRef = ref(null)
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
  const canvas = simulationModalRef.value?.getCanvas()
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

  const canvas = simulationModalRef.value?.getCanvas()
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
    await fetch(`${API_URL}/api/traffic/simulate/stop`, {
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
    const res = await fetch(`${API_URL}/api/traffic/simulate/start`, {
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
    const res = await fetch(`${API_URL}/api/cameras`, {
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

        markerEl.innerHTML =
          '<img src="' +
          cameraIcon +
          '" style="width: 30px; height: 30px;">'

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
            if (
              confirm(
                'Are you sure you want to delete this camera from the system?'
              )
            ) {
              try {
                const delRes = await fetch(
                  `${API_URL}/api/cameras/${cam.id}`,
                  {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `Bearer ${authToken.value}`
                    }
                  }
                )

                const delData = await delRes.json()

                if (!delData.success) {
                  alert(delData.message)
                  return
                }

                await fetch(`${API_URL}/api/traffic/remove`, {
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

        popupNode
          .querySelector('.sim-btn')
          .addEventListener('click', async () => {
            await openSimulationModal(cam)
          })
      })
    }
  } catch (error) {}
}

const loadHeatmap = async () => {
  if (!roadGeoJSON || !map) return

  try {
    const res = await fetch(`${API_URL}/api/traffic/heatmap`, {
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

    const wmsUrl =
      `${GEOSERVER_URL}/traffic_gis/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=traffic_gis:roads&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}&t=${timestamp}`

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
      map.setPaintProperty(
        'gis-roads-layer',
        'line-opacity',
        0.1
      )
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
    map.setPaintProperty(
      'gis-roads-layer',
      'line-opacity',
      1
    )

    map.setPaintProperty(
      'gis-roads-layer',
      'line-color',
      [
        'match',
        ['get', 'type'],
        'primary',
        '#1a73e8',
        '#4caf50'
      ]
    )
  }
}

watch(() => props.activeLayer, (newLayer) => {
  cameraMarkers.forEach(marker => {
    const markerEl = marker.getElement()

    if (markerEl) {
      markerEl.style.display =
        newLayer === 'heatmap'
          ? 'none'
          : 'block'
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
    const res = await fetch(`${API_URL}/api/gis/route`, {
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

  socket = io(SOCKET_URL)

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
    if (
      !payload ||
      String(payload.road_id) !== String(simulationRoadId.value)
    ) {
      return
    }

    simulationStatus.value =
      payload.message ||
      'Simulation status updated'

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

  map.addControl(
    new maplibregl.NavigationControl(),
    'bottom-right'
  )

  map.on('load', async () => {
    try {
      const res = await fetch(`${API_URL}/api/gis/roads`, {
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
      if (
        props.activeMode === 'A' ||
        props.activeMode === 'B'
      ) {
        const coord = [
          e.lngLat.lng,
          e.lngLat.lat
        ]

        const color =
          props.activeMode === 'A'
            ? '#4caf50'
            : '#f44336'

        if (routeMarkers[props.activeMode]) {
          routeMarkers[props.activeMode].remove()
        }

        routeMarkers[props.activeMode] =
          new maplibregl.Marker({ color })
            .setLngLat(coord)
            .addTo(map)

        emit('update-point', {
          mode: props.activeMode,
          coord
        })
      } else if (props.activeMode === 'polygon') {
        polygonCoords.push([
          e.lngLat.lng,
          e.lngLat.lat
        ])

        updateDrawPolygon()
      }
    })

    map.on('dblclick', (e) => {
      if (props.activeMode === 'polygon') {
        e.preventDefault()

        if (polygonCoords.length < 3) {
          return alert(
            'You need to click at least 3 points to create a region!'
          )
        }

        runSpatialQuery()
      }
    })

    map.on(
      'contextmenu',
      'gis-roads-layer',
      async (e) => {
        e.preventDefault()

        if (props.activeMode) return

        if (userRole.value !== 'admin') {
          alert(
            'Monitoring area. You do not have permission to add new Camera!'
          )

          return
        }

        const road = e.features[0]

        await openStreamPopover(e, road)
      }
    )

    loadCameras()
  })
})

onUnmounted(() => {
  if (simulationRoadId.value) {
    stopSimulationProcess(
      simulationRoadId.value
    )
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
</style>