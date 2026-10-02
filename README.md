# PBL3 GIS APP — Ubuntu VM Deployment

Deployment version of the PBL3 GIS traffic monitoring system.

This branch contains the configuration and source code used to run the full system on an Ubuntu 24.04 virtual machine with:

- Vue 3 frontend
- Node.js + Express backend
- MySQL database
- GeoServer WMS/WFS
- YOLO vehicle detection and tracking
- Socket.IO realtime updates
- Nginx reverse proxy
- Cloudflare Tunnel for public Internet access
- Automatic GPU / CPU fallback for YOLO simulation

> Branch: `deployment-vm`

---

# 1. System Architecture

The deployed system follows this architecture:

```text
                        Internet
                           │
                           │ HTTPS
                           ▼
                    Cloudflare Tunnel
                           │
                           ▼
                     cloudflared
                           │
                           ▼
                      Nginx :80
                  192.168.1.30
               ┌───────────┼─────────────┐
               │           │             │
               ▼           ▼             ▼
          Vue Frontend   Node.js      GeoServer
          static files   :5000         :8080
                           │              │
                           │              │
                           ▼              ▼
                         MySQL        Traffic WMS
                         :3306        / WFS layers
                           │
                           ▼
                     YOLO Python
                 Vehicle Detection
                  and Simulation
```

Internally:

```text
Browser
   │
   ├── /                  → Vue frontend
   ├── /api/...           → Node.js :5000
   ├── /socket.io/...     → Node.js :5000
   └── /geoserver/...     → GeoServer :8080
```

Only Nginx is intended to be accessed directly by clients.

---

# 2. Deployment Environment

Current deployment environment:

```text
OS       : Ubuntu 24.04
Node.js  : v18.19.1
npm      : 9.2.0
Python   : 3.12.3
Java     : OpenJDK 17
MySQL    : 8.0
```

The project is currently deployed inside VMware Workstation using a Bridged Network Adapter.

Example network configuration:

```text
Windows Host : 192.168.1.178
Ubuntu VM    : 192.168.1.30
Gateway      : 192.168.1.1
Subnet       : 255.255.255.0
```

Because the VM uses Bridged networking, other devices on the same Wi-Fi/LAN can access the web application.

LAN URL:

```text
http://192.168.1.30
```

---

# 3. Required Directory Structure

The expected Ubuntu directory structure is:

```text
/home/ubuntu/
│
├── traffic-gis/
│   ├── backend/
│   ├── frontend/
│   ├── YOLO/
│   ├── requirements-vm.txt
│   └── ...
│
├── geoserver_data_dir_unzip/
│   └── GeoServer/
│
└── ...
```

GeoServer itself is installed separately:

```text
/opt/geoserver
```

The active GeoServer data directory is:

```text
/home/ubuntu/geoserver_data_dir_unzip/GeoServer
```

Do not move this directory unless the GeoServer startup configuration is also updated.

---

# 4. Clone the Application

Clone the deployment branch:

```bash
cd ~

git clone \
-b deployment-vm \
https://github.com/NguyenXuanKhangDUT/PBL3-GIS-APP.git \
traffic-gis
```

Enter the project:

```bash
cd ~/traffic-gis
```

Verify the branch:

```bash
git branch
```

Expected:

```text
* deployment-vm
```

---

# 5. GeoServer Data Directory

The GeoServer data directory is stored separately from the main application repository.

Expected structure:

```text
/home/ubuntu/
├── traffic-gis/
└── geoserver_data_dir_unzip/
    └── GeoServer/
```

Clone the GeoServer data repository into the correct location:

```bash
cd ~

git clone \
https://github.com/NguyenXuanKhangDUT/PBL3-GIS-GEOSERVER-DATA.git \
geoserver_data_dir_unzip
```

After cloning, verify:

```bash
ls ~/geoserver_data_dir_unzip
```

Expected:

```text
GeoServer
README.md
```

The final path must be:

```text
/home/ubuntu/geoserver_data_dir_unzip/GeoServer
```

---

