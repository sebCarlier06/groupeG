const mqtt = require('mqtt');

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';

let io = null;

const client = mqtt.connect(MQTT_URL);

client.on('connect', () => {
  console.log('Connecté au broker MQTT');
  client.subscribe('game/button/press', (err) => {
    if (err) console.error('Erreur subscribe MQTT:', err);
    else console.log('Abonné à game/button/press');
  });
});

client.on('message', (topic, message) => {
  const payload = message.toString();
  console.log(`MQTT [${topic}]: ${payload}`);

  if (topic === 'game/button/press') {
    try {
      const db = require('./db');
      db.prepare('INSERT INTO button_events (event_type) VALUES (?)').run('button_press');
    } catch (e) {
      console.error('Erreur DB:', e.message);
    }
    if (io) io.emit('button_press', { timestamp: Date.now() });
  }
});

client.on('error', (err) => {
  console.error('Erreur MQTT:', err.message);
});

function setSocketIo(socketInstance) {
  io = socketInstance;
}

function sendCommand(command) {
  client.publish('game/led/command', command);
}

module.exports = { client, setSocketIo, sendCommand };
