const mqtt = require("mqtt");

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";

const client = mqtt.connect(MQTT_URL);

client.on("connect", () => {
  console.log("Connected to MQTT broker");

  client.subscribe("game/button/press", (err) => {
    if (err) {
      console.error("MQTT subscribe error:", err);
    } else {
      console.log("Subscribed to game/button/press");
    }
  });
});

client.on("message", (topic, message) => {
  console.log(`MQTT message on ${topic}: ${message.toString()}`);
});

module.exports = client;