# 6. Python Environment

The `.venv` directory is not stored in Git because the environment is approximately 1.5 GB and contains binary files larger than GitHub's 100 MB file limit.

Create a new Python virtual environment:

```bash
cd ~/traffic-gis

python3 -m venv .venv
```

Activate it:

```bash
source .venv/bin/activate
```

Install Python dependencies:

```bash
pip install --upgrade pip
pip install -r requirements-vm.txt
```

Verify important packages:

```bash
python -c "import cv2; print('OpenCV:', cv2.__version__)"
```

```bash
python -c "import torch; print('Torch:', torch.__version__); print('CUDA:', torch.cuda.is_available())"
```

```bash
python -c "import ultralytics; print('Ultralytics:', ultralytics.__version__)"
```

On VMware, this will normally show:

```text
CUDA: False
```

This is expected.

The YOLO code automatically falls back to CPU when CUDA is unavailable.

---

# 7. YOLO GPU / CPU Selection

The Bird's Eye View simulation supports both GPU and CPU.

The simulation selects the execution device automatically:

```python
DEVICE = 0 if torch.cuda.is_available() else "cpu"
```

Therefore:

```text
NVIDIA CUDA available
        │
        ▼
      GPU

CUDA unavailable
        │
        ▼
      CPU
```

This allows the same source code to work on:

- Windows machines with NVIDIA GPU
- Linux servers with CUDA
- VMware without GPU passthrough
- CPU-only environments

---

# 8. Backend Setup

Enter the backend:

```bash
cd ~/traffic-gis/backend
```

Install Node.js dependencies:

```bash
npm install
```

The backend environment configuration is located in:

```text
backend/.env
```

Current expected variables:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=mygis
JWT_SECRET=YOUR_JWT_SECRET
PORT=5000
```

The deployment branch may already contain the environment file.

Start the backend using the Python virtual environment:

```bash
cd ~/traffic-gis

source .venv/bin/activate

cd backend

npm start
```

Expected output:

```text
Server dang chay tai: http://localhost:5000
```

The backend automatically resumes configured cameras:

```text
[AI System] auto-resuming ... Camera...
Successfully resumed Camera for Road ID: ...
```

The backend starts Python processes using:

```text
python yolo_counter.py
```

Therefore the virtual environment must be activated before starting Node.js.

---

# 9. MySQL Setup

MySQL should be installed and running:

```bash
sudo systemctl status mysql
```

Start it if required:

```bash
sudo systemctl start mysql
```

Enable automatic startup:

```bash
sudo systemctl enable mysql
```

Current database:

```text
mygis
```

Connect:

```bash
mysql -u root -p
```

Then:

```sql
USE mygis;
SHOW TABLES;
```

Expected main tables include:

```text
cameras
roads
traffic_logs
users
```

MySQL should only listen locally.

Check:

```bash
sudo ss -ltnp | grep 3306
```

Expected:

```text
127.0.0.1:3306
```

---

# 10. GeoServer Installation

GeoServer is expected to be installed at:

```text
/opt/geoserver
```

Important paths:

```text
GeoServer engine:
/opt/geoserver

Startup script:
/opt/geoserver/bin/startup.sh

Shutdown script:
/opt/geoserver/bin/shutdown.sh

Web application:
/opt/geoserver/webapps/geoserver

Active data directory:
/home/ubuntu/geoserver_data_dir_unzip/GeoServer
```

Java 17 is used:

```bash
java -version
```

---

# 11. Start GeoServer

GeoServer requires additional Java module exports for WMS image rendering.

Without these options, GeoServer may successfully serve WFS but WMS rendering can fail with an error involving:

```text
sun.java2d.pipe.RenderingEngine
```

Start GeoServer using:

```bash
cd /opt/geoserver/bin

export GEOSERVER_HOME=/opt/geoserver

export GEOSERVER_DATA_DIR=/home/ubuntu/geoserver_data_dir_unzip/GeoServer

