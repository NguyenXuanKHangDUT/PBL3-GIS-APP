<template>
  <div ref="mapContainer" class="map-container"></div>
</template>

<script setup>
// import cameraIcon from '@/assets/camera.png' // cái này nó gây lỗi á
// camera.pgn nằm ở src/assets/icons/camera.png
import cameraIcon from '@/assets/icons/camera.png' // ok rồi, đổi camera icon đi cho đẹp mắt hơn, đỡ nhàm chán với cái emoji 📷 // suggest đi 
import { ref, onMounted, onUnmounted, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as turf from '@turf/turf'
import { io } from 'socket.io-client';

const props = defineProps({
  activeLayer: { type: String, default: 'camera' },
  activeMode: { type: String, default: null },
  triggerRoute: { type: Number, default: 0 },
  avoidTraffic: { type: Boolean, default: false }
})

const emit = defineEmits(['update-point', 'query-result', 'cancel-mode'])

const mapContainer = ref(null)
let map = null
let cameraMarkers = []
let roadGeoJSON = null
let routeMarkers = { A: null, B: null }
let polygonCoords = []

const userRole = ref('user')
const authToken = ref('')

const updateDrawPolygon = () => {
  if (!map) return;
  let geojson = { type: 'FeatureCollection', features: [] };
  
  if (polygonCoords.length > 0) {
    if (polygonCoords.length < 3) {
      geojson.features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: polygonCoords }});
    } else {
      const closedCoords = [...polygonCoords, polygonCoords[0]]; 
      geojson.features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [closedCoords] }});
    }
  }

  if (map.getSource('draw-polygon')) {
    map.getSource('draw-polygon').setData(geojson);
  } else {
    map.addSource('draw-polygon', { type: 'geojson', data: geojson });
    map.addLayer({ id: 'draw-polygon-line', type: 'line', source: 'draw-polygon', paint: { 'line-color': '#ff9800', 'line-width': 3, 'line-dasharray': [2, 2] }});
    map.addLayer({ id: 'draw-polygon-fill', type: 'fill', source: 'draw-polygon', paint: { 'fill-color': '#ff9800', 'fill-opacity': 0.2 }});
  }
}

const runSpatialQuery = () => {
  const closedRing = [...polygonCoords, polygonCoords[0]];
  const searchPolygon = turf.polygon([closedRing]);

  let camCount = 0;
  let vehicleCount = 0;

  cameraMarkers.forEach(marker => {
    const pt = turf.point(marker.getLngLat().toArray());
    if (turf.booleanPointInPolygon(pt, searchPolygon)) camCount++;
  });

  if (roadGeoJSON) {
    roadGeoJSON.features.forEach(road => {
      if (!road.geometry) return;
      try {
        if (turf.booleanIntersects(road, searchPolygon)) {
           vehicleCount += (road.properties.vehicle_count || 0);
        }
      } catch (e) {}
    });
  }

  emit('query-result', { cameras: camCount, vehicles: vehicleCount });
  
  polygonCoords = [];
  updateDrawPolygon();
  map.doubleClickZoom.enable(); 
}

