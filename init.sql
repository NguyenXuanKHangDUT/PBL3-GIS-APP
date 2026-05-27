CREATE DATABASE IF NOT EXISTS mygis;
USE mygis;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin'
);

CREATE TABLE roads (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),
    geojson_data JSON NOT NULL
);

CREATE TABLE cameras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    road_id VARCHAR(50),
    name VARCHAR(100),
    lng DECIMAL(11, 8) NOT NULL,
    lat DECIMAL(10, 8) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    FOREIGN KEY (road_id) REFERENCES roads(id) ON DELETE SET NULL
);

CREATE TABLE traffic_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    road_id VARCHAR(50),
    vehicle_count INT NOT NULL,
    density_level VARCHAR(20),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (road_id) REFERENCES roads(id) ON DELETE CASCADE
);

INSERT INTO users (username, password, role) VALUES ('admin', 'admin', 'admin');