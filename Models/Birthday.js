const mongoose = require('mongoose');

const birthdaySchema = new mongoose.Schema({
    userId: {type: String, required: true, unique: true},
    birthday: {type: Date, required: true},
    guildId: {type: String, required: true}
});

exports.Birthday = mongoose.model('Birthday', birthdaySchema);
// This code defines a Mongoose schema for a Birthday model, which includes a userId and a birthday date.
// The userId is unique, meaning each user can only have one birthday entry in the database.
// The guildId is also included to associate the birthday with a specific guild, allowing for multi-guild support.