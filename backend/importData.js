import fs from 'fs';
import pool from './src/config/db.js';

const seedDatabase = async () => {
    try {
        const rawData = fs.readFileSync('./data.json', 'utf8');
        const geojson = JSON.parse(rawData);

        console.log(`Đang chuẩn bị nạp ${geojson.features.length} đoạn đường vào MySQL...`);

        for (const feature of geojson.features) {
            const id = feature.id; 
            const name = feature.properties.name || 'Chưa rõ tên';
            const type = feature.properties.highway || 'unclassified';
            
            const geometryString = JSON.stringify(feature.geometry);

            await pool.query(
                `REPLACE INTO roads (id, name, type, geojson_data) VALUES (?, ?, ?, ?)`,
                [id, name, type, geometryString]
            );
        }

        console.log('✅ Import dữ liệu GIS thành công');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Có lỗi xảy ra:', error.message);
        process.exit(1);
    }
};

seedDatabase();