export JAVA_OPTS="-Djava.awt.headless=true -Xms512m -Xmx1536m \
--add-exports=java.desktop/sun.java2d.pipe=ALL-UNNAMED \
--add-exports=java.desktop/sun.java2d=ALL-UNNAMED \
--add-exports=java.base/sun.security.action=ALL-UNNAMED"

./startup.sh
```

GeoServer can take approximately one or two minutes to fully start.

Do not test immediately if the startup process has not completed.

Test:

```bash
curl -I http://localhost:8080/geoserver/
```

---

# 12. Stop GeoServer

Use:

```bash
cd /opt/geoserver/bin

export GEOSERVER_HOME=/opt/geoserver

export GEOSERVER_DATA_DIR=/home/ubuntu/geoserver_data_dir_unzip/GeoServer

./shutdown.sh
```

---

# 13. GeoServer CORS

GeoServer runs on Jetty.

The CORS configuration uses:

```text
org.eclipse.jetty.servlets.CrossOriginFilter
```

Do not enable the Tomcat CORS filter at the same time.

The relevant file is:

```text
/opt/geoserver/webapps/geoserver/WEB-INF/web.xml
```

The Jetty filter should be active:

```xml
<filter>
    <filter-name>cross-origin</filter-name>
    <filter-class>
        org.eclipse.jetty.servlets.CrossOriginFilter
    </filter-class>

    <init-param>
        <param-name>chainPreflight</param-name>
        <param-value>false</param-value>
    </init-param>

    <init-param>
        <param-name>allowedOrigins</param-name>
        <param-value>*</param-value>
    </init-param>

    <init-param>
        <param-name>allowedMethods</param-name>
        <param-value>
            GET,POST,PUT,DELETE,HEAD,OPTIONS
        </param-value>
    </init-param>

    <init-param>
        <param-name>allowedHeaders</param-name>
        <param-value>*</param-value>
    </init-param>
