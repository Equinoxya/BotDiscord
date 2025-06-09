const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    birthdayChannelId: { type: String, required: true }
});

exports.Config = mongoose.model('Config', configSchema);