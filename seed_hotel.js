const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./pos_data.db');

db.serialize(() => {
    db.run("INSERT OR IGNORE INTO hotel_rooms (id, room_number, room_type, price_per_night, capacity, status) VALUES (1, '101', 'Standard', 15000.00, 2, 'Available')");
    db.run("INSERT OR IGNORE INTO hotel_rooms (id, room_number, room_type, price_per_night, capacity, status) VALUES (2, '102', 'Deluxe', 25000.00, 2, 'Available')");
    db.run("INSERT OR IGNORE INTO hotel_rooms (id, room_number, room_type, price_per_night, capacity, status) VALUES (3, '201', 'Suite', 50000.00, 4, 'Available')");
    db.run("INSERT OR IGNORE INTO hotel_rooms (id, room_number, room_type, price_per_night, capacity, status) VALUES (4, '202', 'Family', 35000.00, 4, 'Available')");
    console.log("Seeded hotel_rooms master data");
});