const loadCameras = async () => {
  try {
    const res = await fetch('http://localhost:5000/api/cameras', {
      headers: { 'Authorization': `Bearer ${authToken.value}` }
    })
    const result = await res.json()
    if (result.success) {
      cameraMarkers.forEach(marker => marker.remove())
      cameraMarkers = []
      result.data.forEach(cam => {
        const popupNode = document.createElement('div')
        
        const deleteBtnHtml = userRole.value === 'admin' 
          ? `<button class="del-btn" style="background: #f44336; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; width: 100%;">🗑 Xóa Camera</button>` 
          : '';

        popupNode.innerHTML = `
          <div style="text-align: center; min-width: 150px; font-family: sans-serif;">
            <p style="margin: 0 0 4px 0; font-weight: bold; font-size: 14px;">${cam.name}</p>
            <p style="margin: 0 0 12px 0; font-size: 12px; color: gray; word-break: break-all;">Link: ${cam.video_file || 'Không có'}</p>
            <button class="sim-btn" style="background: #1a73e8; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; width: 100%; margin-bottom: 8px;">▶ Xem mô phỏng</button>
            ${deleteBtnHtml}
          </div>
        `

        const popup = new maplibregl.Popup({ offset: 25 }).setDOMContent(popupNode)
        const markerEl = document.createElement('div'); 
        markerEl.innerHTML = '<img src="' + cameraIcon + '" style="width: 30px; height: 30px;">';
        markerEl.style.cursor = 'pointer'; 
        
        if (props.activeLayer === 'heatmap') markerEl.style.display = 'none';

        const marker = new maplibregl.Marker({ element: markerEl }).setLngLat([cam.lng, cam.lat]).setPopup(popup).addTo(map)
        cameraMarkers.push(marker)

        const delBtn = popupNode.querySelector('.del-btn');
        if (delBtn) {
          delBtn.addEventListener('click', async () => {
            if(confirm("Bạn có chắc chắn muốn xóa Camera này khỏi hệ thống?")) {
              try {
                const delRes = await fetch(`http://localhost:5000/api/cameras/${cam.id}`, { 
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${authToken.value}` }
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
                  body: JSON.stringify({ road_id: cam.road_id })
                });

                marker.remove()

                if (props.activeLayer === 'heatmap') loadHeatmap()

                loadCameras() 
              } catch (err) {
                alert("Lỗi khi kết nối đến máy chủ!")
              }
            }
          })
        }

        popupNode.querySelector('.sim-btn').addEventListener('click', async () => {
          try {
            const simRes = await fetch('http://localhost:5000/api/traffic/simulate', {
              method: 'POST', 
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken.value}`
              },
              body: JSON.stringify({ road_id: cam.road_id })
            });
            const simData = await simRes.json();
            if(!simData.success) alert(simData.message); 
            if (props.activeLayer === 'heatmap') loadHeatmap();
          } catch (error) {
            alert("Lỗi kết nối Backend hoặc Python chưa được cài đặt!");
          }
        })
      })
    }
  } catch (error) {}
}

const loadHeatmap = async () => {
  if (!roadGeoJSON || !map) return;
  
  try {
    const res = await fetch('http://localhost:5000/api/traffic/heatmap', {
      headers: { 'Authorization': `Bearer ${authToken.value}` }
    });
    const result = await res.json();
    if (result.success) {
      const trafficMap = {};
      result.data.forEach(t => trafficMap[t.road_id] = t.vehicle_count);

      const updatedGeoJSON = JSON.parse(JSON.stringify(roadGeoJSON)); 
      updatedGeoJSON.features.forEach(f => {
        f.properties.vehicle_count = trafficMap[f.properties.id] || 0;
      });
      roadGeoJSON = updatedGeoJSON; 
    }

    const timestamp = new Date().getTime(); 
    const wmsUrl = `http://localhost:8080/geoserver/traffic_gis/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=traffic_gis:roads&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}&t=${timestamp}`;

    if (map.getSource('geoserver-wms')) {
      map.removeLayer('wms-heatmap-layer');
      map.removeSource('geoserver-wms');
    }

    map.addSource('geoserver-wms', {
      type: 'raster',
      tiles: [wmsUrl],
      tileSize: 256
    });

    map.addLayer({
      id: 'wms-heatmap-layer',
      type: 'raster',
      source: 'geoserver-wms',
      paint: { 'raster-opacity': 1 }
    });

    map.setPaintProperty('gis-roads-layer', 'line-opacity', 0.1);

  } catch (error) {}
}

const resetRoadColor = () => {
  if (!roadGeoJSON || !map) return;
  if (map.getLayer('wms-heatmap-layer')) {
    map.removeLayer('wms-heatmap-layer');
    map.removeSource('geoserver-wms');
  }
  map.setPaintProperty('gis-roads-layer', 'line-opacity', 1);
  map.setPaintProperty('gis-roads-layer', 'line-color', ['match', ['get', 'type'], 'primary', '#1a73e8', '#4caf50']);
}

watch(() => props.activeLayer, (newLayer) => {
  cameraMarkers.forEach(marker => {
    const markerEl = marker.getElement();
    if (markerEl) markerEl.style.display = newLayer === 'heatmap' ? 'none' : 'block';
  })
  if (newLayer === 'heatmap') loadHeatmap();
  else resetRoadColor();
})

watch(() => props.activeMode, (newMode) => {
  if (!map) return;
  if (newMode === 'polygon') {
    map.doubleClickZoom.disable(); 
    polygonCoords = [];
    updateDrawPolygon();
  } else {
    map.doubleClickZoom.enable();
    polygonCoords = [];
    updateDrawPolygon();
  }
})

watch(() => props.triggerRoute, async () => {
  if (!routeMarkers.A || !routeMarkers.B) {
    alert("Vui lòng chọn đủ Điểm A và Điểm B!");
    return;
  }
  
  const startCoord = routeMarkers.A.getLngLat().toArray();
  const endCoord = routeMarkers.B.getLngLat().toArray();

  try {
    const res = await fetch('http://localhost:5000/api/gis/route', {
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken.value}`
      },
      body: JSON.stringify({ startCoord, endCoord, avoidTraffic: props.avoidTraffic })
    });
    const result = await res.json();
    
    if (result.success) {
      if (map.getSource('route-path')) {
        map.getSource('route-path').setData(result.path);
      } else {
        map.addSource('route-path', { type: 'geojson', data: result.path });
        map.addLayer({
          id: 'route-path-layer', type: 'line', source: 'route-path',
          paint: { 'line-color': '#9c27b0', 'line-width': 8, 'line-opacity': 0.8 }
        });
      }
    } else {
      alert(result.message);
    }
  } catch (error) {
    alert("Lỗi khi tìm đường!");
  }
})

onMounted(() => {
  userRole.value = localStorage.getItem('user_role') || 'user';
  authToken.value = localStorage.getItem('token') || '';

  const socket = io('http://localhost:5000');
  socket.on('traffic-update', (data) => {
      // if (props.activeLayer === 'heatmap') {
      //     loadHeatmap();
      // }
      loadCameras(); 
  });

  // BỘ ĐẾM KỶ LUẬT: Cứ đúng 60000ms (1 phút) mới quét và vẽ lại Heatmap 1 lần
  setInterval(() => {
      if (props.activeLayer === 'heatmap') {
          loadHeatmap();
      }
  }, 60000);

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
        headers: { 'Authorization': `Bearer ${authToken.value}` }
      });
      roadGeoJSON = await res.json();

      map.addSource('gis-roads', { type: 'geojson', data: roadGeoJSON });
      map.addLayer({
        id: 'gis-roads-layer', type: 'line', source: 'gis-roads',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': ['match', ['get', 'type'], 'primary', '#1a73e8', '#4caf50'], 'line-width': 5 }
      });

      if (props.activeLayer === 'heatmap') loadHeatmap();
    } catch (err) {}

    map.on('mouseenter', 'gis-roads-layer', () => map.getCanvas().style.cursor = 'pointer')
    map.on('mouseleave', 'gis-roads-layer', () => map.getCanvas().style.cursor = '')

    map.on('click', async (e) => {
      if (props.activeMode === 'A' || props.activeMode === 'B') {
        const coord = [e.lngLat.lng, e.lngLat.lat];
        const color = props.activeMode === 'A' ? '#4caf50' : '#f44336';
        
        if (routeMarkers[props.activeMode]) routeMarkers[props.activeMode].remove();
        routeMarkers[props.activeMode] = new maplibregl.Marker({ color }).setLngLat(coord).addTo(map);

//
        // if (map.getSource('route-path')) {
        //     map.getSource('route-path').setData({ type: 'FeatureCollection', features: [] });
        // }
//
        emit('update-point', { mode: props.activeMode, coord });
      }
      else if (props.activeMode === 'polygon') {
        polygonCoords.push([e.lngLat.lng, e.lngLat.lat]);
        updateDrawPolygon();
      }
    });

    map.on('dblclick', (e) => {
      if (props.activeMode === 'polygon') {
        e.preventDefault();
        if (polygonCoords.length < 3) return alert("Bạn cần click ít nhất 3 điểm để tạo thành một vùng!");
        runSpatialQuery();
      }
    });

    map.on('contextmenu', 'gis-roads-layer', async (e) => {
      e.preventDefault();
      if (props.activeMode) return; 

      if (userRole.value !== 'admin') {
        alert("Khu vực giám sát. Bạn không có quyền thêm Camera mới!");
        return;
      }

      const streamLink = prompt("Nhập đường link luồng IP Camera (.m3u8 hoặc .mp4):", "http://.../stream.m3u8");
      if (!streamLink) return;

      const road = e.features[0];
      const autoName = `CAM_${Math.floor(Math.random() * 10000)}`; 
      const roadId = road.properties.id || 'unknown';
      
      try {
        const addRes = await fetch('http://localhost:5000/api/cameras', {
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken.value}`
          },
          body: JSON.stringify({ road_id: roadId, name: autoName, lng: e.lngLat.lng, lat: e.lngLat.lat, video_file: streamLink })
        });
        const addData = await addRes.json();
        if (!addData.success) {
          alert(addData.message);
          return;
        }
        
        const setupRes = await fetch('http://localhost:5000/api/traffic/setup', {
           method: 'POST', 
           headers: { 
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${authToken.value}`
           },
           body: JSON.stringify({ road_id: roadId, stream_link: streamLink })
        });
        const setupData = await setupRes.json();
        alert(setupData.message);

        loadCameras(); 
      } catch (error) {
        alert("Lỗi chi tiết: " + error.message);
        console.error("Lỗi Setup:", error);
      }
    })

    loadCameras();
  })
})

onUnmounted(() => {
  if (map) map.remove()
})
</script>

<style scoped>
.map-container { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
</style>