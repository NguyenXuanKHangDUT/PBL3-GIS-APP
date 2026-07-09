import fs from 'fs';
import pool from './src/config/db.js';

const seedDatabase = async () => {
    try {
        const rawData = fs.readFileSync('./data.json', 'utf8');
        const geojson = JSON.parse(rawData);

        console.log(`Preparing to import ${geojson.features.length} road segments into MySQL...`); // english

        for (const feature of geojson.features) {
            const id = feature.id; 
            const name = feature.properties.name || 'Unknown Name';
            const type = feature.properties.highway || 'unclassified';
            
            const geometryString = JSON.stringify(feature.geometry);

            await pool.query(
                `REPLACE INTO roads (id, name, type, geojson_data) VALUES (?, ?, ?, ?)`,
                [id, name, type, geometryString]
            );
        }

        console.log('✅ Import GIS data completed successfully.'); // english
        process.exit(0);
        
    } catch (error) {
        console.error('❌ An error occurred:', error.message);
        process.exit(1);
    }
};

seedDatabase();