</filter>
```

And:

```xml
<filter-mapping>
    <filter-name>cross-origin</filter-name>
    <url-pattern>/*</url-pattern>
</filter-mapping>
```

Do not enable:

```text
org.apache.catalina.filters.CorsFilter
```

because the deployment uses Jetty, not Tomcat.

---

# 14. Test GeoServer WMS

Direct GeoServer test:

```bash
curl -I \
"http://localhost:8080/geoserver/traffic_gis/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities"
```

Expected:

```text
HTTP/1.1 200 OK
```

The traffic road layer is:

```text
traffic_gis:roads
```

The heatmap style uses:

```text
traffic_heatmap_style
```

The road styling is based on:

```text
vehicle_count
```

---

# 15. Frontend Production Configuration

The frontend uses centralized environment configuration.

Main configuration file:

```text
frontend/src/config/env.js
```

Production variables:

```text
frontend/.env.production
```

The production deployment uses same-origin URLs:

```env
VITE_API_URL=__ORIGIN__
VITE_SOCKET_URL=__ORIGIN__
VITE_GEOSERVER_URL=__ORIGIN__/geoserver
```

This allows the same frontend build to work using:

```text
http://192.168.1.30
```

as well as:

```text
https://xxxxx.trycloudflare.com
```

without rebuilding for each hostname.

---

# 16. Build Frontend

Install frontend dependencies:

```bash
cd ~/traffic-gis/frontend

npm install
```

Build:

```bash
npm run build
```

The production files are generated inside:

```text
frontend/dist/
```

---

# 17. Deploy Frontend to Nginx

The Nginx web root is:

```text
/var/www/traffic-gis
```

Copy the latest frontend build:

```bash
sudo mkdir -p /var/www/traffic-gis

sudo rm -rf /var/www/traffic-gis/*

sudo cp -a \
~/traffic-gis/frontend/dist/. \
/var/www/traffic-gis/
```

Verify:

```bash
ls -lah /var/www/traffic-gis
```

There should be:

```text
index.html
assets/
...
```

Nginx does not need to be restarted when only static files are replaced.

---

# 18. Nginx Installation

Install:

```bash
sudo apt update

sudo apt install nginx -y
```

Enable automatic startup:

```bash
sudo systemctl enable nginx
```

Start:

```bash
sudo systemctl start nginx
```

Check:

```bash
sudo systemctl status nginx --no-pager
```

---

# 19. Nginx Configuration

Configuration file:

```text
/etc/nginx/sites-available/traffic-gis
```

Current configuration:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name _;

    root /var/www/traffic-gis;
    index index.html;

    # Vue SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Node.js REST API
    location /api/ {
        proxy_pass http://127.0.0.1:5000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO / WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;

        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
    }

    # GeoServer
    location /geoserver/ {
        proxy_pass http://127.0.0.1:8080;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
    }
}
```

Enable:

```bash
sudo rm -f /etc/nginx/sites-enabled/default

sudo ln -s \
/etc/nginx/sites-available/traffic-gis \
/etc/nginx/sites-enabled/traffic-gis
```

Test configuration:

```bash
sudo nginx -t
```

Expected:

```text
syntax is ok
test is successful
```

Reload:

```bash
sudo systemctl reload nginx
```

---

# 20. Test Nginx

Frontend:

```bash
curl -I http://localhost
```

Expected:

```text
HTTP/1.1 200 OK
```

Backend through Nginx:

```bash
curl http://localhost/api/cameras
```

GeoServer through Nginx:

```bash
curl -I \
"http://localhost/geoserver/traffic_gis/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities"
```

Expected:

```text
HTTP/1.1 200 OK
```

---

# 21. Firewall

UFW is used so external clients access only Nginx.

Default policy:

```bash
sudo ufw default deny incoming

sudo ufw default allow outgoing
```

Allow SSH:

```bash
sudo ufw allow 22/tcp
```

Allow Nginx HTTP from LAN:

```bash
sudo ufw allow from 192.168.1.0/24 \
to any port 80 proto tcp
```

Enable firewall:

```bash
sudo ufw enable
```

Check:

```bash
sudo ufw status numbered
```

Ports `5000` and `8080` should not be directly exposed to LAN clients.

Internally, Nginx can still access:

```text
127.0.0.1:5000
127.0.0.1:8080
```

---

# 22. LAN Access

With VMware Bridged Networking, devices on the same LAN can access:

```text
http://192.168.1.30
```

The previous frontend port:

```text
4173
```

is no longer required.

The frontend is served directly by Nginx.

---

# 23. Cloudflare Tunnel

`cloudflared` is used to expose the application to the Internet without router port forwarding.

Install Cloudflare package repository:

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
```

```bash
curl -fsSL \
https://pkg.cloudflare.com/cloudflare-main.gpg \
| sudo tee \
/usr/share/keyrings/cloudflare-main.gpg \
>/dev/null
```

```bash
echo \
"deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
| sudo tee \
/etc/apt/sources.list.d/cloudflared.list
```

Update:

```bash
sudo apt-get update
```

Install:

```bash
sudo apt-get install cloudflared -y
```

Verify:

```bash
cloudflared --version
```

---

# 24. Start Public Cloudflare Quick Tunnel

After:

- MySQL is running
- backend is running
- GeoServer is running
- Nginx is running

start:

```bash
cloudflared tunnel --url http://localhost:80
```

Cloudflare generates an address similar to:

```text
https://random-name.trycloudflare.com
```

Example:

```text
https://motorola-tariff-nominated-ordering.trycloudflare.com
```

The URL changes whenever a new Quick Tunnel is created.

The terminal running `cloudflared` must stay open.

---

# 25. No Router Port Forwarding Required

Cloudflare Tunnel creates an outbound connection from Ubuntu to Cloudflare.

Therefore the router does not need:

```text
Port forwarding
Public IPv4
Static WAN IP
```

The flow is:

```text
Internet User
      │
      ▼
Cloudflare
      │
      ▼
Outbound Tunnel
      │
      ▼
Ubuntu VM
      │
      ▼
Nginx :80
```

---

# 26. Starting the Entire System

After booting the Ubuntu VM, start the services in the following order.

## Terminal 1 — GeoServer

```bash
cd /opt/geoserver/bin

export GEOSERVER_HOME=/opt/geoserver

export GEOSERVER_DATA_DIR=/home/ubuntu/geoserver_data_dir_unzip/GeoServer

export JAVA_OPTS="-Djava.awt.headless=true -Xms512m -Xmx1536m \
--add-exports=java.desktop/sun.java2d.pipe=ALL-UNNAMED \
--add-exports=java.desktop/sun.java2d=ALL-UNNAMED \
--add-exports=java.base/sun.security.action=ALL-UNNAMED"

./startup.sh
```

---

## Terminal 2 — Backend

```bash
cd ~/traffic-gis

source .venv/bin/activate

cd backend

npm start
```

---

## Frontend / Nginx

The frontend is served by Nginx.

Verify Nginx:

```bash
sudo systemctl status nginx --no-pager
```

If necessary:

```bash
sudo systemctl start nginx
```

LAN URL:

```text
http://192.168.1.30
```

---

## Terminal 3 — Cloudflare

```bash
cloudflared tunnel --url http://localhost:80
```

Keep this terminal open.

# 27. Quick Startup Checklist

Check services:

```bash
sudo systemctl status mysql --no-pager
```

```bash
sudo systemctl status nginx --no-pager
```

Check open ports:

```bash
sudo ss -ltnp | grep -E '80|5000|8080|3306'
```

Expected internal services:

```text
:80       Nginx
:5000     Node.js
:8080     GeoServer
127.0.0.1:3306 MySQL
```

Test application:

```bash
curl -I http://localhost
```

```bash
curl http://localhost/api/cameras
```

```bash
curl -I \
"http://localhost/geoserver/traffic_gis/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities"
```

---

# 28. Updating Frontend Code

After modifying frontend source:

```bash
cd ~/traffic-gis/frontend

npm run build
```

Deploy the build:

```bash
sudo rm -rf /var/www/traffic-gis/*

sudo cp -a \
dist/. \
/var/www/traffic-gis/
```

Refresh the browser.

Nginx restart is normally unnecessary.

---

# 29. Updating Backend / YOLO Code

Pull the latest deployment branch:

```bash
cd ~/traffic-gis

git switch deployment-vm

git pull
```

Then restart the backend process.

Because the backend spawns Python scripts, always activate:

```bash
source ~/traffic-gis/.venv/bin/activate
```

before:

```bash
cd ~/traffic-gis/backend

npm start
```

---

# 30. Useful Git Commands

Current branch:

```bash
git branch
```

Switch to deployment version:

```bash
git switch deployment-vm
```

Check changes:

```bash
git status
```

Commit:

```bash
git add -A

git commit -m "Update Ubuntu deployment"
```

Push:

```bash
git push
```

---

# 31. Important Difference Between `main` and `deployment-vm`

The repository contains separate branches.

```text
main
│
└── original / development version

deployment-vm
│
└── Ubuntu VMware deployment version
```

The deployment branch contains changes specifically intended for:

```text
Ubuntu
Nginx
Cloudflare
CPU fallback
production environment
```

Do not merge into `main` unless the deployment changes are intentionally required there.

---

# 32. Troubleshooting

## GeoServer WFS works but WMS is blank

Check GeoServer logs:

```bash
tail -n 150 \
~/geoserver_data_dir_unzip/GeoServer/logs/geoserver.log
```

If the error mentions:

```text
sun.java2d.pipe.RenderingEngine
```

restart GeoServer using the required `JAVA_OPTS`.

---

## GeoServer returns 503

First wait for GeoServer to finish startup.

GeoServer may take around one to two minutes.

Check logs:

```bash
tail -f \
~/geoserver_data_dir_unzip/GeoServer/logs/geoserver.log
```

---

## CORS error

Check:

```bash
curl -I \
-H "Origin: http://192.168.1.30" \
"http://localhost:8080/geoserver/traffic_gis/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities"
```

The response should contain an appropriate:

```text
Access-Control-Allow-Origin
```

header.

---

## Backend works but vehicle count remains 0

The counter does not simply count all vehicles visible in one frame.

It tracks vehicles and counts vehicles crossing the configured counting line.

The result is emitted approximately once every 60 seconds.

Verify:

```text
Camera stream
→ OpenCV
→ YOLO
→ BoT-SORT
→ line crossing
→ cars_per_minute
→ backend
→ database
→ Socket.IO
→ frontend
```

---

## Bird's Eye Simulation reports CUDA error

Verify:

```bash
source ~/traffic-gis/.venv/bin/activate

python -c \
"import torch; print(torch.cuda.is_available())"
```

The deployment version automatically uses CPU when CUDA is unavailable.

---

## Nginx returns 502 Bad Gateway

Check backend:

```bash
curl http://127.0.0.1:5000/api/cameras
```

Check GeoServer:

```bash
curl -I http://127.0.0.1:8080/geoserver/
```

If either fails, start the corresponding service.

---

## LAN clients cannot connect

Verify VM IP:

```bash
hostname -I
```

Verify Nginx:

```bash
sudo ss -ltnp | grep ':80'
```

Verify firewall:

```bash
sudo ufw status numbered
```

VMware should use:

```text
Bridged Network Adapter
```

---

## Cloudflare URL stops working

Quick Tunnel only works while:

```bash
cloudflared tunnel --url http://localhost:80
```

is running.

After stopping the command or rebooting the VM, start it again.

A new `trycloudflare.com` URL will normally be generated.

---

# 33. Security Notes

This branch is designed primarily for project deployment and demonstration.

Files such as:

```text
backend/.env
frontend/.env.production
GeoServer configuration files
```

may contain deployment configuration.

If this repository is public, do not store real production passwords, API keys, tokens, or other sensitive credentials.

For a production deployment, secrets should be stored outside Git.

---

# 34. Current Deployment Summary

Working components:

```text
Vue frontend               ✅
Node.js backend             ✅
MySQL                       ✅
GeoServer                   ✅
WMS                         ✅
WFS                         ✅
Traffic heatmap             ✅
YOLO vehicle detection      ✅
Vehicle tracking            ✅
CPU execution               ✅
GPU execution               ✅
Bird's Eye simulation       ✅
Socket.IO realtime          ✅
Nginx                       ✅
LAN access                  ✅
Cloudflare public access    ✅
```

---

# 35. Final Runtime Layout

```text
/home/ubuntu/
│
├── traffic-gis/
│   │
│   ├── backend/
│   │    └── Node.js / Express
│   │
│   ├── frontend/
│   │    └── Vue 3
│   │
│   ├── YOLO/
│   │    └── Python / Ultralytics
│   │
│   └── requirements-vm.txt
│
├── geoserver_data_dir_unzip/
│   └── GeoServer/
│
└── ...

/opt/
└── geoserver/

/var/www/
└── traffic-gis/

/etc/nginx/
└── sites-available/
    └── traffic-gis
```

---

# 36. Minimal Restore Procedure

For a fresh Ubuntu VM:

```text
1. Install Git
2. Install Node.js / npm
3. Install Python 3 + venv
4. Install Java 17
5. Install MySQL
6. Install GeoServer into /opt/geoserver
7. Clone PBL3-GIS-APP deployment-vm branch
8. Clone GeoServer data repository
9. Create Python .venv
10. Install requirements-vm.txt
11. npm install backend
12. npm install + build frontend
13. Copy frontend/dist to /var/www/traffic-gis
14. Install/configure Nginx
15. Start MySQL
16. Start backend
17. Start GeoServer
18. Test LAN
19. Start Cloudflare Tunnel
20. Test using mobile data / external Internet
```

After these steps, the system should have the same directory structure and deployment architecture as the original VMware environment.

---

## Repository

Main application:

```text
https://github.com/NguyenXuanKhangDUT/PBL3-GIS-APP
```

Deployment branch:

```text
deployment-vm
```

GeoServer data directory:

```text
PBL3-GIS-GEOSERVER-DATA
```
